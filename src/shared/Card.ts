export const enum Color {
    Red,
    Blue,
    Yellow,
    Green
}

export const enum NormalCardType {
    Number,
    Skip,
    Reverse,
    Draw2
}

export const enum WildcardCardType {
    Spy,
    Draw4,
    Exchange,
    Democracy,
    Everybody,
    Polluter,
    Dictator
}

export interface Card {
    Color: Color | undefined
    CardType: NormalCardType | WildcardCardType

    IsSpecial(): boolean
    IsComboStartCard(): boolean
    IsComboCard(): boolean
    IsWildcard(): this is Wildcard
    DrawValue(): number
    CanJumpIn(previous: Card): boolean
    CanSequence(previous: Card, comboMode: boolean): boolean
    CanPlay(previous: Card, comboMode: boolean): boolean
    Name(): string
}

export interface ISerializedCard {
    Wildcard: boolean
    Type: NormalCardType | WildcardCardType
    Color?: Color
    Number?: number
}

export class NormalCard implements Card {
    Color: Color
    CardType: NormalCardType
    Number: number | undefined

    constructor(color: Color, cardType: NormalCardType, num: number | undefined = undefined) {
        this.Color = color
        this.CardType = cardType

        if (!this.IsSpecial()) {
            this.Number = num!
            assert(0 <= this.Number && this.Number <= 9, "Invalid number")
        } else {
            this.Number = undefined
        }
    }

    public IsSpecial(): boolean {
        return this.CardType !== NormalCardType.Number
    }

    public IsComboStartCard(): boolean {
        return this.CardType === NormalCardType.Draw2
    }

    public IsComboCard(): boolean {
        return this.IsSpecial()
    }

    public DrawValue(): number {
        if (this.CardType === NormalCardType.Draw2) {
            return 2
        } else {
            return 0
        }
    }

    public CanJumpIn(previous: Card): boolean {
        if (previous instanceof NormalCard) {
            return previous.CardType === this.CardType && previous.Color === this.Color
        }
        return false
    }

    public CanSequence(previous: Card, comboMode: boolean): boolean {
        if (comboMode) {
            // combo mode: allow any card that can be played on the previous one
            return this.CanPlay(previous, comboMode)
        }

        if (previous instanceof NormalCard) {
            return previous.CardType === this.CardType && previous.Number === this.Number
        }
        return false
    }

    public CanPlay(previous: Card, comboMode: boolean): boolean {
        if (comboMode) {
            if (!this.IsComboCard()) {
                return false
            }

            if (previous.IsWildcard()) {
                return true
            }
            return previous.Color === this.Color || previous.CardType === this.CardType
        }
        if (previous.Color === this.Color) {
            return true
        }
        if (previous instanceof NormalCard) {
            // Same card type; pass
            return previous.CardType === this.CardType && previous.Number === this.Number
        }

        // Wildcard with wrong color
        return false
    }

    public Name(): string {
        switch (this.CardType) {
        case NormalCardType.Draw2:
            return "+2"
        case NormalCardType.Reverse:
            return "RC"
        case NormalCardType.Skip:
            return "SC"
        case NormalCardType.Number:
            return tostring(this.Number!)
        }
    }

    public IsWildcard(): this is Wildcard {
        return false
    }
}

export class Wildcard implements Card {
    Color: Color | undefined
    CardType: WildcardCardType
    constructor(cardType: WildcardCardType) {
        this.CardType = cardType
    }

    public IsSpecial(): boolean {
        return true
    }

    public IsComboStartCard(): boolean {
        switch (this.CardType) {
        case WildcardCardType.Draw4:
        case WildcardCardType.Democracy:
            return true
        default:
            return false
        }
    }

    public DrawValue(): number {
        switch (this.CardType) {
        case WildcardCardType.Spy:
        case WildcardCardType.Exchange:
            return 0
        default:
            return 4
        }
    }

    public IsComboCard(): boolean {
        if (this.IsComboStartCard()) {
            return true
        }

        switch (this.CardType) {
        case WildcardCardType.Spy:
        case WildcardCardType.Exchange:
            return true
        default:
            return false
        }
    }

    public CanJumpIn(previous: Card): boolean {
        if (previous.IsWildcard()) {
            return previous.CardType === this.CardType
        }
        return false
    }

    public CanSequence(previous: Card, comboMode: boolean): boolean {
        if (comboMode) {
            // combo mode: allow any card that can be played in combo mode
            return this.CanPlay(previous, comboMode)
        }

        // only cards that are strictly the same can be played in sequence
        return this.CanJumpIn(previous)
    }

    public CanPlay(previous: Card, comboMode: boolean): boolean {
        if (comboMode) {
            switch (this.CardType) {
            case WildcardCardType.Draw4:
            case WildcardCardType.Democracy:
            case WildcardCardType.Spy:
                return true
            default:
                return false
            }
        }

        return true
    }
    
    public Name(): string {
        switch (this.CardType) {
        case WildcardCardType.Democracy:
            return "DMC"
        case WildcardCardType.Draw4:
            return "+4"
        case WildcardCardType.Dictator:
            return "DC"
        case WildcardCardType.Everybody:
            return "EC"
        case WildcardCardType.Exchange:
            return "XC"
        case WildcardCardType.Polluter:
            return "PC"
        case WildcardCardType.Spy:
            return "SPC"
        }
    }

    public IsWildcard(): this is Wildcard {
        return true
    }
}

export class CardSequence {
    Cards: Array<Card>

    constructor(cards: Array<Card> = []) {
        this.Cards = cards
    }

    public IsValid(comboMode: boolean): boolean {
        if (this.Cards.size() === 0) {
            return false
        }

        if (!comboMode) {
            comboMode = this.Cards.some((card) => card.IsComboStartCard())
        }

        // rule 16.iv: a combo mode sequence must contain one exchange card at most
        if (comboMode) {
            let countExchanges = this.Cards.filter((card) => card.CardType === WildcardCardType.Exchange).size()
            if (countExchanges > 1) {
                return false
            }
        }

        let previousCard = this.Cards[0]
        for (let card of this.Cards.slice(1)) {
            if (!card.CanSequence(previousCard, comboMode)) {
                return false
            }
        }

        return true
    }

    public CanPlay(previous: Card, comboMode: boolean): boolean {
        if (!this.IsValid(comboMode)) {
            return false
        }

        if (!this.Cards[0].CanPlay(previous, comboMode)) {
            return false
        }

        return true
    }

    public CanJumpIn(previous: Card, comboMode: boolean): boolean {
        if (!this.IsValid(comboMode)) {
            return false
        }

        if (!this.Cards[0].CanJumpIn(previous)) {
            return false
        }

        return true
    }

    public IsComboStartSequence(): boolean {
        return this.Cards.some((card) => card.IsComboStartCard())
    }

    public DrawValue(): number {
        return this.Cards
            .map<number>((card) => card.DrawValue())
            .reduce((prev, curr) => prev + curr)
    }

    public HasType(cardType: NormalCardType | WildcardCardType): boolean {
        return this.Cards.some((card) => card.CardType === cardType)
    }

    public CanAddCard(card: Card, isComboMode: boolean): boolean {
        if (this.Cards.size() === 0) {
            if (isComboMode) {
                return card.IsComboCard()
            }
            return true
        }

        let lastCard = this.Cards[this.Cards.size() - 1]
        if (isComboMode) {
            if (!this.IsValid(true)) {
                return false
            }
            if (!card.CanSequence(lastCard, true)) {
                return false
            }
            return true
        }

        // be a bit more lenient outside combomode: allow the player
        // to build combo start sequences

        // whether this is a combo sequence attempt or not is determined by checking
        // if the last card can be a combo card
        // if not, we use non-combo sequencing rules
        // if yes, we use combo sequencing rules
        // the sequences this yields might be invalid outside combo mode
        // if they don't contain a starting card
        return card.CanSequence(lastCard, lastCard.IsComboCard())
    }
}