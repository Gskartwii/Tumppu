import * as Card from "./Card"

export class DeckState {
    DrawPile: Card.CardSequence
    DiscardPile: Card.CardSequence
    CurrentCombo: Card.CardSequence

    constructor() {
        this.DrawPile = new Card.CardSequence
        this.DiscardPile = new Card.CardSequence
        this.CurrentCombo = new Card.CardSequence
    }

    private initializeDrawPile(): void {
        let allCards = new Card.CardSequence
        for (let color of Object.values(Card.Color)) {
            allCards.Cards.push(new Card.NormalCard(color, Card.NormalCardType.Number, 0))
            for (let i = 0; i < 2; i++) {
                for (let j = 1; j <= 9; j++) {
                    allCards.Cards.push(new Card.NormalCard(color, Card.NormalCardType.Number, j))
                }

                allCards.Cards.push(new Card.NormalCard(color, Card.NormalCardType.Draw2))
                allCards.Cards.push(new Card.NormalCard(color, Card.NormalCardType.Reverse))
                allCards.Cards.push(new Card.NormalCard(color, Card.NormalCardType.Skip))
            }
        }

        for (let i = 0; i < 4; i++) {
            allCards.Cards.push(new Card.Wildcard(Card.WildcardCardType.Draw4))
        }
        for (let i = 0; i < 3; i++) {
            allCards.Cards.push(new Card.Wildcard(Card.WildcardCardType.Spy))
        }
        allCards.Cards.push(new Card.Wildcard(Card.WildcardCardType.Democracy))
        allCards.Cards.push(new Card.Wildcard(Card.WildcardCardType.Dictator))
        allCards.Cards.push(new Card.Wildcard(Card.WildcardCardType.Everybody))
        allCards.Cards.push(new Card.Wildcard(Card.WildcardCardType.Exchange))
        allCards.Cards.push(new Card.Wildcard(Card.WildcardCardType.Polluter))

        this.DrawPile = allCards
    }

    public RandomizeDrawPile(): void {
        this.initializeDrawPile()

        let drawPileCards = this.DrawPile.Cards
        for (let i = 0; i < drawPileCards.size(); i++) {
            const randomCardIndex: number = math.random(i, drawPileCards.size() - 1);

            const temp = drawPileCards[randomCardIndex];
            drawPileCards[randomCardIndex] = drawPileCards[i];
            drawPileCards[i] = temp;
        }
    }

    public CanDrawCards(n: number): boolean {
        // must always keep one card in discard pile
        return (this.DrawPile.Cards.size() + this.DiscardPile.Cards.size()) > n + 1
    }

    public CanDrawCard(): boolean {
        return this.CanDrawCards(1)
    }

    public DrawCard(): Card.Card {
        if (this.DrawPile.Cards.size() === 0) {
            // Flip the deck over, except for the last card
            let lastIndex = this.DiscardPile.Cards.size() - 1
            this.DrawPile.Cards = this.DiscardPile.Cards.slice(0, lastIndex - 1)
            this.DiscardPile.Cards = this.DiscardPile.Cards.slice(lastIndex)
        }

        return this.DrawPile.Cards.shift()!
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
        return this.DiscardPile.Cards[0]
    }

    public CanJumpInCards(cards: Card.CardSequence): boolean {
        if (!cards.IsValid(this.IsComboMode())) {
            return false
        }
        return cards.Cards[0].CanJumpIn(this.LastCard(), this.IsComboMode())
    }

    public JumpInCards(cards: Card.CardSequence): void {
        if (!this.CanJumpInCards(cards)) {
            error("can't jump in")
        }
        this.PlayCards(cards)
    }

    public CanPlayCards(cards: Card.CardSequence): boolean {
        if (!cards.IsValid(this.IsComboMode())) {
            return false
        }
        if (!cards.Cards[0].CanPlay(this.LastCard(), this.IsComboMode())) {
            return false
        }
        return true
    }

    public PlayCards(cards: Card.CardSequence): void {
        if (!this.CanPlayCards(cards)) {
            error("can't play cards")
        }
        if (!this.IsComboMode() && cards.IsComboStartSequence()) {
            this.CurrentCombo = cards
        } else if (this.IsComboMode()) {
            this.CurrentCombo.Cards.concat(cards.Cards)
        }

        this.DiscardPile.Cards.concat(cards.Cards)
    }
}