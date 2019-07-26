import { ServerGameState } from "./GameState";
import { BotPlayer } from "./Bot";
import { ServerRealPlayer } from "./Player";

const players = game.GetService("Players")
players.PlayerAdded.Connect((player) => {
    let serverPlayers = [new ServerRealPlayer(player), new BotPlayer, new BotPlayer, new BotPlayer]
    new ServerGameState(serverPlayers)
})