export const AUDIO_EVENTS = {
  enemyTagChanged:
    "audio:enemy-tag-changed",
  bossTagChanged:
    "audio:boss-tag-changed",
  bossAction:
    "audio:boss-action",
  combatHit:
    "audio:combat-hit",
  checkpoint:
    "audio:checkpoint",
  gateOpen:
    "audio:gate-open",
  gateClose:
    "audio:gate-close",
  objectiveComplete:
    "audio:objective-complete",
  finaleStarted:
    "audio:finale-started"
} as const;

export interface SpatialAudioEvent {
  readonly x: number;
  readonly tag?: string;
}
