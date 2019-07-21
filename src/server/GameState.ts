import { TumppuPlayer, GameState } from '../shared/GameState'
import { PlayedCardSequence, Color, Card, Wildcard, WildcardCardType, NormalCardType } from 'shared/Card';

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
        if (startingCard instanceof Wildcard && startingCard.CardType === WildcardCardType.Exchange) {
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
            // dealer gets the first "turn"
            this.AdvanceTurn()

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
            super.handleStartingCard(card)

            if (card instanceof Wildcard) {
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
                        (card.TargetPlayer! as ServerPlayer).DrawCards(card.DrawValue(), this)
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
        // TODO: democracy?
        (this.CurrentPlayer()).DrawCards(this.CurrentCombo!.DrawValue(), this)
        this.AdvanceTurn()
    }

    public BroadcastDraw(drawingPlayer: ServerPlayer, cards: Array<Card>): void {
        for (let player of this.Players) {
            player.TellDraw(drawingPlayer, cards, this)
        }
    }

    public PlayCards(cards: PlayedCardSequence): void {
        super.PlayCards(cards)

        for (let player of this.playersExcept(cards.Player as ServerPlayer)) {
            player.TellPlay(cards, this)
        }
    }

    protected handleCards(cards: PlayedCardSequence): Promise<void> {
        if (this.IsComboMode()) {
            return new Promise((resolve, reject) => {
                let toWait = []
                for (let card of cards.Cards) {
                    if (card instanceof Wildcard && card.CardType === WildcardCardType.Spy) {
                        toWait.push(this.askAndAnnounceTargetPlayer(cards.Player as ServerPlayer, card).then((targetPlayer) => {
                            (card as Wildcard).SetTargetPlayer(targetPlayer);
                            (cards.Player as ServerPlayer).TellHand(targetPlayer, this)
                        }))
                    }
                }

                Promise.all(toWait).then(() => {
                    super.handleCardsComboMode(cards)
                    resolve()
                }, reject)
            })
        }

        return new Promise((resolve, reject) => {
            // assume homogenous
            let toWait = []
            if (cards.Cards[0] instanceof Wildcard) {
                switch (cards.Cards[0].CardType) {
                case WildcardCardType.Dictator:
                    {
                        for (let card of cards.Cards) {
                            toWait.push(this.askAndAnnounceTargetPlayer(cards.Player as ServerPlayer, card).then((targetPlayer) => {
                                targetPlayer.DrawCards(card.DrawValue(), this)
                            }))
                        }
                    }
                    break
                case WildcardCardType.Everybody:
                    {
                        const cardsToDraw = cards.DrawValue()
                        for (let player of this.Players) {
                            player.DrawCards(cardsToDraw, this)
                        }
                    }
                    resolve()
                    break
                case WildcardCardType.Polluter:
                    {
                        const cardsToDraw = cards.DrawValue()
                        for (let player of this.playersExcept(cards.Player as ServerPlayer)) {
                            player.DrawCards(cardsToDraw, this)
                        }
                    }
                    break
                case WildcardCardType.Spy:
                    {
                        for (let card of cards.Cards) {
                            toWait.push(this.askAndAnnounceTargetPlayer(cards.Player as ServerPlayer, card).then((targetPlayer) => {
                                (card as Wildcard).SetTargetPlayer(targetPlayer);
                                (cards.Player as ServerPlayer).TellHand(targetPlayer, this)
                            }))
                        }
                    }
                    break
                case WildcardCardType.Exchange:
                    let myHand = cards.Player.Hand
                    let targetPlayer = (cards.Cards[0] as Wildcard).TargetPlayer!
                    let targetHand = targetPlayer.Hand
                    cards.Player.Hand = targetHand
                    targetPlayer.Hand = myHand
                    break
                }
                toWait.push((cards.Player as ServerPlayer).AskColor(this).then(color => {
                    for (let card of cards.Cards) {
                        card.Color = color
                    }
                }))
                Promise.all(toWait).then(() => {
                    resolve()
                }, reject)
                return
            }

            super.handleCards(cards)
            resolve()
        })
    }

    public AskPlay(): void {
        const currentPlayer = this.CurrentPlayer()
        const canDraw = currentPlayer.Hand.CanDraw(this)
        const mustDraw = currentPlayer.Hand.MustDraw(this)
        let skip = false

        let toWait = []
        if (canDraw && !mustDraw) {
            toWait.push(currentPlayer.AskDraw(this).then((wantsToDraw) => {
                if (this.IsComboMode()) {
                    this.EndCombo()
                    skip = true
                } else {
                    let drawnCards = []
                    while (currentPlayer.Hand.CanDraw(this)) {
                        drawnCards.push(currentPlayer.Hand.DrawCards(1, this)[0])
                    }

                    currentPlayer.TellDraw(currentPlayer, drawnCards, this)
                }
            }))
        }

        if (skip) {
            return this.AskPlay()
        }
        this.CurrentPlayer().AskPlay(this).then((cards) => {
            this.PlayCards(cards)
            this.handleCards(cards).then(() => {
                this.AskPlay()
            })
        })
    }
}