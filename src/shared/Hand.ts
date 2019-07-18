import * as Card from './Card'
import * as DeckState from './DeckState'

export class Hand {
    Cards: Array<Card.Card> = []

    public DrawCards(n: number, state: DeckState.DeckState): Array<Card.Card> {
        let cards = state.DrawCards(n)
        this.Cards = this.Cards.concat(cards)

        return cards
    }

    private hasCards(cards: Array<Card.Card>): boolean {
        return cards.every((card) => this.Cards.includes(card))
    }

    public CanJumpInCards(cards: Card.CardSequence, state: DeckState.DeckState): boolean {
        return this.hasCards(cards.Cards) && state.CanJumpInCards(cards)
    }

    public JumpInCards(cards: Card.CardSequence, state: DeckState.DeckState): void {
        if (!this.CanJumpInCards(cards, state)) {
            error("can't jump in")
        }

        state.PlayCards(cards)
        this.Cards = this.Cards.filter((card) => !cards.Cards.includes(card))
    }

    public CanPlayCards(cards: Card.CardSequence, state: DeckState.DeckState): boolean {
        return this.hasCards(cards.Cards) && state.CanPlayCards(cards)
    }

    public PlayCards(cards: Card.CardSequence, state: DeckState.DeckState): void {
        if (!this.CanPlayCards(cards, state)) {
            error("can't play cards")
        }

        state.PlayCards(cards)
        this.Cards = this.Cards.filter((card) => !cards.Cards.includes(card))
    }

    public ShouldDraw(state: DeckState.DeckState): boolean {
        // Players should only draw if none of their cards can be played
        return this.Cards.every((card) => !card.CanPlay(state.LastCard(), state.IsComboMode()))
    }
}