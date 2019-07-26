import { GameState } from "shared/GameState";
import { ServerPlayer, ServerGameState } from "./GameState";
import { Color, Card, CardSequence } from "shared/Card";
import Net from "@rbxts/net";
import { RealPlayer, TumppuPlayer } from "shared/Player";

const askPlay = new Net.ServerEvent("AskPlay")
const askDraw = new Net.ServerFunction("AskDraw")
const askColor = new Net.ServerFunction("AskColor")
const askVote = new Net.ServerFunction("AskVote")

const tellState = new Net.ServerEvent("TellState")
const tellPlay = new Net.ServerEvent("TellPlay")
const tellDraw = new Net.ServerEvent("TellDraw")
const tellColor = new Net.ServerEvent("TellColor")
const tellVoteCompleted = new Net.ServerEvent("TellVoteCompleted")
const tellHand = new Net.ServerEvent("TellHand")

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

    public AskPlay(state: GameState): Promise<CardSequence> {
        print("asking player to play")
        return new Promise((resolve, reject) => {
            connectOnce<[Array<number>]>(askPlay, this).then((returns: [Array<number>]) => {
                let cards = returns[0].map((index) => this.Hand.Cards[index])
                let result = new CardSequence(cards)

                print("playing cards", result.Cards.map((card) => card.Name()).join(","))

                resolve(result)
            })
            askPlay.SendToPlayer(this.Player)
        })
    }

    public AskDraw(state: GameState): Promise<boolean> {
        return askDraw.CallPlayerAsync(this.Player) as Promise<boolean>
    }

    public AskColor(state: GameState): Promise<Color> {
        return askColor.CallPlayerAsync(this.Player) as Promise<Color>
    }

    public AskVote(state: GameState): Promise<TumppuPlayer> {
        return new Promise((resolve, reject) => {
            askVote.CallPlayerAsync(this.Player).then((returns: any) => {
                let votedPlayer = state.DeserializePlayer(returns as number)
                if (votedPlayer === this) {
                    error("Can't vote for self")
                }
                resolve(votedPlayer)
            }, reject)
        })
    }

    public TellState(state: GameState): void {
        tellState.SendToPlayer(this.Player, state.Serialize(this))
    }

    public TellPlay(player: TumppuPlayer, cards: CardSequence, state: GameState): void {
        tellPlay.SendToPlayer(this.Player, state.SerializePlayer(player), cards.Cards.map((card) => state.SerializeCard(card)))
    }

    public TellDraw(player: TumppuPlayer, cards: Array<Card>, state: GameState): void {
        tellDraw.SendToPlayer(this.Player, state.SerializePlayer(player), player === this ? cards.map((card) => state.SerializeCard(card)) : cards.size())
    }

    public TellColor(color: Color, state: GameState): void {
        tellColor.SendToPlayer(this.Player, color)
    }

    public TellVoteCompleted(votes: Map<TumppuPlayer, TumppuPlayer>, state: GameState): void {
        tellVoteCompleted.SendToAllPlayers(this.Player, votes.entries().map((entry) => [state.SerializePlayer(entry[0]), state.SerializePlayer(entry[1])]))
    }

    public TellHand(player: TumppuPlayer, state: GameState): void {
        tellHand.SendToPlayer(this.Player, state.SerializePlayer(player), player.Hand!.Cards.map((card) => state.SerializeCard(card)))
    }

    public DrawCards(n: number, state: ServerGameState): Array<Card> {
        let cards = state.DrawCards(n)
        this.Hand.AddCards(cards)
        state.BroadcastDraw(this, cards)
        return cards
    }
}