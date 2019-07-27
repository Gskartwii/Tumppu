import { Card, Color, NormalCardType, WildcardCardType } from "shared/Card";

export const CardColors = new Map<Color, Color3>([
    [Color.Red, Color3.fromRGB(0xf4, 0x43, 0x36)], // Red500
    [Color.Green, Color3.fromRGB(0x4C, 0xAF, 0x50)], // Green500
    [Color.Blue, Color3.fromRGB(0x3F, 0x51, 0xB5)], // Indigo500
    [Color.Yellow, Color3.fromRGB(0xFF, 0xC1, 0x07)], // Amber500
])
export const DefaultCardColor = Color3.fromRGB(0x42, 0x42, 0x42) // Grey800

const CardPadding = new UDim(0, 16)

const SpriteSheets = new Map<string, string>([
    ["MaterialContent", "rbxassetid://242376482"],
    ["MaterialNotification", "rbxassetid://242376827"],
    ["MaterialAction2", "rbxassetid://242376304"],
    ["TumppuExtra", "rbxassetid://3510513770"],
])
const NormalCardIcons = new Map<NormalCardType, {spriteSheet: string, position: Vector2, size: Vector2}>([
    [NormalCardType.Reverse, {
        spriteSheet: SpriteSheets.get("MaterialNotification")!,
        position: new Vector2(96, 384),
        size: new Vector2(96, 96)
    }], // notification/sync
    [NormalCardType.Skip, {
        spriteSheet: SpriteSheets.get("MaterialContent")!,
        position: new Vector2(0, 0),
        size: new Vector2(96, 96),
    }] // content/block
])
const WildcardIcons = new Map<WildcardCardType, {spriteSheet: string, position: Vector2, size: Vector2}>([
    [WildcardCardType.Democracy, {
        spriteSheet: SpriteSheets.get("TumppuExtra")!,
        position: new Vector2(0, 0),
        size: new Vector2(96, 96),
    }],
    [WildcardCardType.Dictator, {
        spriteSheet: SpriteSheets.get("TumppuExtra")!,
        position: new Vector2(96, 0),
        size: new Vector2(96, 96),
    }],
    [WildcardCardType.Exchange, {
        spriteSheet: SpriteSheets.get("TumppuExtra")!,
        position: new Vector2(192, 0),
        size: new Vector2(96, 96),
    }],
    [WildcardCardType.Polluter, {
        spriteSheet: SpriteSheets.get("TumppuExtra")!,
        position: new Vector2(288, 0),
        size: new Vector2(96, 96),
    }],
    [WildcardCardType.Everybody, {
        spriteSheet: SpriteSheets.get("TumppuExtra")!,
        position: new Vector2(384, 0),
        size: new Vector2(96, 96),
    }],
    [WildcardCardType.Spy, {
        spriteSheet: SpriteSheets.get("MaterialAction2")!,
        position: new Vector2(672, 576),
        size: new Vector2(96, 96),
    }],
])

const MainIconColor = new Color3(1, 1, 1)
const MainIconSizeMin = 32
const MainIconSizeMax = 96
const SideIconColor = new Color3(1, 1, 1)
const SideIconSizeMin = 16
const SideIconSizeMax = 32

const MainTextColor = new Color3(1, 1, 1)
const MainTextFont = Enum.Font.GothamBlack
const MainTextSizeMin = 32
const MainTextSizeMax = 96
const SideTextColor = new Color3(1, 1, 1)
const SideTextFont = Enum.Font.GothamBlack
const SideTextSizeMin = 16
const SideTextSizeMax = 32

const BackText = "TUMPPU"
const BackTextRotation = 70
const BackTextColor = new Color3(1, 1, 1)
const BackColor = Color3.fromRGB(0x42, 0x42, 0x42) // Grey800
const BackTextFont = Enum.Font.GothamBlack

Promise.spawn(() => game.GetService("ContentProvider").PreloadAsync(
    SpriteSheets.entries()
    .map(([key, value]) => value)
    .map((url) => {
        let temp = new Instance("ImageLabel")
        temp.Image = url
        return temp
    })
))

export class RenderCard {
    Card: Card

    constructor(card: Card) {
        this.Card = card
    }

    public HasIcon(): boolean {
        if (!this.Card.IsWildcard()) {
            switch (this.Card.CardType) {
            case NormalCardType.Skip:
            case NormalCardType.Reverse:
                return true
            default:
                return false
            }
        } else {
            return this.Card.CardType !== WildcardCardType.Draw4
        }
    }

    private configureFront(result: Frame | TextButton): void {
        result.BackgroundColor3 = this.Card.Color === undefined ? DefaultCardColor : CardColors.get(this.Card.Color)!
        result.BorderSizePixel = 0
        result.Name = "Render_" + tostring(this.Card.Color) + "_" + this.Card.Name()

        let padding = new Instance("UIPadding", result)
        padding.PaddingBottom = CardPadding
        padding.PaddingLeft = CardPadding
        padding.PaddingTop = CardPadding
        padding.PaddingRight = CardPadding
        
        if (this.HasIcon()) {
            let iconData: {spriteSheet: string, position: Vector2, size: Vector2}
            if (this.Card.IsWildcard()) {
                iconData = WildcardIcons.get(this.Card.CardType)!
            } else {
                iconData = NormalCardIcons.get(this.Card.CardType as NormalCardType)!
            }

            let mainIcon = new Instance("ImageLabel", result)
            mainIcon.Name = "MainIcon"
            mainIcon.Size = new UDim2(1, 0, 1, 0)
            mainIcon.AnchorPoint = new Vector2(.5, .5)
            mainIcon.Position = new UDim2(.5, 0, .5, 0)
            mainIcon.BackgroundTransparency = 1
            mainIcon.Image = iconData.spriteSheet
            mainIcon.ImageRectOffset = iconData.position
            mainIcon.ImageRectSize = iconData.size
            let mainIconSizeConstraint = new Instance("UISizeConstraint", mainIcon)
            mainIconSizeConstraint.MinSize = new Vector2(MainIconSizeMin, MainIconSizeMin)
            mainIconSizeConstraint.MaxSize = new Vector2(MainIconSizeMax, MainIconSizeMax)
            let mainIconAspectRatioConstraint = new Instance("UIAspectRatioConstraint", mainIcon)
            mainIconAspectRatioConstraint.AspectRatio = 1

            let nwIcon = new Instance("ImageLabel", result)
            nwIcon.Name = "NWIcon"
            nwIcon.Size = new UDim2(1, 0, 1, 0)
            nwIcon.BackgroundTransparency = 1
            nwIcon.Image = iconData.spriteSheet
            nwIcon.ImageRectOffset = iconData.position
            nwIcon.ImageRectSize = iconData.size
            let nwIconSizeConstraint = new Instance("UISizeConstraint", nwIcon)
            nwIconSizeConstraint.MinSize = new Vector2(SideIconSizeMin, SideIconSizeMin)
            nwIconSizeConstraint.MaxSize = new Vector2(SideIconSizeMax, SideIconSizeMax)
            let nwIconAspectRatioConstraint = new Instance("UIAspectRatioConstraint", nwIcon)
            nwIconAspectRatioConstraint.AspectRatio = 1

            let seIcon = nwIcon.Clone()
            seIcon.AnchorPoint = new Vector2(1, 1)
            seIcon.Position = new UDim2(1, 0, 1, 0)
            seIcon.Rotation = 180
            seIcon.Parent = result
        } else {
            let frontText = new Instance("TextLabel", result)
            frontText.Name = "FrontText"
            frontText.Size = new UDim2(1, 0, 1, 0)
            frontText.Font = MainTextFont
            frontText.Text = this.Card.Name()
            frontText.TextScaled = true
            frontText.TextColor3 = MainTextColor
            frontText.BackgroundTransparency = 1
            let frontTextConstraint = new Instance("UITextSizeConstraint", frontText)
            frontTextConstraint.MinTextSize = MainTextSizeMin
            frontTextConstraint.MaxTextSize = MainTextSizeMax

            let nwText = new Instance("TextLabel", result)
            nwText.Name = "NWText"
            nwText.Size = new UDim2(1, 0, 1, 0)
            nwText.Font = SideTextFont
            nwText.Text = this.Card.Name()
            nwText.TextScaled = true
            nwText.TextColor3 = SideTextColor
            nwText.TextXAlignment = Enum.TextXAlignment.Left
            nwText.TextYAlignment = Enum.TextYAlignment.Top
            nwText.BackgroundTransparency = 1
            let nwTextConstraint = new Instance("UITextSizeConstraint", nwText)
            nwTextConstraint.MinTextSize = SideTextSizeMin
            nwTextConstraint.MaxTextSize = SideTextSizeMax

            let seText = nwText.Clone()
            seText.Name = "SEText"
            seText.Rotation = 180
            seText.Parent = result
        }
    }

    public FrontAsButton(): TextButton {
        let result = new Instance("TextButton")
        result.AutoButtonColor = false
        result.Active = true
        result.Text = ""

        this.configureFront(result)

        return result
    }

    public FrontAsFrame(): Frame {
        let result = new Instance("Frame")
        this.configureFront(result)
        return result
    }

    public BackAsFrame(): Frame {
        let result = new Instance("Frame")
        result.BackgroundColor3 = BackColor
        result.BorderSizePixel = 0

        let text = new Instance("TextLabel", result)
        text.AnchorPoint = new Vector2(.5, .5)
        text.Position = new UDim2(.5, 0, .5, 0)
        text.Size = new UDim2(1, 0, 1, 0)
        text.Font = BackTextFont
        text.Text = BackText
        text.TextColor3 = BackTextColor
        text.Rotation = BackTextRotation
        text.TextScaled = true
        text.BackgroundTransparency = 1

        return result
    }
}

// Cards that aren't known by the client
// For compatibility with GameState stuff
export class UnknownCard implements Card {
    Color = undefined
    CardType = NormalCardType.Number

    public IsSpecial(): never {
        return error("unknown card")
    }
    public IsComboStartCard(): never {
        return error("unknown card")
    }
    public IsComboCard(): never {
        return error("unknown card")
    }
    public DrawValue(): never {
        return error("unknown card")
    }
    public CanJumpIn(): never {
        return error("unknown card")
    }
    public CanSequence(): never {
        return error("unknown card")
    }
    public CanPlay(): never {
        return error("unknown card")
    }
    public Serialize(): never {
        return error("unknown card")
    }
    public Name(): never {
        return error("unknown card")
    }
    public IsWildcard(): never {
        return error("unknown card")
    }
}