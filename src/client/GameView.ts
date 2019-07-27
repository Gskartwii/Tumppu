import { LocalGameState } from "./GameState";
import { RenderCardSet, CardAspectRatio } from "./Hand";
import { Card, CardSequence, Color } from "shared/Card";
import { RenderCard, CardColors } from "./Card";
import { TumppuPlayer, RealPlayer } from "shared/Player";
import Tween from "@rbxts/tween";
import { InCubic } from "@rbxts/easing-functions";

const UpdateColorDuration = 1/4
const UpdateColorEasing = InCubic

const PlayedCardPosition = new UDim2(1, 0, 0, 0)
const PlayedCardAnchorPoint = new Vector2(1, 0)
const PlayedCardSize = new UDim2(1, 0, 1, 0)
const PlayedCardAspectRatio = 2.5/3.5

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

const OpponentFrameZIndex = 10
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
const OpponentDrawTweenInfo = OpponentPlayTweenInfo
const OpponentDrawSequenceDelay = OpponentPlaySequenceDelay
const PostPlayDelay = 1/8
const MovingCardZIndex = 5

const DrawButtonActivateTweenInfo = new TweenInfo(
    1/8,
    Enum.EasingStyle.Quart,
    Enum.EasingDirection.In,
)
const DrawButtonDeactivateTweenInfo = new TweenInfo(
    1/8,
    Enum.EasingStyle.Quart,
    Enum.EasingDirection.Out,
)
const DrawButtonGrayoutTransparencyMin = .5
const DrawButtonGrayoutTransparencyMax = 1

const ColorDialogPreDisplayPosition = new UDim2(-.5, 0, .5, 0)
const ColorDialogDisplayPosition = new UDim2(.75, 0, .5, 0)
const ColorDialogPostDisplayPosition = new UDim2(1.5, 0, .5, 0)
const ColorDialogShowTweenInfo = new TweenInfo(
    1/4,
    Enum.EasingStyle.Quart,
    Enum.EasingDirection.Out,
)
const ColorDialogHideTweenInfo = new TweenInfo(
    1/4,
    Enum.EasingStyle.Quart,
    Enum.EasingDirection.In,
)

const PlayerDialogPreDisplayPosition = ColorDialogPreDisplayPosition
const PlayerDialogDisplayPosition = ColorDialogDisplayPosition
const PlayerDialogPostDisplayPosition = ColorDialogPostDisplayPosition
const PlayerDialogShowTweenInfo = ColorDialogShowTweenInfo
const PlayerDialogHideTweenInfo = ColorDialogHideTweenInfo

const PlayerDialogChoiceSize = new UDim2(1, 0, 1, 0)
const PlayerDialogChoiceAspectRatio = 4
const PlayerDialogChoiceColor = OpponentNameInactiveBackground
const PlayerDialogChoiceTextColor = new Color3(1, 1, 1)
const PlayerDialogChoiceFont = Enum.Font.GothamBold
const PlayerDialogChoicePadding = 8
const PlayerDialogChoiceImageSize = new UDim2(1, 0, 1, 0)
const PlayerDialogChoiceImageAspectRatio = 1
const PlayerDialogChoiceImageBackground = new Color3(1, 1, 1)
const PlayerDialogChoiceLabelPadding = 8
const PlayerDialogChoiceLabelContainerPosition = new UDim2(.25, 0, 0, 0)
const PlayerDialogChoiceLabelContainerSize = new UDim2(.75, 0, 1, 0)
const PlayerDialogChoiceTextXAlignment = Enum.TextXAlignment.Left
const PlayerDialogChoiceCanvasPadding = 16

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
        render.Position = PlayedCardPosition
        render.AnchorPoint = PlayedCardAnchorPoint
        render.Size = PlayedCardSize

        const arConstraint = new Instance("UIAspectRatioConstraint", render)
        arConstraint.AspectRatio = PlayedCardAspectRatio

        render.Parent = this.deckContainer
        this.currentPlayedCard = render
    }

    public AnimateUpdateColor(color: Color): Promise<void> {
        const oldColor = this.currentPlayedCard.BackgroundColor3
        const newColor = CardColors.get(color)!

        return new Promise((resolve) => {
            Promise.spawn(() => {
                Tween(UpdateColorDuration, UpdateColorEasing, (x) => this.currentPlayedCard.BackgroundColor3 = x, oldColor, newColor).Wait()
                resolve()
            })
        })
    }
}

class SequencePlayHandler {
    PlayQueue = new CardSequence
    GameState: LocalGameState
    private handConnections: Array<RBXScriptConnection> = []
    private queueConnections: Map<TextButton, RBXScriptConnection> = new Map()
    private playAllConnection?: RBXScriptConnection
    private drawConnection?: RBXScriptConnection
    private pendingResolve?: (cards: [CardSequence, Map<Card, TextButton>] | boolean) => void
    private drawButton: GuiButton

    private handRender: RenderCardSet
    private queueRender: RenderCardSet
    private backFrame: GuiBase2d
    private playTarget: Frame

    AnimationQueue: AnimationQueue

    constructor(state: LocalGameState, queue: AnimationQueue, handRender: RenderCardSet, queueRender: RenderCardSet, backFrame: GuiBase2d, playTarget: Frame, drawButton: GuiButton) {
        this.GameState = state
        this.handRender = handRender
        this.queueRender = queueRender
        this.backFrame = backFrame
        this.playTarget = playTarget
        this.AnimationQueue = queue
        this.drawButton = drawButton
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

            // Note: changes parent
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

    private animateHandToDeck(card: Card, render: TextButton): Promise<void> {
        return new Promise((resolve) => {
            const cards = new Map([[card, render]])
            const oldPositions = new Map([[render, this.transformAbsolutePosition(render.AbsolutePosition)]])
            let target = this.playTarget.FindFirstChild<Frame>("PlayedCard")!
            const newPositions = new Map([[render, this.transformAbsolutePosition(target.AbsolutePosition)]])
            const oldSizes = new Map([[render, render.AbsoluteSize]])
            const newSize = target.AbsoluteSize

            render.Parent = undefined
            this.handRender.DisownCards([card])

            let tweensResolved = this.tweenWithBackFrame(cards.entries(), oldPositions, newPositions, oldSizes, newSize)

            Promise.all(tweensResolved).then(() => {
                resolve()
            })
        })
    }

    private bindHandCard(card: Card, render: TextButton) {
        let thisConnection: RBXScriptConnection, thisQuickPlayConnection: RBXScriptConnection
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
            thisQuickPlayConnection.Disconnect()
            this.handConnections.remove(this.handConnections.indexOf(thisConnection))
            this.handConnections.remove(this.handConnections.indexOf(thisQuickPlayConnection))

            this.AnimationQueue.QueueAnimation(async () => {
                await this.animateHandToQueue([[card, render]])
                this.bindQueueCard(card, render)
            })
        })
        this.handConnections.push(thisConnection)

        thisQuickPlayConnection = render.MouseButton2Click.Connect(() => {
            if (!this.PlayQueue.Cards.isEmpty()) {
                return
            }
            if (!this.GameState.CanPlayCards(this.GameState.LocalPlayer(), new CardSequence([card]))) {
                return
            }

            let pendingResolve = this.pendingResolve
            this.AnimationQueue.QueueAnimation(() => {
                return new Promise((resolve) => {
                    this.animateHandToDeck(card, render).then(() => {
                        if (pendingResolve !== undefined) {
                            pendingResolve([new CardSequence([card]), new Map([[card, render]])])
                        }
                        Promise.spawn(() => {
                            wait(PostPlayDelay)
                            resolve()
                        })
                    })
                })
            })

            this.cleanup()
        })
        this.handConnections.push(thisQuickPlayConnection)
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

    private animatePlayQueue(): Promise<Map<Card, TextButton>> {
        // this.PlayQueue.Cards may get overridden; save it in a closure
        let oldCards = this.PlayQueue.Cards

        return new Promise((resolve) => {
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
            Promise.all(tweensResolved).then(() => {
                resolve(cards)
            })
        })
    }

    private animateActivateDrawButton() {
        this.AnimationQueue.QueueAnimation(() => {
            return new Promise((resolve) => {
                let tween = TweenService.Create(
                    this.drawButton.FindFirstChild<Frame>("GrayoutFrame")!,
                    DrawButtonActivateTweenInfo,
                    {
                        BackgroundTransparency: DrawButtonGrayoutTransparencyMax,
                    }
                )
                tween.Play()

                Promise.spawn(() => {
                    tween.Completed.Wait()
                    resolve()
                })
            })
        })
    }

    private animateDeactivateDrawButton() {
        this.AnimationQueue.QueueAnimation(() => {
            return new Promise((resolve) => {
                let tween = TweenService.Create(
                    this.drawButton.FindFirstChild<Frame>("GrayoutFrame")!,
                    DrawButtonDeactivateTweenInfo,
                    {
                        BackgroundTransparency: DrawButtonGrayoutTransparencyMin,
                    }
                )
                tween.Play()

                Promise.spawn(() => {
                    tween.Completed.Wait()
                    resolve()
                })
            })
        })
    }

    private cleanup(): void {
        this.pendingResolve = undefined
        if (this.playAllConnection !== undefined) {
            this.playAllConnection.Disconnect()
        }
        if (this.drawConnection !== undefined) {
            this.drawConnection.Disconnect()
            this.animateDeactivateDrawButton()
        }
        for (let [_, conn] of this.queueConnections) {
            conn.Disconnect()
        }
        this.queueConnections = new Map()
        for (let conn of this.handConnections) {
            conn.Disconnect()
        }
        this.handConnections = []
    }

    public AskPlay(canDraw: boolean): Promise<[CardSequence, Map<Card, TextButton>] | boolean> {
        return new Promise((resolve, reject) => {
            for (let [card, render] of this.handRender.CardRenders) {
                this.bindHandCard(card, render)
            }

            this.pendingResolve = resolve
            this.playAllConnection = UserInputService.InputBegan.Connect((input) => {
                if (input.UserInputType === Enum.UserInputType.Keyboard
                    && input.KeyCode === Enum.KeyCode.P) {
                        // don't try to play an invalid sequence
                        if (!this.GameState.CanPlayCards(this.GameState.LocalPlayer(), this.PlayQueue)) {
                            return
                        }

                        this.AnimationQueue.QueueAnimation(() => {
                            let seq = new CardSequence(this.PlayQueue.Cards)
                            return new Promise((resolveAnimation) => {
                                this.animatePlayQueue().then((renders) => {
                                    this.PlayQueue.Cards = []
                                    resolve([seq, renders])

                                    Promise.spawn(() => {
                                        wait(PostPlayDelay)
                                        resolveAnimation()
                                    })
                                })
                            })
                        })
                        // must make a copy here
                        this.cleanup()
                }
            })

            if (canDraw) {
                this.animateActivateDrawButton()
                this.drawConnection = this.drawButton.Activated.Connect(() => {
                    this.cleanup()
                    resolve(true)
                })
            }
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

    public Image(): string {
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
        renderFrame.ZIndex = OpponentFrameZIndex

        let renderAspectRatioConstraint = new Instance("UIAspectRatioConstraint", renderFrame)
        renderAspectRatioConstraint.AspectRatio = OpponentFrameAspectRatio

        let renderSizeConstraint = new Instance("UISizeConstraint", renderFrame)
        renderSizeConstraint.MinSize = new Vector2(OpponentFrameMinSize, OpponentFrameMinSize)
        renderSizeConstraint.MaxSize = new Vector2(OpponentFrameMaxSize, OpponentFrameMaxSize)

        let headshot = new Instance("ImageLabel", renderFrame)
        headshot.Name = "Headshot"
        headshot.BackgroundTransparency = 1
        headshot.Image = this.Image()
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

    private getCardPosition(): Vector2 {
        // place the card in the middle of the frame
        // without setting the AnchorPoint
        return new Vector2(this.RenderFrame!.AbsoluteSize.X, 0)
            .sub(new Vector2(this.getCardSize().X, 0))
            .div(new Vector2(2, 1))
            .add(this.RenderFrame!.AbsolutePosition)
    }

    private getCardSize(): Vector2 {
        const height = this.RenderFrame!.AbsoluteSize.Y
        return new Vector2(height * CardAspectRatio, height)
    }

    public AnimatePlayCards(seq: CardSequence): Promise<Array<Instance>> {
        return new Promise((resolve) => {
            let trueTarget = this.targetFrame.FindFirstChild<Frame>("PlayedCard")!

            let oldPosition = this.getCardPosition()
            let newPosition = trueTarget.AbsolutePosition.sub(this.baseFrame.AbsolutePosition)
            let oldSize = this.getCardSize()
            let newSize = trueTarget.AbsoluteSize

            let renders = seq.Cards.reduce((map, card) => {
                let render = new RenderCard(card).FrontAsFrame()
                map.set(card, render)
                return map
            }, new Map<Card, Frame>())

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

    public AnimateDrawCards(cards: Array<Card>): Promise<void> {
        return new Promise((resolve) => {
            let renders = cards.reduce((map, card) => {
                map.set(card, new RenderCard(card).BackAsFrame())
                return map
            }, new Map<Card, Frame>())

            const source = this.targetFrame.FindFirstChild<Frame>("Draw")!
            const oldPosition = source.AbsolutePosition
            const oldSize = source.AbsoluteSize
            const newPosition = this.getCardPosition()
            const newSize = this.getCardSize()

            Promise.spawn(() => {
                let i = 0
                let tweensResolved = []
                let instances: Array<Instance> = []
                for (let card of cards) {
                    let render = renders.get(card)!
                    instances.push(render)
                    render.Position = new UDim2(0, oldPosition.X, 0, oldPosition.Y)
                    render.Size = new UDim2(0, oldSize.X, 0, oldSize.Y)
                    render.Parent = this.baseFrame
                    render.ZIndex = MovingCardZIndex

                    let tween = TweenService.Create(
                        render,
                        OpponentDrawTweenInfo,
                        {
                            Position: new UDim2(0, newPosition.X, 0, newPosition.Y),
                            Size: new UDim2(0, newSize.X, 0, newSize.Y),
                        }
                    )
                    tween.Play()

                    wait(OpponentDrawSequenceDelay)
                    i++

                    tweensResolved.push(new Promise((resolve) => {
                        Promise.spawn(() => {
                            tween.Completed.Wait()
                            resolve()
                        })
                    }))
                }

                Promise.all(tweensResolved).then(() => {
                    for (let instance of instances) {
                        instance.Destroy()
                    }
                    resolve()
                })
            })
        })
    }
}

class ColorDialog {
    AnimationQueue: AnimationQueue
    private dialog: Frame
    private redButton: GuiButton
    private blueButton: GuiButton
    private yellowButton: GuiButton
    private greenButton: GuiButton

    private pendingResolve?: (color: Color) => void
    private connections: Map<GuiButton, RBXScriptConnection> = new Map()

    constructor(animationQueue: AnimationQueue, dialog: Frame) {
        this.AnimationQueue = animationQueue
        this.dialog = dialog
        dialog.Position = ColorDialogPreDisplayPosition

        const buttonContainer = dialog.FindFirstChild("ColorFrame")!
        this.redButton = buttonContainer.FindFirstChild<GuiButton>("Red")!
        this.blueButton = buttonContainer.FindFirstChild<GuiButton>("Blue")!
        this.yellowButton = buttonContainer.FindFirstChild<GuiButton>("Yellow")!
        this.greenButton = buttonContainer.FindFirstChild<GuiButton>("Green")!
    }
    
    private animateShowDialog(): void {
        this.AnimationQueue.QueueAnimation(() => {
            return new Promise((resolve) => {
                const tween = TweenService.Create(
                    this.dialog,
                    ColorDialogShowTweenInfo,
                    {
                        Position: ColorDialogDisplayPosition,
                    }
                )

                tween.Play()

                Promise.spawn(() => {
                    tween.Completed.Wait()
                    resolve()
                })
            })
        })
    }

    private animateHideDialog(): void {
        this.AnimationQueue.QueueAnimation(() => {
            return new Promise((resolve) => {
                const tween = TweenService.Create(
                    this.dialog,
                    ColorDialogHideTweenInfo,
                    {
                        Position: ColorDialogPostDisplayPosition,
                    }
                )

                tween.Play()

                Promise.spawn(() => {
                    tween.Completed.Wait()
                    this.dialog.Position = ColorDialogPreDisplayPosition
                    resolve()
                })
            })
        })
    }

    private connectColor(button: GuiButton, color: Color): RBXScriptConnection {
        let connection = button.MouseButton1Click.Connect(() => {
            for (let [connectedBtn, connection] of this.connections) {
                connection.Disconnect()
            }
            if (this.pendingResolve !== undefined) {
                this.pendingResolve(color)
            }
            this.animateHideDialog()
        })

        this.connections.set(button, connection)
        return connection
    }
    
    public AskColor(): Promise<Color> {
        return new Promise((resolve) => {
            this.pendingResolve = resolve
            this.animateShowDialog()

            this.connectColor(this.redButton, Color.Red)
            this.connectColor(this.blueButton, Color.Blue)
            this.connectColor(this.yellowButton, Color.Yellow)
            this.connectColor(this.greenButton, Color.Green)
        })
    }
}

class PlayerDialog {
    AnimationQueue: AnimationQueue
    private dialog: Frame
    private pendingResolve?: (player: TumppuPlayer) => void
    private connections: Array<RBXScriptConnection> = []
    
    constructor(animationQueue: AnimationQueue, dialog: Frame) {
        this.AnimationQueue = animationQueue
        this.dialog = dialog
        this.dialog.Position = PlayerDialogPreDisplayPosition
    }

    private setCard(card: Card) {
        if (!card.IsWildcard()) {
            error("can't set non-wildcard icon")
        }
    }

    private connectPlayer(index: number, render: OpponentRender) {
        const choice = new Instance("TextButton")
        choice.Name = render.Name()
        choice.LayoutOrder = index
        // Position delegated to UIListLayout
        choice.Size = PlayerDialogChoiceSize
        choice.BackgroundColor3 = PlayerDialogChoiceColor
        choice.BorderSizePixel = 0
        choice.Text = ""
        choice.AutoButtonColor = false

        const arConstraint = new Instance("UIAspectRatioConstraint", choice)
        arConstraint.AspectRatio = PlayerDialogChoiceAspectRatio

        const choicePadding = new Instance("UIPadding", choice)
        const choicePaddingUDim = new UDim(0, PlayerDialogChoicePadding)
        choicePadding.PaddingBottom = choicePaddingUDim
        choicePadding.PaddingLeft = choicePaddingUDim
        choicePadding.PaddingTop = choicePaddingUDim
        choicePadding.PaddingRight = choicePaddingUDim

        const labelContainer = new Instance("Frame", choice)
        labelContainer.Position = PlayerDialogChoiceLabelContainerPosition
        labelContainer.Size = PlayerDialogChoiceLabelContainerSize
        labelContainer.BackgroundTransparency = 1

        const labelContainerPadding = new Instance("UIPadding", labelContainer)
        labelContainerPadding.PaddingLeft = new UDim(0, PlayerDialogChoiceLabelPadding)
        labelContainerPadding.PaddingRight = new UDim(0, PlayerDialogChoiceLabelPadding)

        const nameLabel = new Instance("TextLabel", labelContainer)
        nameLabel.Size = new UDim2(1, 0, .5, 0)
        nameLabel.Text = render.Name()
        nameLabel.Font = PlayerDialogChoiceFont
        nameLabel.BackgroundTransparency = 1
        nameLabel.TextColor3 = PlayerDialogChoiceTextColor
        nameLabel.TextXAlignment = PlayerDialogChoiceTextXAlignment
        nameLabel.TextScaled = true

        const numCards = render.Player.Hand!.Cards.size()
        const cardsLabel = nameLabel.Clone()
        cardsLabel.Position = new UDim2(0, 0, .5, 0)
        cardsLabel.Text = (numCards === 1) ? "1 card" : "%d cards".format(numCards)
        cardsLabel.Parent = labelContainer

        const playerImage = new Instance("ImageLabel", choice)
        playerImage.Size = PlayerDialogChoiceImageSize
        playerImage.BackgroundColor3 = PlayerDialogChoiceImageBackground
        playerImage.BorderSizePixel = 0
        playerImage.Image = render.Image()

        const imageARConstraint = new Instance("UIAspectRatioConstraint", playerImage)
        imageARConstraint.AspectRatio = PlayerDialogChoiceImageAspectRatio

        // TODO: Visual animation on choice?
        // also for color dialog?
        this.connections.push(choice.Activated.Connect(() => {
            for (const conn of this.connections) {
                conn.Disconnect()
            }
            this.connections = []

            if (this.pendingResolve !== undefined) {
                this.pendingResolve(render.Player)
            }

            this.animateHide()
        }))

        choice.Parent = this.dialog.FindFirstChild("PlayersFrame")
    }

    private animateShow() {
        this.AnimationQueue.QueueAnimation(() => {
            return new Promise((resolve) => {
                const tween = TweenService.Create(
                    this.dialog,
                    PlayerDialogShowTweenInfo,
                    {
                        Position: PlayerDialogDisplayPosition,
                    }
                )

                tween.Play()

                Promise.spawn(() => {
                    tween.Completed.Wait()
                    resolve()
                })
            })
        })
    }

    private animateHide() {
        this.AnimationQueue.QueueAnimation(() => {
            return new Promise((resolve) => {
                const tween = TweenService.Create(
                    this.dialog,
                    PlayerDialogHideTweenInfo,
                    {
                        Position: PlayerDialogPostDisplayPosition,
                    }
                )

                tween.Play()

                Promise.spawn(() => {
                    tween.Completed.Wait()
                    this.dialog.Position = PlayerDialogPreDisplayPosition
                    resolve()
                })
            })
        })
    }

    public AskPlayer(card: Card, opponentRenders: Array<OpponentRender>): Promise<TumppuPlayer> {
        return new Promise((resolve) => {
            this.pendingResolve = resolve
            this.setCard(card)

            const playersFrame = this.dialog.FindFirstChild<ScrollingFrame>("PlayersFrame")!
            // don't ClearAlLChildren, we need to keep padding and layout delegate
            for (const choice of playersFrame.GetChildren()) {
                if (choice.IsA("GuiButton")) {
                    choice.Destroy()
                }
            }

            playersFrame.CanvasSize = new UDim2(
                1, -PlayerDialogChoiceCanvasPadding * 2,
                1/4 * 3/4 * opponentRenders.size(), -PlayerDialogChoiceCanvasPadding * 2,
            )
            for (const [i, render] of opponentRenders.entries()) {
                this.connectPlayer(i, render)
            }

            this.animateShow()
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
    private colorHandler: ColorDialog
    private playerChoiceHandler: PlayerDialog
    private opponentRenders: Map<TumppuPlayer, OpponentRender>
    private drawButtonLabel: TextLabel

    constructor(options: {
        state: LocalGameState,
        baseFrame: GuiBase2d,
        handFrame: Frame,
        queueFrame: Frame,
        deckContainer: Frame,
        drawButton: GuiButton,
        colorDialog: Frame,
        playerDialog: Frame,
        mouse: Mouse}) {
        this.GameState = options.state

        this.animationQueue = new AnimationQueue
        this.handRender = new RenderCardSet(options.state.LocalPlayer().Hand!.Cards, options.handFrame, options.mouse)
        this.queueRender = new RenderCardSet([], options.queueFrame, options.mouse)
        this.queueRender.UseStandardOrder = false
        this.deckRender = new RenderDecks(options.deckContainer)
        this.playHandler = new SequencePlayHandler(options.state, this.animationQueue, this.handRender, this.queueRender, options.baseFrame, options.deckContainer, options.drawButton)
        this.colorHandler = new ColorDialog(this.animationQueue, options.colorDialog)
        this.playerChoiceHandler = new PlayerDialog(this.animationQueue, options.playerDialog)
        this.opponentRenders = new Map(this.GameState.Players
            .filter((player) => player !== this.GameState.LocalPlayer())
            .map((player) => [player, new OpponentRender(
                this.GameState,
                this.animationQueue,
                player,
                options.baseFrame,
                options.deckContainer)]))
        this.drawButtonLabel = options.drawButton
            .FindFirstChild("LabelContainer")!
            .FindFirstChild<TextLabel>("PaddedLabel")!

        for (let [player, render] of this.opponentRenders) {
            render.Render()
        }
    }

    public AskPlay(canDraw: boolean): Promise<CardSequence | boolean> {
        return new Promise((resolve) => {
            this.animationQueue.QueueAnimation(async () => {
                // if a draw animation is in progress, we must wait for it to end
                this.playHandler.AskPlay(canDraw).then((resolution) => {
                    if (typeIs(resolution, "boolean")) {
                        resolve(resolution)
                        return
                    }

                    const [seq, renders] = resolution
                    this.animationQueue.QueueAnimation(async () => {
                        this.deckRender.RenderPlayedCard(seq.Cards[seq.Cards.size() - 1])
                        for (let [card, render] of renders) {
                            render.Destroy()
                        }
                    })

                    resolve(seq)
                })
            })
        })
    }

    public AskColor(): Promise<Color> {
        return new Promise((resolve) => {
            this.colorHandler.AskColor().then((color) => {
                this.animationQueue.QueueAnimation(async () => {
                    await this.deckRender.AnimateUpdateColor(color)
                })
                resolve(color)
            })
        })
    }

    public AskPlayer(card: Card): Promise<TumppuPlayer> {
        return new Promise((resolve) => {
            this.playerChoiceHandler.AskPlayer(card, this.opponentRenders.values()).then((player) => {
                resolve(player)
            })
        })
    }

    public DrawTopCard(card: Card): void {
        this.animationQueue.QueueAnimation(async () => {
            // TODO: animation
            this.deckRender.RenderPlayedCard(card)
        })
    }

    public DrawCards(player: TumppuPlayer, cards: Array<Card>): void {
        this.animationQueue.QueueAnimation(async () => {
            if (player === this.GameState.LocalPlayer()) {
                await this.playHandler.AnimateDrawCards(cards)
            } else {
                await this.opponentRenders.get(player)!.AnimateDrawCards(cards)
            }

            // Will always be undefined if a player has drawn
            this.updateDrawButton(undefined)
        })
    }

    public OpponentPlayedCards(player: TumppuPlayer, cards: CardSequence, comboSeq: CardSequence | undefined): void {
        this.animationQueue.QueueAnimation(() => {
            return new Promise((resolve) => {
                this.opponentRenders.get(player)!.AnimatePlayCards(cards).then((animatedCards) => {
                    this.deckRender.RenderPlayedCard(cards.Cards[cards.Cards.size() - 1])
                    this.updateDrawButton(comboSeq)
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

    public OpponentChoseColor(color: Color): void {
        this.animationQueue.QueueAnimation(async () => {
            await this.deckRender.AnimateUpdateColor(color)
        })
    }

    private updateDrawButton(comboSeq: CardSequence | undefined): void {
        if (comboSeq !== undefined) {
            this.drawButtonLabel.Text = "+%d".format(comboSeq.DrawValue())
        } else {
            this.drawButtonLabel.Text = "Draw"
        }
    }

    public QueueUpdateDrawButton(comboSeq: CardSequence | undefined): void {
        this.animationQueue.QueueAnimation(async () => {
            this.updateDrawButton(comboSeq)
        })
    }
}