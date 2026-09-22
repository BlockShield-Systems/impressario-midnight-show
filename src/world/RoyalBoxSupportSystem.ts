import Phaser from "phaser";
import {
  getWorldGrandCardPickups,
  getWorldSupportPickups
} from "./WorldHazards";
import {
  getWorldSection
} from "./SectionOwnership";
import {
  MIRROR_CORE_GAUNTLET_CARD_PICKUP_IDS
} from "./MirrorCoreBalance";
import {
  advanceGrandCardProjectile,
  createGrandCardProjectileState,
  grandCardProjectileBounds,
  type GrandCardProjectileState
} from "../magic/GrandCardState";

import type {
  CombatSystem,
  CombatTarget
} from "../combat/CombatSystem";

import type { MagicSystem } from "../magic/MagicSystem";
import type { PlayerController } from "../main";
import {
  combinePressedIntent,
  type GameplayActionIntentSource
} from "../runtime/GamepadInputController";

import type {
  PlayerHealthSystem
} from "../player/PlayerHealthSystem";

interface GrandCardProjectile
extends GrandCardProjectileState {
  rotation: number;
  target: CombatTarget | null;
}

interface EncoreRose {
  readonly x: number;
  readonly y: number;
  consumed: boolean;
}

interface GrandCardPickup {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

const GRAND_CARD_COST = 18;
const GRAND_CARD_DAMAGE = 14;
const GRAND_CARD_SPEED = 390;
const GRAND_CARD_RANGE = 520;
const GRAND_CARD_LIFETIME = 1.6;
const GRAND_CARD_COOLDOWN = 0.3;

const ROYAL_BOX_START_X = 31664;
const ROYAL_BOX_END_X = 35344;
const LOOK_DOWN_DELAY = 0.18;
const LOOK_DOWN_OFFSET = 105;

const ROSE_POSITIONS =
  getWorldSupportPickups("RoyalBox");

const GRAND_CARD_PICKUPS:
readonly GrandCardPickup[] =
  getWorldGrandCardPickups().filter(
    pickup =>
      !MIRROR_CORE_GAUNTLET_CARD_PICKUP_IDS
        .some(id => id === pickup.id)
  );

export class RoyalBoxSupportSystem {
  private unlocked = false;
  private elapsed = 0;

  private lookDownTimer = 0;
  private cameraOffsetY = 0;

  private readonly projectiles:
    GrandCardProjectile[] = [];

  private readonly roses: EncoreRose[] =
    ROSE_POSITIONS.map(
      position => ({
        ...position,
        consumed: false
      })
    );

  private readonly graphics:
    Phaser.GameObjects.Graphics;

  private readonly tutorialText:
    Phaser.GameObjects.Text;

  private readonly cardKey:
    Phaser.Input.Keyboard.Key | undefined;
  private readonly actionIntents:
    GameplayActionIntentSource;

  private readonly downKey:
    Phaser.Input.Keyboard.Key | undefined;

  private readonly arrowDownKey:
    Phaser.Input.Keyboard.Key | undefined;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerController,
    private readonly playerHealth: PlayerHealthSystem,
    private readonly combatSystem: CombatSystem,
    private readonly magicSystem: MagicSystem,
    actionIntents: GameplayActionIntentSource
  ) {
    this.actionIntents = actionIntents;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(96);

    this.cardKey =
      scene.input.keyboard?.addKey(
        Phaser.Input.Keyboard.KeyCodes.L
      );

    this.downKey =
      scene.input.keyboard?.addKey(
        Phaser.Input.Keyboard.KeyCodes.S
      );

    this.arrowDownKey =
      scene.input.keyboard?.addKey(
        Phaser.Input.Keyboard.KeyCodes.DOWN
      );

    this.tutorialText = scene.add.text(
      320,
      286,
      "",
      {
        align: "center",
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#f5d675",
        backgroundColor: "#080611e8",
        padding: {
          x: 9,
          y: 7
        }
      }
    );

    this.tutorialText
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1190)
      .setVisible(false);

    this.redraw();
  }

  public update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;

    const gamepadCard =
      this.actionIntents.consumeGamepadAction(
        "grandCard"
      );

    if (
      !this.unlocked &&
      this.player.x >= ROYAL_BOX_START_X &&
      this.player.x < ROYAL_BOX_END_X
    ) {
      this.unlock();
    }

    this.updateLookDown(deltaSeconds);

    if (!this.unlocked) {
      return;
    }

    if (
      combinePressedIntent(
        Boolean(
          this.cardKey &&
          Phaser.Input.Keyboard.JustDown(
            this.cardKey
          )
        ),
        gamepadCard
      )
    ) {
      this.tryCastGrandCard();
    }

    this.updateProjectiles(deltaSeconds);
    this.updateRoses();
    this.updateGrandCardPickups();
    this.redraw();
  }

  public resetAfterDeath(): void {
    this.projectiles.length = 0;

    for (const rose of this.roses) {
      rose.consumed = false;
    }

    this.lookDownTimer = 0;
    this.cameraOffsetY = 0;

    this.scene.cameras.main
      .setFollowOffset(0, 0);

    this.redraw();
  }

  private unlock(): void {
    this.unlocked = true;

    this.magicSystem.unlockGrandCard();

    this.tutorialText
      .setText(
        [
          "NEW ACT — GRAND CARD [L]",
          "18 SHOW · Soft-homing ranged attack",
          "Hold [S] / [↓] on the ground to look below"
        ].join("\n")
      )
      .setVisible(true);

    this.scene.time.delayedCall(
      5200,
      () => {
        this.tutorialText.setVisible(false);
      }
    );

    this.scene.cameras.main.flash(
      180,
      226,
      91,
      190,
      false
    );
  }

  private tryCastGrandCard(): void {
    if (
      this.magicSystem.trySpendGrandCard(
        GRAND_CARD_COST,
        GRAND_CARD_COOLDOWN
      ) !== "spent"
    ) {
      return;
    }

    const startX =
      this.player.centerX +
      this.player.facing * 17;

    const startY =
      this.player.centerY - 8;

    const ownerSection =
      getWorldSection(startX);

    const target =
      this.combatSystem.findNearestTarget(
        startX,
        startY,
        GRAND_CARD_RANGE,
        this.player.facing,
        ownerSection?.id ?? null
      );

    const direction =
      target
        ? new Phaser.Math.Vector2(
            target.bounds.centerX - startX,
            target.bounds.centerY - startY
          )
        : new Phaser.Math.Vector2(
            this.player.facing,
            0
          );

    if (direction.lengthSq() <= 0.0001) {
      direction.set(
        this.player.facing,
        0
      );
    }

    direction.normalize();

    this.projectiles.push({
      ...createGrandCardProjectileState(
        startX,
        startY,
        direction.x * GRAND_CARD_SPEED,
        direction.y * GRAND_CARD_SPEED,
        GRAND_CARD_LIFETIME,
        ownerSection
      ),
      rotation: Math.atan2(
        direction.y,
        direction.x
      ),
      target
    });

    this.scene.cameras.main.shake(
      45,
      0.0015
    );
  }

  private updateProjectiles(
    deltaSeconds: number
  ): void {
    for (const projectile of this.projectiles) {
      if (
        projectile.target &&
        projectile.target.active
      ) {
        const desired =
          new Phaser.Math.Vector2(
            projectile.target.bounds.centerX -
              projectile.x,
            projectile.target.bounds.centerY -
              projectile.y
          );

        if (desired.lengthSq() > 0.0001) {
          desired.normalize();

          const current =
            new Phaser.Math.Vector2(
              projectile.velocityX,
              projectile.velocityY
            ).normalize();

          const steering =
            1 - Math.exp(
              -5.5 * deltaSeconds
            );

          current.lerp(
            desired,
            steering
          );

          if (current.lengthSq() > 0.0001) {
            current.normalize();

            projectile.velocityX =
              current.x * GRAND_CARD_SPEED;

            projectile.velocityY =
              current.y * GRAND_CARD_SPEED;
          }
        }
      } else {
        projectile.target = null;
      }

      if (
        !advanceGrandCardProjectile(
          projectile,
          deltaSeconds,
          getWorldSection(projectile.x)
        )
      ) {
        projectile.lifetime = 0;
        continue;
      }

      projectile.rotation +=
        8.5 * deltaSeconds;

      const authoredBounds =
        grandCardProjectileBounds(projectile);

      const bounds =
        new Phaser.Geom.Rectangle(
          authoredBounds.x,
          authoredBounds.y,
          authoredBounds.width,
          authoredBounds.height
        );

      const target =
        this.combatSystem
          .findTargetIntersecting(bounds);

      if (
        target &&
        this.combatSystem.applyRangedHit(
          target,
          GRAND_CARD_DAMAGE,
          projectile.x
        )
      ) {
        projectile.lifetime = 0;
      }
    }

    const active =
      this.projectiles.filter(
        projectile =>
          projectile.lifetime > 0
      );

    this.projectiles.length = 0;
    this.projectiles.push(...active);
  }

  private updateRoses(): void {
    const playerBounds =
      new Phaser.Geom.Rectangle(
        this.player.x,
        this.player.y,
        this.player.width,
        this.player.height
      );

    for (const rose of this.roses) {
      if (rose.consumed) {
        continue;
      }

      const bounds =
        new Phaser.Geom.Rectangle(
          rose.x - 12,
          rose.y - 16,
          24,
          28
        );

      if (
        Phaser.Geom.Intersects
          .RectangleToRectangle(
            playerBounds,
            bounds
          ) &&
        this.playerHealth.heal(1)
      ) {
        rose.consumed = true;

        this.scene.cameras.main.shake(
          55,
          0.0015
        );
      }
    }
  }

  private updateGrandCardPickups(): void {
    const playerBounds =
      new Phaser.Geom.Rectangle(
        this.player.x,
        this.player.y,
        this.player.width,
        this.player.height
      );

    for (const pickup of GRAND_CARD_PICKUPS) {
      if (
        !this.magicSystem
          .isGrandCardPickupAvailable(
            pickup.id
          ) ||
        !Phaser.Geom.Intersects
          .RectangleToRectangle(
            playerBounds,
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
  }

  private updateLookDown(
    deltaSeconds: number
  ): void {
    const downHeld =
      Boolean(this.downKey?.isDown) ||
      Boolean(this.arrowDownKey?.isDown) ||
      this.actionIntents.gamepadLookDownHeld;

    const grounded =
      this.player.state === "idle" ||
      this.player.state === "run";

    const allowed =
      this.unlocked &&
      this.player.x >= ROYAL_BOX_START_X &&
      this.player.x < ROYAL_BOX_END_X &&
      grounded &&
      downHeld;

    if (allowed) {
      this.lookDownTimer = Math.min(
        LOOK_DOWN_DELAY,
        this.lookDownTimer +
          deltaSeconds
      );
    } else {
      this.lookDownTimer = 0;
    }

    const targetOffset =
      this.lookDownTimer >=
      LOOK_DOWN_DELAY
        ? LOOK_DOWN_OFFSET
        : 0;

    const smoothing =
      1 - Math.exp(
        -8 * deltaSeconds
      );

    this.cameraOffsetY =
      Phaser.Math.Linear(
        this.cameraOffsetY,
        targetOffset,
        smoothing
      );

    if (
      Math.abs(
        this.cameraOffsetY -
        targetOffset
      ) < 0.1
    ) {
      this.cameraOffsetY =
        targetOffset;
    }

    this.scene.cameras.main
      .setFollowOffset(
        0,
        this.cameraOffsetY
      );
  }

  private redraw(): void {
    const g = this.graphics;
    g.clear();

    if (!this.unlocked) {
      return;
    }

    for (const rose of this.roses) {
      if (rose.consumed) {
        continue;
      }

      const bob =
        Math.sin(
          this.elapsed * 3.2 +
          rose.x * 0.01
        ) * 3;

      const x = rose.x;
      const y = rose.y + bob;

      g.fillStyle(
        0xe85fbd,
        0.14
      );

      g.fillCircle(
        x,
        y,
        18
      );

      g.lineStyle(
        2,
        0x74e7ef,
        0.9
      );

      g.strokeCircle(
        x,
        y,
        13
      );

      g.lineStyle(
        2,
        0x67d7a1,
        1
      );

      g.lineBetween(
        x,
        y + 3,
        x,
        y + 14
      );

      g.fillStyle(
        0xe95ea9,
        1
      );

      for (
        let petal = 0;
        petal < 6;
        petal += 1
      ) {
        const angle =
          petal / 6 *
          Math.PI * 2;

        g.fillCircle(
          x + Math.cos(angle) * 6,
          y + Math.sin(angle) * 6,
          4
        );
      }

      g.fillStyle(
        0xf4ca63,
        1
      );

      g.fillCircle(
        x,
        y,
        4
      );
    }

    for (const pickup of GRAND_CARD_PICKUPS) {
      if (
        !this.magicSystem
          .isGrandCardPickupAvailable(
            pickup.id
          )
      ) {
        continue;
      }

      const bob = Math.sin(
        this.elapsed * 3.8 +
        pickup.x * 0.01
      ) * 3;
      const y = pickup.y - 9 + bob;

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

    for (const projectile of this.projectiles) {
      g.save();

      g.translateCanvas(
        projectile.x,
        projectile.y
      );

      g.rotateCanvas(
        projectile.rotation
      );

      g.fillStyle(
        0xf6e4b5,
        1
      );

      g.fillRoundedRect(
        -8,
        -5,
        16,
        10,
        2
      );

      g.lineStyle(
        2,
        0xe85fbd,
        1
      );

      g.strokeRoundedRect(
        -8,
        -5,
        16,
        10,
        2
      );

      g.fillStyle(
        0xd5376c,
        1
      );

      g.fillCircle(
        0,
        0,
        2
      );

      g.restore();
    }
  }
}
