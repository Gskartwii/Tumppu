import { ClientEvent } from "@rbxts/net";
import { ISerializedGameState } from "shared/GameState";
import { DeserializeState } from "./GameState";
import { NetworkManager } from "./NetworkManager";
import { GameView } from "./GameView";

export {}

const tellState = new ClientEvent("TellState")

const localPlayer = game.GetService("Players").LocalPlayer
const baseFrame = localPlayer.WaitForChild("PlayerGui")
    .WaitForChild<ScreenGui>("TumppuGui")
const handFrame = baseFrame
    .WaitForChild<Frame>("OwnCards")
const queueFrame = baseFrame
    .WaitForChild<Frame>("PlayQueue")
const playedCardContainer = baseFrame
    .WaitForChild("CenterContainer")
    .WaitForChild<Frame>("Cards")
const drawButton = baseFrame
    .WaitForChild("CenterContainer")
    .WaitForChild("BelowDecks")
    .WaitForChild<GuiButton>("DrawButton")
const colorDialog = baseFrame
    .WaitForChild<Frame>("ColorDialog")
const playerChoiceDialog = baseFrame
    .WaitForChild<Frame>("PlayerDialog")

tellState.Connect((serializedState: ISerializedGameState) => {
    let state = DeserializeState(serializedState)
    new NetworkManager(state, new GameView({
        state: state,
        baseFrame: baseFrame,
        handFrame: handFrame,
        queueFrame: queueFrame,
        deckContainer: playedCardContainer,
        drawButton: drawButton,
        colorDialog: colorDialog,
        playerDialog: playerChoiceDialog,
        mouse: localPlayer.GetMouse(),
    }))
})
