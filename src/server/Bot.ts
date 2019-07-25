import { GameState } from 'shared/GameState'
import { Card, NormalCard, Wildcard, WildcardCardType, Color, CardSequence } from 'shared/Card';
import { ServerPlayer, ServerGameState } from './GameState'
import { AbstractPlayer, TumppuPlayer, TargetedWildcard } from 'shared/Player';

export class BotPlayer extends AbstractPlayer implements ServerPlayer {
    private getBestColor(): Color {
        return (this.Hand.Cards.filter((card) => card instanceof NormalCard) as Array<NormalCard>)
            .reduce((map, card) => {
                map.get(card.Color)!.push(card)
                return map
            }, new Map<Color, Array<Card>>(Object.values([0, 1, 2, 3] as Array<Color>).map((color) => [color, []])))
            .entries()
            .reduce((prev, current) => prev.size() < current.size() ? current : prev)[0]
    }

    private getBestPlayer(state: GameState): TumppuPlayer {
        return state.Players
            .filter((player) => player !== this)
            .reduce((prev, current) => prev.Hand!.Cards.size() < current.Hand!.Cards.size() ? prev : current)
    }

    // use promise for compatibility
    // AskPlay should never be called if Hand.ShouldDraw() returns true
    public AskPlay(state: GameState): Promise<CardSequence> {
        print("asking bot to play")
        return new Promise((resolve, reject) => {
            if (state.MustDraw(this)) {
                reject("hand should draw yet bot asked to play")
            }
            if (!state.IsComboMode()) {
                let lastCard = state.LastCard()
                let myCards = this.Hand.Cards

                // find sequences of cards that begin with the same color as the last card
                let cardsOfColor = myCards.filter((card) => card.Color === lastCard.Color)
                let sequences = cardsOfColor.map<Array<Card>>((card) => this.Hand.FindLongestNormalSequence(card))

                if (lastCard instanceof NormalCard) {
                    // find the sequence of cards that begin with the same symbol as the last card, if any
                    let sameTypeSequence = myCards.filter((card) => card.CanSequence(state.LastCard(), false))
                    if (sameTypeSequence.size() !== 0) {
                        // may be a duplicate, but it doesn't matter
                        sequences.push(sameTypeSequence)
                    }
                }

                // find sequences of wildcards with the same symbol
                let wildcards = (myCards.filter((card) => card.IsWildcard()) as Array<Wildcard>)
                    .reduce((map, card) => {
                        let mapArr = map.get(card.CardType)
                        if (mapArr === undefined) {
                            mapArr = []
                            map.set(card.CardType, mapArr)
                        }
                        mapArr.push(card)
                        return map
                    }, new Map<WildcardCardType, Array<Card>>()).values()
                sequences = sequences.concat(wildcards)

                let chosen = sequences.reduce((prev, curr) => prev.size() < curr.size() ? prev : curr)
                let chosenCard = chosen[0]

                if (chosenCard.IsWildcard()) {
                    let wildArray = (chosen as Array<TargetedWildcard>)
                    switch (chosenCard.CardType) {
                    case WildcardCardType.Dictator:
                    case WildcardCardType.Exchange:
                    // spying results are discarded for now
                    case WildcardCardType.Spy:
                        let playerWithLeastCards = this.getBestPlayer(state);
                        wildArray.forEach((card) => card.TargetPlayer = playerWithLeastCards)
                    }

                    // find color with most cards
                    let bestColor = this.getBestColor()
                    wildArray.forEach((card) => card.Color = bestColor)
                }

                let outSequence = new CardSequence
                outSequence.Cards = chosen
                resolve(outSequence)
                return
            }
            // combo mode
            // TODO: smarter combo AI
            let comboCards = this.Hand.Cards.filter((card) => card.IsComboCard())
            let outSequence = new CardSequence
            // play cards one at a time
            outSequence.Cards = [comboCards[0]]
            resolve(outSequence)
        })
    }

    public AskColor(state: GameState): Promise<Color> {
        return new Promise((resolve, reject) => resolve(this.getBestColor()))
    }

    public AskVote(state: GameState): Promise<TumppuPlayer> {
        return new Promise((resolve, reject) => resolve(this.getBestPlayer(state)))
    }

    public AskDraw(state: GameState): Promise<boolean> {
        return new Promise((resolve, reject) => resolve(true))
    }

    public TellPlay(player: TumppuPlayer, cards: CardSequence, state: GameState): void {
        // aggressive jump-in
        /*let cardsToJumpIn = this.Hand.Cards.filter((card) => card.CanJumpIn(state.LastCard()))
        if (cardsToJumpIn.size() !== 0) {
            let sequences = cardsToJumpIn.map<Array<Card>>((card) => this.Hand.FindLongestNormalSequence(card))
            let shortestSequence = sequences.reduce((prev, curr) => prev.size() < curr.size() ? prev : curr)

            let playedSeq = new CardSequence
            playedSeq.Cards = shortestSequence

            state.JumpInCards(this, playedSeq)
        }*/
    } 

    public TellDraw(player: TumppuPlayer, cards: Array<Card>, state: GameState): void {
        // nop
    }

    public TellColor(color: Color, state: GameState): void {
        // nop
    }

    public TellVoteCompleted(votes: Map<TumppuPlayer, TumppuPlayer>, state: GameState): void {
        // nop
    }

    public TellState(state: GameState): void {
        // nop
    }

    public TellHand(player: TumppuPlayer, state: GameState): void {
        // nop
    }

    public DrawCards(n: number, state: ServerGameState): Array<Card> {
        let cards = state.DrawCards(n)
        this.Hand.AddCards(cards)
        state.BroadcastDraw(this, cards)
        
        return cards
    }
}