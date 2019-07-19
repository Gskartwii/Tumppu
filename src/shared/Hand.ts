import * as Card from './Card'
import * as GameState from './GameState'

export class Hand {
    Cards: Array<Card.Card> = []

    public DrawCards(n: number, state: GameState.GameState): Array<Card.Card> {
        let cards = state.DrawCards(n)
        this.Cards = this.Cards.concat(cards)

        return cards
    }

    private hasCards(cards: Array<Card.Card>): boolean {
        return cards.every((card) => this.Cards.includes(card))
    }

    public CanJumpInCards(cards: Card.PlayedCardSequence, state: GameState.GameState): boolean {
        return this.hasCards(cards.Cards) && state.CanJumpInCards(cards)
    }

    public JumpInCards(cards: Card.PlayedCardSequence, state: GameState.GameState): void {
        if (!this.CanJumpInCards(cards, state)) {
            error("can't jump in")
        }

        state.PlayCards(cards)
        this.Cards = this.Cards.filter((card) => !cards.Cards.includes(card))
    }

    public CanPlayCards(cards: Card.PlayedCardSequence, state: GameState.GameState): boolean {
        return this.hasCards(cards.Cards) && state.CanPlayCards(cards)
    }

    public PlayCards(cards: Card.PlayedCardSequence, state: GameState.GameState): void {
        if (!this.CanPlayCards(cards, state)) {
            error("can't play cards")
        }

        state.PlayCards(cards)
        this.Cards = this.Cards.filter((card) => !cards.Cards.includes(card))
    }

    public CanDraw(state: GameState.GameState): boolean {
        if (state.IsComboMode()) {
            return true
        }
        return this.Cards.every((card) => {
            return card.CardType === Card.WildcardCardType.Exchange
            || !card.CanPlay(state.LastCard(), state.IsComboMode())
        })
    }

    public MustDraw(state: GameState.GameState): boolean {
        // Players should only draw if none of their cards can be played, or if all playable cards are exchange cards
        return this.Cards.every((card) => card.CardType === Card.WildcardCardType.Exchange || !card.CanPlay(state.LastCard(), state.IsComboMode()))
    }

    // FindLongestNormalSequence finds the longest possible sequences for the card without using combo mode
    public FindLongestNormalSequence(card: Card.Card): Array<Card.Card> {
        let seq = this.Cards.filter((card2) => card !== card2 && card2.CanSequence(card, false))
        // Make sure the card always goes first
        seq.unshift(card)
        return seq
    }
}