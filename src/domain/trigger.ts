import type { DeckLayerRef } from "./deck.js";

export type TriggerAction =
  | { readonly type: "program"; readonly target: DeckLayerRef }
  | { readonly type: "sequence"; readonly actions: readonly TriggerAction[] }
  | { readonly type: "set-output-enabled"; readonly outputId: string; readonly enabled: boolean }
  | { readonly type: "set-media-feature"; readonly outputId: string; readonly feature: "stream" | "record" | "virtual"; readonly enabled: boolean }
  | { readonly type: "set-master"; readonly deckId: string; readonly level: number };
