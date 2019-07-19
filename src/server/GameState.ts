import { TumppuPlayer, GameState, Direction } from '../shared/GameState'
import { PlayedCardSequence, Color, Card, ISerializedCard } from 'shared/Card';

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