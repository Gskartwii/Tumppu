import { TumppuPlayer, GameState, Direction } from '../shared/GameState'
import { PlayedCardSequence, Color, Card } from 'shared/Card';
import { ISerializedPlayer } from './Player';
import { ISerializedCard, ServerCard, ServerCardSequence } from './Card';

export interface ServerPlayer extends TumppuPlayer {
    AskPlay(state: GameState): Promise<PlayedCardSequence>
    AskDraw(state: GameState): Promise<boolean>
    AskColor(state: GameState): Promise<Color>
    AskVote(state: GameState): Promise<TumppuPlayer>

    TellState(state: GameState): void
    TellPlay(cards: PlayedCardSequence, state: GameState): void
    TellDraw(player: TumppuPlayer, cards: Array<Card>, state: GameState): void
    TellColor(color: Color, state: GameState): void
    TellVoteCompleted(votes: Map<TumppuPlayer, TumppuPlayer>, state: GameState): void
}

interface ISerializedGameState {
    Direction: Direction
    Players: Array<ISerializedPlayer>
    Turn: number
    DrawPile: number
    DiscardPile: [ISerializedCard, number]
    CurrentCombo: Array<ISerializedCard> | undefined
}

export class ServerGameState extends GameState {
    Players: Array<ServerPlayer>
    DrawPile: Array<ServerCard> = []
    DiscardPile: Array<ServerCard> = []
    CurrentCombo: ServerCardSequence | undefined

    constructor(players: Array<ServerPlayer>) {
        super(players as Array<TumppuPlayer>)
        this.Players = players
    }

    public DeserializePlayer(index: number): ServerPlayer {
        return this.Players[index] as ServerPlayer
    }

    public LastCard(): ServerCard {
        return this.DiscardPile[this.DiscardPile.size() - 1]
    }

    public Serialize(): ISerializedGameState {
        return {
            Direction: this.Direction,
            Players: this.Players.map((player) => player.Serialize()),
            Turn: this.Turn,
            DrawPile: this.DrawPile.size(),
            DiscardPile: [this.LastCard().Serialize(this), this.DiscardPile.size()],
            CurrentCombo: this.CurrentCombo !== undefined ? this.CurrentCombo.Cards.map((card) => card.Serialize(this)) : undefined, 
        }
    }
}