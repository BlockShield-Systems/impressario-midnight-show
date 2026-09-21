import Phaser from "phaser";
import { BossView } from "../boss/BossView";
import { AUDIO_EVENTS } from "../audio/AudioEvents";
import { leaderboard } from "../leaderboard/LeaderboardClient";
import {
  PickupRespawnState
} from "../magic/GrandCardState";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./WorldLayout";
import { getWorldCheckpoint, getWorldGate, type WorldGateId } from "./WorldGameplay";
import type { CombatSystem, CombatTarget } from "../combat/CombatSystem";
import type { MagicSystem } from "../magic/MagicSystem";
import type { PlayerHealthSystem } from "../player/PlayerHealthSystem";
import type { PlayerController } from "../main";
import {
  MIRROR_CONDUCTOR_ARENA_BOUNDS,
  MIRROR_CONDUCTOR_ANCHORS,
  MIRROR_CONDUCTOR_ARENA_WALLS,
  MIRROR_CONDUCTOR_BEAM_REACH,
  MIRROR_CONDUCTOR_INITIAL_HEALTH,
  MIRROR_CONDUCTOR_PHASE_THREE_PROJECTILE_CAP,
  MirrorConductorCheckpointState,
  MirrorConductorFloorHazardState,
  MirrorConductorMovementCycle,
  MirrorConductorShieldCycle,
  applyMirrorConductorDamage,
  getMirrorConductorPhase,
  getMirrorConductorProjectileProfile,
  getMirrorConductorShieldRearmSeconds,
  shouldShowMirrorConductorThresholdCue,
  type MirrorConductorCheckpointPhase,
  type MirrorConductorMovementSnapshot,
  type MirrorConductorPhaseCheckpoint
} from "./MirrorConductorPhase";

export const MIRROR_CONDUCTOR_START_X = 44672;
export const MIRROR_CONDUCTOR_END_X = 49824;
export const MIRROR_CONDUCTOR_THRESHOLD_X = 45552;
const ARENA_LEFT =
  MIRROR_CONDUCTOR_ARENA_BOUNDS.left;
const ARENA_RIGHT =
  MIRROR_CONDUCTOR_ARENA_BOUNDS.right;
const ARENA_CENTER_X =
  (ARENA_LEFT + ARENA_RIGHT) * 0.5;

const HEALTH_PICKUP_RESPAWN_SECONDS = 14;

const RUNTIME_CARD_PICKUP_POSITIONS = [
  {
    id: "ConductorCardLeft",
    x: 45920,
    y: 520
  },
  {
    id: "ConductorCardRight",
    x: 48544,
    y: 520
  }
] as const;

const RUNTIME_HEALTH_PICKUP_POSITIONS = [
  {
    id: "ConductorRoseLeft",
    x: 46176,
    y: 352
  },
  {
    id: "ConductorRoseRight",
    x: 47968,
    y: 416
  }
] as const;

type BossCounter = {
  readonly x: number;
  readonly y: number;
};

type BossAction =
  | "intro"
  | "shield-block"
  | "shield-break"
  | "projectile-volley";

interface BossProjectile {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lifetime: number;
  radius: number;
  color: number;
  active: boolean;
  spawnDelay: number;
}

interface RuntimeGrandCardPickup {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  active: boolean;
}

interface RuntimeHealthPickup {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

interface FinaleParticle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lifetime: number;
  maximumLifetime: number;
  color: number;
  size: number;
}

function playerBounds(
  player: PlayerController
): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(
    player.x,
    player.y,
    player.width,
    player.height
  );
}

function circleIntersectsRectangle(
  x: number,
  y: number,
  radius: number,
  rectangle: Phaser.Geom.Rectangle
): boolean {
  const nearestX = Phaser.Math.Clamp(
    x,
    rectangle.left,
    rectangle.right
  );

  const nearestY = Phaser.Math.Clamp(
    y,
    rectangle.top,
    rectangle.bottom
  );

  const deltaX = x - nearestX;
  const deltaY = y - nearestY;

  return (
    deltaX * deltaX +
      deltaY * deltaY <=
    radius * radius
  );
}

function lineIntersectsRectangle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rectangle: Phaser.Geom.Rectangle,
  tolerance: number
): boolean {
  return Phaser.Geom.Intersects.LineToRectangle(
    new Phaser.Geom.Line(x1, y1, x2, y2),
    new Phaser.Geom.Rectangle(
      rectangle.x - tolerance,
      rectangle.y - tolerance,
      rectangle.width + tolerance * 2,
      rectangle.height + tolerance * 2
    )
  );
}

function createWorldGate(
  id: WorldGateId
): Phaser.Geom.Rectangle {
  const gate = getWorldGate(id);

  return new Phaser.Geom.Rectangle(
    gate.x,
    gate.y,
    gate.width,
    gate.height
  );
}

class MirrorConductor
implements CombatTarget {
  public x: number =
    MIRROR_CONDUCTOR_ANCHORS[0].x;
  public y: number =
    MIRROR_CONDUCTOR_ANCHORS[0].y;

  public readonly width = 42;
  public readonly height = 64;

  public active = false;

  private health =
    MIRROR_CONDUCTOR_INITIAL_HEALTH;
  private shielded = true;
  private defeated = false;
  private markedTimer = 0;
  private flashTimer = 0;

  private visualTimer = 0;
  private visualMode:
    | "idle"
    | "entrance"
    | "cast"
    | "counter"
    | "hurt"
    | "transition12"
    | "transition23" = "idle";

  private previousPhase: 1 | 2 | 3 = 1;
  private facing: -1 | 1 = -1;
  private defeatSequenceStarted = false;
  private readonly movementCycle =
    new MirrorConductorMovementCycle();

  // Each score is approximately 90 seconds. These minimum windows
  // prevent high damage from skipping an entire musical phase.
  private phaseElapsed = 0;

  private readonly view: BossView;

  public constructor(
    private readonly scene:
      Phaser.Scene,
    private readonly graphics:
      Phaser.GameObjects.Graphics,
    private readonly onCounter:
      (counter: BossCounter) => void,
    private readonly onAction:
      (action: BossAction) => void,
    private readonly onPhaseChanged: (
      phase: MirrorConductorCheckpointPhase
    ) => void,
    private readonly onDefeated:
      () => void
  ) {
    this.graphics.setDepth(47);

    this.view = new BossView(
      scene,
      46
    );

    this.view.reset(
      this.viewState(false)
    );
  }

  public get currentHealth(): number {
    return this.health;
  }

  public get phase(): 1 | 2 | 3 {
    return getMirrorConductorPhase(
      this.health
    );
  }

  public get isShielded(): boolean {
    return this.shielded;
  }

  public get isDefeated(): boolean {
    return this.defeated;
  }

  public get movementState():
  MirrorConductorMovementSnapshot {
    return this.movementCycle.current;
  }

  public get bounds():
  Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.x,
      this.y,
      this.width,
      this.height
    );
  }

  public setEnabled(
    enabled: boolean
  ): void {
    this.active =
      enabled &&
      !this.defeated;

    if (this.active) {
      this.visualMode = "entrance";
      this.visualTimer = 0.82;
      this.previousPhase = this.phase;
      this.phaseElapsed = 0;
    }

    this.updateView();
  }

  public breakShield(): boolean {
    if (
      !this.active ||
      !this.shielded
    ) {
      return false;
    }

    this.shielded = false;
    this.onAction("shield-break");
    this.flashTimer = 0.35;
    this.visualMode = "entrance";
    this.visualTimer = 0.72;

    this.scene.cameras.main.flash(
      220,
      115,
      239,
      255,
      false
    );

    this.scene.cameras.main.shake(
      150,
      0.006
    );

    return true;
  }

  public rearmShield(): void {
    if (!this.active || this.shielded) {
      return;
    }

    this.shielded = true;
    this.flashTimer = 0.16;
  }

  public receiveRangedHit(
    damage: number,
    sourceX: number
  ): boolean {
    if (!this.active) {
      return false;
    }

    this.markedTimer = 2.2;

    this.receiveHit(
      damage,
      60,
      -20,
      sourceX < this.x
        ? 1
        : -1
    );

    return true;
  }

  public receiveHit(
    damage: number,
    _knockbackX: number,
    _knockbackY: number,
    facing: -1 | 1
  ): void {
    if (!this.active) {
      return;
    }

    this.facing = facing;

    if (this.shielded) {
      this.onAction("shield-block");
      this.onCounter({
        x:
          this.x +
          this.width * 0.5,
        y:
          this.y +
          this.height * 0.5
      });

      this.flashTimer = 0.1;
      this.visualMode = "counter";
      this.visualTimer = 0.48;
      return;
    }

    const phaseBefore = this.phase;

    this.health = applyMirrorConductorDamage(
      this.health,
      damage,
      this.phaseElapsed
    );

    this.flashTimer = 0.12;

    if (this.health <= 0) {
      this.startDefeatSequence();
      return;
    }

    const phaseAfter = this.phase;

    if (phaseAfter !== phaseBefore) {
      this.phaseElapsed = 0;
      this.onPhaseChanged(
        phaseAfter as
          MirrorConductorCheckpointPhase
      );
    }

    if (
      phaseBefore === 1 &&
      phaseAfter >= 2
    ) {
      this.visualMode = "transition12";
      this.visualTimer = 1.0;
    } else if (
      phaseBefore <= 2 &&
      phaseAfter === 3
    ) {
      this.visualMode = "transition23";
      this.visualTimer = 1.12;
    } else {
      this.visualMode = "hurt";
      this.visualTimer = 0.3;
    }

    this.previousPhase = phaseAfter;
  }

  public restorePhaseCheckpoint(
    checkpoint: MirrorConductorPhaseCheckpoint
  ): void {
    this.reset();
    this.health = checkpoint.bossHealth;
    this.shielded = checkpoint.shielded;
    this.previousPhase = checkpoint.phase;
    this.phaseElapsed =
      checkpoint.phaseElapsed;
  }

  public reset(): void {
    const position =
      MIRROR_CONDUCTOR_ANCHORS[0];
    this.x = position.x;
    this.y = position.y;

    this.health =
      MIRROR_CONDUCTOR_INITIAL_HEALTH;
    this.shielded = true;
    this.active = false;
    this.defeated = false;

    this.markedTimer = 0;
    this.flashTimer = 0;
    this.visualTimer = 0;
    this.visualMode = "idle";
    this.previousPhase = 1;
    this.facing = -1;
    this.defeatSequenceStarted = false;
    this.phaseElapsed = 0;
    this.movementCycle.reset();

    this.graphics.clear();

    this.view.reset(
      this.viewState(false)
    );
  }

  public update(
    deltaSeconds: number,
    elapsed: number,
    player: PlayerController,
    fireProjectile: (
      x: number,
      y: number,
      targetX: number,
      targetY: number,
      color?: number,
      delaySeconds?: number,
      speed?: number,
      lifetimeSeconds?: number
    ) => void
  ): MirrorConductorMovementSnapshot {
    if (!this.active) {
      return this.movementCycle.current;
    }

    this.phaseElapsed +=
      deltaSeconds;

    this.flashTimer = Math.max(
      0,
      this.flashTimer - deltaSeconds
    );

    this.markedTimer = Math.max(
      0,
      this.markedTimer - deltaSeconds
    );

    this.visualTimer = Math.max(
      0,
      this.visualTimer - deltaSeconds
    );

    this.facing =
      player.centerX <
      this.x + this.width * 0.5
        ? -1
        : 1;

    const position =
      this.movementCycle.update(
        deltaSeconds
      );
    this.x = position.x;
    this.y = position.y;

    const currentPhase = this.phase;

    if (
      currentPhase !==
      this.previousPhase
    ) {
      if (
        this.previousPhase === 1 &&
        currentPhase >= 2
      ) {
        this.visualMode = "transition12";
        this.visualTimer = 1.0;
      } else if (
        this.previousPhase <= 2 &&
        currentPhase === 3
      ) {
        this.visualMode = "transition23";
        this.visualTimer = 1.12;
      }

      this.previousPhase =
        currentPhase;
    }

    if (
      this.visualTimer <= 0 &&
      this.visualMode !== "idle"
    ) {
      this.visualMode = "idle";
    }

    const projectileProfile =
      getMirrorConductorProjectileProfile(
        currentPhase
      );
    const interval =
      projectileProfile.intervalSeconds;

    const previousCycle =
      Math.floor(
        (elapsed - deltaSeconds) /
        interval
      );

    const currentCycle =
      Math.floor(
        elapsed /
        interval
      );

    if (
      currentCycle !== previousCycle
    ) {
      this.onAction("projectile-volley");

      const count =
        projectileProfile.volleySize;

      for (
        let index = 0;
        index < count;
        index += 1
      ) {
        fireProjectile(
          this.x +
            this.width * 0.5,
          this.y +
            this.height * 0.5,
          player.centerX,
          player.centerY +
            (
              index -
              (count - 1) * 0.5
            ) *
            55,
          index % 2 === 0
            ? 0xe95acb
            : 0x75eaf1,
          index *
            projectileProfile.staggerSeconds,
          projectileProfile.speed,
          projectileProfile.lifetimeSeconds
        );
      }

      if (
        this.visualMode === "idle"
      ) {
        this.visualMode = "cast";
        this.visualTimer = 0.48;
      }
    }

    this.updateView();
    this.redrawVfx(elapsed);

    return position;
  }

  private startDefeatSequence(): void {
    if (this.defeatSequenceStarted) {
      return;
    }

    this.defeatSequenceStarted = true;
    this.defeated = true;
    this.active = false;

    this.graphics.clear();

    this.view.playDefeatSequence(
      this.viewState(true),
      () => {
        this.onDefeated();
      }
    );
  }

  private updateView(): void {
    this.view.update(
      this.viewState(this.active),
      this.selectAnimation()
    );
  }

  private viewState(
    visible: boolean
  ): {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly facing: -1 | 1;
    readonly phase: 1 | 2 | 3;
    readonly visible: boolean;
    readonly flashing: boolean;
  } {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      facing: this.facing,
      phase: this.phase,
      visible,
      flashing: this.flashTimer > 0
    };
  }

  private selectAnimation(): string {
    const phase = this.phase;

    switch (this.visualMode) {
      case "entrance":
        return "boss_entrance";

      case "transition12":
        return "boss_transition_1_2";

      case "transition23":
        return "boss_transition_2_3";

      case "cast":
        return `boss_phase${phase}_cast`;

      case "counter":
        return `boss_phase${phase}_counter`;

      case "hurt":
        return `boss_hurt_phase${phase}`;

      case "idle":
        return `boss_phase${phase}_idle`;
    }
  }

  private redrawVfx(
    elapsed: number
  ): void {
    const g = this.graphics;
    g.clear();

    if (!this.active) {
      return;
    }

    const centerX =
      this.x +
      this.width * 0.5;

    const centerY =
      this.y +
      this.height * 0.5;

    if (
      this.phase >= 2 &&
      this.markedTimer <= 0
    ) {
      for (
        const offset of [-105, 105]
      ) {
        g.fillStyle(
          0x723769,
          0.2
        );

        g.fillRoundedRect(
          this.x + offset,
          this.y,
          this.width,
          this.height,
          9
        );

        g.lineStyle(
          2,
          0xe95acb,
          0.45
        );

        g.strokeRoundedRect(
          this.x + offset,
          this.y,
          this.width,
          this.height,
          9
        );
      }
    }

    if (this.markedTimer > 0) {
      g.lineStyle(
        4,
        0xf6d466,
        1
      );

      g.strokeCircle(
        centerX,
        centerY,
        38 +
          Math.sin(elapsed * 7) *
          3
      );
    }

    if (this.shielded) {
      g.lineStyle(
        5,
        0x91f5f4,
        0.86
      );

      g.strokeCircle(
        centerX,
        centerY,
        41
      );
    }
  }
}


export class MirrorConductorSystem {
  private elapsed = 0;
  private checkpointReached = false;
  private bossStarted = false;
  private bossDefeated = false;
  private finaleActive = false;
  private finaleSubmitted = false;
  private finaleTime = 0;
  private finaleBurstTimer = 0;
  private finaleCreditsVisible = false;
  private curtainAudioPlayed = false;
  private readonly floorHazard =
    new MirrorConductorFloorHazardState();
  private hazardCooldown = 0;
  private previousSpotlightCasts = 0;
  private wasInsideSection = false;
  private arenaWallsActive = false;
  private readonly shieldCycle =
    new MirrorConductorShieldCycle();
  private readonly phaseCheckpoint =
    new MirrorConductorCheckpointState();
  private readonly healthPickupRespawns =
    new PickupRespawnState();

  private readonly entranceGate = createWorldGate(
    "MirrorConductorEntrance"
  );

  private readonly resolutionGate = createWorldGate(
    "MirrorConductorResolution"
  );

  private readonly arenaWalls =
    MIRROR_CONDUCTOR_ARENA_WALLS.map(
      wall =>
        new Phaser.Geom.Rectangle(
          wall.x,
          wall.y,
          wall.width,
          wall.height
        )
    );

  private readonly projectiles: BossProjectile[] = [];
  private readonly finaleParticles: FinaleParticle[] = [];
  private readonly cardPickups:
    RuntimeGrandCardPickup[] =
      RUNTIME_CARD_PICKUP_POSITIONS.map(
        pickup => ({
          ...pickup,
          active: false
        })
      );
  private readonly healthPickups:
    readonly RuntimeHealthPickup[] =
      RUNTIME_HEALTH_PICKUP_POSITIONS;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hud: Phaser.GameObjects.Text;
  private readonly bossHudGraphics: Phaser.GameObjects.Graphics;
  private readonly bossHudText: Phaser.GameObjects.Text;
  private readonly finaleGraphics: Phaser.GameObjects.Graphics;
  private readonly finaleOverlay: Phaser.GameObjects.Graphics;
  private readonly finaleTitle: Phaser.GameObjects.Text;
  private readonly finaleHint: Phaser.GameObjects.Text;
  private readonly finaleCredits: Phaser.GameObjects.Text;
  private readonly conductor: MirrorConductor;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth: PlayerHealthSystem,
    combatSystem: CombatSystem,
    private readonly magicSystem: MagicSystem,
    private readonly addSolid: (
      solid: Phaser.Geom.Rectangle
    ) => void,
    private readonly removeSolid: (
      solid: Phaser.Geom.Rectangle
    ) => void
  ) {
    this.graphics = scene.add.graphics().setDepth(48);

    this.hud = scene.add.text(
      320,
      62,
      "",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#d7fbff",
        backgroundColor: "#050713e8",
        padding: { x: 10, y: 7 }
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1220)
      .setVisible(false);

    this.bossHudGraphics = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(1240)
      .setVisible(false);

    this.bossHudText = scene.add.text(
      452,
      7,
      "",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f6d675",
        stroke: "#050713",
        strokeThickness: 3
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1241)
      .setVisible(false);

    this.finaleGraphics = scene.add.graphics().setDepth(1320);
    this.finaleOverlay = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(1900);

    this.finaleTitle = scene.add.text(
      320,
      88,
      [
        "CONGRATULATION",
        "",
        "NOW YOU ARE AN",
        "IMPRESSARIO TRUE MAGICIAN"
      ].join("\n"),
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "17px",
        color: "#ffe184",
        stroke: "#130718",
        strokeThickness: 5,
        backgroundColor: "#080713d9",
        padding: { x: 18, y: 12 }
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1950)
      .setAlpha(0)
      .setVisible(false);

    this.finaleHint = scene.add.text(
      320,
      272,
      [
        "THE CURTAIN FALLS...",
        "BUT THE GRAND PERFORMANCE MAY CONTINUE."
      ].join("\n"),
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8ff4f2",
        stroke: "#060913",
        strokeThickness: 4,
        backgroundColor: "#050711d9",
        padding: { x: 12, y: 9 }
      }
    )
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(1951)
      .setAlpha(0)
      .setVisible(false);

    this.finaleCredits = scene.add.text(
      320,
      72,
      [
        "IMPRESSARIO",
        "THE MIDNIGHT SHOW",
        "",
        "A GAME BY",
        "DEMIAN LIENERT",
        "",
        "PROGRAMMING / LOGIC / DESIGN",
        "TYPESCRIPT",
        "",
        "THANK YOU FOR PLAYING"
      ].join("\n"),
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#f5df9c",
        stroke: "#05060c",
        strokeThickness: 4,
        lineSpacing: 7
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2000)
      .setAlpha(0)
      .setVisible(false);

    this.conductor = new MirrorConductor(
      scene,
      scene.add.graphics().setDepth(46),
      counter => {
        this.fireProjectile(
          counter.x,
          counter.y,
          this.player.centerX,
          this.player.centerY,
          0xf2c963
        );
      },
      action => {
        this.emitBossAction(action);
      },
      phase => {
        this.capturePhaseCheckpoint(
          phase
        );
      },
      () => {
        this.completeBoss();
      }
    );

    combatSystem.registerTarget(this.conductor);
    this.addSolid(this.resolutionGate);
    this.setArenaWallsActive(false);
    this.previousSpotlightCasts = magicSystem.castsPerformed;
    this.shieldCycle.reset(this.player.centerX);
    this.beginFreshRun();
  }

  public update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    this.hazardCooldown = Math.max(
      0,
      this.hazardCooldown - deltaSeconds
    );

    const insideSection =
      this.player.x >= MIRROR_CONDUCTOR_START_X &&
      this.player.x < MIRROR_CONDUCTOR_END_X;

    if (
      !this.wasInsideSection &&
      insideSection
    ) {
      this.beginFreshRun();
      this.restoreAuthoredCheckpoint();
    } else if (
      this.wasInsideSection &&
      !insideSection
    ) {
      this.clearFinaleRunState();
    }

    this.wasInsideSection = insideSection;

    if (
      insideSection &&
      this.player.y > 675 &&
      !this.finaleActive
    ) {
      this.playerHealth.fallOut();
      return;
    }

    if (
      !this.checkpointReached &&
      this.player.x >= getWorldCheckpoint(
        "MirrorConductor"
      ).triggerX
    ) {
      this.checkpointReached = true;
      this.playerHealth.setCheckpoint(
        getWorldCheckpoint("MirrorConductor")
      );
    }

    this.updateThresholdCue(insideSection);

    if (
      !this.bossStarted &&
      !this.bossDefeated &&
      this.player.x >= MIRROR_CONDUCTOR_THRESHOLD_X &&
      this.player.x < MIRROR_CONDUCTOR_END_X
    ) {
      this.startBoss();
    }

    if (this.bossStarted) {
      this.updateBoss(deltaSeconds);
      this.updateProjectiles(deltaSeconds);
      this.updateHazards(deltaSeconds);
      this.updateCardPickups();
      this.updateHealthPickups(
        deltaSeconds
      );
    }

    if (this.finaleActive) {
      this.updateFinale(deltaSeconds);
    }

    this.redraw();
  }

  public resetAfterDeath(): void {
    if (this.bossDefeated) {
      return;
    }

    this.elapsed = 0;
    this.hazardCooldown = 0;
    this.floorHazard.reset();
    this.projectiles.length = 0;
    this.bossStarted = false;
    this.clearCardPickups();

    const activeDropTimers =
      this.dropTimerRemainders();
    this.phaseCheckpoint.preserveDropTimers(
      activeDropTimers
    );
    const checkpoint =
      this.phaseCheckpoint.restore();

    if (checkpoint) {
      this.conductor.restorePhaseCheckpoint(
        checkpoint
      );
      this.shieldCycle.reset(
        this.player.centerX
      );
      this.setArenaWallsActive(true);
      this.playerHealth.restoreHealth(
        checkpoint.playerHealth
      );
      this.magicSystem.restoreGrandCardCharges(
        checkpoint.grandCardCharges
      );
      this.restoreDropTimerRemainders(
        checkpoint.dropTimerRemainders
      );
    } else {
      this.conductor.reset();
      this.shieldCycle.reset(
        this.player.centerX
      );
      this.setArenaWallsActive(false);
    }
    this.removeSolid(this.entranceGate);
    this.removeSolid(this.resolutionGate);
    this.addSolid(this.resolutionGate);

    this.restoreCamera();
    this.hideBossHud();
    this.clearThresholdCue();

    this.previousSpotlightCasts =
      this.magicSystem.castsPerformed;
  }

  private capturePhaseCheckpoint(
    phase: MirrorConductorCheckpointPhase
  ): void {
    const checkpoint =
      this.phaseCheckpoint.capture(
        phase,
        this.playerHealth.currentHealth,
        this.magicSystem.grandCardChargeCount,
        this.dropTimerRemainders()
      );

    this.playerHealth.setRuntimeCheckpoint(
      `Mirror Conductor — Phase ${phase}`,
      checkpoint.spawnX,
      checkpoint.spawnY
    );
  }

  private dropTimerRemainders():
  Readonly<Record<string, number>> {
    return {
      ...this.magicSystem
        .grandCardPickupTimerRemainders(
          RUNTIME_CARD_PICKUP_POSITIONS.map(
            pickup => pickup.id
          )
        ),
      ...this.healthPickupRespawns.snapshot(
        RUNTIME_HEALTH_PICKUP_POSITIONS.map(
          pickup => pickup.id
        )
      )
    };
  }

  private restoreDropTimerRemainders(
    remainders: Readonly<Record<string, number>>
  ): void {
    const cardRemainders =
      Object.fromEntries(
        RUNTIME_CARD_PICKUP_POSITIONS.map(
          pickup => [
            pickup.id,
            remainders[pickup.id] ?? 0
          ])
      );
    const healthRemainders =
      Object.fromEntries(
        RUNTIME_HEALTH_PICKUP_POSITIONS.map(
          pickup => [
            pickup.id,
            remainders[pickup.id] ?? 0
          ])
      );

    this.magicSystem
      .restoreGrandCardPickupTimers(
        cardRemainders
      );
    this.healthPickupRespawns.restore(
      healthRemainders
    );
  }

  private beginFreshRun(): void {
    this.phaseCheckpoint.beginRun();
    this.resetDropTimers();
    this.clearCardPickups();
  }

  private clearFinaleRunState(): void {
    this.setArenaWallsActive(false);
    this.phaseCheckpoint.clear();
    this.resetDropTimers();
    this.clearCardPickups();
    this.restoreAuthoredCheckpoint();
  }

  private restoreAuthoredCheckpoint(): void {
    const checkpoint =
      getWorldCheckpoint("MirrorConductor");

    this.playerHealth.replaceRuntimeCheckpoint(
      checkpoint.displayName,
      checkpoint.x,
      checkpoint.y
    );
  }

  private resetDropTimers(): void {
    this.healthPickupRespawns.reset(
      RUNTIME_HEALTH_PICKUP_POSITIONS.map(
        pickup => pickup.id
      )
    );
    this.magicSystem.resetGrandCardPickups(
      RUNTIME_CARD_PICKUP_POSITIONS.map(
        pickup => pickup.id
      )
    );
  }

  private updateThresholdCue(
    insideSection: boolean
  ): void {
    const visible =
      shouldShowMirrorConductorThresholdCue({
        insideSection,
        bossStarted: this.bossStarted,
        bossDefeated: this.bossDefeated,
        finaleActive: this.finaleActive,
        controlsLocked:
          this.playerHealth.controlsLocked,
        playerX: this.player.x,
        thresholdX:
          MIRROR_CONDUCTOR_THRESHOLD_X
      });

    if (visible) {
      this.hud
        .setText(
          "CROSS THE THRESHOLD WHEN READY"
        )
        .setVisible(true);
      return;
    }

    if (!this.bossStarted) {
      this.clearThresholdCue();
    }
  }

  private clearThresholdCue(): void {
    this.hud
      .setText("")
      .setVisible(false);
  }

  private startBoss(): void {
    this.bossStarted = true;
    this.shieldCycle.reset(
      this.player.centerX
    );
    this.floorHazard.reset();
    this.clearThresholdCue();

    this.removeSolid(this.entranceGate);
    this.removeSolid(this.resolutionGate);
    this.addSolid(this.entranceGate);
    this.addSolid(this.resolutionGate);
    this.setArenaWallsActive(true);

    this.scene.cameras.main.setBounds(
      ARENA_LEFT,
      0,
      ARENA_RIGHT - ARENA_LEFT,
      WORLD_HEIGHT
    );

    this.conductor.setEnabled(true);
    this.spawnCardPickups();
    this.hud.setVisible(true);
    this.emitBossAction("intro");

    this.scene.cameras.main.flash(
      260,
      80,
      220,
      245,
      false
    );
  }

  private updateBoss(deltaSeconds: number): void {
    const deferShieldRearm =
      this.conductor.movementState.state === "hold" &&
      !this.conductor.isShielded;

    if (
      this.shieldCycle.update(
        deltaSeconds,
        this.player.centerX,
        true,
        deferShieldRearm
      )
    ) {
      this.conductor.rearmShield();
    }

    const casts = this.magicSystem.castsPerformed;

    if (casts !== this.previousSpotlightCasts) {
      const distance = Phaser.Math.Distance.Between(
        this.player.centerX,
        this.player.centerY,
        this.conductor.bounds.centerX,
        this.conductor.bounds.centerY
      );

      if (
        distance <= 190 &&
        this.shieldCycle.canBreak(
          this.player.centerX
        ) &&
        this.conductor.breakShield()
      ) {
        this.shieldCycle.noteShieldBroken(
          getMirrorConductorShieldRearmSeconds(
            this.conductor.phase
          )
        );
      }
    }

    this.previousSpotlightCasts = casts;

    const movement = this.conductor.update(
      deltaSeconds,
      this.elapsed,
      this.player,
      (
        x,
        y,
        targetX,
        targetY,
        color,
        delaySeconds,
        speed,
        lifetimeSeconds
      ) => {
        this.fireProjectile(
          x,
          y,
          targetX,
          targetY,
          color,
          delaySeconds,
          speed,
          lifetimeSeconds
        );
      }
    );

    if (movement.beamTelegraphStarted) {
      this.scene.events.emit(
        AUDIO_EVENTS.hazardTelegraph,
        this.conductor.bounds.centerX
      );
    }

    this.redrawBossHud();
  }

  private fireProjectile(
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    color = 0xe95acb,
    delaySeconds = 0,
    speed = 230,
    lifetimeSeconds = 4
  ): void {
    if (
      this.conductor.phase === 3 &&
      this.projectiles.filter(
        projectile => projectile.active
      ).length >=
        MIRROR_CONDUCTOR_PHASE_THREE_PROJECTILE_CAP
    ) {
      return;
    }

    const direction = new Phaser.Math.Vector2(
      targetX - x,
      targetY - y
    );

    if (direction.lengthSq() <= 0.0001) {
      direction.set(1, 0);
    }

    direction.normalize();

    this.projectiles.push({
      x,
      y,
      velocityX: direction.x * speed,
      velocityY: direction.y * speed,
      lifetime: lifetimeSeconds,
      radius: 6,
      color,
      active: true,
      spawnDelay: delaySeconds
    });
  }

  private updateProjectiles(
    deltaSeconds: number
  ): void {
    if (this.conductor.isDefeated) {
      this.projectiles.length = 0;
      return;
    }

    const bounds = playerBounds(this.player);

    for (const projectile of this.projectiles) {
      if (!projectile.active) {
        continue;
      }

      let activeDelta = deltaSeconds;

      if (projectile.spawnDelay > 0) {
        activeDelta = Math.max(
          0,
          deltaSeconds - projectile.spawnDelay
        );
        projectile.spawnDelay = Math.max(
          0,
          projectile.spawnDelay - deltaSeconds
        );

        if (projectile.spawnDelay > 0) {
          continue;
        }
      }

      projectile.lifetime -= activeDelta;
      projectile.x +=
        projectile.velocityX * activeDelta;
      projectile.y +=
        projectile.velocityY * activeDelta;

      if (
        projectile.lifetime <= 0 ||
        projectile.x < ARENA_LEFT ||
        projectile.x > ARENA_RIGHT ||
        projectile.y < 0 ||
        projectile.y > 688
      ) {
        projectile.active = false;
        continue;
      }

      if (
        circleIntersectsRectangle(
          projectile.x,
          projectile.y,
          projectile.radius,
          bounds
        ) &&
        this.playerHealth.receiveDamage(
          1,
          projectile.x,
          190,
          -135
        )
      ) {
        projectile.active = false;
      }
    }

    const active = this.projectiles.filter(
      projectile => projectile.active
    );

    this.projectiles.length = 0;
    this.projectiles.push(...active);
  }

  private updateHazards(
    deltaSeconds: number
  ): void {
    if (this.conductor.isDefeated) {
      return;
    }

    const bounds = playerBounds(this.player);
    const phase = this.conductor.phase;
    const movement =
      this.conductor.movementState;
    const beamActive =
      movement.beamState === "active";
    const beamOriginX =
      this.conductor.bounds.centerX;
    const beamOriginY =
      this.conductor.bounds.centerY;

    if (
      beamActive &&
      this.hazardCooldown <= 0
    ) {
      for (
        let index = 0;
        index < phase;
        index += 1
      ) {
        const angle =
          movement.stateElapsed * 1.35 +
          index * Math.PI / phase;

        const endX =
          beamOriginX +
          Math.cos(angle) *
            MIRROR_CONDUCTOR_BEAM_REACH;

        const endY =
          beamOriginY +
          Math.sin(angle) *
            MIRROR_CONDUCTOR_BEAM_REACH;

        if (
          lineIntersectsRectangle(
            beamOriginX,
            beamOriginY,
            endX,
            endY,
            bounds,
            5
          )
        ) {
          this.damageHazard(beamOriginX);
          return;
        }
      }
    }

    if (phase === 3) {
      const suppressRight =
        movement.state === "hold" &&
        movement.anchorIndex === 3;
      const floor = this.floorHazard.update(
        deltaSeconds,
        suppressRight
      );

      if (floor.telegraphStarted) {
        this.scene.events.emit(
          AUDIO_EVENTS.bossAction,
          "floor-warning",
          floor.side === "left" ? 46196 : 48268
        );
      }

      if (floor.damagingSide) {
        const floorHazard =
          new Phaser.Geom.Rectangle(
            floor.damagingSide === "left"
              ? 45160
              : 47232,
            502,
            2072,
            18
          );

        if (
          this.floorHazard.canDamage(
            floor.damagingSide
          ) &&
          this.hazardCooldown <= 0 &&
          Phaser.Geom.Intersects.RectangleToRectangle(
            bounds,
            floorHazard
          ) &&
          this.damageHazard(floorHazard.centerX)
        ) {
          this.floorHazard.markDamageApplied();
        }
      }
    }
  }

  private damageHazard(sourceX: number): boolean {
    const damaged =
      this.playerHealth.receiveDamage(
        1,
        sourceX,
        175,
        -170
      );

    if (damaged) {
      this.hazardCooldown = 1.15;
    }

    return damaged;
  }

  private spawnCardPickups(): void {
    for (const pickup of this.cardPickups) {
      pickup.active =
        this.magicSystem
          .isGrandCardPickupAvailable(
            pickup.id
          );
    }
  }

  private clearCardPickups(): void {
    for (const pickup of this.cardPickups) {
      pickup.active = false;
    }
  }

  private updateCardPickups(): void {
    const bounds = playerBounds(this.player);

    for (const pickup of this.cardPickups) {
      if (
        !pickup.active &&
        this.magicSystem
          .isGrandCardPickupAvailable(
            pickup.id
          )
      ) {
        pickup.active = true;
      }

      if (
        !pickup.active ||
        !Phaser.Geom.Intersects
          .RectangleToRectangle(
            bounds,
            new Phaser.Geom.Rectangle(
              pickup.x - 10,
              pickup.y - 18,
              20,
              24
            )
          )
      ) {
        continue;
      }

      if (
        this.magicSystem.collectGrandCardPickup(
          pickup.id,
          pickup.x
        )
      ) {
        pickup.active = false;
        this.scene.cameras.main.shake(
          55,
          0.0015
        );
      }
    }
  }

  private updateHealthPickups(
    deltaSeconds: number
  ): void {
    this.healthPickupRespawns.update(
      deltaSeconds
    );

    const bounds = playerBounds(this.player);

    for (const pickup of this.healthPickups) {
      if (
        !this.healthPickupRespawns
          .isAvailable(pickup.id) ||
        !Phaser.Geom.Intersects
          .RectangleToRectangle(
            bounds,
            new Phaser.Geom.Rectangle(
              pickup.x - 9,
              pickup.y - 19,
              18,
              20
            )
          )
      ) {
        continue;
      }

      if (
        this.playerHealth.heal(1) &&
        this.healthPickupRespawns.collect(
          pickup.id,
          HEALTH_PICKUP_RESPAWN_SECONDS
        )
      ) {
        this.scene.events.emit(
          AUDIO_EVENTS.grandCardPickup,
          pickup.x
        );
        this.scene.cameras.main.shake(
          55,
          0.0015
        );
      }
    }
  }

  private completeBoss(): void {
    if (
      this.bossDefeated ||
      !this.conductor.isDefeated
    ) {
      return;
    }

    this.bossDefeated = true;
    this.bossStarted = false;
    this.projectiles.length = 0;
    this.clearFinaleRunState();

    this.removeSolid(this.resolutionGate);
    this.removeSolid(this.entranceGate);
    this.setArenaWallsActive(false);
    this.restoreCamera();
    this.hideBossHud();
    this.startFinale();
  }

  private startFinale(): void {
    if (
      this.finaleActive ||
      !this.bossDefeated ||
      !this.conductor.isDefeated
    ) {
      return;
    }

    this.finaleActive = true;
    this.finaleTime = 0;
    this.finaleBurstTimer = 0;
    this.finaleCreditsVisible = false;
    this.curtainAudioPlayed = false;
    this.projectiles.length = 0;

    this.player.velocityX = 0;
    this.player.velocityY = 0;

    this.hud.setVisible(false).setText("");
    this.hideBossHud();

    this.finaleTitle
      .setVisible(true)
      .setAlpha(0);

    this.finaleHint
      .setVisible(false)
      .setAlpha(0);

    this.finaleCredits
      .setVisible(false)
      .setAlpha(0);

    if (!this.finaleSubmitted) {
      this.finaleSubmitted = true;
      void leaderboard.finishRun();
    }

    this.scene.events.emit(
      AUDIO_EVENTS.finaleStarted,
      ARENA_CENTER_X
    );

    this.spawnFinaleBurst(
      ARENA_CENTER_X,
      260,
      48
    );

    this.spawnFinaleBurst(
      ARENA_CENTER_X - 180,
      190,
      30
    );

    this.spawnFinaleBurst(
      ARENA_CENTER_X + 180,
      180,
      30
    );

    this.scene.cameras.main.flash(
      650,
      255,
      222,
      115,
      false
    );

    this.scene.cameras.main.shake(
      420,
      0.009
    );
  }

  private updateFinale(deltaSeconds: number): void {
    this.finaleTime += deltaSeconds;
    this.finaleBurstTimer -= deltaSeconds;
    this.player.velocityY = 0;

    if (this.finaleTime < 4.4) {
      this.player.velocityX = 0;

      if (
        this.finaleBurstTimer <= 0 &&
        this.finaleTime < 3.6
      ) {
        this.spawnFinaleBurst(
          Phaser.Math.Between(45360, 49100),
          Phaser.Math.Between(90, 310),
          Phaser.Math.Between(18, 32)
        );

        this.finaleBurstTimer = 0.48;

        this.scene.events.emit(
          AUDIO_EVENTS.bossAction,
          "finale-firework",
          this.player.centerX
        );
      }
    } else if (this.finaleTime < 8.7) {
      this.player.facing = 1;
      this.player.velocityX = 105;
      this.player.x = Math.min(
        49720,
        this.player.x + 105 * deltaSeconds
      );
    } else {
      this.player.velocityX = 0;
    }

    for (const particle of this.finaleParticles) {
      particle.lifetime -= deltaSeconds;
      particle.velocityY += 155 * deltaSeconds;
      particle.velocityX *= Math.pow(
        0.985,
        deltaSeconds * 60
      );
      particle.x +=
        particle.velocityX * deltaSeconds;
      particle.y +=
        particle.velocityY * deltaSeconds;
    }

    const active = this.finaleParticles.filter(
      particle => particle.lifetime > 0
    );

    this.finaleParticles.length = 0;
    this.finaleParticles.push(...active);

    const titleAlpha =
      this.finaleTime < 0.6
        ? this.finaleTime / 0.6
        : this.finaleTime < 4.2
          ? 1
          : Phaser.Math.Clamp(
              1 -
                (this.finaleTime - 4.2) /
                  0.8,
              0,
              1
            );

    this.finaleTitle
      .setVisible(titleAlpha > 0)
      .setAlpha(titleAlpha);

    const hintAlpha =
      this.finaleTime < 7.5
        ? 0
        : this.finaleTime < 8.3
          ? (this.finaleTime - 7.5) / 0.8
          : this.finaleTime < 10.3
            ? 1
            : Phaser.Math.Clamp(
                1 -
                  (this.finaleTime - 10.3) /
                    0.7,
                0,
                1
              );

    this.finaleHint
      .setVisible(hintAlpha > 0)
      .setAlpha(hintAlpha);

    if (this.finaleTime >= 10.5) {
      if (!this.curtainAudioPlayed) {
        this.curtainAudioPlayed = true;
        this.scene.events.emit(
          AUDIO_EVENTS.bossAction,
          "curtain-close",
          this.player.centerX
        );
      }

      const fade = Phaser.Math.Clamp(
        (this.finaleTime - 10.5) / 1.2,
        0,
        1
      );

      this.finaleOverlay.clear();
      this.finaleOverlay
        .fillStyle(0x020308, fade)
        .fillRect(0, 0, 640, 360);

      if (
        fade >= 0.96 &&
        !this.finaleCreditsVisible
      ) {
        this.finaleCreditsVisible = true;
        this.finaleCredits
          .setVisible(true)
          .setAlpha(0);
      }

      if (this.finaleCreditsVisible) {
        this.finaleCredits.setAlpha(
          Phaser.Math.Clamp(
            (this.finaleTime - 11.65) / 1.2,
            0,
            1
          )
        );
      }
    }

    this.redrawFinale();
  }

  private spawnFinaleBurst(
    x: number,
    y: number,
    amount: number
  ): void {
    const colors = [
      0xffd565,
      0xf05ac7,
      0x75edf2,
      0xffffff,
      0x8ff0a8
    ] as const;

    for (
      let index = 0;
      index < amount;
      index += 1
    ) {
      const angle = Phaser.Math.FloatBetween(
        0,
        Math.PI * 2
      );

      const speed = Phaser.Math.FloatBetween(
        75,
        245
      );

      const lifetime = Phaser.Math.FloatBetween(
        0.8,
        1.85
      );

      this.finaleParticles.push({
        x,
        y,
        velocityX: Math.cos(angle) * speed,
        velocityY:
          Math.sin(angle) * speed -
          Phaser.Math.FloatBetween(15, 75),
        lifetime,
        maximumLifetime: lifetime,
        color:
          colors[
            Phaser.Math.Between(
              0,
              colors.length - 1
            )
          ] ?? 0xffffff,
        size: Phaser.Math.FloatBetween(2, 5)
      });
    }
  }

  private setArenaWallsActive(
    active: boolean
  ): void {
    for (const wall of this.arenaWalls) {
      this.removeSolid(wall);

      if (active) {
        this.addSolid(wall);
      }
    }

    this.arenaWallsActive = active;
  }

  private emitBossAction(
    action: BossAction
  ): void {
    this.scene.events.emit(
      AUDIO_EVENTS.bossAction,
      action,
      this.conductor.bounds.centerX
    );
  }

  private redraw(): void {
    const graphics = this.graphics;
    graphics.clear();

    for (const [gate, active] of [
      [this.entranceGate, this.bossStarted],
      [this.resolutionGate, !this.bossDefeated],
      ...this.arenaWalls.map(
        wall => [
          wall,
          this.arenaWallsActive
        ] as const
      )
    ] as const) {
      if (!active) {
        continue;
      }

      graphics
        .fillStyle(0x080817, 0.94)
        .fillRect(
          gate.x,
          gate.y,
          gate.width,
          gate.height
        );

      graphics.lineStyle(3, 0xe95acb, 1);

      for (
        let y = 0;
        y < gate.height;
        y += 28
      ) {
        graphics.lineBetween(
          gate.x + 2,
          y,
          gate.right - 2,
          y + 17
        );
      }

      graphics
        .lineStyle(2, 0x75eaf1, 1)
        .strokeRect(
          gate.x,
          gate.y,
          gate.width,
          gate.height
        );
    }

    for (const pickup of this.cardPickups) {
      if (!pickup.active || !this.bossStarted) {
        continue;
      }

      const y = pickup.y - 9 +
        Math.sin(
          this.elapsed * 3.8 +
          pickup.x * 0.01
        ) * 3;

      graphics
        .fillStyle(0x75edf2, 0.18)
        .fillCircle(pickup.x, y, 17)
        .fillStyle(0xf6e4b5, 1)
        .fillRoundedRect(
          pickup.x - 8,
          y - 5,
          16,
          10,
          2
        )
        .lineStyle(2, 0xe85fbd, 1)
        .strokeRoundedRect(
          pickup.x - 8,
          y - 5,
          16,
          10,
          2
        )
        .fillStyle(0xd5376c, 1)
        .fillCircle(pickup.x, y, 2);
    }

    for (const pickup of this.healthPickups) {
      if (
        !this.bossStarted ||
        !this.healthPickupRespawns
          .isAvailable(pickup.id)
      ) {
        continue;
      }

      const y = pickup.y - 10 +
        Math.sin(
          this.elapsed * 4.2 +
          pickup.x * 0.01
        ) * 3;

      graphics
        .fillStyle(0x62e9b2, 0.25)
        .fillCircle(pickup.x, y, 14)
        .fillStyle(0xe85fbd, 1)
        .fillCircle(pickup.x - 4, y - 2, 5)
        .fillCircle(pickup.x + 4, y - 2, 5)
        .fillCircle(pickup.x, y - 7, 5)
        .fillStyle(0xf4ce68, 1)
        .fillCircle(pickup.x, y - 2, 3)
        .lineStyle(2, 0x62e9b2, 1)
        .lineBetween(
          pickup.x,
          y + 2,
          pickup.x,
          y + 10
        );
    }

    for (const projectile of this.projectiles) {
      if (projectile.spawnDelay > 0) {
        continue;
      }

      graphics
        .fillStyle(projectile.color, 0.24)
        .fillCircle(
          projectile.x,
          projectile.y,
          projectile.radius * 2.2
        );

      graphics
        .fillStyle(projectile.color, 1)
        .fillCircle(
          projectile.x,
          projectile.y,
          projectile.radius
        );
    }

    if (this.bossStarted) {
      this.redrawBossHazards(graphics);

      const mechanic = this.conductor.isShielded
        ? "USE [K] SPOTLIGHT NEAR THE SHIELD"
        : this.conductor.phase === 2
          ? "USE [L] GRAND CARD TO MARK THE REAL CONDUCTOR"
          : this.conductor.phase === 3
            ? "CURTAIN COLLAPSE — KEEP MOVING"
            : "REFLECTED GUARD BROKEN";

      this.hud
        .setVisible(true)
        .setText(
          `MIRROR CONDUCTOR — PHASE ${this.conductor.phase}\n${mechanic}`
        );
    }
  }

  private redrawBossHazards(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    const phase = this.conductor.phase;
    const movement =
      this.conductor.movementState;
    const active =
      movement.beamState === "active";
    const telegraph =
      movement.beamState === "telegraph";
    const originX =
      this.conductor.bounds.centerX;
    const originY =
      this.conductor.bounds.centerY;

    const alpha = active
      ? 0.92
      : telegraph
        ? 0.28
        : 0;

    if (active || telegraph) {
      for (
        let index = 0;
        index < phase;
        index += 1
      ) {
        const angle =
          movement.stateElapsed * 1.35 +
          index * Math.PI / phase;

        graphics
          .lineStyle(
            active ? 6 : 2,
            0xf05ac7,
            alpha
          )
          .lineBetween(
            originX,
            originY,
            originX +
              Math.cos(angle) *
                MIRROR_CONDUCTOR_BEAM_REACH,
            originY +
              Math.sin(angle) *
                MIRROR_CONDUCTOR_BEAM_REACH
          );
      }
    }

    if (movement.state === "telegraph") {
      const destination =
        MIRROR_CONDUCTOR_ANCHORS[
          movement.destinationIndex
        ]!;

      graphics
        .lineStyle(2, 0x75eaf1, 0.65)
        .lineBetween(
          originX,
          originY,
          destination.x + 21,
          destination.y + 32
        )
        .strokeCircle(
          destination.x + 21,
          destination.y + 32,
          28
        );
    }

    if (phase === 3) {
      const floor = this.floorHazard.current;
      const visible =
        floor.phase === "telegraph" ||
        floor.damagingSide !== null;

      if (visible) {
        graphics
          .fillStyle(
            0xf05ac7,
            floor.damagingSide ? 0.32 : 0.14
          )
          .fillRect(
            floor.side === "left" ? 45160 : 47232,
            502,
            2072,
            18
          );
      }
    }
  }

  private redrawBossHud(): void {
    if (
      !this.bossStarted ||
      this.conductor.isDefeated
    ) {
      this.hideBossHud();
      return;
    }

    const graphics = this.bossHudGraphics;
    const x = 285;
    const y = 22;
    const width = 335;
    const height = 17;

    const healthRatio = Phaser.Math.Clamp(
      this.conductor.currentHealth / 108,
      0,
      1
    );

    graphics.setVisible(true).clear();
    graphics
      .fillStyle(0x03050d, 0.94)
      .fillRoundedRect(
        x - 3,
        y - 3,
        width + 6,
        height + 6,
        6
      );

    graphics
      .fillStyle(0x24112e, 1)
      .fillRoundedRect(
        x,
        y,
        width,
        height,
        4
      );

    const healthColor =
      this.conductor.phase === 3
        ? 0xe653bf
        : this.conductor.phase === 2
          ? 0x9c58db
          : 0x63dce8;

    graphics
      .fillStyle(healthColor, 1)
      .fillRoundedRect(
        x,
        y,
        width * healthRatio,
        height,
        4
      );

    graphics
      .lineStyle(2, 0xe5ba55, 1)
      .strokeRoundedRect(
        x,
        y,
        width,
        height,
        4
      );

    graphics
      .lineStyle(1, 0xf6e6bc, 0.72)
      .lineBetween(
        x + width / 3,
        y,
        x + width / 3,
        y + height
      )
      .lineBetween(
        x + width * 2 / 3,
        y,
        x + width * 2 / 3,
        y + height
      );

    this.bossHudText
      .setVisible(true)
      .setText(
        `THE MIRROR CONDUCTOR — PHASE ${this.conductor.phase}`
      );
  }

  private hideBossHud(): void {
    this.bossHudGraphics
      .setVisible(false)
      .clear();

    this.bossHudText
      .setVisible(false)
      .setText("");
  }

  private restoreCamera(): void {
    this.scene.cameras.main.setBounds(
      0,
      0,
      WORLD_WIDTH,
      WORLD_HEIGHT
    );
  }

  private redrawFinale(): void {
    const graphics = this.finaleGraphics;
    graphics.clear();

    if (!this.finaleActive) {
      return;
    }

    const glow =
      0.72 +
      Math.sin(this.finaleTime * 3) * 0.18;

    graphics
      .fillStyle(0xffdf72, 0.11 * glow)
      .fillRoundedRect(
        49624,
        160,
        176,
        348,
        42
      );

    graphics
      .fillStyle(0x101c36, 1)
      .fillRoundedRect(
        49664,
        192,
        96,
        288,
        34
      );

    graphics
      .lineStyle(9, 0xe4b84f, 0.96)
      .strokeRoundedRect(
        49664,
        192,
        96,
        288,
        34
      );

    graphics
      .lineStyle(4, 0x7bf2ef, 0.88)
      .strokeRoundedRect(
        49677,
        206,
        70,
        270,
        27
      );

    graphics
      .fillStyle(
        0xffed9c,
        0.42 +
          Math.sin(this.finaleTime * 4) *
            0.12
      )
      .fillRoundedRect(
        49687,
        219,
        50,
        259,
        20
      );

    for (const particle of this.finaleParticles) {
      const alpha = Phaser.Math.Clamp(
        particle.lifetime /
          particle.maximumLifetime,
        0,
        1
      );

      graphics
        .fillStyle(particle.color, alpha * 0.18)
        .fillCircle(
          particle.x,
          particle.y,
          particle.size * 2.4
        );

      graphics
        .fillStyle(particle.color, alpha)
        .fillCircle(
          particle.x,
          particle.y,
          particle.size
        );
    }
  }
}
