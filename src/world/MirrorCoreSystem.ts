import Phaser from "phaser";
import { getWorldEnemySpawns } from "./WorldEnemies";
import {
  getWorldGrandCardPickups,
  getWorldHazards,
  getWorldSupportPickups
} from "./WorldHazards";
import {
  getWorldCheckpoint,
  getWorldGate,
  type WorldGateId
} from "./WorldGameplay";
import { EnemyView } from "../enemies/EnemyView";
import { AUDIO_EVENTS } from "../audio/AudioEvents";
import {
  PickupRespawnState
} from "../magic/GrandCardState";
import {
  MIRROR_CORE_GAUNTLET_CARD_PICKUP_IDS,
  MIRROR_CORE_GAUNTLET_HEALTH_PICKUP_IDS,
  MIRROR_CORE_HEALTH_PICKUP_RESPAWN_SECONDS,
  mirrorCoreEnemyHealth
} from "./MirrorCoreBalance";
import {
  KALEIDOSCOPE_ANGULAR_SPEED,
  KALEIDOSCOPE_BEAM_LENGTH,
  KALEIDOSCOPE_CENTER_X,
  KALEIDOSCOPE_CENTER_Y,
  advanceKaleidoscopeHazardTime,
  getKaleidoscopeHazardPhase,
  isKaleidoscopeBeamDamaging
} from "./KaleidoscopeHazardTiming";

import type {
  CombatSystem,
  CombatTarget
} from "../combat/CombatSystem";

import type {
  PlayerController
} from "../main";

import type {
  MagicSystem
} from "../magic/MagicSystem";

import type {
  PlayerHealthSystem
} from "../player/PlayerHealthSystem";

export const MIRROR_CORE_START_X = 35344;

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
export const MIRROR_CORE_END_X = 39200;

interface MovingMirror {
  readonly solid: Phaser.Geom.Rectangle;
  readonly originX: number;
  readonly originY: number;
  readonly travelX: number;
  readonly travelY: number;
  readonly speed: number;
  readonly phase: number;
  previousX: number;
  previousY: number;
}

interface Rose {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  consumed: boolean;
}

interface GauntletPickup {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

interface CoreProjectile {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lifetime: number;
  radius: number;
  color: number;
  active: boolean;
}

interface CoreEnemySpawn {
  readonly id: string;
  readonly kind:
    | "duelist"
    | "caster"
    | "mime";
  readonly x: number;
  readonly y: number;
  readonly left: number;
  readonly right: number;
}

const ENEMY_SPAWNS:
readonly CoreEnemySpawn[] =
  getWorldEnemySpawns("MirrorCore").map(
    spawn => {
      if (
        spawn.kind !== "duelist" &&
        spawn.kind !== "caster" &&
        spawn.kind !== "mime"
      ) {
        throw new Error(
          `Invalid MirrorCore kind: ${spawn.kind}`
        );
      }

      return {
        id: spawn.id,
        kind: spawn.kind,
        x: spawn.x,
        y: spawn.y,
        left: spawn.patrolLeft,
        right: spawn.patrolRight
      };
    }
  );

const GAUNTLET_HEALTH_PICKUPS:
readonly GauntletPickup[] =
  getWorldSupportPickups("MirrorCore")
    .filter(pickup =>
      MIRROR_CORE_GAUNTLET_HEALTH_PICKUP_IDS.some(
        id => id === pickup.id
      )
    );

const ROSE_POSITIONS =
  getWorldSupportPickups("MirrorCore")
    .filter(pickup =>
      !MIRROR_CORE_GAUNTLET_HEALTH_PICKUP_IDS.some(
        id => id === pickup.id
      )
    );

const GAUNTLET_CARD_PICKUPS:
readonly GauntletPickup[] =
  getWorldGrandCardPickups("MirrorCore")
    .filter(pickup =>
      MIRROR_CORE_GAUNTLET_CARD_PICKUP_IDS.some(
        id => id === pickup.id
      )
    );

const SPIKE_RECTS =
  getWorldHazards(
    "MirrorCore",
    "Spike"
  ).map(
    hazard =>
      new Phaser.Geom.Rectangle(
        hazard.x,
        hazard.y,
        hazard.width,
        hazard.height
      )
  );

if (SPIKE_RECTS.length !== 4) {
  throw new Error(
    `Expected 4 MirrorCore spikes, got ${SPIKE_RECTS.length}.`
  );
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

function moveTowards(
  current: number,
  target: number,
  maximumDelta: number
): number {
  const difference = target - current;

  if (
    Math.abs(difference) <=
    maximumDelta
  ) {
    return target;
  }

  return (
    current +
    Math.sign(difference) *
    maximumDelta
  );
}

function circleIntersectsRectangle(
  centerX: number,
  centerY: number,
  radius: number,
  rectangle: Phaser.Geom.Rectangle
): boolean {
  const closestX = Phaser.Math.Clamp(
    centerX,
    rectangle.left,
    rectangle.right
  );

  const closestY = Phaser.Math.Clamp(
    centerY,
    rectangle.top,
    rectangle.bottom
  );

  const dx = centerX - closestX;
  const dy = centerY - closestY;

  return (
    dx * dx + dy * dy <=
    radius * radius
  );
}

function lineIntersectsRectangle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rectangle: Phaser.Geom.Rectangle,
  thickness: number
): boolean {
  const centerX = rectangle.centerX;
  const centerY = rectangle.centerY;

  const lineX = x2 - x1;
  const lineY = y2 - y1;

  const lengthSquared =
    lineX * lineX +
    lineY * lineY;

  if (lengthSquared <= 0.0001) {
    return circleIntersectsRectangle(
      x1,
      y1,
      thickness,
      rectangle
    );
  }

  const projection =
    Phaser.Math.Clamp(
      (
        (centerX - x1) * lineX +
        (centerY - y1) * lineY
      ) / lengthSquared,
      0,
      1
    );

  const closestX =
    x1 + lineX * projection;

  const closestY =
    y1 + lineY * projection;

  const radius =
    Math.max(
      rectangle.width,
      rectangle.height
    ) * 0.5 +
    thickness;

  return circleIntersectsRectangle(
    closestX,
    closestY,
    radius,
    rectangle
  );
}

class MirrorRelay
implements CombatTarget {
  public active = true;
  public readonly targetingGroup = "MirrorCore";
  public readonly targetingKind = "relay";

  private activated = false;
  private flashTimer = 0;

  private readonly graphics:
    Phaser.GameObjects.Graphics;

  public constructor(
    private readonly scene: Phaser.Scene,
    public readonly targetingId: string,
    public readonly x: number,
    public readonly y: number,
    private readonly onActivated:
      () => void
  ) {
    this.graphics =
      scene.add.graphics();

    this.graphics.setDepth(45);
  }

  public get isActivated(): boolean {
    return this.activated;
  }

  public get bounds():
  Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.x - 15,
      this.y - 19,
      30,
      38
    );
  }

  public receiveHit(
    _damage: number,
    _knockbackX: number,
    _knockbackY: number,
    _facing: -1 | 1
  ): void {
    // Cane and ordinary melee cannot
    // activate a Mirror Relay.
    this.flashTimer = 0.08;
  }

  public receiveRangedHit(
    _damage: number,
    _sourceX: number
  ): boolean {
    if (
      !this.active ||
      this.activated
    ) {
      return false;
    }

    this.activated = true;
    this.active = false;
    this.flashTimer = 0.3;

    this.scene.cameras.main.flash(
      180,
      70,
      225,
      245,
      false
    );

    this.onActivated();

    return true;
  }

  public forceActivated(): void {
    this.activated = true;
    this.active = false;
  }

  public reset(): void {
    this.activated = false;
    this.active = true;
    this.flashTimer = 0;
  }

  public update(
    deltaSeconds: number,
    elapsed: number
  ): void {
    this.flashTimer = Math.max(
      0,
      this.flashTimer - deltaSeconds
    );

    const g = this.graphics;
    g.clear();

    const pulse =
      1 +
      Math.sin(elapsed * 5) *
      0.07;

    const radius = 13 * pulse;

    g.fillStyle(
      this.activated
        ? 0x83f4ee
        : 0x190d2d,
      0.95
    );

    g.fillCircle(
      this.x,
      this.y,
      radius
    );

    g.lineStyle(
      this.flashTimer > 0
        ? 5
        : 2,
      this.activated
        ? 0xffd86a
        : 0xe65ac8,
      1
    );

    g.strokeCircle(
      this.x,
      this.y,
      radius + 4
    );

    g.lineStyle(
      2,
      0x75e8f0,
      0.9
    );

    for (
      let index = 0;
      index < 4;
      index += 1
    ) {
      const angle =
        elapsed * 0.8 +
        index * Math.PI * 0.5;

      g.lineBetween(
        this.x +
          Math.cos(angle) * 8,
        this.y +
          Math.sin(angle) * 8,
        this.x +
          Math.cos(angle) * 19,
        this.y +
          Math.sin(angle) * 19
      );
    }
  }
}

class CoreEnemy
implements CombatTarget {
  public x: number;
  public y: number;

  public readonly width = 20;
  public readonly height = 30;
  public readonly targetingGroup = "MirrorCore";

  public active = false;

  private health: number;
  private defeated = false;

  private velocityX = 0;
  private velocityY = 0;

  private facing: -1 | 1 = -1;

  private actionTimer = 0.5;
  private flashTimer = 0;
  private contactTimer = 0;
  private elapsed = 0;

  private readonly movementHistory:
    number[] = [];

  private readonly view: EnemyView;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player:
      PlayerController,
    private readonly playerHealth:
      PlayerHealthSystem,
    private readonly spawn:
      CoreEnemySpawn,
    private readonly graphics:
      Phaser.GameObjects.Graphics,
    private readonly fireProjectile: (
      x: number,
      y: number,
      targetX: number,
      targetY: number,
      color?: number
    ) => void
  ) {
    this.x = spawn.x;
    this.y = spawn.y;

    this.graphics.setVisible(false);

    this.view = new EnemyView(
      scene,
      44
    );

    this.health =
      mirrorCoreEnemyHealth(spawn.kind);
  }

  public get targetingId(): string {
    return this.spawn.id;
  }

  public get targetingKind(): string {
    return this.spawn.kind;
  }

  public get isDefeated(): boolean {
    return this.defeated;
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

    this.redraw();
  }

  public reset(): void {
    this.x = this.spawn.x;
    this.y = this.spawn.y;

    this.health =
      mirrorCoreEnemyHealth(
        this.spawn.kind
      );

    this.active = false;
    this.defeated = false;

    this.velocityX = 0;
    this.velocityY = 0;

    this.actionTimer = 0.5;
    this.flashTimer = 0;
    this.contactTimer = 0;
    this.elapsed = 0;

    this.movementHistory.length = 0;
    this.redraw();
  }

  public receiveHit(
    damage: number,
    knockbackX: number,
    knockbackY: number,
    facing: -1 | 1
  ): void {
    if (!this.active) {
      return;
    }

    this.health = Math.max(
      0,
      this.health - damage
    );

    this.velocityX =
      knockbackX * facing * 0.55;

    this.velocityY =
      knockbackY * 0.4;

    this.flashTimer = 0.12;

    if (this.health <= 0) {
      this.defeated = true;
      this.active = false;
      this.redraw();

      this.scene.cameras.main.shake(
        90,
        0.003
      );
    }
  }

  public update(
    deltaSeconds: number
  ): void {
    if (
      !this.active ||
      this.defeated
    ) {
      return;
    }

    this.elapsed += deltaSeconds;

    this.actionTimer -= deltaSeconds;

    this.flashTimer = Math.max(
      0,
      this.flashTimer - deltaSeconds
    );

    this.contactTimer = Math.max(
      0,
      this.contactTimer - deltaSeconds
    );

    const distanceX =
      this.player.centerX -
      (this.x + this.width * 0.5);

    if (Math.abs(distanceX) > 2) {
      this.facing =
        distanceX < 0 ? -1 : 1;
    }

    switch (this.spawn.kind) {
      case "duelist":
        this.updateDuelist(
          distanceX,
          deltaSeconds
        );
        break;

      case "caster":
        this.updateCaster(
          distanceX,
          deltaSeconds
        );
        break;

      case "mime":
        this.updateMime(
          deltaSeconds
        );
        break;
    }

    this.x = Phaser.Math.Clamp(
      this.x,
      this.spawn.left,
      this.spawn.right -
        this.width
    );

    if (
      this.spawn.kind !== "caster"
    ) {
      this.velocityY +=
        900 * deltaSeconds;

      this.y +=
        this.velocityY *
        deltaSeconds;

      const floorY =
        this.spawn.y +
        this.height;

      if (
        this.y + this.height >=
        floorY
      ) {
        this.y =
          floorY -
          this.height;

        this.velocityY = 0;
      }
    }

    this.applyContactDamage();
    this.redraw();
  }

  private updateDuelist(
    distanceX: number,
    deltaSeconds: number
  ): void {
    const targetSpeed =
      Math.abs(distanceX) < 68
        ? 0
        : Math.sign(distanceX) * 88;

    this.velocityX = moveTowards(
      this.velocityX,
      targetSpeed,
      410 * deltaSeconds
    );

    if (
      this.actionTimer <= 0 &&
      Math.abs(distanceX) < 210
    ) {
      this.velocityX =
        Math.sign(distanceX) * 255;

      this.actionTimer = 1.05;
    }

    this.x +=
      this.velocityX *
      deltaSeconds;
  }

  private updateCaster(
    distanceX: number,
    deltaSeconds: number
  ): void {
    const hoverTarget =
      this.spawn.y +
      Math.sin(
        this.elapsed * 2.2
      ) * 25;

    this.y = Phaser.Math.Linear(
      this.y,
      hoverTarget,
      1 -
      Math.exp(
        -4 * deltaSeconds
      )
    );

    this.velocityX = moveTowards(
      this.velocityX,
      Math.abs(distanceX) < 135
        ? -Math.sign(distanceX) * 45
        : Math.sign(distanceX) * 24,
      120 * deltaSeconds
    );

    this.x +=
      this.velocityX *
      deltaSeconds;

    if (this.actionTimer <= 0) {
      this.fireProjectile(
        this.x + this.width * 0.5,
        this.y + this.height * 0.5,
        this.player.centerX,
        this.player.centerY,
        0xe762ce
      );

      this.actionTimer = 1.25;
    }
  }

  private updateMime(
    deltaSeconds: number
  ): void {
    this.movementHistory.push(
      this.player.velocityX
    );

    if (
      this.movementHistory.length >
      30
    ) {
      const recorded =
        this.movementHistory.shift() ?? 0;

      const mirrored =
        -Phaser.Math.Clamp(
          recorded,
          -145,
          145
        );

      this.velocityX = moveTowards(
        this.velocityX,
        mirrored,
        520 * deltaSeconds
      );
    }

    this.x +=
      this.velocityX *
      deltaSeconds;

    if (
      this.actionTimer <= 0 &&
      Math.abs(
        this.player.centerX -
        (this.x + this.width * 0.5)
      ) < 180
    ) {
      this.velocityY = -285;
      this.actionTimer = 1.35;
    }
  }

  private applyContactDamage(): void {
    if (
      this.contactTimer > 0 ||
      !Phaser.Geom.Intersects
        .RectangleToRectangle(
          this.bounds,
          playerBounds(this.player)
        )
    ) {
      return;
    }

    if (
      this.playerHealth.receiveDamage(
        1,
        this.x + this.width * 0.5,
        195,
        -145
      )
    ) {
      this.contactTimer = 0.85;
    }
  }

  private visualTag(): string {
    if (this.defeated) {
      return `core_${this.spawn.kind}_defeated`;
    }

    if (this.spawn.kind === "duelist") {
      if (
        Math.abs(this.velocityX) > 180 &&
        this.actionTimer > 0.72
      ) {
        return "core_duelist_dash";
      }

      if (this.actionTimer < 0.18) {
        return "core_duelist_telegraph";
      }

      return Math.abs(this.velocityX) > 5
        ? "core_duelist_patrol"
        : "core_duelist_idle";
    }

    if (this.spawn.kind === "caster") {
      if (this.actionTimer > 1.05) {
        return "core_caster_cast";
      }

      if (this.actionTimer < 0.22) {
        return "core_caster_telegraph";
      }

      return "core_caster_hover";
    }

    if (Math.abs(this.velocityY) > 20) {
      return "core_mime_mimic";
    }

    if (this.movementHistory.length < 30) {
      return "core_mime_record";
    }

    return Math.abs(this.velocityX) > 5
      ? "core_mime_stalk"
      : "core_mime_idle";
  }

  private redraw(): void {
    this.graphics.clear();

    this.view.update({
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      facing: this.facing,
      visible:
        this.active ||
        this.defeated,
      tag: this.visualTag(),
      flashing: this.flashTimer > 0
    });
  }
}

export class MirrorCoreSystem {
  private elapsed = 0;
  private entered = false;
  private relaysCheckpointReached = false;
  private gauntletStarted = false;
  private gauntletCleared = false;
  private coreCheckpointReached = false;
  private cleared = false;
  private hazardCooldown = 0;
  private gauntletBeamElapsed = 0;
  private wasInsideSection = false;
  private readonly healthPickupRespawns =
    new PickupRespawnState();

  private readonly graphics:
    Phaser.GameObjects.Graphics;
  private readonly objectiveText:
    Phaser.GameObjects.Text;
  private readonly titleText:
    Phaser.GameObjects.Text;

  private readonly relayGate =
    createWorldGate("MirrorRelay");
  private readonly gauntletGate =
    createWorldGate("MirrorBoss");
  private readonly exitGate =
    createWorldGate("MirrorExit");

  private readonly relays:
    MirrorRelay[];
  private readonly enemies:
    CoreEnemy[];
  private readonly projectiles:
    CoreProjectile[] = [];
  private readonly roses:
    Rose[];
  private readonly movingMirrors:
    MovingMirror[];

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth:
      PlayerHealthSystem,
    combatSystem: CombatSystem,
    private readonly magicSystem: MagicSystem,
    private readonly addSolid: (
      solid: Phaser.Geom.Rectangle
    ) => void,
    private readonly removeSolid: (
      solid: Phaser.Geom.Rectangle
    ) => void
  ) {
    this.graphics =
      scene.add.graphics().setDepth(42);

    this.objectiveText = scene.add.text(
      320,
      12,
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

    this.titleText = scene.add.text(
      320,
      52,
      "ACT VIII\nTHE MIRROR CORE",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#8ff5f5",
        backgroundColor: "#040711ee",
        padding: { x: 16, y: 10 }
      }
    )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1220)
      .setAlpha(0)
      .setVisible(false);

    this.relays = [
      new MirrorRelay(
        scene,
        "MirrorRelayA",
        35720,
        286,
        () => this.onRelayActivated()
      ),
      new MirrorRelay(
        scene,
        "MirrorRelayB",
        36080,
        254,
        () => this.onRelayActivated()
      )
    ];

    for (const relay of this.relays) {
      combatSystem.registerTarget(relay);
    }

    this.enemies = ENEMY_SPAWNS.map(
      spawn =>
        new CoreEnemy(
          scene,
          this.player,
          this.playerHealth,
          spawn,
          scene.add.graphics().setDepth(44),
          (
            x,
            y,
            targetX,
            targetY,
            color
          ) => this.fireProjectile(
            x,
            y,
            targetX,
            targetY,
            color
          )
        )
    );

    for (const enemy of this.enemies) {
      combatSystem.registerTarget(enemy);
    }

    this.roses = ROSE_POSITIONS.map(
      position => ({
        id: position.id,
        x: position.x,
        y: position.y,
        consumed: false
      })
    );

    this.movingMirrors = [
      {
        solid: new Phaser.Geom.Rectangle(
          35616,
          448,
          88,
          14
        ),
        originX: 35616,
        originY: 448,
        travelX: 0,
        travelY: -112,
        speed: 1.2,
        phase: 0,
        previousX: 35616,
        previousY: 448
      },
      {
        solid: new Phaser.Geom.Rectangle(
          35872,
          352,
          88,
          14
        ),
        originX: 35872,
        originY: 352,
        travelX: 96,
        travelY: 0,
        speed: 1.05,
        phase: 1.4,
        previousX: 35872,
        previousY: 352
      },
      {
        solid: new Phaser.Geom.Rectangle(
          36064,
          416,
          88,
          14
        ),
        originX: 36064,
        originY: 416,
        travelX: 0,
        travelY: -128,
        speed: 1.35,
        phase: 2.1,
        previousX: 36064,
        previousY: 416
      }
    ];

    for (const platform of this.movingMirrors) {
      this.addSolid(platform.solid);
    }

    this.addSolid(this.relayGate);
    this.addSolid(this.gauntletGate);
    this.addSolid(this.exitGate);
    this.redraw();
  }

  public update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    this.hazardCooldown = Math.max(
      0,
      this.hazardCooldown - deltaSeconds
    );

    const insideSection =
      this.isPlayerInSection();

    if (!insideSection) {
      if (this.wasInsideSection) {
        this.resetGauntletPickups();
        this.redraw();
      }

      this.wasInsideSection = false;
      this.objectiveText.setVisible(false);
      return;
    }

    this.wasInsideSection = true;

    if (this.player.y > 675) {
      this.playerHealth.fallOut();
      return;
    }

    this.updateProgression();
    this.updateGauntletBeamTiming(
      deltaSeconds
    );
    this.updateMovingMirrors();
    this.updateRelays(deltaSeconds);
    this.updateEnemies(deltaSeconds);
    this.updateProjectiles(deltaSeconds);
    this.updateHazards();
    this.updateRoses();
    this.updateGauntletPickups(
      deltaSeconds
    );
    this.redraw();
  }

  public getDebugSnapshot() {
    const relaysActivated = this.relays.filter(
      relay => relay.isActivated
    ).length;

    return {
      relaysActivated,
      relayGateOpen:
        this.relaysCheckpointReached,
      kaleidoscopePhase:
        getKaleidoscopeHazardPhase(
          this.gauntletBeamElapsed
        ),
      objective: this.objectiveText.text
    };
  }

  public resetAfterDeath(): void {
    this.elapsed = 0;
    this.hazardCooldown = 0;
    this.gauntletBeamElapsed = 0;
    this.projectiles.length = 0;
    this.resetGauntletPickups();

    for (const rose of this.roses) {
      rose.consumed = false;
    }

    if (this.relaysCheckpointReached) {
      for (const relay of this.relays) {
        relay.forceActivated();
      }
      this.removeSolid(this.relayGate);
    } else {
      for (const relay of this.relays) {
        relay.reset();
      }
      this.addSolid(this.relayGate);
    }

    if (this.gauntletCleared) {
      this.removeSolid(this.gauntletGate);
      for (const enemy of this.enemies) {
        enemy.setEnabled(false);
      }
    } else {
      this.gauntletStarted = false;
      for (const enemy of this.enemies) {
        enemy.reset();
      }
      this.addSolid(this.gauntletGate);
    }

    if (this.cleared) {
      this.removeSolid(this.exitGate);
    } else {
      this.addSolid(this.exitGate);
    }

    for (const platform of this.movingMirrors) {
      platform.solid.x = platform.originX;
      platform.solid.y = platform.originY;
      platform.previousX = platform.originX;
      platform.previousY = platform.originY;
    }

    this.objectiveText
      .setVisible(false)
      .setText("");
    this.redraw();
  }

  private isPlayerInSection(): boolean {
    return (
      this.player.x >= MIRROR_CORE_START_X &&
      this.player.x < MIRROR_CORE_END_X
    );
  }

  private updateProgression(): void {
    const entryCheckpoint =
      getWorldCheckpoint("MirrorCore");

    if (
      !this.entered &&
      this.player.x >= entryCheckpoint.triggerX
    ) {
      this.entered = true;
      this.playerHealth.setCheckpoint(
        entryCheckpoint
      );
      this.titleText
        .setVisible(true)
        .setAlpha(1);
      this.scene.tweens.add({
        targets: this.titleText,
        alpha: 0,
        delay: 1500,
        duration: 850,
        ease: "Sine.InOut",
        onComplete: () =>
          this.titleText.setVisible(false)
      });
    }

    if (
      !this.gauntletStarted &&
      !this.gauntletCleared &&
      this.relaysCheckpointReached &&
      this.player.x >= this.relayGate.right
    ) {
      this.gauntletStarted = true;
      this.gauntletBeamElapsed = 0;
      for (const enemy of this.enemies) {
        enemy.setEnabled(true);
      }
      this.scene.cameras.main.flash(
        180,
        220,
        76,
        187,
        false
      );
    }

    if (
      this.gauntletStarted &&
      !this.gauntletCleared &&
      this.enemies.every(
        enemy => enemy.isDefeated
      )
    ) {
      this.gauntletStarted = false;
      this.gauntletCleared = true;
      this.removeSolid(this.gauntletGate);
      this.projectiles.length = 0;
      this.resetGauntletPickups();
      this.scene.cameras.main.flash(
        220,
        242,
        201,
        94,
        false
      );
    }

    const coreCheckpoint =
      getWorldCheckpoint("CoreChamber");

    if (
      this.gauntletCleared &&
      !this.coreCheckpointReached &&
      this.player.x >= coreCheckpoint.triggerX
    ) {
      this.coreCheckpointReached = true;
      this.playerHealth.setCheckpoint(
        coreCheckpoint
      );
    }

    if (
      this.gauntletCleared &&
      !this.cleared &&
      this.player.x >= 38944
    ) {
      this.cleared = true;
      this.removeSolid(this.exitGate);
      this.objectiveText.setText(
        "MIRROR CORE STABILIZED — CONDUCTOR APPROACH OPEN"
      );
      this.scene.cameras.main.flash(
        320,
        117,
        234,
        241,
        false
      );
      this.scene.time.delayedCall(
        2800,
        () => this.objectiveText.setVisible(false)
      );
    }
  }

  private onRelayActivated(): void {
    if (
      !this.relays.every(
        relay => relay.isActivated
      )
    ) {
      return;
    }

    this.relaysCheckpointReached = true;
    this.removeSolid(this.relayGate);
    this.playerHealth.setCheckpoint(
      getWorldCheckpoint("MirrorRelays")
    );
    this.scene.cameras.main.shake(
      180,
      0.004
    );
  }

  private updateGauntletBeamTiming(
    deltaSeconds: number
  ): void {
    if (!this.gauntletStarted) {
      return;
    }

    const previousPhase =
      getKaleidoscopeHazardPhase(
        this.gauntletBeamElapsed
      );

    this.gauntletBeamElapsed =
      advanceKaleidoscopeHazardTime(
        this.gauntletBeamElapsed,
        deltaSeconds
      );

    const phase =
      getKaleidoscopeHazardPhase(
        this.gauntletBeamElapsed
      );

    if (phase === previousPhase) {
      return;
    }

    if (phase === "telegraph") {
      this.scene.events.emit(
        AUDIO_EVENTS.hazardTelegraph,
        KALEIDOSCOPE_CENTER_X
      );
    } else if (phase === "active") {
      this.scene.events.emit(
        AUDIO_EVENTS.hazardActive,
        KALEIDOSCOPE_CENTER_X
      );
    }
  }

  private updateMovingMirrors(): void {
    const playerBottom =
      this.player.y + this.player.height;

    for (const platform of this.movingMirrors) {
      platform.previousX = platform.solid.x;
      platform.previousY = platform.solid.y;

      const wave = (
        Math.sin(
          this.elapsed * platform.speed +
          platform.phase
        ) + 1
      ) * 0.5;

      platform.solid.x =
        platform.originX +
        platform.travelX * wave;
      platform.solid.y =
        platform.originY +
        platform.travelY * wave;

      const deltaX =
        platform.solid.x - platform.previousX;
      const deltaY =
        platform.solid.y - platform.previousY;

      const standing =
        this.player.x + this.player.width >
          platform.previousX + 2 &&
        this.player.x <
          platform.previousX +
          platform.solid.width - 2 &&
        Math.abs(
          playerBottom - platform.previousY
        ) < 4 &&
        this.player.velocityY >= 0;

      if (standing) {
        this.player.x += deltaX;
        this.player.y += deltaY;
      }
    }
  }

  private updateRelays(
    deltaSeconds: number
  ): void {
    for (const relay of this.relays) {
      relay.update(
        deltaSeconds,
        this.elapsed
      );
    }
  }

  private updateEnemies(
    deltaSeconds: number
  ): void {
    for (const enemy of this.enemies) {
      enemy.update(deltaSeconds);
    }
  }

  private fireProjectile(
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    color = 0xe95acb
  ): void {
    if (
      x < MIRROR_CORE_START_X ||
      x >= MIRROR_CORE_END_X
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
      velocityX: direction.x * 195,
      velocityY: direction.y * 195,
      lifetime: 4,
      radius: 6,
      color,
      active: true
    });
  }

  private updateProjectiles(
    deltaSeconds: number
  ): void {
    const bounds = playerBounds(this.player);

    for (const projectile of this.projectiles) {
      if (!projectile.active) {
        continue;
      }

      projectile.lifetime -= deltaSeconds;
      projectile.x +=
        projectile.velocityX * deltaSeconds;
      projectile.y +=
        projectile.velocityY * deltaSeconds;

      if (
        projectile.lifetime <= 0 ||
        projectile.x < MIRROR_CORE_START_X ||
        projectile.x >= MIRROR_CORE_END_X ||
        projectile.y < 0 ||
        projectile.y >= 720
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

  private updateHazards(): void {
    if (
      !this.isPlayerInSection() ||
      this.hazardCooldown > 0
    ) {
      return;
    }

    const bounds = playerBounds(this.player);

    for (const spike of SPIKE_RECTS) {
      if (
        Phaser.Geom.Intersects
          .RectangleToRectangle(
            bounds,
            spike
          )
      ) {
        this.damageHazard(spike.centerX);
        return;
      }
    }

    const refractionBeamX = [
      35680,
      35888,
      36096
    ] as const;

    for (
      let index = 0;
      index < refractionBeamX.length;
      index += 1
    ) {
      const x = refractionBeamX[index];
      if (x === undefined) {
        continue;
      }

      const cycle = (
        this.elapsed + index * 0.62
      ) % 2.6;
      const active =
        cycle >= 0.72 && cycle < 1.7;

      if (
        active &&
        Phaser.Geom.Intersects
          .RectangleToRectangle(
            bounds,
            new Phaser.Geom.Rectangle(
              x - 5,
              192,
              10,
              336
            )
          )
      ) {
        this.damageHazard(x);
        return;
      }
    }

    if (
      !this.gauntletStarted ||
      !isKaleidoscopeBeamDamaging(
        this.gauntletBeamElapsed
      )
    ) {
      return;
    }

    for (let index = 0; index < 2; index += 1) {
      const angle =
        this.gauntletBeamElapsed *
          KALEIDOSCOPE_ANGULAR_SPEED +
        index * Math.PI / 2;
      const endX = Phaser.Math.Clamp(
        KALEIDOSCOPE_CENTER_X +
          Math.cos(angle) *
            KALEIDOSCOPE_BEAM_LENGTH,
        this.relayGate.right,
        this.gauntletGate.x
      );
      const endY = Phaser.Math.Clamp(
        KALEIDOSCOPE_CENTER_Y +
          Math.sin(angle) *
            KALEIDOSCOPE_BEAM_LENGTH,
        96,
        656
      );

      if (
        lineIntersectsRectangle(
          KALEIDOSCOPE_CENTER_X,
          KALEIDOSCOPE_CENTER_Y,
          endX,
          endY,
          bounds,
          5
        )
      ) {
        this.damageHazard(
          KALEIDOSCOPE_CENTER_X
        );
        return;
      }
    }
  }

  private damageHazard(sourceX: number): void {
    if (
      this.playerHealth.receiveDamage(
        1,
        sourceX,
        175,
        -170
      )
    ) {
      this.hazardCooldown = 1.15;
    }
  }

  private updateGauntletPickups(
    deltaSeconds: number
  ): void {
    if (!this.gauntletStarted) {
      return;
    }

    this.healthPickupRespawns.update(
      deltaSeconds
    );

    const bounds = playerBounds(this.player);

    for (const pickup of GAUNTLET_CARD_PICKUPS) {
      if (
        !this.magicSystem
          .isGrandCardPickupAvailable(
            pickup.id
          ) ||
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
        this.scene.cameras.main.shake(
          55,
          0.0015
        );
      }
    }

    for (const pickup of GAUNTLET_HEALTH_PICKUPS) {
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
          MIRROR_CORE_HEALTH_PICKUP_RESPAWN_SECONDS
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

  private resetGauntletPickups(): void {
    this.healthPickupRespawns.reset(
      MIRROR_CORE_GAUNTLET_HEALTH_PICKUP_IDS
    );
    this.magicSystem.resetGrandCardPickups(
      MIRROR_CORE_GAUNTLET_CARD_PICKUP_IDS
    );
  }

  private updateRoses(): void {
    const bounds = playerBounds(this.player);

    for (const rose of this.roses) {
      if (
        rose.consumed ||
        !Phaser.Geom.Intersects
          .RectangleToRectangle(
            bounds,
            new Phaser.Geom.Rectangle(
              rose.x - 9,
              rose.y - 19,
              18,
              20
            )
          )
      ) {
        continue;
      }

      if (this.playerHealth.heal(1)) {
        rose.consumed = true;
        this.scene.cameras.main.shake(
          55,
          0.0015
        );
      }
    }
  }

  private redraw(): void {
    const g = this.graphics;
    g.clear();

    for (const platform of this.movingMirrors) {
      const solid = platform.solid;
      g.fillStyle(0x12283b, 1);
      g.fillRoundedRect(
        solid.x,
        solid.y,
        solid.width,
        solid.height,
        4
      );
      g.fillStyle(0x75eaf1, 1);
      g.fillRect(
        solid.x,
        solid.y,
        solid.width,
        3
      );
      g.lineStyle(1, 0xe65bc9, 0.9);
      g.strokeRoundedRect(
        solid.x,
        solid.y,
        solid.width,
        solid.height,
        4
      );
    }

    this.redrawRefractionBeams(g);
    this.redrawSpikes(g);
    this.redrawRoses(g);
    this.redrawGauntletPickups(g);
    this.redrawProjectiles(g);
    this.redrawGauntletBeam(g);
    this.redrawGates(g);
    this.redrawObjective();
  }

  private redrawRefractionBeams(
    g: Phaser.GameObjects.Graphics
  ): void {
    for (
      const [index, x] of [
        35680,
        35888,
        36096
      ].entries()
    ) {
      const cycle = (
        this.elapsed + index * 0.62
      ) % 2.6;
      const active =
        cycle >= 0.72 && cycle < 1.7;
      g.lineStyle(
        active ? 5 : 2,
        active ? 0xe95acb : 0x75eaf1,
        active ? 0.9 : 0.28
      );
      g.lineBetween(x, 192, x, 528);
    }
  }

  private redrawSpikes(
    g: Phaser.GameObjects.Graphics
  ): void {
    for (const spike of SPIKE_RECTS) {
      const count = Math.max(
        1,
        Math.floor(spike.width / 11)
      );
      const width = spike.width / count;

      for (let index = 0; index < count; index += 1) {
        const x = spike.x + index * width;
        g.fillStyle(
          index % 2 === 0
            ? 0xe95acb
            : 0x75eaf1,
          1
        );
        g.fillTriangle(
          x,
          spike.bottom,
          x + width * 0.5,
          spike.top,
          x + width,
          spike.bottom
        );
      }
    }
  }

  private redrawRoses(
    g: Phaser.GameObjects.Graphics
  ): void {
    for (const rose of this.roses) {
      if (rose.consumed) {
        continue;
      }

      const pulse = 1 + Math.sin(
        this.elapsed * 5 + rose.x * 0.01
      ) * 0.1;
      g.fillStyle(0x62e9b2, 0.25);
      g.fillCircle(
        rose.x,
        rose.y - 10,
        14 * pulse
      );
      g.fillStyle(0xe85fbd, 1);
      g.fillCircle(rose.x - 4, rose.y - 12, 5);
      g.fillCircle(rose.x + 4, rose.y - 12, 5);
      g.fillCircle(rose.x, rose.y - 17, 5);
      g.fillStyle(0xf4ce68, 1);
      g.fillCircle(rose.x, rose.y - 12, 3);
      g.lineStyle(2, 0x62e9b2, 1);
      g.lineBetween(
        rose.x,
        rose.y - 8,
        rose.x,
        rose.y
      );
    }
  }

  private redrawGauntletPickups(
    g: Phaser.GameObjects.Graphics
  ): void {
    if (
      !this.gauntletStarted ||
      !this.isPlayerInSection()
    ) {
      return;
    }

    for (const pickup of GAUNTLET_HEALTH_PICKUPS) {
      if (
        !this.healthPickupRespawns
          .isAvailable(pickup.id)
      ) {
        continue;
      }

      const y = pickup.y - 10 + Math.sin(
        this.elapsed * 4.2 +
        pickup.x * 0.01
      ) * 3;

      g.fillStyle(0x62e9b2, 0.25);
      g.fillCircle(pickup.x, y, 14);
      g.fillStyle(0xe85fbd, 1);
      g.fillCircle(pickup.x - 4, y - 2, 5);
      g.fillCircle(pickup.x + 4, y - 2, 5);
      g.fillCircle(pickup.x, y - 7, 5);
      g.fillStyle(0xf4ce68, 1);
      g.fillCircle(pickup.x, y - 2, 3);
      g.lineStyle(2, 0x62e9b2, 1);
      g.lineBetween(
        pickup.x,
        y + 2,
        pickup.x,
        y + 10
      );
    }

    for (const pickup of GAUNTLET_CARD_PICKUPS) {
      if (
        !this.magicSystem
          .isGrandCardPickupAvailable(
            pickup.id
          )
      ) {
        continue;
      }

      const y = pickup.y - 9 + Math.sin(
        this.elapsed * 3.8 +
        pickup.x * 0.01
      ) * 3;

      g.fillStyle(0x75edf2, 0.18);
      g.fillCircle(pickup.x, y, 17);
      g.fillStyle(0xf6e4b5, 1);
      g.fillRoundedRect(
        pickup.x - 8,
        y - 5,
        16,
        10,
        2
      );
      g.lineStyle(2, 0xe85fbd, 1);
      g.strokeRoundedRect(
        pickup.x - 8,
        y - 5,
        16,
        10,
        2
      );
      g.fillStyle(0xd5376c, 1);
      g.fillCircle(pickup.x, y, 2);
    }
  }

  private redrawProjectiles(
    g: Phaser.GameObjects.Graphics
  ): void {
    for (const projectile of this.projectiles) {
      if (!projectile.active) {
        continue;
      }
      g.fillStyle(projectile.color, 0.22);
      g.fillCircle(
        projectile.x,
        projectile.y,
        projectile.radius + 6
      );
      g.fillStyle(projectile.color, 1);
      g.fillCircle(
        projectile.x,
        projectile.y,
        projectile.radius
      );
    }
  }

  private redrawGauntletBeam(
    g: Phaser.GameObjects.Graphics
  ): void {
    if (!this.gauntletStarted) {
      return;
    }

    const phase =
      getKaleidoscopeHazardPhase(
        this.gauntletBeamElapsed
      );

    if (phase === "off") {
      return;
    }

    const telegraph = phase === "telegraph";
    const pulse =
      0.55 +
      Math.sin(
        this.gauntletBeamElapsed * 22
      ) * 0.15;

    g.fillStyle(
      telegraph ? 0xf7d77a : 0xffffff,
      telegraph ? pulse : 0.9
    );
    g.fillCircle(
      KALEIDOSCOPE_CENTER_X,
      KALEIDOSCOPE_CENTER_Y,
      telegraph ? 10 : 7
    );

    for (let index = 0; index < 2; index += 1) {
      const angle =
        this.gauntletBeamElapsed *
          KALEIDOSCOPE_ANGULAR_SPEED +
        index * Math.PI / 2;
      const endX = Phaser.Math.Clamp(
        KALEIDOSCOPE_CENTER_X +
          Math.cos(angle) *
            KALEIDOSCOPE_BEAM_LENGTH,
        this.relayGate.right,
        this.gauntletGate.x
      );
      const endY = Phaser.Math.Clamp(
        KALEIDOSCOPE_CENTER_Y +
          Math.sin(angle) *
            KALEIDOSCOPE_BEAM_LENGTH,
        96,
        656
      );
      const color = index % 2 === 0
        ? 0xe95acb
        : 0x75eaf1;

      g.lineStyle(
        telegraph ? 2 : 5,
        color,
        telegraph ? pulse : 0.88
      );

      if (telegraph) {
        const segmentCount = 14;

        for (
          let segment = 0;
          segment < segmentCount;
          segment += 2
        ) {
          const start =
            segment / segmentCount;
          const end =
            Math.min(
              1,
              (segment + 1) /
                segmentCount
            );

          g.lineBetween(
            Phaser.Math.Linear(
              KALEIDOSCOPE_CENTER_X,
              endX,
              start
            ),
            Phaser.Math.Linear(
              KALEIDOSCOPE_CENTER_Y,
              endY,
              start
            ),
            Phaser.Math.Linear(
              KALEIDOSCOPE_CENTER_X,
              endX,
              end
            ),
            Phaser.Math.Linear(
              KALEIDOSCOPE_CENTER_Y,
              endY,
              end
            )
          );
        }
      } else {
        g.lineBetween(
          KALEIDOSCOPE_CENTER_X,
          KALEIDOSCOPE_CENTER_Y,
          endX,
          endY
        );
      }
    }
  }

  private redrawGates(
    g: Phaser.GameObjects.Graphics
  ): void {
    const gates = [
      [this.relayGate, !this.relaysCheckpointReached],
      [this.gauntletGate, !this.gauntletCleared],
      [this.exitGate, !this.cleared]
    ] as const;

    for (const [gate, visible] of gates) {
      if (!visible) {
        continue;
      }
      g.fillStyle(0x080817, 0.94);
      g.fillRect(
        gate.x,
        gate.y,
        gate.width,
        gate.height
      );
      g.lineStyle(3, 0xe95acb, 1);
      for (let y = 0; y < gate.height; y += 28) {
        g.lineBetween(
          gate.x + 2,
          y,
          gate.right - 2,
          y + 17
        );
      }
      g.lineStyle(2, 0x75eaf1, 1);
      g.strokeRect(
        gate.x,
        gate.y,
        gate.width,
        gate.height
      );
    }
  }

  private redrawObjective(): void {
    if (!this.isPlayerInSection()) {
      this.objectiveText.setVisible(false);
      return;
    }

    this.objectiveText.setVisible(true);

    if (!this.relaysCheckpointReached) {
      const active = this.relays.filter(
        relay => relay.isActivated
      ).length;
      this.objectiveText.setText(
        `MIRROR RELAYS ${active}/2 — HIT WITH [L] GRAND CARD`
      );
      return;
    }

    if (!this.gauntletCleared) {
      const remaining = this.enemies.filter(
        enemy => !enemy.isDefeated
      ).length;
      this.objectiveText.setText(
        `KALEIDOSCOPE GAUNTLET — REFLECTIONS ${4 - remaining}/4`
      );
      return;
    }

    this.objectiveText.setText(
      this.cleared
        ? "MIRROR CORE STABILIZED — CONDUCTOR APPROACH OPEN"
        : "STABILIZE THE CORE — REACH THE EASTERN SEAL"
    );
  }
}
