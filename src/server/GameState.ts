import { GameState } from '../shared/GameState'
import { Color, Card, Wildcard, WildcardCardType, CardSequence } from 'shared/Card';
import { TumppuPlayer, TargetedWildcard } from 'shared/Player';

export interface ServerPlayer extends TumppuPlayer {
    AskPlay(state: GameState): Promise<CardSequence>
    AskDraw(state: GameState): Promise<boolean>
    AskColor(state: GameState): Promise<Color>
    AskVote(state: GameState): Promise<TumppuPlayer>

    TellState(state: GameState): void
    TellPlay(player: TumppuPlayer, cards: CardSequence, state: GameState): void
    TellDraw(player: TumppuPlayer, cards: Array<Card>, state: GameState): void
    TellColor(color: Color, state: GameState): void
    TellVoteCompleted(votes: Map<TumppuPlayer, TumppuPlayer>, state: GameState): void
    TellHand(player: TumppuPlayer, state: GameState): void

    DrawCards(n: number, state: ServerGameState): Array<Card>
}

export class ServerGameState extends GameState {
    Players: Array<ServerPlayer>

    constructor(players: Array<ServerPlayer>) {
        super(players)
        this.Players = players

        this.RandomizeDrawPile()
        let startingCard = this.DrawCard()
        // Don't implement rule 17 yet...
        if (startingCard.IsWildcard() && startingCard.CardType === WildcardCardType.Exchange) {
            // return the card to the draw pile and get a new one
            this.DrawPile.push(startingCard)
            startingCard = this.DrawCard()
        }
        this.DiscardPile = [startingCard]

        for (let player of this.Players) {
            player.TellState(this)
        }

        // this may cause Draw() to occur, so we call it after announcing the state
        this.handleStartingCard(startingCard).then(() => {
            for (let player of players) {
                player.DrawCards(7, this)
            }
            
            // don't implement jump-in rules yet
            this.AskPlay()
        })
    }

    public CurrentPlayer(): ServerPlayer {
        return this.Players[this.Turn]
    }

    private playersExcept(exclude: ServerPlayer): Array<ServerPlayer> {
        return this.Players.filter((player) => player !== exclude)
    }

    protected handleStartingCard(card: Card): Promise<void> {
        return new Promise((resolve, reject) => {
            if (card.IsWildcard()) {
                let toWait = []
                if (!card.IsComboCard()) {
                    toWait.push(this.askAndAnnounceColor(this.CurrentPlayer(), card))
                }

                switch (card.CardType) {
                case WildcardCardType.Democracy:
                case WildcardCardType.Dictator:
                    toWait.push(this.askAndAnnounceTargetPlayer(this.CurrentPlayer(), card))
                    break
                }

                Promise.all<Color | ServerPlayer>(toWait).then(() => {
                    // Once the target player is in place, check if we need to draw cards
                    switch (card.CardType) {
                    case WildcardCardType.Dictator:
                        ((card as TargetedWildcard).TargetPlayer! as ServerPlayer).DrawCards(card.DrawValue(), this)
                        break
                    case WildcardCardType.Everybody:
                        for (let player of this.Players) {
                            player.DrawCards(card.DrawValue(), this)
                        }
                        break
                    case WildcardCardType.Polluter:
                        for (let player of this.playersExcept(this.CurrentPlayer())) {
                            player.DrawCards(card.DrawValue(), this)
                        }
                        break
                    }

                    super.handleStartingCard(card)
                    resolve()
                }, reject)

                return
            }

            super.handleStartingCard(card)
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
        // TODO: democracy?
        (this.CurrentPlayer()).DrawCards(this.CurrentCombo!.DrawValue(), this)
        this.AdvanceTurn()
    }

    public BroadcastDraw(drawingPlayer: ServerPlayer, cards: Array<Card>): void {
        for (let player of this.Players) {
            player.TellDraw(drawingPlayer, cards, this)
        }
    }

    public PlayCards(player: TumppuPlayer, cards: CardSequence): void {
        super.PlayCards(player, cards)

        for (let tellTo of this.playersExcept(player as ServerPlayer)) {
            print("telling play to", tellTo, player)
            tellTo.TellPlay(player, cards, this)
        }
    }

    protected handleCards(player: TumppuPlayer, cards: CardSequence): Promise<void> {
        if (this.IsComboMode()) {
            return new Promise((resolve, reject) => {
                let toWait = []
                for (let card of cards.Cards) {
                    if (card.IsWildcard() && card.CardType === WildcardCardType.Spy) {
                        toWait.push(this.askAndAnnounceTargetPlayer(player as ServerPlayer, card).then((targetPlayer) => {
                            (card as TargetedWildcard).TargetPlayer = targetPlayer;
                            (player as ServerPlayer).TellHand(targetPlayer, this)
                        }))
                    }
                }

                Promise.all(toWait).then(() => {
                    super.handleCardsComboMode(player, cards)
                    resolve()
                }, reject)
            })
        }

        return new Promise((resolve, reject) => {
            // assume homogenous
            let toWait = []
            if (cards.Cards[0].IsWildcard()) {
                switch (cards.Cards[0].CardType) {
                case WildcardCardType.Dictator:
                    {
                        for (let card of cards.Cards) {
                            toWait.push(this.askAndAnnounceTargetPlayer(player as ServerPlayer, card).then((targetPlayer) => {
                                targetPlayer.DrawCards(card.DrawValue(), this)
                            }))
                        }
                    }
                    break
                case WildcardCardType.Everybody:
                    {
                        const cardsToDraw = cards.DrawValue()
                        for (let drawTo of this.Players) {
                            drawTo.DrawCards(cardsToDraw, this)
                        }
                    }
                    resolve()
                    break
                case WildcardCardType.Polluter:
                    {
                        const cardsToDraw = cards.DrawValue()
                        for (let drawTo of this.playersExcept(player as ServerPlayer)) {
                            drawTo.DrawCards(cardsToDraw, this)
                        }
                    }
                    break
                case WildcardCardType.Spy:
                    {
                        for (let card of cards.Cards) {
                            toWait.push(this.askAndAnnounceTargetPlayer(player as ServerPlayer, card).then((targetPlayer) => {
                                (card as TargetedWildcard).TargetPlayer = targetPlayer;
                                (player as ServerPlayer).TellHand(targetPlayer, this)
                            }))
                        }
                    }
                    break
                case WildcardCardType.Exchange:
                    let myHand = player.Hand
                    let targetPlayer = (cards.Cards[0] as TargetedWildcard).TargetPlayer!
                    let targetHand = targetPlayer.Hand
                    player.Hand = targetHand
                    targetPlayer.Hand = myHand
                    break
                }
                toWait.push((player as ServerPlayer).AskColor(this).then(color => {
                    for (let card of cards.Cards) {
                        card.Color = color
                    }
                }))
                Promise.all(toWait).then(() => {
                    super.handleCards(player, cards)
                    resolve()
                }, reject)
                return
            }

            super.handleCards(player, cards)
            resolve()
        })
    }

    // Returns whether the player can play
    public DrawCardsForPlayer(player: ServerPlayer): boolean {
        if (this.IsComboMode()) {
            this.EndCombo()
            return false
        }

        let drawnCards = []
        while (this.CanDraw(player)) {
            let newCard = this.DrawCard()
            drawnCards.push(newCard)
            player.Hand!.AddCards([newCard])
        }

        player.TellDraw(player, drawnCards, this)
        return true
    }

    public AskPlay(): void {
        const currentPlayer = this.CurrentPlayer()
        const canDraw = this.CanDraw(currentPlayer)
        const mustDraw = this.MustDraw(currentPlayer)
        let skip = false

        let toWait = []
        if (canDraw && !mustDraw) {
            toWait.push(currentPlayer.AskDraw(this).then((wantsToDraw) => {
                skip = !this.DrawCardsForPlayer(currentPlayer)
            }))
        } else if (mustDraw) {
            skip = !this.DrawCardsForPlayer(currentPlayer)
        }

        if (skip) {
            return this.AskPlay()
        }
        Promise.all(toWait).then(() => {
            this.CurrentPlayer().AskPlay(this).then((cards) => {
                this.PlayCards(currentPlayer, cards)

                this.IsStartingCard = false

                this.handleCards(currentPlayer, cards).then(() => {
                    this.AskPlay()
                })
            })
        })
    }
}