import { GameState } from 'shared/GameState'
import { Card, NormalCard, Wildcard, WildcardCardType, Color, CardSequence } from 'shared/Card';
import { ServerPlayer, ServerGameState } from './GameState'
import { AbstractPlayer, TumppuPlayer } from 'shared/Player';

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

                // don't set color or target yet, the logic on when
                // it is needed should be delegated to GameState

                let outSequence = new CardSequence(chosen)
                resolve(outSequence)
                return
            }
            // combo mode
            // TODO: smarter combo AI
            let comboCards = this.Hand.Cards.filter((card) => card.CanPlay(state.LastCard(), true))
            // play cards one at a time
            let outSequence = new CardSequence([comboCards[0]])
            resolve(outSequence)
        })
    }

    public AskColor(state: GameState): Promise<Color> {
        return new Promise((resolve, reject) => resolve(this.getBestColor()))
    }

    public AskVote(cardType: WildcardCardType, count: number, state: GameState): Promise<Array<TumppuPlayer>> {
        const votes: Array<TumppuPlayer> = []
        for (let i = 0; i < count; i++) {
            votes.push(this.getBestPlayer(state))
        }
        return new Promise((resolve, reject) => resolve(votes))
    }

    public AskDraw(state: GameState): Promise<boolean> {
        return new Promise((resolve, reject) => resolve(true))
    }

    public async AskReady(): Promise<void> {
        //always ready
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

    public TellDraw(player: TumppuPlayer, cards: Array<Card>, endCombo: boolean, state: GameState): void {
        // nop
    }

    public TellColor(color: Color, state: GameState): void {
        // nop
    }

    public TellVoteCompleted(votes: Map<TumppuPlayer, TumppuPlayer>, tieBreaker: TumppuPlayer | undefined, state: GameState): void {
        // nop
    }

    public TellState(state: GameState): void {
        // nop
    }

    public TellHands(player: Array<TumppuPlayer>, state: GameState): void {
        // nop
    }

    public DrawCards(n: number, endCombo: boolean, state: ServerGameState): Array<Card> {
        let cards = state.DrawCards(n)
        this.Hand.AddCards(cards)
        state.BroadcastDraw(this, cards, endCombo)
        
        return cards
    }
}