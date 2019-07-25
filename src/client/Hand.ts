import { Card } from "shared/Card";
import { RenderCard } from "./Card";
import { Hand, TumppuPlayer } from "shared/Player";

// Assuming the size of the parent is given by RelativeYY, this will yield the correct dimensions
const CardSize = new UDim2(0.238, 0, 1, 0)
const CardOffsetMaxScale = 0.238 / 2

const HandCardTweenInfo = new TweenInfo(
    .5, // time
    Enum.EasingStyle.Quart,
    Enum.EasingDirection.InOut,
)

const TweenService = game.GetService("TweenService")

export class RenderHand {
    Player: TumppuPlayer
    Hand: Hand
    private RenderFrame: Frame
    private hasRendered: boolean = false
    CardRenders: Map<Card, TextButton> = new Map()

    constructor(player: TumppuPlayer, frame: Frame) {
        this.Player = player
        this.Hand = player.Hand!
        this.RenderFrame = frame
    }

    private getCardAbsolutePositions(): Map<Card, Vector2> {
        let layoutDelegate = new Instance("UIGridLayout")
        layoutDelegate.Name = "__LayoutDelegate"
        layoutDelegate.CellSize = CardSize
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

    private initialRenderToFrame(): void {
        this.RenderFrame.ClearAllChildren()
        this.CardRenders = new Map()

        let cards = this.Hand.Cards
        this.CardRenders = cards.reduce((map, card, index) => {
            let render = new RenderCard(card).FrontAsButton()
            render.Size = CardSize
            render.Parent = this.RenderFrame
            render.ZIndex = index
            render.LayoutOrder = index

            map.set(card, render)
            return map
        }, new Map<Card, TextButton>())

        this.getCardRelativePositions().forEach((pos, card) => {
            this.CardRenders.get(card)!.Position = new UDim2(0, pos.X, 0, pos.Y)
        })
    }

    private disownOutdatedRenders(): void {
        this.CardRenders = new Map(
            this.CardRenders
                .entries()
                .filter(([card, btn]) => {
                    return this.Hand.HasCards([card])
                })
        )
    }

    private tweenCardsToPosition(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.disownOutdatedRenders()

            let newPositions = this.getCardRelativePositions()
            let tweens: Array<Tween> = []

            for (let [card, render] of this.CardRenders) {
                let newPosition = newPositions.get(card)!
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

    public Update(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.hasRendered) {
                this.initialRenderToFrame()
                this.hasRendered = true
                resolve()
            } else {
                this.tweenCardsToPosition().then(resolve, reject)
            }
        })
    }
}