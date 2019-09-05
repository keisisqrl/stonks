port module Stonks.Ports exposing (apiUpdate, apiUpdateSymbol, saveLast)

import Stonks.Util exposing (extractSymbolFromUrl)
import Url


port saveLast : String -> Cmd msg


port apiUpdate : (String -> msg) -> Sub msg


apiUpdateSymbol : String -> Maybe String
apiUpdateSymbol updatedURL =
    Url.fromString updatedURL
        |> Maybe.andThen extractSymbolFromUrl
