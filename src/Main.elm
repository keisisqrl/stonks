module Main exposing (main)

import Browser exposing (Document, application, document)
import Browser.Navigation as Navigation
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
import Url exposing (Url)
import Url.Builder
import Url.Parser as Parser exposing (Parser)


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
    , isStonks : Maybe Bool
    , message : String
    , key : Navigation.Key
    }


defaultSymbol : String
defaultSymbol =
    "DJIA"


init : () -> Url -> Navigation.Key -> ( Model, Cmd Msg )
init _ url key =
    let
        model =
            Model
                (initSymbol url)
                Nothing
                "Loading..."
                key
    in
    ( model
    , callStonksApi model
    )


initSymbol : Url -> String
initSymbol url =
    case Parser.parse Parser.string url of
        Just symbol ->
            if String.length symbol < 5 then
                symbol

            else
                defaultSymbol

        Nothing ->
            defaultSymbol


type alias StonksResponse =
    { symbol : String
    , isStonks : Bool
    }


type Msg
    = TextInput String
    | StonksApiResponse (Result Http.Error StonksResponse)
    | GetStonks
    | UrlChange Url
    | UrlRequest Browser.UrlRequest


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        TextInput symbol ->
            if String.length symbol < 5 then
                ( { model | symbol = symbol }, Cmd.none )

            else
                ( model, Cmd.none )

        StonksApiResponse response ->
            handleResponse response model

        GetStonks ->
            ( { model
                | isStonks = Nothing
                , message = "Loading..."
              }
            , callStonksApi model
            )

        UrlRequest urlreq ->
            case urlreq of
                Browser.Internal url ->
                    ( model
                    , Navigation.pushUrl model.key (Url.toString url)
                    )

                Browser.External url ->
                    ( model
                    , Navigation.load url
                    )

        _ ->
            ( model, Cmd.none )


handleResponse : Result Http.Error StonksResponse -> Model -> ( Model, Cmd Msg )
handleResponse response model =
    case response of
        Ok stonksResponse ->
            let
                isStonks =
                    stonksResponse.isStonks
            in
            ( { model
                | symbol = stonksResponse.symbol
                , isStonks = Just isStonks
                , message =
                    stonksResponse.symbol
                        ++ (if isStonks then
                                " is stonks!"

                            else
                                " is not stonks!"
                           )
              }
            , Navigation.pushUrl model.key
                (Url.Builder.absolute [ stonksResponse.symbol ] [])
            )

        Err errorHttp ->
            ( handleHttpError errorHttp model, Cmd.none )


handleHttpError : Http.Error -> Model -> Model
handleHttpError errorHttp model =
    let
        message =
            case errorHttp of
                Http.BadStatus status ->
                    if status == 429 then
                        "API limit exceeded! Try again in a minute."

                    else
                        "Error. Please try again."

                _ ->
                    "Error. Please try again."
    in
    { model
        | isStonks = Nothing
        , message = message
    }


docView : Model -> Browser.Document Msg
docView model =
    { body = [ view model ]
    , title = model.message
    }


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
                ]
                { onPress = Just GetStonks
                , label = text "Check"
                }
            ]
        ]


stonksImage : Model -> Element Msg
stonksImage model =
    Maybe.map
        (\isStonks ->
            let
                imgBase =
                    if isStonks then
                        "stonks"

                    else
                        "not-stonks"

                imgUrl =
                    Url.Builder.absolute
                        [ imgBase ++ ".jpg" ]
                        []
            in
            image [] { src = imgUrl, description = "" }
        )
        model.isStonks
        |> Maybe.withDefault (text model.message)


apiEndpoint : String -> String
apiEndpoint symbol =
    Url.Builder.absolute
        [ ".api"
        , String.toUpper symbol
        ]
        []


callStonksApi : Model -> Cmd Msg
callStonksApi model =
    Http.get
        { url = apiEndpoint model.symbol
        , expect = Http.expectJson StonksApiResponse decodeStonks
        }


decodeStonks : D.Decoder StonksResponse
decodeStonks =
    D.map2 StonksResponse
        (D.field "symbol" D.string)
        (D.field "isStonks" D.bool)


inputwidth : Element.Attribute Msg
inputwidth =
    style "width" "4em"
        |> Element.htmlAttribute
