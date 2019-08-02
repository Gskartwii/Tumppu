import * as Card from './Card'
import { ISerializedPlayer, TumppuPlayer, RealPlayer } from './Player'

export const enum Direction {
    Clockwise,
    CounterClockwise
}

export interface ISerializedGameState {
    Direction: Direction
    IsOpenMode: boolean
    IsStartingCard: boolean
    Players: Array<ISerializedPlayer>
    Turn: number
    LastPlayer: number
    DrawPile: number
    DiscardPile: {lastCard: Card.ISerializedCard, count: number }
    CurrentCombo: Array<Card.ISerializedCard> | undefined
}

export class GameState {
    Direction: Direction = Direction.Clockwise
    Players: Array<TumppuPlayer>
    Turn: number = 0
    IsOpenMode: boolean = false
    IsStartingCard: boolean = true
    // LastPlayer tracks the player of the last card
    // because when the combo mode ends on a wildcard
    // that wildcard may have been played by anybody
    // and its color won't be asked until the combo ends
    LastPlayer: TumppuPlayer

    DrawPile: Array<Card.Card> = []
    DiscardPile: Array<Card.Card> = []
    CurrentCombo: Card.CardSequence | undefined

    constructor(players: Array<TumppuPlayer>) {
        this.Players = players
        this.LastPlayer = this.CurrentPlayer()
    }

    protected initializeDrawPile(): void {
        let allCards = []
        // HACK: hardcoded number of colors since we can't use Object.keys/values on const enums
        for (let color: Card.Color = 0; color < 4; color++) {
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
        //allCards.push(new Card.Wildcard(Card.WildcardCardType.Democracy))
        allCards.push(new Card.Wildcard(Card.WildcardCardType.Dictator))
        allCards.push(new Card.Wildcard(Card.WildcardCardType.Everybody))
        //allCards.push(new Card.Wildcard(Card.WildcardCardType.Exchange))
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

        let card = this.DrawPile.shift()!
        if (card.IsWildcard()) {
            card.Color = undefined;
        }

        return card
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
        return this.DiscardPile[this.DiscardPile.size() - 1]
    }

    public CurrentPlayer(): TumppuPlayer {
        return this.Players[this.Turn]
    }

    public CanJumpInCards(player: TumppuPlayer, cards: Card.CardSequence): boolean {
        if (!cards.IsValid(this.IsComboMode())) {
            return false
        }
        return cards.Cards[0].CanJumpIn(this.LastCard())
    }

    public JumpInCards(player: TumppuPlayer, cards: Card.CardSequence): void {
        if (!this.CanJumpInCards(player, cards)) {
            error("can't jump in")
        }
        this.PlayCards(player, cards)
    }

    public CanPlayCards(player: TumppuPlayer, cards: Card.CardSequence): boolean {
        if (this.CurrentPlayer() !== player) {
            print("wrong player")
            return false
        }
        if (!cards.IsValid(this.IsComboMode())) {
            print("nonvalid seq")
            return false
        }
        if (!cards.Cards[0].CanPlay(this.LastCard(), this.IsComboMode())) {
            print("doesn't fit with previous")
            return false
        }

        // rule 7.f.ii
        if (cards.Cards.every((card) => card.IsWildcard() && card.CardType === Card.WildcardCardType.Exchange)
            && cards.Cards.size() === player.Hand!.Cards.size()) {
            print("player would run out")
            return false
        }

        return true
    }

    public CanDraw(player: TumppuPlayer): boolean {
        // TODO: don't allow playing exchange if it was ignored by this player
        return this.IsComboMode() || player.Hand!.Cards.every((card) => {
            return card instanceof Card.Wildcard && card.CardType === Card.WildcardCardType.Exchange
                || !card.CanPlay(this.LastCard(), this.IsComboMode())
        })
    }

    public MustDraw(player: TumppuPlayer): boolean {
        // TODO: don't allow playing exchange if it was ignored by this player
        return player.Hand!.Cards.every((card) => {
            return !card.CanPlay(this.LastCard(), this.IsComboMode())
        })
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
            default:
                error("can't handle card type " + card.CardType)
        }
    }

    protected handleCardsComboMode(player: TumppuPlayer, cards: Card.CardSequence): void {
        let turnCards = cards.Cards.filter((card) =>
            (!card.IsWildcard() && (
                card.CardType === Card.NormalCardType.Reverse ||
                card.CardType === Card.NormalCardType.Skip
            ) || (card.IsWildcard() &&
            card.CardType === Card.WildcardCardType.Exchange)))
        if (turnCards.size() === 0) {
            // only contains spy, +2, +4 and/or democracy
            if (cards.DrawValue() === 0) {
                // only spy cards: bail without advancing the turn
                // the turn doesn't end until the combo cards have been drawn,
                // after which EndCombo() will be called
                return
            }
            this.AdvanceTurn()
            return
        } else if (!turnCards[0].IsWildcard() && turnCards[0].CardType === Card.NormalCardType.Reverse) {
            // special case: rule 16.d.iii.1
            this.handleCardComboMode(turnCards[0], player)
            turnCards = turnCards.slice(1)
        }

        this.AdvanceTurn()

        for (let card of turnCards) {
            this.handleCardComboMode(card, player)
        }
    }

    protected handleCards(player: TumppuPlayer, cards: Card.CardSequence): void {
        if (this.IsComboMode()) {
            return this.handleCardsComboMode(player, cards)
        }

        // assume non-combo sequences are homogenous, i.e. all cards have the same type
        switch (cards.Cards[0].CardType) {
        case Card.NormalCardType.Reverse:
            // rule 7.a.iv
            if (this.IsDuel()) {
                // the turn will be advanced below, too
                this.AdvanceTurn()
            } else if (cards.Cards.size() % 2 === 1) {
                this.FlipDirection()
            }
            break
        case Card.NormalCardType.Skip:
            // rule 7.a.iv
            if (this.IsDuel()) {
                // the turn will be advanced below, too
                // advance exactly once
                this.AdvanceTurn()
            } else {
                const numCards = cards.Cards.size()
                for (let i = 0; i < numCards; i++) {
                    this.AdvanceTurn()
                }
            }
            break
        }

        this.AdvanceTurn()
    }

    private playCards(player: TumppuPlayer, cards: Card.CardSequence): void {
        if (!this.IsComboMode() && cards.IsComboStartSequence()) {
            this.CurrentCombo = cards
        } else if (this.IsComboMode()) {
            this.CurrentCombo!.Cards = this.CurrentCombo!.Cards.concat(cards.Cards)
        }

        this.DiscardPile = this.DiscardPile.concat(cards.Cards)
        player.Hand!.RemoveCards(cards.Cards)
    }

    public PlayCards(player: TumppuPlayer, cards: Card.CardSequence): void {
        if (!this.CanPlayCards(player, cards)) {
            error("can't play cards")
        }

        this.LastPlayer = player
        this.playCards(player, cards)
    }

    public AdvanceTurn(): void {
        switch (this.Direction) {
        case Direction.Clockwise:
            this.Turn++
            this.Turn %= this.Players.size()
            break
        case Direction.CounterClockwise:
            if (this.Turn === 0) {
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
        print("combo end:", this.CurrentCombo!.DrawValue())
        this.CurrentCombo = undefined
        this.AdvanceTurn()
    }

    public DeserializePlayer(index: number): TumppuPlayer {
        return this.Players[index]
    }

    public SerializePlayer(player: TumppuPlayer): number {
        let index = this.Players.indexOf(player)
        if (index === -1) {
            error("couldn't serialize player")
        }
        return index
    }

    public SerializePlayerForInit(hidden: boolean, player: TumppuPlayer): ISerializedPlayer {
        return {
            Hand: hidden ? player.Hand!.Cards.size() : player.Hand!.Cards.map((card) => this.SerializeCard(card)),
            Player: player instanceof RealPlayer ? player.Player : undefined
        }
    }

    public Serialize(forPlayer?: TumppuPlayer): ISerializedGameState {
        return {
            Direction: this.Direction,
            Players: this.Players.map((player) => this.SerializePlayerForInit(player !== forPlayer, player)),
            Turn: this.Turn,
            DrawPile: this.DrawPile.size(),
            DiscardPile: {lastCard: this.SerializeCard(this.LastCard()), count: this.DiscardPile.size()},
            CurrentCombo: this.CurrentCombo !== undefined ? this.CurrentCombo.Cards.map((card) => this.SerializeCard(card)) : undefined, 
            IsOpenMode: this.IsOpenMode,
            IsStartingCard: this.IsStartingCard,
            LastPlayer: this.SerializePlayer(this.LastPlayer),
        }
    }

    protected handleStartingCard(card: Card.Card): void {
        if (card instanceof Card.NormalCard) {
            switch (card.CardType) {
            case Card.NormalCardType.Reverse:
                this.FlipDirection()
                break
            case Card.NormalCardType.Skip:
                this.AdvanceTurn()
                break
            case Card.NormalCardType.Draw2:
                this.CurrentCombo = new Card.CardSequence()
                this.CurrentCombo.Cards = this.DiscardPile
                break
            }
        } else {
            switch (card.CardType) {
            case Card.WildcardCardType.Democracy:
            case Card.WildcardCardType.Draw4:
                this.CurrentCombo = new Card.CardSequence()
                this.CurrentCombo.Cards = this.DiscardPile
                break
            case Card.WildcardCardType.Spy:
                this.IsOpenMode = true
                break
            }
        }

        this.AdvanceTurn()
    }

    public SerializeCard(card: Card.Card): Card.ISerializedCard {
        return {
            Wildcard: card.IsWildcard(),
            Type: card.CardType,
            Color: card.Color,
            Number: card instanceof Card.NormalCard ? card.Number : undefined,
        }
    }

    public DeserializeCard(serialized: Card.ISerializedCard): Card.Card {
        if (serialized.Wildcard) {
            let result = new Card.Wildcard(serialized.Type as Card.WildcardCardType)
            result.Color = serialized.Color

            return result
        }
        return new Card.NormalCard(serialized.Color!, serialized.Type as Card.NormalCardType, serialized.Number)
    }
}