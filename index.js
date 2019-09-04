import { Elm } from './src/Main.elm';
import stonksImg from './stonks.jpg';
import notStonksImg from './not-stonks.jpg';
import html from './index.html';

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
  console.log(e);
  if (e.data.type === 'CACHE_UPDATED') {
    console.log(e.data.payload.updatedURL);
  }
}

// Check that service workers are supported and register SW
if ('serviceWorker' in navigator) {
  // Use the window load event to keep the page load performant
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
  if ('BroadcastChannel' in window) {
    const sub = new BroadcastChannel('stonksSWUpdate');
    sub.onmessage = swMessage;
  } else {
    navigator.serviceWorker
    .addEventListener('message',swMessage);
  }
}
