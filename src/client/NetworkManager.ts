import { LocalGameState } from "./GameState";
import { ClientEvent, CreateThrottledFunction } from "@rbxts/net";
import { ISerializedCard, CardSequence } from "shared/Card";
import { GameView } from "./GameView";

const tellDraw = new ClientEvent("TellDraw")
const tellPlay = new ClientEvent("TellPlay")
const askPlay = new ClientEvent("AskPlay")

export class NetworkManager {
    GameState: LocalGameState
    private gameView: GameView

    constructor(state: LocalGameState, view: GameView) {
        this.GameState = state
        this.gameView = view

        this.gameView.UpdateTopCard()

        tellDraw.Connect((playerIndex: number, cards: number | Array<ISerializedCard>) => {
            let player = state.DeserializePlayer(playerIndex)
            let newCards = state.DeserializeCards(cards)

            player.Hand!.AddCards(newCards)

            if (player === state.LocalPlayer()) {
                this.gameView.AddNewCards(newCards)
            }
        })

        tellPlay.Connect((playerIndex: number, cards: Array<ISerializedCard>) => {
            let player = state.DeserializePlayer(playerIndex)
            let hand = player.Hand!

            // doesn't matter what indexes are played, all opponent cards should be unknown
            // except in open mode (TODO)
            hand.Cards = hand.Cards.slice(0, hand.Cards.size() - cards.size())
            let deserializedCards = state.DeserializeCards(cards)
            hand.AddCards(deserializedCards)

            let seq = new CardSequence(deserializedCards)

            print("tellplay cards", deserializedCards.map((card) => card.Name()).join())
            this.GameState.PlayCards(player, seq)

            this.gameView.OpponentPlayedCards(player, seq)
        })

        askPlay.Connect(async () => {
            print("asked to play")
            let player = this.GameState.LocalPlayer()
            let playedCards = await this.gameView.AskPlay()
            print("playing cards", playedCards.Cards.map((card) => card.Name()).join())
            let serialized = playedCards.Cards.map((card) => player.Hand!.Cards.indexOf(card))
            this.GameState.PlayCards(player, playedCards)

            askPlay.SendToServer(serialized)
        })
    }
}