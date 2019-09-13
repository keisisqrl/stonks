import {Elm} from './src/Main';
import { NowRequest, NowResponse } from '@now/node';
const uuidv4 = require('uuid/v4');

interface ReqStore {
  [idx: string]: (value: string) => void;
}

interface ElmResp {
  id: string,
  response: string
}

const app = Elm.Main.init(null);

var requests: ReqStore = {};

function handleResponse({id: reqId, response}: ElmResp) {
  let res: ((_: string) => void) = requests[reqId];
  if (Object.keys(requests).length > 1) console.log(requests);
  delete(requests[reqId]);
  res(response);
}

app.ports.returnToTs.subscribe(handleResponse);

export default function(_req: NowRequest, res: NowResponse)
                        : Promise<NowResponse>{
  let reqId: string = uuidv4();
  return new Promise(
    (resolve, reject) => {
      requests[reqId] = resolve;
      setTimeout(() => reject("Request timed out"), 2000);
      app.ports.getTheThing.send(reqId);
    })
    .then((response: string) => {
      return res.status(200).send(response)})
    .catch((error: string) => {
      console.log(error);
      return res.status(500).send(error)});
}
