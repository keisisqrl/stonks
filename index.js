import { Elm } from './src/Main.elm';
import stonksImg from './stonks.jpg';
import notStonksImg from './not-stonks.jpg';
import html from './index.html';

const stonkKey = 'lastStonk';

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

app.ports.saveLast.subscribe((stonk) => {
  localStorage.setItem(stonkKey, stonk)
});
