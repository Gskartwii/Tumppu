import { ClientEvent } from "@rbxts/net";
import { ISerializedGameState } from "shared/GameState";
import { DeserializeState } from "./GameState";
import { NetworkManager } from "./NetworkManager";

export {}

const tellState = new ClientEvent("TellState")

tellState.Connect((serializedState: ISerializedGameState) => {
    new NetworkManager(DeserializeState(serializedState))
})