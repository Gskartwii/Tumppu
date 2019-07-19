import { NormalCard, NormalCardType, WildcardCardType, Color, Card, Wildcard, CardSequence } from "shared/Card";
import { ServerGameState, ServerPlayer } from "./GameState";

export interface ISerializedCard {
    Wildcard: boolean
    Type: NormalCardType | WildcardCardType
    Color?: Color
    Number?: number
    TargetPlayerIndex?: number
}

export interface ServerCard extends Card {
    Serialize(state: ServerGameState): ISerializedCard
}

export class ServerNormalCard extends NormalCard {
    public Serialize(state: ServerGameState): ISerializedCard {
        return {
            Wildcard: false,
            Type: this.CardType,
            Color: this.Color,
            Number: this.Number,
            TargetPlayerIndex: undefined,
        }
    }
}

export class ServerWildcard extends Wildcard {
    TargetPlayer: ServerPlayer | undefined

    public SetTargetPlayer(target: ServerPlayer): void {
        this.TargetPlayer = target
    }

    public Serialize(state: ServerGameState): ISerializedCard {
        return {
            Wildcard: true,
            Type: this.CardType,
            Color: this.Color,
            Number: undefined,
            TargetPlayerIndex: this.TargetPlayer !== undefined ? state.Players.indexOf(this.TargetPlayer) : undefined,
        }
    }
}

export class ServerCardSequence extends CardSequence {
    Cards: Array<ServerCard> = []
}

export function DeserializeCard(serialized: ISerializedCard, state: ServerGameState): ServerCard {
    if (serialized.Wildcard) {
        let result = new ServerWildcard(serialized.Type as WildcardCardType)
        result.Color = serialized.Color
        if (serialized.TargetPlayerIndex !== undefined) {
            result.TargetPlayer = state.Players[serialized.TargetPlayerIndex]
        }

        return result
    }
    return new ServerNormalCard(serialized.Color!, serialized.Type as NormalCardType, serialized.Number)
}