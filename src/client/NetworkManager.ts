import { LocalGameState } from "./GameState";
import { ClientEvent, CreateThrottledFunction } from "@rbxts/net";
import { RenderHand } from "./Hand";
import { ISerializedCard, CardSequence } from "shared/Card";
import { RenderCard } from "./Card";

const tellDraw = new ClientEvent("TellDraw")
const tellPlay = new ClientEvent("TellPlay")
const askPlay = new ClientEvent("AskPlay")

const localPlayer = game.GetService("Players").LocalPlayer
const handFrame = localPlayer.WaitForChild("PlayerGui")
    .WaitForChild("TumppuGui")
    .WaitForChild<Frame>("OwnCards")
const playedCardContainer = localPlayer.WaitForChild("PlayerGui")
    .WaitForChild("TumppuGui")
    .WaitForChild("CenterContainer")
    .WaitForChild("Cards")

export class NetworkManager {
    GameState: LocalGameState
    private handRender: RenderHand

    constructor(state: LocalGameState) {
        this.GameState = state
        this.handRender = new RenderHand(state.LocalPlayer(), handFrame)

        this.UpdateTopCard()

        tellDraw.Connect((playerIndex: number, cards: number | Array<ISerializedCard>) => {
            let player = state.DeserializePlayer(playerIndex)
            let newCards = state.DeserializeCards(cards)

            player.Hand!.AddCards(newCards)

            if (player === state.LocalPlayer()) {
                this.UpdateHand()
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

            let seq = new CardSequence
            seq.Cards = deserializedCards

            print("playing cards", deserializedCards.map((card) => card.Name()).join())
            this.GameState.PlayCards(player, seq)

            this.UpdateTopCard()
        })

        askPlay.Connect(async () => {
            print("asked to play")
            let playedCards = await this.AskPlay()
            this.UpdateTopCard()

            askPlay.SendToServer(playedCards)
        })
    }

    public UpdateTopCard(): void {
        print("updating topcard")
        const state = this.GameState
        playedCardContainer.WaitForChild("PlayedCard").Destroy()

        let cardRender = new RenderCard(state.DiscardPile[state.DiscardPile.size() - 1])
        let frame = cardRender.FrontAsFrame()
        frame.Name = "PlayedCard"
        frame.Parent = playedCardContainer
    }

    public UpdateHand(): Promise<void> {
        print("updating hand")
        return this.handRender.Update()
    }

    public AskPlay(): Promise<Array<number>> {
        return new Promise((resolve, reject) => {
            let connections: Array<RBXScriptConnection> = []
            for (let [card, render] of this.handRender.CardRenders) {
                connections.push(render.Activated.Connect((activated) => {
                    let seq = new CardSequence
                    seq.Cards = [card]
                    let localPlayer = this.GameState.LocalPlayer()
                    if (this.GameState.CanPlayCards(localPlayer, seq)) {
                        let cardIndices = seq.Cards.map((card) => localPlayer.Hand!.Cards.indexOf(card))
                        this.GameState.PlayCards(this.GameState.LocalPlayer(), seq)
                        render.Destroy()
                        connections.forEach((conn) => {
                            conn.Disconnect()
                        })

                        resolve(cardIndices)
                        this.UpdateHand()
                    }
                }))
            }
        })
    }
}