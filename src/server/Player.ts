import { RealPlayer, GameState, TumppuPlayer } from "shared/GameState";
import { ServerPlayer, ServerGameState } from "./GameState";
import { PlayedCardSequence, Color } from "shared/Card";
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

export interface ISerializedPlayer {
    Hand: Array<ISerializedCard> | number
    Player?: Player
}

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

    public AskVote(state: ServerGameState): Promise<TumppuPlayer> {
        return new Promise((resolve, reject) => {
            askVote.CallPlayerAsync(this.Player).then((returns: any) => {
                let votedPlayer = state.DeserializePlayer(returns as number)
                if (votedPlayer === this) {
                    error("Can't voted for self")
                }
                resolve(votedPlayer)
            }, reject)
        })
    }

    public TellState(state: GameState): void {
        tellState.SendToPlayer(this.Player, this.Serialize())
    }
}