port module Main exposing (main)

import Http
import Platform exposing (Program, worker)
import Process exposing (sleep)
import Task exposing (andThen, perform, succeed)


main : Program () Int Msg
main =
    worker
        { init = \_ -> ( 1, Cmd.none )
        , update = update
        , subscriptions = subs
        }


type alias RetVal =
    { id : String
    , response : String
    }



--- UPDATE


type Msg
    = Get String
    | Return String


update : Msg -> Int -> ( Int, Cmd Msg )
update msg int =
    case msg of
        Get reqId ->
            ( int
            , sleep 1000
                |> andThen (\_ -> succeed reqId)
                |> perform Return
            )

        Return reqId ->
            ( int + 1
            , returnToTs
                (RetVal reqId (String.fromInt int))
            )



--- SUBSCRIPTIONS


subs : Int -> Sub Msg
subs _ =
    getTheThing Get



--- PORTS


port getTheThing : (String -> msg) -> Sub msg


port returnToTs : RetVal -> Cmd msg
