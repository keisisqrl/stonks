module Main exposing (main)

import Browser exposing (Document, application, document)
import Browser.Navigation as Navigation
import Cmd.Extra exposing (withCmd, withNoCmd)
import Debug
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
import Process
import RemoteData exposing (RemoteData(..), WebData)
import RemoteData.Http as RDHttp
import Task exposing (Task)
import Update.Extra exposing (addCmd, updateModel)
import Url exposing (Url)
import Url.Builder
import Url.Parser as Parser exposing (Parser)


main : Program () Model Msg
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
    }


defaultSymbol : String
defaultSymbol =
    "DJIA"


init : () -> Url -> Navigation.Key -> ( Model, Cmd Msg )
init _ url key =
    let
        symbol =
            initSymbol url

        model =
            Model
                symbol
                Loading
                key
    in
    ( model
    , callStonksApi symbol
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
            { model | isStonks = response }
                |> withNoCmd
                |> updateModel updateFromResponse
                |> addCmd (changeUrlIfSuccess model)
                |> addCmd (maybe429Timeout model)
                |> Debug.log "responsereturn"

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


maybe429Timeout : Model -> Cmd Msg
maybe429Timeout model =
    case model.isStonks of
        Failure err ->
            if is429 err then
                Process.sleep 5
                    |> Task.perform SetNotAsked

            else
                Cmd.none

        _ ->
            Cmd.none


changeUrlIfSuccess : Model -> Cmd Msg
changeUrlIfSuccess model =
    if RemoteData.isSuccess model.isStonks then
        Navigation.pushUrl model.key
            (Url.Builder.absolute [ model.symbol ] [])

    else
        Cmd.none


docView : Model -> Browser.Document Msg
docView model =
    { body = [ view model ]
    , title = getMessage model
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
                { onPress = buttonPressMsg model
                , label = text "Check"
                }
            ]
        ]


buttonPressMsg : Model -> Maybe Msg
buttonPressMsg model =
    case RemoteData.mapError is429 model.isStonks of
        Failure rateLimit ->
            if rateLimit then
                Nothing

            else
                Just GetStonks

        Loading ->
            Nothing

        NotAsked ->
            Just GetStonks

        Success _ ->
            Just GetStonks


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
                imgBase =
                    if response.isStonks then
                        "stonks"

                    else
                        "not-stonks"

                imgUrl =
                    Url.Builder.absolute
                        [ imgBase ++ ".jpg" ]
                        []
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


inputwidth : Element.Attribute Msg
inputwidth =
    style "width" "4em"
        |> Element.htmlAttribute


getMessage : Model -> String
getMessage model =
    case model.isStonks of
        NotAsked ->
            "Click to find out!"

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
