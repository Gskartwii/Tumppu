import { Card, NormalCardType, NormalCard } from "shared/Card";
import { RenderCard } from "./Card";

const CardOffsetRatio = 1/2
export const CardAspectRatio = 2.5/3.5

const HandCardTweenInfo = new TweenInfo(
    1/4, // time
    Enum.EasingStyle.Quart,
    Enum.EasingDirection.InOut,
)
const MouseMoveTweenInfo = new TweenInfo(
    1/15,
    Enum.EasingStyle.Quad,
    Enum.EasingDirection.Out,
)

const TweenService = game.GetService("TweenService")

export class RenderCardSet {
    Hand: Array<Card>
    UseStandardOrder: boolean = true
    private RenderFrame: Frame
    CardRenders: Map<Card, TextButton> = new Map()
    private ownedCardRenders: Map<TextButton, boolean> = new Map()
    Mouse: Mouse
    private mouseConnection: RBXScriptConnection

    constructor(hand: Array<Card>, frame: Frame, mouse: Mouse) {
        this.Hand = hand
        this.RenderFrame = frame
        this.Mouse = mouse

        this.mouseConnection = mouse.Move.Connect(() => {
            if (!this.cardsFit(this.CardRenders)) {
                this.tweenCardsToPosition(this.getCardRelativePositions(this.CardRenders), MouseMoveTweenInfo)
            }
        })
    }

    private ownsCard(card: Card): boolean {
        let render = this.CardRenders.get(card)
        if (render === undefined) {
            return false
        }
        return true === this.ownedCardRenders.get(render)
    }

    private cardRendersInOrder(renders: Map<Card, TextButton>): Array<[Card, TextButton]> {
        function reliableTieBreaker(a: unknown, b: unknown): boolean {
            // HACK
            let aStr = tostring(a)
            let bStr = tostring(b)
            return aStr < bStr
        }

        if (!this.UseStandardOrder) {
            let result: Array<[Card, TextButton]> = []
            for (let card of this.Hand) {
                result.push([card, renders.get(card)!])
            }
            return result
        }
        let result = renders.entries()
        table.sort(result, ([a, _], [b, __]) => {
            let aWild = a.IsWildcard()
            let bWild = b.IsWildcard()
            if (aWild !== bWild) {
                return bWild
            } else if (aWild && bWild) {
                if (a.CardType === b.CardType) {
                    return reliableTieBreaker(a, b)
                }
                return a.CardType < b.CardType
            }

            let aIsNumber = a.CardType === NormalCardType.Number
            let bIsNumber = b.CardType === NormalCardType.Number
            let aColor = a.Color!
            let bColor = b.Color!
            if (aIsNumber && bIsNumber) {
                let aNumber = (a as NormalCard).Number!
                let bNumber = (b as NormalCard).Number!
                if (aNumber === bNumber) {
                    if (aColor === bColor) {
                        return reliableTieBreaker(a, b)
                    }
                    return aColor < bColor
                }
                return aNumber < bNumber
            }

            if (a.CardType === b.CardType) {
                if (aColor === bColor) {
                    return reliableTieBreaker(a, b)
                }
                return aColor < bColor
            }
            return a.CardType < b.CardType
        })

        return result
    }

    private fixLayoutOrders(renders: Map<Card, TextButton>): void {
        let i = 0
        for (let [card, render] of this.cardRendersInOrder(renders)) {
            render.LayoutOrder = i
            render.ZIndex = i
            i++
        }
    }

    private cardsFit(renders: Map<Card, TextButton>): boolean {
        const frameWidth = this.RenderFrame.AbsoluteSize.X
        const countCards = renders.size()
        const cardWidth = this.EstimateAbsoluteSize().X
        const cardsWidth = cardWidth + (countCards - 1) * cardWidth * CardOffsetRatio

        return frameWidth >= cardsWidth
    }

    private getPositionCurve(normMousX: number, countCards: number) {
        const partThresold = math.max(0.15, 0.15 - 1/countCards)

        const quickGrowStartPos = math.max(0, normMousX - partThresold)
        const quickGrowEndPos = math.min(1, normMousX + partThresold)
        const quickGrowStartOff = math.max(0, quickGrowStartPos - 0.1)
        const quickGrowEndOff = math.min(1, quickGrowEndPos + 0.1)

        return (normIndex: number) => {
            // Construct the curve in three parts

            if (normIndex < quickGrowStartPos) {
                // pre-quick grow
                return (math.sin(
                        normIndex/quickGrowStartPos*math.pi/2 - math.pi/2) + 1)
                        *quickGrowStartOff
            } else if (normIndex > quickGrowEndPos) {
                // post-quick grow
                return math.sin((normIndex - quickGrowEndPos)/(1-quickGrowEndPos)*math.pi/2)
                    * (1-quickGrowEndOff)
                    + quickGrowEndOff
            } else {
                // quick grow: linear
                return (normIndex - quickGrowStartPos) / (quickGrowEndPos - quickGrowStartPos) * (quickGrowEndOff - quickGrowStartOff) + quickGrowStartOff
            }
        }
    } 
    
    private getCardAbsolutePositions(renders: Map<Card, TextButton>): Map<Card, Vector2> {
        let sorted = this.cardRendersInOrder(renders)

        const countCards = sorted.size()
        if (countCards === 0) {
            return new Map()
        }

        this.fixLayoutOrders(renders)
        const frameStartX = this.RenderFrame.AbsolutePosition.X
        const frameWidth = this.RenderFrame.AbsoluteSize.X
        const frameEndX = frameStartX + frameWidth
        const frameStartY = this.RenderFrame.AbsolutePosition.Y
        const frameEndY = frameStartY + this.RenderFrame.AbsoluteSize.Y
        const mousePositionX = this.Mouse.X
        const mousePositionY = this.Mouse.Y
        const estCardWidth = this.EstimateAbsoluteSize().X
        const maxCardOffset = estCardWidth * CardOffsetRatio

        const baseCardWidth = math.min(maxCardOffset, frameWidth / countCards)
        const cardAreaMaxWidth = (countCards - 1) * maxCardOffset + estCardWidth
        const cardsStartOffset = math.max(0, 0.5 * frameWidth - 0.5 * cardAreaMaxWidth)

        if (this.cardsFit(renders) || 
            mousePositionX < frameStartX
            || mousePositionX > frameEndX
            || mousePositionY < frameStartY
            || mousePositionY > frameEndY) {
                // equal adjustments for everything
                let positions = new Map<Card, Vector2>()
                let i = 0
                for (let [card, render] of sorted) {
                    positions.set(card, new Vector2(baseCardWidth * i + frameStartX + cardsStartOffset, frameStartY))
                    i++
                }
                return positions
            }

        const normalizedMouseX = (mousePositionX - frameStartX) / (frameEndX - frameStartX)
        //const paramA = 3
        const curve = this.getPositionCurve(normalizedMouseX, countCards)

        let positions = new Map<Card, Vector2>()
        let i = 0
        for (let [card, render] of sorted) {
            let normalizedIndex = i / countCards
            const normalizedPosition = curve(normalizedIndex)

            positions.set(card, new Vector2(
                normalizedPosition*frameWidth + frameStartX,
                frameStartY,
            ))
            i++
        }
        return positions
    }

    private getAbsolutePositionsCenterAligned(renders: Map<Card, TextButton>): Map<Card, Vector2> {
        let layoutDelegate = new Instance("UIGridLayout")
        layoutDelegate.Name = "__LayoutDelegate"

        let cardSize = this.EstimateAbsoluteSize()
        layoutDelegate.CellSize = new UDim2(0, cardSize.X, 0, cardSize.Y)
        layoutDelegate.CellPadding = new UDim2(0, -CardOffsetRatio * cardSize.X, 0, 0)
        layoutDelegate.FillDirection = Enum.FillDirection.Horizontal
        layoutDelegate.HorizontalAlignment = Enum.HorizontalAlignment.Center
        layoutDelegate.Parent = this.RenderFrame
        layoutDelegate.SortOrder = Enum.SortOrder.LayoutOrder

        let result = renders.entries().reduce((map, [card, frame]) => {
            map.set(card, frame.AbsolutePosition)
            return map
        }, new Map<Card, Vector2>())
        layoutDelegate.Destroy()
        return result
    }

    private getCardRelativePositions(renders: Map<Card, TextButton>): Map<Card, Vector2> {
        let result = this.getCardAbsolutePositions(renders)
        result.forEach((pos, card, map) => {
            return map.set(card, pos.sub(this.RenderFrame.AbsolutePosition))
        })

        return result
    }

    public Render(): void {
        let cardSizeVec = this.EstimateAbsoluteSize()
        let cardSize = new UDim2(0, cardSizeVec.X, 0, cardSizeVec.Y)
        this.RenderFrame.ClearAllChildren()

        let cards = this.Hand
        this.CardRenders = cards.reduce((map, card, index) => {
            let render = new RenderCard(card).FrontAsButton()
            render.Size = cardSize
            render.Parent = this.RenderFrame

            map.set(card, render)
            return map
        }, new Map<Card, TextButton>())

        this.getCardRelativePositions(this.CardRenders).forEach((pos, card) => {
            this.CardRenders.get(card)!.Position = new UDim2(0, pos.X, 0, pos.Y)
        })
    }

    private tweenCardsToPosition(newPositions: Map<Card, Vector2>, info: TweenInfo = HandCardTweenInfo): Promise<void> {
        return new Promise((resolve, reject) => {
            let tweens: Array<Tween> = []

            for (let [card, newPosition] of newPositions) {
                if (!this.ownsCard(card)) {
                    continue
                }

                let render = this.CardRenders.get(card)!
                let tween = TweenService.Create(
                    render,
                    info,
                    {Position: new UDim2(0, newPosition.X, 0, newPosition.Y)}
                )
                tween.Play()

                tweens.push(tween)
            }

            Promise.spawn(() => {
                wait(HandCardTweenInfo.Time)

                resolve()
            })
        })
    }

    public AddNewCards(cards: Array<Card>): Map<Card, TextButton> {
        let baseIndex = this.CardRenders.size()
        let cardSizeVec = this.EstimateAbsoluteSize()
        let cardSize = new UDim2(0, cardSizeVec.X, 0, cardSizeVec.Y)

        let newRenders = cards.reduce((map, card, index) => {
            let render = new RenderCard(card).FrontAsButton()
            render.Size = cardSize
            render.Parent = this.RenderFrame
            render.ZIndex = baseIndex + index
            render.LayoutOrder = baseIndex + index

            map.set(card, render)
            return map
        }, new Map<Card, TextButton>())

        this.CardRenders = new Map(this.CardRenders.entries().concat(newRenders.entries()))
        for (let [card, render] of newRenders) {
            this.ownedCardRenders.set(render, true)
        }
        this.tweenCardsToPosition(this.getCardRelativePositions(this.CardRenders))

        return newRenders
    }

    public MakeSpaceForCardRenders(cards: Map<Card, TextButton>): void {
        const oldParents = new Map<TextButton, Instance>()
        for (let [card, render] of cards) {
            oldParents.set(render, render.Parent!)
            render.Parent = this.RenderFrame
        }

        const tempRenders = new Map(this.CardRenders.entries().concat(cards.entries()))
        let positions = this.getCardRelativePositions(tempRenders)
        for (let [card, render] of cards) {
            positions.delete(card)
        }
        this.tweenCardsToPosition(positions)

        for (let [render, parent] of oldParents) {
            render.Parent = parent
        }
    }

    public AddRender(card: Card, render: TextButton): void {
        this.Hand.push(card)
        this.ownedCardRenders.set(render, true)
        this.CardRenders.set(card, render)
        render.Parent = this.RenderFrame
    }

    public EstimateAbsolutePositions(cards: Map<Card, TextButton>): Map<TextButton, Vector2> {
        let oldLayoutOrders = cards.values().reduce((map, render) => {
            map.set(render, render.LayoutOrder)
            return map
        }, new Map<TextButton, number>())
        let oldParents = cards.values().reduce((map, render) => {
            map.set(render, render.Parent)
            return map
        }, new Map<TextButton, Instance | undefined>())

        const tempRenders = new Map(this.CardRenders.entries().concat(cards.entries()))
        let result = this.getCardAbsolutePositions(tempRenders)

        for (let [card, render] of cards) {
            this.CardRenders.delete(card)
            render.LayoutOrder = oldLayoutOrders.get(render)!
            render.Parent = oldParents.get(render)
        }

        return new Map(result
            .entries()
            .filter(([card, pos]) => cards.get(card) !== undefined)
            .map(([card, pos]) => [cards.get(card)!, pos]))
    }

    public EstimateAbsoluteSize(): Vector2 {
        let absoluteY = this.RenderFrame.AbsoluteSize.Y
        return new Vector2(absoluteY * CardAspectRatio, absoluteY)
    }

    public DisownCards(cards: Array<Card>): void {
        for (let card of cards) {
            let render = this.CardRenders.get(card)!
            this.ownedCardRenders.delete(render)
            this.CardRenders.delete(card)
        }

        this.tweenCardsToPosition(this.getCardRelativePositions(this.CardRenders))
    }

    public GetAbsolutePosition(): Vector2 {
        return this.RenderFrame.AbsolutePosition
    }

    public Destroy(): void {
        this.mouseConnection.Disconnect()
        for (let [render, isOwned] of this.ownedCardRenders) {
            if (isOwned) {
                render.Destroy()
            }
        }

        // don't destroy RenderFrame here, it may be owned by somebody else
    }
}