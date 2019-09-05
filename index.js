import { Elm } from './src/Main.elm';
import stonksImg from './assets/images/stonks.jpg';
import notStonksImg from './assets/images/not-stonks.jpg';

const stonkKey = 'lastStonk';

// recover last retrieved symbol from localStorage

var lastSymbol = localStorage.getItem(stonkKey);

var app = Elm.Main.init({
  node: document.querySelector('main'),
  flags: {
    lastSymbol: lastSymbol,
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

function swMessage(e) {
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
