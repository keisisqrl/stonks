// WARNING: Do not manually modify this file. It was generated using:
// https://github.com/dillonkearns/elm-typescript-interop
// Type definitions for Elm ports

export namespace Elm {
  namespace Main {
    export interface App {
      ports: {
        saveLast: {
          subscribe(callback: (data: string) => void): void
        }
        apiUpdate: {
          send(data: string): void
        }
      };
    }
    export function init(options: {
      node?: HTMLElement | null;
      flags: {
        lastSymbol: string | null,
        images: {
          stonks: string,
          notStonks: string
        }
      };
    }): Elm.Main.App;
  }
}
