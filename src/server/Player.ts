import { RealPlayer, GameState, TumppuPlayer } from "shared/GameState";
import { ServerPlayer, ServerGameState } from "./GameState";
import { PlayedCardSequence, Color, Card } from "shared/Card";
import Net from "@rbxts/net";
import { ServerHand } from "./Hand";

const askPlay = new Net.ServerFunction("AskPlay")
const askDraw = new Net.ServerFunction("AskDraw")
const askColor = new Net.ServerFunction("AskColor")
const askVote = new Net.ServerFunction("AskVote")

const tellState = new Net.ServerEvent("TellState")
const tellPlay = new Net.ServerEvent("TellPlay")
const tellDraw = new Net.ServerEvent("TellDraw")
const tellColor = new Net.ServerEvent("TellColor")
const tellVoteCompleted = new Net.ServerEvent("TellVoteCompleted")
const tellHand = new Net.ServerEvent("TellHand")

export class ServerRealPlayer extends RealPlayer implements ServerPlayer {
    Hand: ServerHand = new ServerHand

    constructor(player: Player) {
        super(player)
    }

    public AskPlay(state: GameState): Promise<PlayedCardSequence> {
        return new Promise((resolve, reject) => {
            askPlay.CallPlayerAsync(this.Player).then((returns: any) => {
                // handle colors, player assigns, etc.
                resolve(this.Hand.DeserializeSequence(this, returns as Array<number>))
            }, reject)
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

    public TellPlay(cards: PlayedCardSequence, state: GameState): void {
        tellPlay.SendToPlayer(this.Player, state.SerializePlayer(cards.Player), cards.Cards.map((card) => card.Serialize(state)))
    }

    public TellDraw(player: TumppuPlayer, cards: Array<Card>, state: GameState): void {
        tellDraw.SendToPlayer(this.Player, state.SerializePlayer(player), player === this ? cards.map((card) => card.Serialize(state)) : cards.size())
    }

    public TellColor(color: Color, state: GameState): void {
        tellColor.SendToPlayer(this.Player, color)
    }

    public TellVoteCompleted(votes: Map<TumppuPlayer, TumppuPlayer>, state: GameState): void {
        tellVoteCompleted.SendToAllPlayers(this.Player, votes.entries().map((entry) => [state.SerializePlayer(entry[0]), state.SerializePlayer(entry[1])]))
    }

    public TellHand(player: TumppuPlayer, state: GameState): void {
        tellHand.SendToPlayer(this.Player, state.SerializePlayer(player), player.Hand.Cards.map((card) => card.Serialize(state)))
    }

    public DrawCards(n: number, state: ServerGameState): Array<Card> {
        let cards = this.Hand.DrawCards(n, state)
        state.BroadcastDraw(this, cards)
        return cards
    }
}