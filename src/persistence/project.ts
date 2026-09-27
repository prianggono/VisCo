import type { Composition } from "../domain/composition.js";
import type { Deck } from "../domain/deck.js";
import type { Group } from "../domain/group.js";
import type { Slice } from "../domain/slice.js";
import type { Source, Library } from "../domain/source.js";
import type { OutputTarget } from "../domain/output.js";
import type { LicenseInfo } from "../domain/license.js";
import type { Channel } from "../domain/channel.js";

export interface ProjectSnapshot {
  readonly version: number;
  readonly compositions: readonly Composition[];
  /** Presentation flows such as Offline and Online. */
  readonly channels: readonly Channel[];
  readonly decks: readonly Deck[];
  /** Groups are persisted globally but each Group is owned by exactly one Deck. */
  readonly groups: readonly Group[];
  /** Layers are owned by Decks; there is intentionally no second global Layer registry. */
  readonly slices: readonly Slice[];
  readonly sources: readonly Source[];
  readonly library?: Library;
  /** Persisted output routing configuration; required so project restore cannot silently lose outputs. */
  readonly outputs: readonly OutputTarget[];
  /** Persisted license state; required so project restore preserves watermark policy. */
  readonly license: LicenseInfo;
}

export interface RevisionSnapshot {
  readonly id: string;
  readonly createdAt: string;
  readonly project: ProjectSnapshot;
}
