import { Elm } from './src/Main.elm';

const stonkKey = 'lastStonk';

var lastSymbol = localStorage.getItem(stonkKey);

var app = Elm.Main.init({
  node: document.querySelector('main'),
  flags: {
    lastSymbol: lastSymbol
  }
});

app.ports.saveLast.subscribe((stonk) => {
  localStorage.setItem(stonkKey, stonk)
});
