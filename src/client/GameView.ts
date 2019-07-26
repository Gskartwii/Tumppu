import { LocalGameState } from "./GameState";
import { RenderCardSet, CardAspectRatio } from "./Hand";
import { Card, CardSequence } from "shared/Card";
import { RenderCard } from "./Card";
import { TumppuPlayer, RealPlayer } from "shared/Player";

interface IOpponentData {
    BotName: string
    Position: UDim2
    AnchorPoint: Vector2
}


const LeftOpponent = {BotName: "<Korppu>", Position: new UDim2(0, 0, .5, 0), AnchorPoint: new Vector2(0, .5)}
const TopLeftOpponent = {BotName: "<Joonatan>", Position: new UDim2(0, 0, 0, 0), AnchorPoint: new Vector2(0, 0)}
const MiddleLeftOpponent = {BotName: "<Sofia>", Position: new UDim2(1/3, 0, 0, 0), AnchorPoint: new Vector2(.5, 0)}
const TopOpponent = {BotName: "<Jussi>", Position: new UDim2(.5, 0, 0, 0), AnchorPoint: new Vector2(.5, 0)}
const MiddleRightOpponent = {BotName: "<Matias>", Position: new UDim2(2/3, 0, 0, 0), AnchorPoint: new Vector2(.5, 0)}
const TopRightOpponent = {BotName: "<Orvar>", Position: new UDim2(1, 0, 0, 0), AnchorPoint: new Vector2(1, 0)}
const RightOpponent = {BotName: "<Tengil>", Position: new UDim2(1, 0, .5, 0), AnchorPoint: new Vector2(1, .5)}
const OpponentData = new Map<number, Array<IOpponentData>>([
    [2, [TopOpponent]],
    [3, [TopLeftOpponent, TopRightOpponent]],
    [4, [LeftOpponent, TopOpponent, RightOpponent]],
    [5, [LeftOpponent, MiddleLeftOpponent, MiddleRightOpponent, RightOpponent]],
    [6, [LeftOpponent, TopLeftOpponent, TopOpponent, TopRightOpponent, RightOpponent]],
    [7, [LeftOpponent, TopLeftOpponent, MiddleLeftOpponent, MiddleRightOpponent, TopRightOpponent, RightOpponent]]
])

const OpponentFrameBackground = new Color3(1, 1, 1)
const OpponentFrameBorder = new Color3(224, 224, 224)
const OpponentFrameBorderSize = 2
const OpponentFrameSize = new UDim2(.2, 0, .2, 0)
const OpponentFrameAspectRatio = 1
const OpponentFrameMinSize = 96
const OpponentFrameMaxSize = 256
const OpponentBotAsset = 467136076
const OpponentImageSize = new UDim2(1, 0, 1, 0)
const OpponentNamePadding = 8
const OpponentNameInactiveBackground = Color3.fromRGB(0x95, 0x75, 0xCD)
const OpponentNameBackgroundSize = new UDim2(1, 0, .25, 0)
const OpponentNameBackgroundAnchorPoint = new Vector2(0, 1)
const OpponentNameBackgroundPosition = new UDim2(0, 0, 1, 0)
const OpponentNameColor = new Color3(1, 1, 1)
const OpponentNameFont = Enum.Font.GothamBold
const OpponentNameMinSize = 8
const OpponentNameMaxSize = 16

const QueueMoveTweenInfo = new TweenInfo(
    1/4, //time
    Enum.EasingStyle.Quart,
    Enum.EasingDirection.InOut,
)
const OpponentPlayTweenInfo = new TweenInfo(
    1/4, // time
    Enum.EasingStyle.Quart,
    Enum.EasingDirection.InOut,
)
const OpponentPlaySequenceDelay = 1/15
const PostPlayDelay = 1/8
const MovingCardZIndex = 5

const TweenService = game.GetService("TweenService")
const UserInputService = game.GetService("UserInputService")
const Players = game.GetService("Players")

class AnimationQueue {
    private queuePromise: Promise<void> | undefined

    public QueueAnimation(animation: () => Promise<void>) {
        if (this.queuePromise === undefined) {
            this.queuePromise = animation()
            return
        }
        this.queuePromise = this.queuePromise.then(animation)
    }
}

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
    private playTarget: Frame

    AnimationQueue: AnimationQueue

    constructor(state: LocalGameState, queue: AnimationQueue, handRender: RenderCardSet, queueRender: RenderCardSet, backFrame: GuiBase2d, playTarget: Frame) {
        this.GameState = state
        this.handRender = handRender
        this.queueRender = queueRender
        this.backFrame = backFrame
        this.playTarget = playTarget
        this.AnimationQueue = queue
    }

    private transformAbsolutePosition(pos: Vector2): Vector2 {
        return pos.sub(this.backFrame.AbsolutePosition)
    }

    private tweenWithBackFrame(cards: Array<[Card, TextButton]>, oldPositions: Map<TextButton, Vector2>, newPositions: Map<TextButton, Vector2>, oldSizes: Map<TextButton, Vector2>, newSize: Vector2): Array<Promise<void>> {
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
        return tweensResolved
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

            let tweensResolved = this.tweenWithBackFrame(cards, oldPositions, newPositions, oldSizes, newSize)

            Promise.all(tweensResolved).then(() => {
                for (let [card, render] of cards) {
                    to.AddRender(card, render)
                    render.ZIndex = targetZIndexes.get(render)!
                    const relativePosition = newPositions.get(render)!.sub(this.transformAbsolutePosition(to.GetAbsolutePosition()))
                    render.Position = new UDim2(0, relativePosition.X, 0, relativePosition.Y)
                }

                Promise.spawn(() => {
                    wait() // Why is this needed? The card positions might go haywire without it
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
                // first card must always be valid, no matter if it's a combo sequence or not
                if (!this.GameState.CanPlayCards(this.GameState.LocalPlayer(), new CardSequence([card]))) {
                    return
                }
            } else if (!this.PlayQueue.CanAddCard(card, this.GameState.IsComboMode())) {
                return
            }
            // comboMode: true, because we must allow the player to
            // build the comboMode sequences first

            this.PlayQueue.Cards.push(card)
            render.Active = false
            thisConnection.Disconnect()
            this.handConnections.remove(this.handConnections.indexOf(thisConnection))

            this.AnimationQueue.QueueAnimation(async () => {
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

            this.AnimationQueue.QueueAnimation(async () => {
                await this.animateQueueToHand(removedCardMap.entries())

                for (let [card, render] of removedCardMap) {
                    this.bindHandCard(card, render)
                }
            })
        })
        this.queueConnections.set(render, thisConnection)
    }

    private animatePlayQueue(): void {
        // this.PlayQueue.Cards may get overridden; save it in a closure
        let oldCards = this.PlayQueue.Cards
        this.AnimationQueue.QueueAnimation(() => {
            const cards = oldCards.reduce((map, card) => {
                map.set(card, this.queueRender.CardRenders.get(card)!)
                return map
            }, new Map<Card, TextButton>())
            const oldPositions = cards.entries().reduce((map, [card, render]) => {
                map.set(render, this.transformAbsolutePosition(render.AbsolutePosition))
                return map
            }, new Map<TextButton, Vector2>())

            let target = this.playTarget.FindFirstChild<Frame>("PlayedCard")!
            const newPosition = this.transformAbsolutePosition(target.AbsolutePosition)
            const newPositions = cards.entries().reduce((map, [card, render]) => {
                map.set(render, newPosition)
                return map
            }, new Map<TextButton, Vector2>())
            const oldSizes = cards.entries().reduce((map, [card, render]) => {
                map.set(render, render.AbsoluteSize)
                return map
            }, new Map<TextButton, Vector2>())
            const newSize = target.AbsoluteSize

            this.queueRender.Hand = []
            this.queueRender.DisownCards(oldCards)

            let tweensResolved = this.tweenWithBackFrame(cards.entries(), oldPositions, newPositions, oldSizes, newSize)

            return new Promise((resolve, reject) => {
                Promise.all(tweensResolved).then(() => {
                    Promise.spawn(() => {
                        wait(PostPlayDelay)

                        resolve()
                        for (let [card, render] of cards) {
                            render.Destroy()
                        }
                    })
                })
            })
        })
    }

    public AskPlay(): Promise<CardSequence> {
        return new Promise((resolve, reject) => {
            for (let [card, render] of this.handRender.CardRenders) {
                this.bindHandCard(card, render)
            }

            let connection = UserInputService.InputBegan.Connect((input) => {
                if (input.UserInputType === Enum.UserInputType.Keyboard
                    && input.KeyCode === Enum.KeyCode.P) {
                        // don't try to play an invalid sequence
                        if (!this.GameState.CanPlayCards(this.GameState.LocalPlayer(), this.PlayQueue)) {
                            return
                        }

                        this.animatePlayQueue()
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

    public AnimateDrawCards(cards: Array<Card>): Promise<void> {
        return new Promise((resolve) => {
            let renders = cards.reduce((map, card) => {
                map.set(card, new RenderCard(card).FrontAsButton())
                return map
            }, new Map<Card, TextButton>())

            const source = this.playTarget.FindFirstChild<Frame>("Draw")!
            const oldPosition = this.transformAbsolutePosition(source.AbsolutePosition)
            const oldSize = this.transformAbsolutePosition(source.AbsoluteSize)
            const oldPositions = new Map(renders.entries().map(([card, render]) => [render, oldPosition]))
            const oldSizes = new Map(renders.entries().map(([card, render]) => [render, oldSize]))
            const newPositions = new Map(
                this.handRender.EstimateAbsolutePositions(renders)
                    .entries()
                    .map(([render, pos]) => [render, this.transformAbsolutePosition(pos)]))
            const newSize = this.handRender.EstimateAbsoluteSize()

            this.handRender.MakeSpaceForCardRenders(renders)
            const targetZIndexes = renders.entries().reduce((map, [card, render]) => {
                map.set(render, render.ZIndex)
                return map
            }, new Map<TextButton, number>())

            let tweensResolved = this.tweenWithBackFrame(renders.entries(), oldPositions, newPositions, oldSizes, newSize)

            Promise.all(tweensResolved).then(() => {
                for (let [card, render] of renders) {
                    this.handRender.AddRender(card, render)
                    render.ZIndex = targetZIndexes.get(render)!
                    const relativePosition = newPositions.get(render)!.sub(this.transformAbsolutePosition(this.handRender.GetAbsolutePosition()))
                    render.Position = new UDim2(0, relativePosition.X, 0, relativePosition.Y)
                }

                Promise.spawn(() => {
                    wait()
                    resolve()
                })
            })
        })
    }
}

class OpponentRender {
    GameState: LocalGameState
    Player: TumppuPlayer

    RenderFrame?: Frame
    AnimationQueue: AnimationQueue
    
    private index: number
    private baseFrame: GuiBase2d
    private targetFrame: GuiBase2d

    constructor(state: LocalGameState, queue: AnimationQueue, player: TumppuPlayer, baseFrame: GuiBase2d, targetFrame: GuiBase2d) {
        this.GameState = state
        this.Player = player
        this.baseFrame = baseFrame
        this.targetFrame = targetFrame
        this.AnimationQueue = queue

        let index = state.Players.indexOf(player)
        let localIndex = state.Players.indexOf(state.LocalPlayer())
        let adjustedIndex = (index - localIndex - 1 + state.Players.size()) % state.Players.size()
        this.index = adjustedIndex
    }

    private getOpponentData(): IOpponentData {
        let thisOppData = OpponentData.get(this.GameState.Players.size())!
        return thisOppData[this.index]
    }

    public Name(): string {
        if (this.Player instanceof RealPlayer) {
            return this.Player.Player.Name
        }
        return this.getOpponentData().BotName
    }

    private image(): string {
        if (this.Player instanceof RealPlayer) {
            return Players.GetUserThumbnailAsync(this.Player.Player.UserId, Enum.ThumbnailType.HeadShot, Enum.ThumbnailSize.Size352x352)[0]
        }
        return ("https://www.roblox.com/asset-thumbnail/image?assetId=%d&width=352&height=352&format=png").format(OpponentBotAsset)
    }

    public Render(): void {
        if (this.RenderFrame !== undefined) {
            this.RenderFrame.Destroy()
        }
        let data = this.getOpponentData()
        let renderFrame = new Instance("Frame")
        this.RenderFrame = renderFrame
        renderFrame.Name = this.Name()
        renderFrame.AnchorPoint = data.AnchorPoint
        renderFrame.Size = OpponentFrameSize
        renderFrame.Position = data.Position
        renderFrame.BackgroundColor3 = OpponentFrameBackground
        renderFrame.BorderColor3 = OpponentFrameBorder
        renderFrame.BorderSizePixel = OpponentFrameBorderSize

        let renderAspectRatioConstraint = new Instance("UIAspectRatioConstraint", renderFrame)
        renderAspectRatioConstraint.AspectRatio = OpponentFrameAspectRatio

        let renderSizeConstraint = new Instance("UISizeConstraint", renderFrame)
        renderSizeConstraint.MinSize = new Vector2(OpponentFrameMinSize, OpponentFrameMinSize)
        renderSizeConstraint.MaxSize = new Vector2(OpponentFrameMaxSize, OpponentFrameMaxSize)

        let headshot = new Instance("ImageLabel", renderFrame)
        headshot.Name = "Headshot"
        headshot.BackgroundTransparency = 1
        headshot.Image = this.image()
        headshot.Size = OpponentImageSize

        let playerNameContainer = new Instance("Frame", renderFrame)
        playerNameContainer.Size = OpponentNameBackgroundSize
        playerNameContainer.AnchorPoint = OpponentNameBackgroundAnchorPoint
        playerNameContainer.Position = OpponentNameBackgroundPosition
        playerNameContainer.BackgroundColor3 = OpponentNameInactiveBackground
        playerNameContainer.BorderSizePixel = 0

        let playerNamePadding = new Instance("UIPadding", playerNameContainer)
        const padding = new UDim(0, OpponentNamePadding)
        playerNamePadding.PaddingTop = padding
        playerNamePadding.PaddingRight = padding
        playerNamePadding.PaddingBottom = padding
        playerNamePadding.PaddingLeft = padding

        let playerNameText = new Instance("TextLabel", playerNameContainer)
        playerNameText.BackgroundTransparency = 1
        playerNameText.Text = this.Name()
        playerNameText.TextColor3 = OpponentNameColor
        playerNameText.Font = OpponentNameFont
        playerNameText.TextScaled = true
        playerNameText.Size = new UDim2(1, 0, 1, 0)

        let playerNameTextSizeConstraint = new Instance("UITextSizeConstraint", playerNameText)
        playerNameTextSizeConstraint.MinTextSize = OpponentNameMinSize
        playerNameTextSizeConstraint.MaxTextSize = OpponentNameMaxSize

        renderFrame.Parent = this.baseFrame
    }

    public AnimatePlayCards(seq: CardSequence): Promise<Array<Instance>> {
        return new Promise((resolve) => {
            let trueTarget = this.targetFrame.FindFirstChild<Frame>("PlayedCard")!
            let renders = seq.Cards.reduce((map, card) => {
                let render = new RenderCard(card).FrontAsFrame()
                render.Size = new UDim2(CardAspectRatio * OpponentFrameAspectRatio, 0, 1, 0)
                render.AnchorPoint = new Vector2(.5, .5)
                render.Position = new UDim2(.5, 0, .5, 0)
                render.Parent = this.RenderFrame!
                map.set(card, render)
                return map
            }, new Map<Card, Frame>())

            let oldPosition = renders.get(seq.Cards[0])!.AbsolutePosition
            let newPosition = trueTarget.AbsolutePosition.sub(this.baseFrame.AbsolutePosition)
            let oldSize = renders.get(seq.Cards[0])!.AbsoluteSize
            let newSize = trueTarget.AbsoluteSize

            Promise.spawn(() => {
                // iterate over this to ensure correct order
                let i = 0
                let tweensResolved = []
                let instances: Array<Instance> = []
                for (let card of seq.Cards) {
                    let render = renders.get(card)!
                    instances.push(render)
                    render.AnchorPoint = new Vector2(0, 0)
                    render.Position = new UDim2(0, oldPosition.X, 0, oldPosition.Y)
                    render.Size = new UDim2(0, oldSize.X, 0, oldSize.Y)
                    render.Parent = this.baseFrame
                    render.ZIndex = MovingCardZIndex + i

                    let tween = TweenService.Create(
                        render,
                        OpponentPlayTweenInfo,
                        {
                            Position: new UDim2(0, newPosition.X, 0, newPosition.Y),
                            Size: new UDim2(0, newSize.X, 0, newSize.Y),
                        }
                    )
                    tween.Play()

                    wait(OpponentPlaySequenceDelay)
                    i++

                    tweensResolved.push(new Promise((resolve) => {
                        Promise.spawn(() => {
                            tween.Completed.Wait()
                            resolve()
                        })
                    }))
                }

                Promise.all(tweensResolved).then(() => {
                    resolve(instances)
                })
            })
        })
    }
}

export class GameView {
    GameState: LocalGameState
    private animationQueue: AnimationQueue
    private handRender: RenderCardSet
    private queueRender: RenderCardSet
    private deckRender: RenderDecks
    private playHandler: SequencePlayHandler
    private opponentRenders: Map<TumppuPlayer, OpponentRender>

    constructor(options: {
        state: LocalGameState,
        baseFrame: GuiBase2d,
        handFrame: Frame,
        queueFrame: Frame,
        deckContainer: Frame,
        mouse: Mouse}) {
        this.GameState = options.state

        this.animationQueue = new AnimationQueue
        this.handRender = new RenderCardSet(options.state.LocalPlayer().Hand!.Cards, options.handFrame, options.mouse)
        this.queueRender = new RenderCardSet([], options.queueFrame, options.mouse)
        this.queueRender.UseStandardOrder = false
        this.deckRender = new RenderDecks(options.deckContainer)
        this.playHandler = new SequencePlayHandler(options.state, this.animationQueue, this.handRender, this.queueRender, options.baseFrame, options.deckContainer)
        this.opponentRenders = new Map(this.GameState.Players
            .filter((player) => player !== this.GameState.LocalPlayer())
            .map((player) => [player, new OpponentRender(
                this.GameState,
                this.animationQueue,
                player,
                options.baseFrame,
                options.deckContainer)]))

        for (let [player, render] of this.opponentRenders) {
            render.Render()
        }
    }

    public AskPlay(): Promise<CardSequence> {
        return new Promise((resolve) => {
            this.animationQueue.QueueAnimation(async () => {
                // if a draw animation is in progress, we must wait for it to end
                this.playHandler.AskPlay().then((seq) => {
                    resolve(seq)
                    this.animationQueue.QueueAnimation(async () => {
                        this.deckRender.RenderPlayedCard(seq.Cards[seq.Cards.size() - 1])
                    })
                })
            })
        })
    }

    public DrawTopCard(card: Card): void {
        this.animationQueue.QueueAnimation(async () => {
            // TODO: animation
            this.deckRender.RenderPlayedCard(card)
        })
    }

    public AddNewCards(cards: Array<Card>): void {
        this.animationQueue.QueueAnimation(() => {
            return this.playHandler.AnimateDrawCards(cards)
        })
    }

    public OpponentPlayedCards(player: TumppuPlayer, cards: CardSequence): void {
        this.animationQueue.QueueAnimation(() => {
            return new Promise((resolve) => {
                this.opponentRenders.get(player)!.AnimatePlayCards(cards).then((animatedCards) => {
                    this.deckRender.RenderPlayedCard(cards.Cards[cards.Cards.size() - 1])
                    for (let card of animatedCards) {
                        card.Destroy()
                    }

                    Promise.spawn(() => {
                        wait(PostPlayDelay)
                        resolve()
                    })
                })
            })
        })
    }
}