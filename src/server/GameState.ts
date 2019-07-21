import { TumppuPlayer, GameState } from '../shared/GameState'
import { PlayedCardSequence, Color, Card, Wildcard, WildcardCardType } from 'shared/Card';

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

    DrawCards(n: number, state: ServerGameState): Array<Card>
}

export class ServerGameState extends GameState {
    constructor(players: Array<ServerPlayer>) {
        super(players)

        this.RandomizeDrawPile()
        let startingCard = this.DrawCard()
        this.DiscardPile = [startingCard]

        for (let player of this.Players as Array<ServerPlayer>) {
            player.TellState(this)
        }

        // this may cause Draw() to occur, so we call it after announcing the state
        this.handleStartingCard(startingCard).then(() => {
            // dealer gets the first "turn"
            this.AdvanceTurn()

            for (let player of players) {
                player.DrawCards(7, this)
            }
        })
    }

    private playersExcept(exclude: ServerPlayer): Array<ServerPlayer> {
        return this.Players.filter((player) => player !== exclude) as Array<ServerPlayer>
    }

    protected handleStartingCard(card: Card): Promise<void> {
        return new Promise((resolve, reject) => {
            super.handleStartingCard(card)

            if (card instanceof Wildcard) {
                let toWait = []
                if (!card.IsComboCard()) {
                    toWait.push(this.askAndAnnounceColor(this.CurrentPlayer() as ServerPlayer, card))
                }

                switch (card.CardType) {
                case WildcardCardType.Democracy:
                case WildcardCardType.Dictator:
                    toWait.push(this.askAndAnnounceTargetPlayer(this.CurrentPlayer() as ServerPlayer, card))
                    break
                }

                Promise.all<Color | ServerPlayer>(toWait).then(() => {
                    // Once the target player is in place, check if we need to draw cards
                    switch (card.CardType) {
                    case WildcardCardType.Dictator:
                        (card.TargetPlayer! as ServerPlayer).DrawCards(card.DrawValue(), this)
                        break
                    case WildcardCardType.Everybody:
                        for (let player of this.Players as Array<ServerPlayer>) {
                            player.DrawCards(card.DrawValue(), this)
                        }
                        break
                    case WildcardCardType.Polluter:
                        for (let player of this.playersExcept(this.CurrentPlayer() as ServerPlayer)) {
                            player.DrawCards(card.DrawValue(), this)
                        }
                        break
                    }

                    resolve()
                }, reject)
            }
            resolve()
        })
    }

    protected askAndAnnounceColor(playerToAsk: ServerPlayer, card: Card): Promise<Color> {
        return new Promise((resolve, reject) => {
            playerToAsk.AskColor(this).then((color) => {
                for (let player of this.playersExcept(playerToAsk)) {
                    player.TellColor(color, this)
                }
            })
        })
    }

    protected askAndAnnounceTargetPlayer(playerToAsk: ServerPlayer, card: Card): Promise<ServerPlayer> {
        return new Promise((resolve, reject) => {
            playerToAsk.AskVote(this).then((targetPlayer) => {
                for (let player of this.playersExcept(playerToAsk)) {
                    player.TellVoteCompleted(new Map().set(playerToAsk, targetPlayer), this)
                }
                resolve(targetPlayer as ServerPlayer)
            })
        })
    }

    public EndCombo(): void {
        (this.CurrentPlayer() as ServerPlayer).DrawCards(this.CurrentCombo!.DrawValue(), this)
    }

    public BroadcastDraw(drawingPlayer: ServerPlayer, cards: Array<Card>): void {
        for (let player of this.Players as Array<ServerPlayer>) {
            player.TellDraw(drawingPlayer, cards, this)
        }
    }
}