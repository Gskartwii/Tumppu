import { Card, NormalCardType, NormalCard } from "shared/Card";
import { RenderCard } from "./Card";

const CardOffsetMaxScale = 0.238 / 2
const CardAspectRatio = 2.5/3.5

const HandCardTweenInfo = new TweenInfo(
    .5, // time
    Enum.EasingStyle.Quart,
    Enum.EasingDirection.InOut,
)

const TweenService = game.GetService("TweenService")

export class RenderCardSet {
    Hand: Array<Card>
    UseStandardOrder: boolean = true
    private RenderFrame: Frame
    CardRenders: Map<Card, TextButton> = new Map()

    constructor(hand: Array<Card>, frame: Frame) {
        this.Hand = hand
        this.RenderFrame = frame
    }

    private cardRendersInOrder(): Array<[Card, TextButton]> {
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
                return a.CardType < b.CardType
            }

            let aIsNumber = a.CardType === NormalCardType.Number
            let bIsNumber = b.CardType === NormalCardType.Number
            let colorIsBelow = a.Color! < b.Color!
            if (aIsNumber && bIsNumber) {
                let aNumber = (a as NormalCard).Number!
                let bNumber = (b as NormalCard).Number!
                if (aNumber === bNumber) {
                    return colorIsBelow
                }
                return aNumber < bNumber
            }

            if (a.CardType === b.CardType) {
                return colorIsBelow
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

    private getCardAbsolutePositions(): Map<Card, Vector2> {
        this.fixLayoutOrders()
        let layoutDelegate = new Instance("UIGridLayout")
        layoutDelegate.Name = "__LayoutDelegate"

        let cardSize = this.EstimateAbsoluteSize()
        layoutDelegate.CellSize = new UDim2(0, cardSize.X, 0, cardSize.Y)
        layoutDelegate.CellPadding = new UDim2(-CardOffsetMaxScale, 0, 0, 0)
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
        this.CardRenders = new Map()

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

    private tweenCardsToPosition(newPositions: Map<Card, Vector2>): Promise<void> {
        return new Promise((resolve, reject) => {
            let tweens: Array<Tween> = []

            for (let [card, newPosition] of newPositions) {
                let render = this.CardRenders.get(card)!
                let tween = TweenService.Create(
                    render,
                    HandCardTweenInfo,
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

    public AddRender(render: TextButton): void {
        render.Parent = this.RenderFrame
    }

    public EstimateAbsolutePosition(card: Card, render: TextButton): Vector2 {
        let oldLayoutOrder = render.LayoutOrder
        let oldParent = render.Parent

        render.Parent = this.RenderFrame
        this.CardRenders.set(card, render)
        let result = this.getCardAbsolutePositions().get(card)!

        this.CardRenders.delete(card)
        render.LayoutOrder = oldLayoutOrder
        render.Parent = oldParent

        return result
    }

    public EstimateAbsoluteSize(): Vector2 {
        let absoluteY = this.RenderFrame.AbsoluteSize.Y
        return new Vector2(absoluteY * CardAspectRatio, absoluteY)
    }

    public DisownCards(cards: Array<Card>): void {
        for (let card of cards) {
            this.CardRenders.delete(card)
        }

        this.tweenCardsToPosition(this.getCardRelativePositions())
    }

    public GetAbsolutePosition(): Vector2 {
        return this.RenderFrame.AbsolutePosition
    }
}