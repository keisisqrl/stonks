import { Elm } from './src/Main';
import stonksImg from './assets/images/stonks.jpg';
import notStonksImg from './assets/images/not-stonks.jpg';
import {Maybe} from './lib/maybe';

const stonkKey = 'lastStonk';

// recover last retrieved symbol from localStorage

var lastSymbol: Maybe<string> =
  Maybe.from(localStorage.getItem(stonkKey));

console.log(JSON.stringify({
  lastSymbol: lastSymbol
}))

var app = Elm.Main.init({
  node: document.querySelector('main'),
  flags: {
    lastSymbol: lastSymbol.toJSON(),
    images: {
      stonks: stonksImg,
      notStonks: notStonksImg
    }
  }
});

// register to save last retrieved stock symbol

app.ports.saveLast.subscribe((stonk) => {
  localStorage.setItem(stonkKey, stonk)
});

function swMessage(e: MessageEvent) {
  if (e.data.type === 'CACHE_UPDATED'
      && e.data.payload.updatedURL.includes('.api')) {
    app.ports.apiUpdate.send(e.data.payload.updatedURL);
  }
}

// Check that service workers are supported and register SW
if ('serviceWorker' in navigator) {
  // Use the window load event to keep the page load performant
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
  if ('BroadcastChannel' in window) {
    const sub = new BroadcastChannel('stonksAPIUpdate');
    sub.onmessage = swMessage;
  } else {
    navigator.serviceWorker
    .addEventListener('message',swMessage);
  }
}
