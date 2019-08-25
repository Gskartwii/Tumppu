import { LocalGameState } from "./GameState";
import { ClientEvent } from "@rbxts/net";
import { ISerializedCard, CardSequence, Color, WildcardCardType } from "shared/Card";
import { GameView } from "./GameView";
import { TumppuPlayer } from "shared/Player";

const tellDraw = new ClientEvent("TellDraw")
const tellPlay = new ClientEvent("TellPlay")
const tellColor = new ClientEvent("TellColor")
const tellVoteCompleted = new ClientEvent("TellVoteCompleted")
const tellHands=  new ClientEvent("TellHands")
const askReady = new ClientEvent("AskReady")
const askPlay = new ClientEvent("AskPlay")
const askColor = new ClientEvent("AskColor")
const askVote = new ClientEvent("AskVote")

export class NetworkManager {
    GameState: LocalGameState
    private gameView: GameView

    constructor(state: LocalGameState, view: GameView) {
        this.GameState = state
        this.gameView = view

        this.gameView.DrawTopCard(this.GameState.DiscardPile[this.GameState.DiscardPile.size() - 1])
        this.gameView.QueueUpdateDrawButton(state.CurrentCombo)

        tellDraw.Connect((playerIndex: number, cards: number | Array<ISerializedCard>, endCombo: boolean) => {
            let player = state.DeserializePlayer(playerIndex)
            let newCards = state.DeserializeCards(cards)

            player.Hand!.AddCards(newCards)

            print("telldraw:", newCards.size(), playerIndex)

            if (endCombo) {
                this.GameState.EndCombo()
            }

            this.gameView.DrawCards(player, newCards)
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

            print("told play cards", deserializedCards.map((card) => card.Name()).join(), playerIndex)
            this.GameState.PlayCards(player, seq)

            this.gameView.OpponentPlayedCards(player, seq, this.GameState.CurrentCombo)
        })

        askPlay.Connect(async (canDraw: boolean) => {
            print("asked to play", canDraw)
            let player = this.GameState.LocalPlayer()
            let playedCards = await this.gameView.AskPlay(canDraw)
            if (typeIs(playedCards, "boolean")) {
                askPlay.SendToServer(playedCards)
                return
            }
            print("playing cards", playedCards.Cards.map((card) => card.Name()).join())
            let serialized = playedCards.Cards.map((card) => player.Hand!.Cards.indexOf(card))
            this.GameState.PlayCards(player, playedCards)
            this.gameView.QueueUpdateDrawButton(this.GameState.CurrentCombo)

            askPlay.SendToServer(serialized)
        })

        askColor.Connect(async () => {
            print("asked color")
            let color = await this.gameView.AskColor()
            this.GameState.LastCard().Color = color

            askColor.SendToServer(color)
        })

        tellColor.Connect((color: Color) => {
            print("tellcolor", color)
            this.GameState.LastCard().Color = color
            this.gameView.OpponentChoseColor(color)
        })

        askVote.Connect(async (cardType: WildcardCardType, count: number) => {
            print("asked players")
            // TODO: don't close dialog if it's democracy
            // instead show waiting animation
            let players = await this.gameView.AskPlayers(cardType, count)

            askVote.SendToServer(players.map((player) => this.GameState.SerializePlayer(player)))
        })

        tellVoteCompleted.Connect((results: Array<[number, number]>, tieBreaker?: number) => {
            const resultMap = new Map(results
                .map(([voter, target]) => [
                    this.GameState.DeserializePlayer(voter),
                    this.GameState.DeserializePlayer(target),
                ]));
            
            let tieBreakerPlayer: TumppuPlayer | undefined = undefined
            if (tieBreaker !== undefined) {
                tieBreakerPlayer = this.GameState.DeserializePlayer(tieBreaker)
            }

            const voteCounts = resultMap.entries().reduce((counts, [voter, votee]) => {
                counts.set(votee, (counts.get(votee) || 0) + 1)

                return counts
            }, new Map<TumppuPlayer, number>()).entries()
            table.sort(voteCounts, ([playerA, votesA], [playerB, votesB]) => {
                if (playerA === tieBreaker) {
                    return true
                } else if (playerB === tieBreaker) {
                    return false
                }

                return votesA > votesB
            })

            const voteTarget = voteCounts[0][0]
            this.GameState.GiveTurn(voteTarget)

            this.gameView.PresentVotes(voteCounts, tieBreakerPlayer)
        })

        tellHands.Connect((hands: Array<[number, Array<ISerializedCard>]>) => {
            const playerCards = new Map(hands
                .map(([player, cards]) => [ 
                    this.GameState.DeserializePlayer(player),
                    cards.map((card) => state.DeserializeCard(card))
                ])
            )

            this.gameView.PresentCards(playerCards)
        })

        askReady.Connect(() => {
            askReady.SendToServer()
        })
    }
}