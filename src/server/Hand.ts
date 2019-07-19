import { Hand } from "shared/Hand";
import { PlayedCardSequence } from "shared/Card";
import { TumppuPlayer } from "shared/GameState";

export class ServerHand extends Hand {
    public DeserializeSequence(player: TumppuPlayer, indexes: Array<number>): PlayedCardSequence {
        let seq = new PlayedCardSequence(player)
        seq.Cards = indexes.map((index: number) => this.Cards[index])

        return seq
    }
}