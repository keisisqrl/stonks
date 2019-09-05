module Stonks.Util exposing (extractSymbolFromUrl)

import Url exposing (Url)
import Url.Parser exposing ((</>), Parser, parse, s, string)


extractSymbolFromUrl : Url -> Maybe String
extractSymbolFromUrl url =
    parse extractor url


extractor : Parser (String -> a) a
extractor =
    s ".api" </> string
