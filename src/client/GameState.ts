import { GameState, ISerializedGameState } from "shared/GameState";
import { TumppuPlayer, RealPlayer, AbstractPlayer } from "shared/Player";
import { UnknownCard } from "./Card";
import { CardSequence, ISerializedCard, Card } from "shared/Card";

const localPlayer = game.GetService("Players").LocalPlayer

function generateUnknownCards(n: number): Array<UnknownCard> {
    let unknowns = []
    for (let i = 0; i < n; i++) {
        unknowns.push(new UnknownCard)
    }
    return unknowns
}

export function DeserializeState(serializedState: ISerializedGameState): LocalGameState {
    let players = serializedState.Players.map((serializedPlr) => {
        if (serializedPlr.Player === undefined) {
            return new AbstractPlayer
        } else {
            return new RealPlayer(serializedPlr.Player)
        }
    })

    let state = new LocalGameState(players)
    serializedState.Players.forEach((serializedPlayer, index) => {
        if (typeIs(serializedPlayer.Hand, "number")) {
            players[index].Hand!.Cards = generateUnknownCards(serializedPlayer.Hand)
        } else {
            players[index].Hand!.Cards = serializedPlayer.Hand.map((card) => state.DeserializeCard(card))
        }
    })
    state.IsStartingCard = serializedState.IsStartingCard

    state.Direction = serializedState.Direction
    state.IsOpenMode = serializedState.IsOpenMode
    state.Turn = serializedState.Turn
    state.DrawPile = generateUnknownCards(serializedState.DrawPile)
    state.DiscardPile = generateUnknownCards(serializedState.DiscardPile.count)
    state.DiscardPile.pop()
    state.DiscardPile.push(state.DeserializeCard(serializedState.DiscardPile.lastCard))

    if (serializedState.CurrentCombo !== undefined) {
        let comboCards = serializedState.CurrentCombo.map((card) => state.DeserializeCard(card))
        let combo = new CardSequence(comboCards)
        state.CurrentCombo = combo
    }

    if (serializedState.IsStartingCard) {
        state.HandleStartingCard()
        state.IsStartingCard = false
    }

    state.LastPlayer = state.DeserializePlayer(serializedState.LastPlayer)

    return state
}

export class LocalGameState extends GameState {
    public LocalPlayer(): TumppuPlayer {
        return this.Players.find((player) => player instanceof RealPlayer && player.Player === localPlayer)!
    }

    public DeserializeCards(cards: number | Array<ISerializedCard>): Array<Card> {
        if (typeIs(cards, "number")) {
            return generateUnknownCards(cards)
        }
        return cards.map((card) => this.DeserializeCard(card))
    }

    public HandleStartingCard(): void {
        return this.handleStartingCard(this.DiscardPile[this.DiscardPile.size() - 1])
    }

    public PlayCards(player: TumppuPlayer, cards: CardSequence): void {
        super.PlayCards(player, cards)
        this.handleCards(player, cards)
    }
}