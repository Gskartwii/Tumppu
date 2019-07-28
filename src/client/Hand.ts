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

    constructor(hand: Array<Card>, frame: Frame, mouse: Mouse) {
        this.Hand = hand
        this.RenderFrame = frame
        this.Mouse = mouse

        mouse.Move.Connect(() => {
            if (!this.canDelegate()) {
                this.tweenCardsToPosition(this.getCardRelativePositions(), MouseMoveTweenInfo)
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

    private cardRendersInOrder(): Array<[Card, TextButton]> {
        function reliableTieBreaker(a: unknown, b: unknown): boolean {
            // HACK
            let aStr = tostring(a)
            let bStr = tostring(b)
            return aStr < bStr
        }

        if (!this.UseStandardOrder) {
            let result: Array<[Card, TextButton]> = []
            for (let card of this.Hand) {
                result.push([card, this.CardRenders.get(card)!])
            }
            return result
        }
        let result = this.CardRenders.entries()
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

    private fixLayoutOrders(): void {
        let i = 0
        for (let [card, render] of this.cardRendersInOrder()) {
            render.LayoutOrder = i
            render.ZIndex = i
            i++
        }
    }

    private canDelegate(): boolean {
        const frameWidth = this.RenderFrame.AbsoluteSize.X
        const countCards = this.CardRenders.size()
        const cardWidth = this.EstimateAbsoluteSize().X
        const cardsWidth = cardWidth + (countCards - 1) * cardWidth * CardOffsetRatio

        return frameWidth >= cardsWidth
    }
    
    private getCardAbsolutePositions(): Map<Card, Vector2> {
        let sorted = this.cardRendersInOrder()

        const countCards = sorted.size()
        if (countCards === 0) {
            return new Map()
        }

        this.fixLayoutOrders()
        const cardWidth = this.EstimateAbsoluteSize().X
        const frameStartX = this.RenderFrame.AbsolutePosition.X
        const frameWidth = this.RenderFrame.AbsoluteSize.X
        const frameEndX = frameStartX + frameWidth
        const frameStartY = this.RenderFrame.AbsolutePosition.Y
        const frameEndY = frameStartY + this.RenderFrame.AbsoluteSize.Y
        const mousePositionX = this.Mouse.X
        const mousePositionY = this.Mouse.Y

        if (this.canDelegate()) {
            // deletgate calculations to a UIGridLayout with center alignment
            return this.getAbsolutePositionsCenterAligned()
        }

        const baseCardWidth = (frameWidth) / countCards
        if (mousePositionX < frameStartX
            || mousePositionX > frameEndX
            || mousePositionY < frameStartY
            || mousePositionY > frameEndY) {
                // equal adjustments for everything
                let positions = new Map<Card, Vector2>()
                let i = 0
                for (let [card, render] of sorted) {
                    positions.set(card, new Vector2(baseCardWidth * i + frameStartX, frameStartY))
                    i++
                }
                return positions
            }

        const normalizedMouseX = 1 - (mousePositionX - frameStartX) / (frameEndX - frameStartX)
        const paramA = 3

        let positions = new Map<Card, Vector2>()
        let i = 0
        for (let [card, render] of sorted) {
            let normalizedIndex = i / (countCards - 1)
            let normalizedPosition = (
                  (1/6)*paramA*math.pow(normalizedIndex, 3)
                - (1/2)*paramA*normalizedMouseX*math.pow(normalizedIndex, 2)
                + normalizedIndex
                - (1/6)*paramA*normalizedIndex
                + (1/2)*paramA*normalizedMouseX*normalizedIndex)

            positions.set(card, new Vector2(
                normalizedPosition*(frameWidth - baseCardWidth) + frameStartX,
                frameStartY,
            ))
            i++
        }
        return positions
    }

    private getAbsolutePositionsCenterAligned(): Map<Card, Vector2> {
        let layoutDelegate = new Instance("UIGridLayout")
        layoutDelegate.Name = "__LayoutDelegate"

        let cardSize = this.EstimateAbsoluteSize()
        layoutDelegate.CellSize = new UDim2(0, cardSize.X, 0, cardSize.Y)
        layoutDelegate.CellPadding = new UDim2(0, -CardOffsetRatio * cardSize.X, 0, 0)
        layoutDelegate.FillDirection = Enum.FillDirection.Horizontal
        layoutDelegate.HorizontalAlignment = Enum.HorizontalAlignment.Center
        layoutDelegate.Parent = this.RenderFrame
        layoutDelegate.SortOrder = Enum.SortOrder.LayoutOrder

        let result = this.CardRenders.entries().reduce((map, [card, frame]) => {
            map.set(card, frame.AbsolutePosition)
            return map
        }, new Map<Card, Vector2>())
        layoutDelegate.Destroy()
        return result
    }

    private getCardRelativePositions(): Map<Card, Vector2> {
        let result = this.getCardAbsolutePositions()
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

        this.getCardRelativePositions().forEach((pos, card) => {
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
        this.tweenCardsToPosition(this.getCardRelativePositions())

        return newRenders
    }

    public MakeSpaceForCardRenders(cards: Map<Card, TextButton>): void {
        for (let [card, render] of cards) {
            render.Parent = this.RenderFrame
        }

        this.CardRenders = new Map(this.CardRenders.entries().concat(cards.entries()))
        let positions = this.getCardRelativePositions()
        for (let [card, render] of cards) {
            positions.delete(card)
        }
        this.tweenCardsToPosition(positions)
    }

    public AddRender(card: Card, render: TextButton): void {
        this.ownedCardRenders.set(render, true)
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

        for (let [card, render] of cards) {
            render.Parent = this.RenderFrame
            this.CardRenders.set(card, render)
        }

        let result = this.getCardAbsolutePositions()

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

        this.tweenCardsToPosition(this.getCardRelativePositions())
    }

    public GetAbsolutePosition(): Vector2 {
        return this.RenderFrame.AbsolutePosition
    }
}