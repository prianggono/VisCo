import { describe, expect, it } from "vitest";
import type { Channel } from "../src/domain/channel.js";

describe("Presentation channels", () => {
  it("distinguishes offline and online presentation flows", () => {
    const offline: Channel = {
      id: "channel-offline",
      name: "Offline",
      type: "offline",
      deckIds: ["deck-opening", "deck-main"],
      enabled: true
    };
    const online: Channel = {
      id: "channel-online",
      name: "Online",
      type: "online",
      deckIds: ["deck-opening", "deck-stream"],
      enabled: true
    };

    expect(offline.type).toBe("offline");
    expect(online.type).toBe("online");
    expect(offline.deckIds).toContain("deck-main");
    expect(online.deckIds).toContain("deck-stream");
  });

  it("allows the same Deck to be reused by both flows", () => {
    const sharedDeckId = "deck-opening";
    const offline: Channel = { id: "offline", name: "Offline", type: "offline", deckIds: [sharedDeckId], enabled: true };
    const online: Channel = { id: "online", name: "Online", type: "online", deckIds: [sharedDeckId], enabled: true };

    expect(offline.deckIds).toContain(sharedDeckId);
    expect(online.deckIds).toContain(sharedDeckId);
  });
});
