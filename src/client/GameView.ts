import { LocalGameState } from "./GameState";
import { RenderCardSet } from "./Hand";
import { Card, CardSequence } from "shared/Card";
import { RenderCard } from "./Card";

const QueueMoveTweenInfo = new TweenInfo(
    1/4, //time
    Enum.EasingStyle.Quart,
    Enum.EasingDirection.InOut,
)
const MovingCardZIndex = 5

const TweenService = game.GetService("TweenService")
const UserInputService = game.GetService("UserInputService")

class RenderDecks {
    private deckContainer: Frame
    private currentDrawDeck: Frame
    private currentPlayedCard: Frame

    constructor(deckContainer: Frame) {
        this.deckContainer = deckContainer
        this.currentDrawDeck = deckContainer.FindFirstChild<Frame>("Draw")!
        this.currentPlayedCard = deckContainer.FindFirstChild<Frame>("PlayedCard")!
    }

    public RenderPlayedCard(card: Card) {
        this.currentPlayedCard.Destroy()
        let render = new RenderCard(card).FrontAsFrame()
        render.Name = "PlayedCard"
        render.Parent = this.deckContainer
        this.currentPlayedCard = render
    }
}

class SequencePlayHandler {
    PlayQueue = new CardSequence
    GameState: LocalGameState
    private handConnections: Array<RBXScriptConnection> = []
    private queueConnections: Map<TextButton, RBXScriptConnection> = new Map()

    private handRender: RenderCardSet
    private queueRender: RenderCardSet
    private backFrame: GuiBase2d

    private animationPromise?: Promise<void>

    constructor(state: LocalGameState, handRender: RenderCardSet, queueRender: RenderCardSet, backFrame: GuiBase2d) {
        this.GameState = state
        this.handRender = handRender
        this.queueRender = queueRender
        this.backFrame = backFrame
    }

    private queueAnimation(animation: () => Promise<void>): void {
        if (this.animationPromise === undefined) {
            this.animationPromise = animation()
            return
        }
        this.animationPromise = this.animationPromise.then(animation)
    }

    private transformAbsolutePosition(pos: Vector2): Vector2 {
        return pos.sub(this.backFrame.AbsolutePosition)
    }

    private swapCardRenders(cards: Array<[Card, TextButton]>, from: RenderCardSet, to: RenderCardSet): Promise<void> {
        return new Promise((resolve) => {
            const oldPositions = cards.reduce((map, [card, render]) => {
                map.set(render, this.transformAbsolutePosition(render.AbsolutePosition))
                return map
            }, new Map<TextButton, Vector2>())
            const newPositions = new Map(to.EstimateAbsolutePositions(new Map(cards)).entries().map(([render, pos]) => [render, this.transformAbsolutePosition(pos)]))

            const oldSizes = cards.reduce((map, [card, render]) => {
                map.set(render, render.AbsoluteSize)
                return map
            }, new Map<TextButton, Vector2>())
            const newSize = to.EstimateAbsoluteSize()

            to.MakeSpaceForCardRenders(new Map(cards))
            from.DisownCards(cards.map(([card, render]) => card))

            const targetZIndexes = cards.reduce((map, [card, render]) => {
                map.set(render, render.ZIndex)
                return map
            }, new Map<TextButton, number>())

            let tweensResolved = []
            for (let [card, render] of cards) {
                render.ZIndex = MovingCardZIndex
                let oldPosition = oldPositions.get(render)!
                let oldSize = oldSizes.get(render)!
                let newPosition = newPositions.get(render)!
                render.Position = new UDim2(0, oldPosition.X, 0, oldPosition.Y)
                render.Size = new UDim2(0, oldSize.X, 0, oldSize.Y)
                render.Parent = this.backFrame

                let tween = TweenService.Create(
                    render,
                    QueueMoveTweenInfo,
                    {
                        Position: new UDim2(0, newPosition.X, 0, newPosition.Y),
                        Size: new UDim2(0, newSize.X, 0, newSize.Y),
                    }
                )
                tween.Play()
                tweensResolved.push(new Promise((resolve, reject) => {
                    Promise.spawn(() => {
                        tween.Completed.Wait()
                        resolve()
                    })
                }))
            }

            Promise.all(tweensResolved).then(() => {
                for (let [card, render] of cards) {
                    to.AddRender(render)
                    render.ZIndex = targetZIndexes.get(render)!
                    const relativePosition = newPositions.get(render)!.sub(this.transformAbsolutePosition(to.GetAbsolutePosition()))
                    render.Position = new UDim2(0, relativePosition.X, 0, relativePosition.Y)
                }

                Promise.spawn(() => {
                    wait()
                    resolve()
                })
            })
        })
    }

    private animateHandToQueue(cards: Array<[Card, TextButton]>): Promise<void> {
        this.queueRender.Hand = this.queueRender.Hand.concat(cards.map(([card, render]) => card))
        return this.swapCardRenders(cards, this.handRender, this.queueRender)
    }

    private animateQueueToHand(cards: Array<[Card, TextButton]>): Promise<void> {
        for (let [card, render] of cards) {
            this.queueRender.Hand.remove(this.queueRender.Hand.indexOf(card))
        }

        return this.swapCardRenders(cards, this.queueRender, this.handRender)
    }

    private bindHandCard(card: Card, render: TextButton) {
        let thisConnection: RBXScriptConnection
        render.Active = true
        thisConnection = render.Activated.Connect(() => {
            if (this.PlayQueue.Cards.isEmpty()) {
                if (!this.GameState.CanPlayCards(this.GameState.LocalPlayer(), new CardSequence([card]))) {
                    return
                }
            } else if (!this.PlayQueue.CanAddCard(card, this.GameState.IsComboMode())) {
                return
            }
            this.PlayQueue.Cards.push(card)
            render.Active = false
            thisConnection.Disconnect()
            this.handConnections.remove(this.handConnections.indexOf(thisConnection))

            this.queueAnimation(async () => {
                await this.animateHandToQueue([[card, render]])
                this.bindQueueCard(card, render)
            })
        })
        this.handConnections.push(thisConnection)
    }

    private bindQueueCard(card: Card, render: TextButton) {
        render.Active = true
        let thisConnection = render.Activated.Connect(() => {
            let cards = this.PlayQueue.Cards
            let removeIndex = cards.indexOf(card)
            let removedCards = this.PlayQueue.Cards.splice(removeIndex, cards.size() - removeIndex)
            let removedCardMap = removedCards.reduce((map, card) => {
                map.set(card, this.queueRender.CardRenders.get(card)!)
                return map
            }, new Map<Card, TextButton>())

            for (let [card, render] of removedCardMap) {
                this.queueConnections.get(render)!.Disconnect()
                this.queueConnections.delete(render)
                render.Active = false
            }

            this.queueAnimation(async () => {
                await this.animateQueueToHand(removedCardMap.entries())

                for (let [card, render] of removedCardMap) {
                    this.bindHandCard(card, render)
                }
            })
        })
        this.queueConnections.set(render, thisConnection)
    }

    public AskPlay(): Promise<CardSequence> {
        for (let [card, render] of this.handRender.CardRenders) {
            this.bindHandCard(card, render)
        }

        return new Promise((resolve, reject) => {
            let connection = UserInputService.InputBegan.Connect((input) => {
                if (input.UserInputType === Enum.UserInputType.Keyboard
                    && input.KeyCode === Enum.KeyCode.P) {
                        connection.Disconnect()
                        for (let [_, conn] of this.queueConnections) {
                            conn.Disconnect()
                        }
                        this.queueConnections = new Map()
                        for (let conn of this.handConnections) {
                            conn.Disconnect()
                        }
                        this.handConnections = []

                        // must make a copy here
                        resolve(new CardSequence(this.PlayQueue.Cards))
                        this.PlayQueue.Cards = []
                }
            })
        })
    }
}

export class GameView {
    GameState: LocalGameState
    private handRender: RenderCardSet
    private queueRender: RenderCardSet
    private deckRender: RenderDecks
    private playHandler: SequencePlayHandler

    constructor(options: {
        state: LocalGameState,
        baseFrame: GuiBase2d,
        handFrame: Frame,
        queueFrame: Frame,
        deckContainer: Frame}) {
        this.GameState = options.state

        this.handRender = new RenderCardSet(options.state.LocalPlayer().Hand!.Cards, options.handFrame)
        this.queueRender = new RenderCardSet([], options.queueFrame)
        this.queueRender.UseStandardOrder = false
        this.deckRender = new RenderDecks(options.deckContainer)
        this.playHandler = new SequencePlayHandler(options.state, this.handRender, this.queueRender, options.baseFrame)
    }

    public AskPlay(): Promise<CardSequence> {
        return this.playHandler.AskPlay()
    }

    public AddNewCards(cards: Array<Card>): void {
        this.handRender.AddNewCards(cards)
    }

    public UpdateTopCard(): void {
        this.deckRender.RenderPlayedCard(this.GameState.LastCard())
    }
}