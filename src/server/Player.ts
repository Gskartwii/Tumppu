import { GameState } from "shared/GameState";
import { ServerPlayer, ServerGameState } from "./GameState";
import { Color, Card, CardSequence, WildcardCardType } from "shared/Card";
import Net from "@rbxts/net";
import { RealPlayer, TumppuPlayer } from "shared/Player";

const askPlay = new Net.ServerEvent("AskPlay")
const askColor = new Net.ServerEvent("AskColor")
const askVote = new Net.ServerEvent("AskVote")
const askReady = new Net.ServerEvent("AskReady")

const tellState = new Net.ServerEvent("TellState")
const tellPlay = new Net.ServerEvent("TellPlay")
const tellDraw = new Net.ServerEvent("TellDraw")
const tellColor = new Net.ServerEvent("TellColor")
const tellVoteCompleted = new Net.ServerEvent("TellVoteCompleted")
const tellHands = new Net.ServerEvent("TellHands")

function connectOnce<T extends Array<unknown>>(event: Net.ServerEvent, forPlayer: RealPlayer): Promise<T> {
    return new Promise((resolve, reject) => {
        let connection: RBXScriptConnection
        connection = (event.getEvent() as RBXScriptSignal<(player: Player, ...args: T) => void>).Connect((player, ...args) => {
            if (forPlayer.Player === player) {
                connection.Disconnect()
                resolve(args)
            }
        })
    })
}

export class ServerRealPlayer extends RealPlayer implements ServerPlayer {
    constructor(player: Player) {
        super(player)
    }

    public AskPlay(state: GameState, canDraw: boolean): Promise<CardSequence | boolean> {
        return new Promise((resolve, reject) => {
            connectOnce<[Array<number> | boolean]>(askPlay, this).then((returns: [Array<number> | boolean]) => {
                if (typeIs(returns[0], "boolean")) {
                    resolve(returns[0])
                    return
                }
                let cards = returns[0].map((index) => this.Hand.Cards[index])
                let result = new CardSequence(cards)

                print("playing cards", result.Cards.map((card) => card.Name()).join())

                resolve(result)
            })
            askPlay.SendToPlayer(this.Player, canDraw)
        })
    }

    public async AskColor(state: GameState): Promise<Color> {
        let result = connectOnce<[Color]>(askColor, this)
        askColor.SendToPlayer(this.Player)
        return (await result)[0]
    }

    public AskVote(cardType: WildcardCardType, count: number, state: GameState): Promise<Array<TumppuPlayer>> {
        return new Promise((resolve, reject) => {
            connectOnce<[Array<number>]>(askVote, this).then((returns) => {
                const playerIndexes = returns[0]
                const votedPlayers = playerIndexes.map((player) => state.DeserializePlayer(player))
                if (votedPlayers.some((player) => player === this)) {
                    error("Can't vote for self")
                }

                if (votedPlayers.size() !== count) {
                    error("Count of votes didn't match what was asked for")
                }
                resolve(votedPlayers)
            })

            askVote.SendToPlayer(this.Player, cardType, count)
        })
    }

    public async AskReady(): Promise<void> {
        let result = connectOnce(askReady, this)
        askReady.SendToPlayer(this.Player)
        await result
        return 
    }

    public TellState(state: GameState): void {
        tellState.SendToPlayer(this.Player, state.Serialize(this))
    }

    public TellPlay(player: TumppuPlayer, cards: CardSequence, state: GameState): void {
        print("server tellPlay:", cards.Cards.map((card) => card.Name()).join())
        tellPlay.SendToPlayer(this.Player, state.SerializePlayer(player), cards.Cards.map((card) => state.SerializeCard(card)))
    }

    public TellDraw(player: TumppuPlayer, cards: Array<Card>, endCombo: boolean, state: GameState): void {
        print("server tellDraw:", cards.size())
        tellDraw.SendToPlayer(this.Player, state.SerializePlayer(player), player === this ? cards.map((card) => state.SerializeCard(card)) : cards.size(), endCombo)
    }

    public TellColor(color: Color, state: GameState): void {
        tellColor.SendToPlayer(this.Player, color)
    }

    public TellVoteCompleted(votes: Map<TumppuPlayer, TumppuPlayer>, state: GameState): void {
        tellVoteCompleted.SendToPlayer(this.Player, votes
            .entries()
            .map((entry) => [
                state.SerializePlayer(entry[0]),
                state.SerializePlayer(entry[1])]))
    }

    public TellHands(players: Array<TumppuPlayer>, state: GameState): void {
        tellHands.SendToPlayer(this.Player, 
            players.map((player) => {
                return [
                    state.SerializePlayer(player),
                    player.Hand!.Cards
                        .map((card) => state.SerializeCard(card))]
            }))
    }

    public DrawCards(n: number, endCombo: boolean, state: ServerGameState): Array<Card> {
        let cards = state.DrawCards(n)
        this.Hand.AddCards(cards)
        state.BroadcastDraw(this, cards, endCombo)
        return cards
    }
}