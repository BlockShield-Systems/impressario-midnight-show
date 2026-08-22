export interface MovementInputEdgeSnapshot {
  readonly jumpPressed: boolean;
  readonly dashPressed: boolean;
}

export interface MovementInputSnapshot
  extends MovementInputEdgeSnapshot {
  readonly moveX: number;
  readonly downHeld: boolean;
  readonly jumpHeld: boolean;
}

export class MovementInputEdges {
  private jumpQueued = false;
  private dashQueued = false;

  public queueJump(): void {
    this.jumpQueued = true;
  }

  public queueDash(): void {
    this.dashQueued = true;
  }

  public snapshot(
    consumeEdges: boolean
  ): MovementInputEdgeSnapshot {
    const snapshot = {
      jumpPressed:
        consumeEdges && this.jumpQueued,
      dashPressed:
        consumeEdges && this.dashQueued
    };

    if (consumeEdges) {
      this.clear();
    }

    return snapshot;
  }

  public clear(): void {
    this.jumpQueued = false;
    this.dashQueued = false;
  }
}
