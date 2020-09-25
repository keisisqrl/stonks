import AlphaVantage from "alphavantage-ts";
import { NowRequest, NowResponse } from '@now/node';
import moment from 'moment-timezone';
import nacl from 'tweetnacl';
import b64 from 'base64-js';
import {TextEncoder, TextDecoder} from 'util';
import {Option} from 'tsoption';
var winston = require('winston');

require('winston-papertrail').Papertrail;

const winstonPapertrail = new winston.transports.Papertrail({
  host: process.env.LOG_HOST,
  port: process.env.LOG_PORT,
  program: "stonks",
  hostname: "stonks.today"
});

const winstonConsole = new winston.transports.Console();

const logger = new winston.Logger({
  transports: [
    winstonPapertrail,
    winstonConsole
  ]
})

interface ResponseObject {
  symbol: string,
  isStonks: Boolean
}

interface EtagContents {
  ts: number,
  resp: ResponseObject
}

// Configuration - AlphaVantage API key and etag crypto key from secrets/env

const alpha = new AlphaVantage(process.env.AV_API_KEY);
const etag_key: Uint8Array = b64.toByteArray(process.env.ETAG_KEY);

// Minutes for a response to expire

const exprMinutes: number = 45;

export default function(req: NowRequest, res: NowResponse) {
  const symbol: string =
    Option.of(<string>req.query.symbol).getOrElse('DJIA');
  if (symbol.length > 4) {
    logger.info("symbol " + symbol + " too long!");
    res.status(400).send(null);
    return;
  }

  logger.info("request for symbol: " + symbol +
    " id " + req.headers['x-vercel-id']);

  if (symbol.toUpperCase() != symbol) {
      logger.info("redirect to upper-case");
      res.setHeader("Location",
        req.headers['x-forwarded-proto'] + "://" +
        req.headers['host'] + ['/.api/'] +
        symbol.toUpperCase());
      res.setHeader("Cache-Control", "max-age=86400, immutable")
      res.status(301).send(null);
      return;
  }

  const match_tag: Option<string> = Option.of(req.headers['if-none-match']);
  const last_fetch: Option<number> =
    Option.of(Date.parse(req.headers['if-modified-since']));
  if (match_tag.nonEmpty()) {
    let matched: boolean = false;
    let etag: EtagContents;
    try {
     [matched, etag] = check_etag(match_tag.get());
    } catch (error) {
      logger.info("Error checking etag: " + error);
    }
    if (matched) {
      logger.info(`Matched etag for ${symbol}, populating cache`);
      add_cache_control(res, etag.ts);
      res.setHeader("ETag",match_tag.get());
      res.status(200).json(etag.resp);
      return;
    } else {
      logger.info(`Expired etag for ${symbol}`);
    }
  } else if (last_fetch.nonEmpty()) {
    if (no_update(last_fetch.get())) {
      logger.info("No need to update per timestamp");
      res.status(304).send(null);
      return;
    }
  }

  alpha.stocks.quote(symbol, {datatype: "json"})
  .then((av_resp) => {
      let symbol: string = av_resp['Global Quote']['01. symbol'];
      let change: string = av_resp['Global Quote']['09. change'];
      let isStonks: boolean = parseFloat(change) > 0;
      logger.info("Got response for " + symbol);
      let respPayload: ResponseObject = {
        symbol: symbol,
        isStonks: isStonks
      };
      add_etag(res, Date.now(), respPayload);
      add_cache_control(res);
      res.status(200).json(respPayload);

  }).catch((err) => {
    if (err.includes("frequency")) {
      logger.info("ERROR! api limit exceeded");
      res.setHeader("retry-after", "120");
      res.status(429).send(null);
    } else {
      logger.info("Unknown error: " + err);
      res.status(500).send(null);
    }
  });
}

function add_etag(res: NowResponse, timestamp: number, resp: ResponseObject): void {
  const encoder: TextEncoder = new TextEncoder();
  let contents: EtagContents = {
    ts: timestamp,
    resp: resp
  };
  let nonce: Uint8Array = nacl.randomBytes(nacl.secretbox.nonceLength);
  let crypted: Uint8Array = nacl.secretbox(
    encoder.encode(JSON.stringify(contents)),nonce,etag_key
  )
  let tag: Uint8Array = new Uint8Array(crypted.length + nonce.length);
  tag.set(nonce,0);
  tag.set(crypted,nonce.length);
  let tagString: string = b64.fromByteArray(tag);
  res.setHeader("etag",'"' + tagString + '"')
}

function add_cache_control(res: NowResponse, timestamp = Date.now()): void {
  let cacheTime: number = calculate_cache_time(timestamp);
  logger.info("Caching for: " + cacheTime + " seconds");
  res.setHeader("cache-control", "s-maxage=" + cacheTime);
}

function check_etag(match_tag: string): [boolean, EtagContents] {
  const decoder: TextDecoder = new TextDecoder();
  let tagString: string = match_tag.replace(/"/g,'');
  let tag: Uint8Array;
  try {
    tag = b64.toByteArray(tagString);
  } catch (error) {
    throw "Bad etag base64: " + error;
  }
  if (tag.byteLength < nacl.secretbox.nonceLength) {
    throw "Bad etag: too short!"
  }
  let nonce: Uint8Array = tag.slice(0,nacl.secretbox.nonceLength);
  let crypted: Uint8Array = tag.slice(nacl.secretbox.nonceLength);
  let decrypted: Uint8Array|null = nacl.secretbox.open(crypted,nonce,etag_key);
  if (decrypted == null) {
    throw "Failed to decrypt etag! Did etag key change?"
  }
  let contents: EtagContents;
  try {
    contents = JSON.parse(decoder.decode(decrypted))
  } catch (error) {
    throw "Bad etag payload: " + error;
  }
  return [no_update(contents.ts), contents];
}

function calculate_cache_time(timestamp: number): number {
  let targetTime: moment.Moment = moment(timestamp).tz('America/New_York');
  if (in_weekend(targetTime)) {
    switch (targetTime.day()) {
      case 0:
        targetTime.day(1);
      case 6:
        targetTime.day(8);
    }
    targetTime.hour(9);
    targetTime.minute(30);
  } else if (outside_business_hours(targetTime)) {
    if (targetTime.hour() > 15) {
      targetTime.hour(33);
    } else {
      targetTime.hour(9);
    }
    targetTime.minute(30);
  } else {
    targetTime.add({
      minutes: exprMinutes
    });
  }
  return targetTime.unix() - moment().unix();
}

function in_weekend(market_time: moment.Moment): boolean {
  let day: number = market_time.day();
  if (day == 0 || day == 6) return true;
  else return false;
}

function outside_business_hours(market_time: moment.Moment): boolean {
  let minute: number = market_time.minute();
  let hour: number = market_time.hour();
  if (hour < 9 || hour > 15 || (hour == 9 && minute < 30)) {
    return true;
  } else {
    return false;
  }
}

function no_update(timestamp: number): boolean {
  return moment(timestamp).add({
      seconds: calculate_cache_time(timestamp)
    }).isAfter();
}
