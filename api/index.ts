import AlphaVantage from "alphavantage-ts";
import { NowRequest, NowResponse } from '@now/node';
import moment from 'moment-timezone';
import nacl from 'tweetnacl';
import b64 from 'base64-js';
import {TextEncoder, TextDecoder} from 'util';

const alpha = new AlphaVantage(process.env.AV_API_KEY);
const etag_key: Uint8Array = b64.toByteArray(process.env.ETAG_KEY);

export default function(req: NowRequest, res: NowResponse) {
  const {symbol = "DJIA"} = req.query;
  if (symbol.length > 4) {
    res.status(400).send(null);
    return;
  }
  const match_tag: string|null = req.headers['if-none-match'];
  const last_fetch: number = Date.parse(req.headers['if-modified-since']);
  if (match_tag) {
    if (check_etag(match_tag)) {
      res.setHeader("etag",match_tag);
      res.status(304).send(null);
      return;
    }
  } else if (last_fetch) {
    if (check_date(last_fetch)) {
      add_etag(res, last_fetch);
      res.status(304).send(null);
      return;
    }
  }

  alpha.stocks.quote((symbol as string), {datatype: "json"})
  .then((av_resp) => {
      let symbol: string = av_resp['Global Quote']['01. symbol'];
      let change: string = av_resp['Global Quote']['09. change'];
      add_etag(res, Date.now());
      res.setHeader("cache-control", "s-maxage=2700");
      res.status(200).json({
        symbol: symbol,
        change: change
      });

  }).catch((_) => {
    console.log("ERROR! api limit exceeded");
    res.setHeader("retry-after", "120");
    res.status(429).send(null);
  });
}

function add_etag(res: NowResponse, timestamp: number): void {
  const encoder: TextEncoder = new TextEncoder();
  let nonce: Uint8Array = nacl.randomBytes(nacl.secretbox.nonceLength);
  let crypted: Uint8Array = nacl.secretbox(
    encoder.encode(timestamp.toString()),nonce,etag_key
  )
  let tag: Uint8Array = new Uint8Array(crypted.length + nonce.length);
  tag.set(nonce,0);
  tag.set(crypted,nonce.length);
  let tagString: string = b64.fromByteArray(tag);
  res.setHeader("etag",'"' + tagString + '"')
}

function check_etag(match_tag: string): boolean {
  const decoder: TextDecoder = new TextDecoder();
  let tagString: string = match_tag.replace(/"/g,'')
  let tag: Uint8Array = b64.toByteArray(tagString);
  let nonce: Uint8Array = tag.slice(0,nacl.secretbox.nonceLength);
  let crypted: Uint8Array = tag.slice(nacl.secretbox.nonceLength);
  let decrypted: Uint8Array = nacl.secretbox.open(crypted,nonce,etag_key);
  let timestamp: number = parseInt(decoder.decode(decrypted));
  return check_date(timestamp);
}

function check_date(timestamp: number): boolean {
  if ( no_update(timestamp) ) {
    return true;
  } else {
    return false;
  }
}

function in_weekend(timestamp = Date.now()): boolean {
  let day: number = moment(timestamp).tz('America/New_York').day();
  if (day == 0 || day == 6) return true;
  else return false;
}

function outside_business_hours(timestamp = Date.now()): boolean {
  let market_time: moment.Moment = moment(timestamp).tz('America/New_York');
  let minute: number = market_time.minute();
  let hour: number = market_time.hour();
  if (hour < 9 || hour > 16 || (hour == 9 && minute < 30)) {
    return true;
  } else {
    return false;
  }
}

function no_update(timestamp: number) {
  return (
    ((in_weekend(timestamp) || outside_business_hours(timestamp))
    && (in_weekend() || outside_business_hours())
    && (Date.now() - timestamp < 24*60*60*1000))
    || Date.now() - timestamp < 45*60*1000
  );
}
