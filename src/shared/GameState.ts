import * as Hand from './Hand'
import * as Card from './Card'

export const enum Direction {
    Clockwise,
    CounterClockwise
}

export interface TumppuPlayer {
    Hand: Hand.Hand
    Active: boolean
}

export class RealPlayer implements TumppuPlayer {
    Hand: Hand.Hand = new Hand.Hand
    Active: boolean = true
    Player: Player

    constructor(player: Player) {
        this.Player = player
    }
}

export class GameState {
    Direction: Direction = Direction.Clockwise
    Players: Array<TumppuPlayer>
    Turn: number = 0

    DrawPile: Array<Card.Card> = []
    DiscardPile: Array<Card.Card> = []
    CurrentCombo: Card.CardSequence | undefined

    private initializeDrawPile(): void {
        let allCards = []
        for (let color of Object.values(Card.Color)) {
            allCards.push(new Card.NormalCard(color, Card.NormalCardType.Number, 0))
            for (let i = 0; i < 2; i++) {
                for (let j = 1; j <= 9; j++) {
                    allCards.push(new Card.NormalCard(color, Card.NormalCardType.Number, j))
                }

                allCards.push(new Card.NormalCard(color, Card.NormalCardType.Draw2))
                allCards.push(new Card.NormalCard(color, Card.NormalCardType.Reverse))
                allCards.push(new Card.NormalCard(color, Card.NormalCardType.Skip))
            }
        }

        for (let i = 0; i < 4; i++) {
            allCards.push(new Card.Wildcard(Card.WildcardCardType.Draw4))
        }
        for (let i = 0; i < 3; i++) {
            allCards.push(new Card.Wildcard(Card.WildcardCardType.Spy))
        }
        allCards.push(new Card.Wildcard(Card.WildcardCardType.Democracy))
        allCards.push(new Card.Wildcard(Card.WildcardCardType.Dictator))
        allCards.push(new Card.Wildcard(Card.WildcardCardType.Everybody))
        allCards.push(new Card.Wildcard(Card.WildcardCardType.Exchange))
        allCards.push(new Card.Wildcard(Card.WildcardCardType.Polluter))

        this.DrawPile = allCards
    }

    public RandomizeDrawPile(): void {
        this.initializeDrawPile()

        let drawPileCards = this.DrawPile
        for (let i = 0; i < drawPileCards.size(); i++) {
            const randomCardIndex: number = math.random(i, drawPileCards.size() - 1);

            const temp = drawPileCards[randomCardIndex];
            drawPileCards[randomCardIndex] = drawPileCards[i];
            drawPileCards[i] = temp;
        }
    }

    public CanDrawCards(n: number): boolean {
        // must always keep one card in discard pile
        return (this.DrawPile.size() + this.DiscardPile.size()) > n + 1
    }

    public CanDrawCard(): boolean {
        return this.CanDrawCards(1)
    }

    public DrawCard(): Card.Card {
        if (this.DrawPile.size() === 0) {
            // Flip the deck over, except for the last card
            let lastIndex = this.DiscardPile.size() - 1
            this.DrawPile = this.DiscardPile.slice(0, lastIndex - 1)
            this.DiscardPile = this.DiscardPile.slice(lastIndex)
        }

        return this.DrawPile.shift()!
    }

    public DrawCards(n: number): Array<Card.Card> {
        let out = []

        for (let i = 0; i < n; i++) {
            out.push(this.DrawCard())
        }

        return out
    }

    public IsComboMode(): boolean {
        return this.CurrentCombo !== undefined
    }

    public LastCard(): Card.Card {
        return this.DiscardPile[0]
    }

    public CurrentPlayer(): TumppuPlayer {
        return this.Players[this.Turn]
    }

    public CanJumpInCards(cards: Card.PlayedCardSequence): boolean {
        if (!cards.IsValid(this.IsComboMode())) {
            return false
        }
        return cards.Cards[0].CanJumpIn(this.LastCard())
    }

    public JumpInCards(cards: Card.PlayedCardSequence): void {
        if (!this.CanJumpInCards(cards)) {
            error("can't jump in")
        }
        this.PlayCards(cards)
    }

    public CanPlayCards(cards: Card.PlayedCardSequence): boolean {
        if (this.CurrentPlayer() !== cards.Player) {
            return false
        }
        if (!cards.IsValid(this.IsComboMode())) {
            return false
        }
        if (!cards.Cards[0].CanPlay(this.LastCard(), this.IsComboMode())) {
            return false
        }

        // rule 7.f.ii
        if (cards.Cards.every((card) => card.CardType === Card.WildcardCardType.Exchange)
            && cards.Cards.size() === cards.Player.Hand.Cards.size()) {
            return false
        }

        return true
    }

    public FlipDirection(): void {
        if (this.Direction === Direction.Clockwise) {
            this.Direction = Direction.CounterClockwise
        } else {
            this.Direction = Direction.Clockwise
        }
    }

    public IsDuel(): boolean {
        return this.Players.size() === 2
    }

    protected handleCardComboMode(card: Card.Card, player: TumppuPlayer): void {
        switch (card.CardType) {
            case Card.NormalCardType.Skip:
                // rule 16.d.v
                if (!this.IsDuel()) {
                    this.AdvanceTurn()
                }
                break
            case Card.NormalCardType.Reverse:
                // rule 16.d.v
                if (!this.IsDuel()) {
                    this.FlipDirection()
                }
                break
            case Card.WildcardCardType.Exchange:
                let myHand = player.Hand
                let targetPlayer = (card as Card.Wildcard).TargetPlayer!
                let otherHand = targetPlayer.Hand
                player.Hand = otherHand
                targetPlayer.Hand = myHand

                this.GiveTurn(targetPlayer)

                break
            default:
                error("can't handle card type " + card.CardType)
        }
    }

    protected handleCardsComboMode(cards: Card.PlayedCardSequence): void {
        if (cards.Cards.every((card) => card.CardType === Card.WildcardCardType.Spy)) {
            this.EndCombo()
            return
        }

        let turnCards = cards.Cards.filter((card) =>
            card.CardType === Card.NormalCardType.Reverse ||
            card.CardType === Card.NormalCardType.Skip ||
            card.CardType === Card.WildcardCardType.Exchange)
        if (turnCards.size() === 0) {
            // only contains +2, +4 and/or democracy
            this.AdvanceTurn()
            return
        } else if (turnCards[0].CardType === Card.NormalCardType.Reverse) {
            // special case: rule 16.d.iii.1
            this.handleCardComboMode(turnCards[0], cards.Player)
            turnCards = turnCards.slice(1)
        }

        this.AdvanceTurn()

        for (let card of turnCards) {
            this.handleCardComboMode(card, cards.Player)
        }
    }

    protected handleCards(cards: Card.PlayedCardSequence): void {
        if (this.IsComboMode()) {
            return this.handleCardsComboMode(cards)
        }

        // assume non-combo sequences are homogenous, i.e. all cards have the same type
        switch (cards.Cards[0].CardType) {
        case Card.NormalCardType.Reverse:
            // rule 7.a.iv
            if (this.IsDuel()) {
                this.GiveTurn(cards.Player)
            } else if (cards.Cards.size() % 2 == 1) {
                this.FlipDirection()
            }
            break
        case Card.NormalCardType.Skip:
            // rule 7.a.iv
            if (this.IsDuel()) {
                this.GiveTurn(cards.Player)
            } else {
                const numCards = cards.Cards.size()
                for (let i = 0; i < numCards; i++) {
                    this.AdvanceTurn()
                }
            }
            break

        // spy cards handled by client and server code

        case Card.WildcardCardType.Dictator:
            for (let card of cards.Cards) {
                (card as Card.Wildcard).TargetPlayer!.Hand.DrawCards(card.DrawValue(), this)
            }
            break
        
        case Card.WildcardCardType.Everybody:
            {
                const cardsToDraw = cards.DrawValue()
                for (let player of this.Players) {
                    player.Hand.DrawCards(cardsToDraw, this)
                }
            }
            break

        case Card.WildcardCardType.Polluter:
            // scopes are weird
            {
                const cardsToDraw = cards.DrawValue()
                for (let player of this.Players.filter((player) => player !== cards.Player)) {
                    player.Hand.DrawCards(cardsToDraw, this)
                }
            }
            break
        
        case Card.WildcardCardType.Exchange:
           let myHand = cards.Player.Hand
           let targetPlayer = (cards.Cards[0] as Card.Wildcard).TargetPlayer!
           let targetHand = targetPlayer.Hand
           cards.Player.Hand = targetHand
           targetPlayer.Hand = myHand
           break
        }

        this.AdvanceTurn()
    }

    public PlayCards(cards: Card.PlayedCardSequence): void {
        if (!this.CanPlayCards(cards)) {
            error("can't play cards")
        }
        if (!this.IsComboMode() && cards.IsComboStartSequence()) {
            this.CurrentCombo = cards
        } else if (this.IsComboMode()) {
            this.CurrentCombo!.Cards.concat(cards.Cards)
        }

        this.DiscardPile.concat(cards.Cards)

        this.handleCards(cards)
    }

    public AdvanceTurn(): void {
        switch (this.Direction) {
        case Direction.Clockwise:
            this.Turn++
            this.Turn %= this.Players.size()
            break
        case Direction.CounterClockwise:
            if (this.Turn == 0) {
                this.Turn = this.Players.size() - 1
            } else {
                this.Turn--
            }
            break
        }
    }

    public GiveTurn(player: TumppuPlayer): void {
        this.Turn = this.Players.indexOf(player)
        if (this.Turn === -1) {
            error("couldn't find player")
        }
    }

    public EndCombo(): void {
        this.CurrentPlayer().Hand.DrawCards(this.CurrentCombo!.DrawValue(), this)
        this.CurrentCombo = undefined
    }

    constructor(players: Array<TumppuPlayer>) {
        this.RandomizeDrawPile()
        this.DiscardPile = [this.DrawCard()]

        this.Players = players
        for (let player of players) {
            player.Hand.DrawCards(7, this)
        }
    }
}