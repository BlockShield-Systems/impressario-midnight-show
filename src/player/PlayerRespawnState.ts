import {
  getWorldCheckpoint,
  type WorldCheckpoint
} from "../world/WorldGameplay.ts";
import type { PlayerController } from "./PlayerController.ts";

const RESPAWN_DELAY_SECONDS = 0.75;

export class PlayerRespawnState {
  private respawnTimer = 0;
  private checkpoint = getWorldCheckpoint(
    "InitialSpawn"
  );
  private readonly player: PlayerController;

  public constructor(
    player: PlayerController
  ) {
    this.player = player;
  }

  public get controlsLocked(): boolean {
    return this.respawnTimer > 0;
  }

  public get currentCheckpoint(): WorldCheckpoint {
    return this.checkpoint;
  }

  public setCheckpoint(
    checkpoint: WorldCheckpoint
  ): void {
    this.checkpoint = checkpoint;
  }

  public beginRespawn(): boolean {
    if (this.controlsLocked) {
      return false;
    }

    this.respawnTimer = RESPAWN_DELAY_SECONDS;
    this.player.resetTransientState();
    return true;
  }

  public update(deltaSeconds: number): boolean {
    if (!this.controlsLocked) {
      return false;
    }

    this.respawnTimer = Math.max(
      0,
      this.respawnTimer - deltaSeconds
    );

    this.player.velocityX = 0;
    this.player.velocityY = 0;

    if (this.respawnTimer > 0) {
      return false;
    }

    this.player.x = this.checkpoint.x;
    this.player.y = this.checkpoint.y;
    this.player.velocityX = 0;
    this.player.velocityY = 0;
    return true;
  }
}
