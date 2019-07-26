import * as Card from "./Card";

export class Hand {
    Cards: Array<Card.Card> = []

    public HasCards(cards: Array<Card.Card>): boolean {
        return cards.every((card) => this.Cards.includes(card))
    }

    public AddCards(cards: Array<Card.Card>): void {
        this.Cards = this.Cards.concat(cards)
    }

    public RemoveCards(cards: Array<Card.Card>): void {
        this.Cards = this.Cards.filter((card) => !cards.includes(card))
    }

    // FindLongestNormalSequence finds the longest possible sequences for the card without using combo mode
    public FindLongestNormalSequence(card: Card.Card): Array<Card.Card> {
        let seq = this.Cards.filter((card2) => card !== card2 && card2.CanSequence(card, false))
        // Make sure the card always goes first
        seq.unshift(card)
        return seq
    }
}

export interface TumppuPlayer {
    Hand?: Hand
}

export interface TargetedCard extends Card.Card {
    TargetPlayer?: TumppuPlayer
}

export class TargetedWildcard extends Card.Wildcard implements TargetedCard {
    TargetPlayer?: TumppuPlayer = undefined

    constructor(cardType: Card.WildcardCardType) {
        super(cardType)
    }
}

export interface ISerializedPlayer {
    Hand: Array<Card.ISerializedCard> | number
    Player?: Player
}

export class AbstractPlayer implements TumppuPlayer {
    Hand: Hand = new Hand
}

export class RealPlayer extends AbstractPlayer implements TumppuPlayer {
    Player: Player

    constructor(player: Player) {
        super()
        this.Player = player
    }
}
