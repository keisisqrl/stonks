port module Main exposing (main)

import Bool.Extra exposing (ifElse, toMaybe)
import Browser exposing (Document, application, document)
import Browser.Navigation as Navigation
import Cmd.Extra exposing (withCmd, withNoCmd)
import Element
    exposing
        ( Element
        , centerX
        , column
        , el
        , fill
        , image
        , layout
        , padding
        , px
        , row
        , spacing
        , text
        , width
        )
import Element.Background as Background
import Element.Border as Border
import Element.Font as Font
import Element.Input as Input
import Html exposing (Html)
import Html.Attributes exposing (style)
import Http
import Json.Decode as D
import Maybe.Extra as Maybe
import Process
import RemoteData exposing (RemoteData(..), WebData)
import RemoteData.Http as RDHttp
import Task
import Update.Extra exposing (addCmd, updateModel)
import Url exposing (Url)
import Url.Builder
import Url.Parser as Parser exposing (Parser)


port saveLast : String -> Cmd msg


main : Program D.Value Model Msg
main =
    application
        { init = init
        , view = docView
        , update = update
        , subscriptions = \_ -> Sub.none
        , onUrlChange = UrlChange
        , onUrlRequest = UrlRequest
        }


type alias Model =
    { symbol : String
    , isStonks : WebData StonksResponse
    , key : Navigation.Key
    , images : ImageUrls
    }


type alias Flags =
    { lastSymbol : Maybe String
    , images : ImageUrls
    }


type alias ImageUrls =
    { stonks : String
    , notStonks : String
    }


defaultSymbol : String
defaultSymbol =
    "DJIA"


init : D.Value -> Url -> Navigation.Key -> ( Model, Cmd Msg )
init jsonFlags url key =
    let
        flags =
            D.decodeValue decodeFlags jsonFlags
                |> Result.toMaybe
                |> Maybe.withDefault
                    (Flags
                        Nothing
                        (ImageUrls "/stonks.jpg" "/not-stonks.jpg")
                    )

        symbol =
            initSymbol url flags.lastSymbol

        model =
            Model
                symbol
                Loading
                key
                flags.images
    in
    ( model
    , callStonksApi symbol
    )


initSymbol : Url -> Maybe String -> String
initSymbol url lastSymbol =
    let
        urlSymbol =
            Parser.parse Parser.string url

        fallback =
            defaultSymbol
    in
    Maybe.or urlSymbol lastSymbol
        |> Maybe.withDefault defaultSymbol


type alias StonksResponse =
    { symbol : String
    , isStonks : Bool
    }


type Msg
    = TextInput String
    | StonksApiResponse (WebData StonksResponse)
    | GetStonks
    | UrlChange Url
    | UrlRequest Browser.UrlRequest
    | SetNotAsked ()


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        TextInput symbol ->
            (if String.length symbol < 5 then
                { model | symbol = symbol }

             else
                model
            )
                |> withNoCmd

        StonksApiResponse response ->
            let
                changeUrl =
                    changeUrlIfSuccess model.key
            in
            { model | isStonks = response }
                |> withNoCmd
                |> updateModel updateFromResponse
                |> addCmd (changeUrl response)
                |> addCmd (reEnableIf429 response)
                |> addCmd (saveLastOnSuccess response)

        GetStonks ->
            { model | isStonks = Loading }
                |> withCmd (callStonksApi model.symbol)

        UrlRequest urlreq ->
            case urlreq of
                Browser.Internal url ->
                    model
                        |> withCmd
                            (Navigation.pushUrl
                                model.key
                                (Url.toString url)
                            )

                Browser.External url ->
                    model
                        |> withCmd (Navigation.load url)

        SetNotAsked _ ->
            { model | isStonks = NotAsked }
                |> withNoCmd

        _ ->
            withNoCmd model


updateFromResponse : Model -> Model
updateFromResponse model =
    { model
        | symbol =
            RemoteData.unwrap
                model.symbol
                (\a -> a.symbol)
                model.isStonks
    }


saveLastOnSuccess : WebData StonksResponse -> Cmd Msg
saveLastOnSuccess response =
    RemoteData.map
        (\sResp ->
            saveLast sResp.symbol
        )
        response
        |> RemoteData.withDefault Cmd.none


changeUrlIfSuccess :
    Navigation.Key
    -> WebData StonksResponse
    -> Cmd Msg
changeUrlIfSuccess key response =
    RemoteData.map
        (\a ->
            Navigation.pushUrl key
                (Url.Builder.absolute [ a.symbol ] [])
        )
        response
        |> RemoteData.withDefault Cmd.none


docView : Model -> Browser.Document Msg
docView model =
    { body = [ view model ]
    , title = getMessage model
    }


reEnableIf429 : WebData e -> Cmd Msg
reEnableIf429 response =
    RemoteData.mapError is429 response
        |> defaultError False
        |> ifElse
            (Process.sleep 60000
                |> Task.perform SetNotAsked
            )
            Cmd.none


view : Model -> Html Msg
view model =
    column [ centerX, Element.spaceEvenly ]
        [ row [ centerX ]
            [ inputColumn model
            ]
        , row [] [ stonksImage model ]
        ]
        |> Element.layout []


inputColumn : Model -> Element Msg
inputColumn model =
    let
        isLimited =
            RemoteData.mapError is429 model.isStonks
                |> defaultError False

        btnConfig =
            { onPress =
                toMaybe GetStonks (not isLimited)
            , label =
                text (ifElse "Please wait..." "Check" isLimited)
            }

        btnTextColor =
            Font.color
                (ifElse
                    (Element.rgb255 119 119 119)
                    (Element.rgb255 0 0 0)
                    isLimited
                )
    in
    column [ centerX, padding 5, spacing 5 ]
        [ row []
            [ text "Is "
            , Input.text
                [ Border.widthEach { bottom = 1, top = 0, left = 0, right = 0 }
                , inputwidth
                , Border.rounded 0
                , Font.center
                , padding 1
                ]
                { text = model.symbol
                , onChange = TextInput
                , placeholder = Nothing
                , label =
                    Input.labelHidden "Symbol"
                }
            , text " stonks?"
            ]
        , row [ centerX ]
            [ Input.button
                [ Border.width 1
                , Background.color (Element.rgb255 238 238 238)
                , padding 3
                , btnTextColor
                ]
                btnConfig
            ]
        ]


stonksImage : Model -> Element Msg
stonksImage model =
    let
        message =
            getMessage model
    in
    case model.isStonks of
        NotAsked ->
            text message

        Loading ->
            text message

        Success response ->
            let
                imgUrl =
                    if response.isStonks then
                        model.images.stonks

                    else
                        model.images.notStonks
            in
            image [ width fill ] { src = imgUrl, description = message }

        Failure _ ->
            text message


apiEndpoint : String -> String
apiEndpoint symbol =
    Url.Builder.absolute
        [ ".api"
        , String.toUpper symbol
        ]
        []


callStonksApi : String -> Cmd Msg
callStonksApi symbol =
    RDHttp.getWithConfig
        RDHttp.defaultConfig
        (apiEndpoint symbol)
        StonksApiResponse
        decodeStonks


decodeStonks : D.Decoder StonksResponse
decodeStonks =
    D.map2 StonksResponse
        (D.field "symbol" D.string)
        (D.field "isStonks" D.bool)


decodeFlags : D.Decoder Flags
decodeFlags =
    D.map2 Flags
        (D.field "lastSymbol" decodeLastSymbol)
        (D.field "images" decodeImageUrls)


decodeLastSymbol : D.Decoder (Maybe String)
decodeLastSymbol =
    D.maybe D.string
        |> D.map
            (Maybe.filter (\a -> String.length a < 5))
        |> D.map
            (Maybe.filter (\a -> String.length a > 0))
        |> D.map
            (Maybe.map String.toUpper)


decodeImageUrls : D.Decoder ImageUrls
decodeImageUrls =
    D.map2 ImageUrls
        (D.field "stonks" D.string)
        (D.field "notStonks" D.string)


inputwidth : Element.Attribute Msg
inputwidth =
    style "width" "4em"
        |> Element.htmlAttribute


getMessage : Model -> String
getMessage model =
    case model.isStonks of
        NotAsked ->
            "Click to check!"

        Loading ->
            "Loading..."

        Success apiResponse ->
            responseMessage apiResponse

        Failure htErr ->
            errorMessage htErr


responseMessage : StonksResponse -> String
responseMessage stonksResponse =
    stonksResponse.symbol
        ++ " is "
        ++ (if stonksResponse.isStonks then
                "stonks!"

            else
                "NOT stonks!"
           )


errorMessage : Http.Error -> String
errorMessage errorHttp =
    if is429 errorHttp then
        "Rate limit reached! Please try again in 60 seconds..."

    else
        "Error! Please try again!"


is429 : Http.Error -> Bool
is429 errorHttp =
    if errorHttp == Http.BadStatus 429 then
        True

    else
        False


defaultError : e -> RemoteData e a -> e
defaultError err_ rd =
    case rd of
        Failure err ->
            err

        _ ->
            err_
