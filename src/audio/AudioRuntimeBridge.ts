import Phaser from "phaser";

import {
  AUDIO_EVENTS
} from "./AudioEvents";

import {
  ZONE_AUDIO_IDS
} from "./AudioLoadPlan";

import type {
  AudioAssetId
} from "./AudioManifest";

import type {
  AudioDirector
} from "./AudioDirector";

import type {
  MusicDirector
} from "./MusicDirector";

import type {
  ManagedAudioHandle
} from "./audio-types";

import type {
  CombatSystem
} from "../combat/CombatSystem";

import type {
  MagicSystem
} from "../magic/MagicSystem";

import type {
  PlayerHealthSystem
} from "../player/PlayerHealthSystem";

import type {
  MovementState,
  PlayerController
} from "../main";

interface Zone {
  readonly start: number;
  readonly music: AudioAssetId;
  readonly ambience: AudioAssetId;
  readonly voice?: AudioAssetId;
}

const ZONES: readonly Zone[] = [
  {
    start: 0,
    music:
      "music_01_opening_rehearsal",
    ambience:
      "amb_theatre_room",
    voice:
      "vo_opening"
  },
  {
    start: 700,
    music:
      "music_01_opening_rehearsal",
    ambience:
      "amb_theatre_room",
    voice:
      "vo_movement_rehearsal"
  },
  {
    start: 2240,
    music:
      "music_02_combat_rehearsal",
    ambience:
      "amb_theatre_room",
    voice:
      "vo_combat_rehearsal"
  },
  {
    start: 2880,
    music:
      "music_03_backstage_ambush",
    ambience:
      "amb_theatre_room",
    voice:
      "vo_backstage_ambush"
  },
  {
    start: 4800,
    music:
      "music_04_grand_gallery",
    ambience:
      "amb_gallery_whispers",
    voice:
      "vo_grand_gallery"
  },
  {
    start: 6400,
    music:
      "music_05_gallery_gauntlet",
    ambience:
      "amb_gallery_whispers"
  },
  {
    start: 8200,
    music:
      "music_06_spotlight_vault",
    ambience:
      "amb_spotlight_electric",
    voice:
      "vo_spotlight_vault"
  },
  {
    start: 9600,
    music:
      "music_07_card_sanctum",
    ambience:
      "amb_spotlight_electric",
    voice:
      "vo_card_sanctum"
  },
  {
    start: 12000,
    music:
      "music_08_royal_box",
    ambience:
      "amb_gallery_whispers",
    voice:
      "vo_royal_box"
  },
  {
    start: 14400,
    music:
      "music_09_mirror_core",
    ambience:
      "amb_mirror_core_machine",
    voice:
      "vo_mirror_core"
  },
  {
    start: 16400,
    music:
      "music_10_conductor_phase_1",
    ambience:
      "amb_mirror_core_machine",
    voice:
      "vo_boss_intro"
  }
];

const ENEMY_TAG_AUDIO:
Readonly<Record<string, AudioAssetId>> = {
  stagehand_alert:
    "stagehand_alert",
  thrower_telegraph:
    "card_enemy_telegraph",
  thrower_throw:
    "card_enemy_throw",
  card_telegraph:
    "card_enemy_telegraph",
  card_throw:
    "card_enemy_throw",
  acrobat_telegraph:
    "acrobat_telegraph",
  acrobat_leap:
    "acrobat_leap",
  acrobat_stalk:
    "acrobat_land",
  wraith_telegraph:
    "wraith_telegraph",
  wraith_charge:
    "wraith_charge",
  sentry_telegraph:
    "sentry_lock",
  sentry_cooldown:
    "sentry_fire",
  echo_duelist_telegraph:
    "echo_duelist_telegraph",
  echo_duelist_dash:
    "echo_duelist_dash",
  echo_caster_cast:
    "echo_caster_cast",
  core_mime_record:
    "core_mime_record",
  core_mime_mimic:
    "core_mime_mimic"
};

export class AudioRuntimeBridge {
  private previousState:
    MovementState;

  private previousGrounded: boolean;
  private previousHealth: number;
  private previousAttack: string | null;
  private previousCasts: number;
  private previousX: number;

  private stepDistance = 0;
  private stepVariant = false;

  private zoneIndex = -1;
  private zoneLoadGeneration = 0;

  private readonly playedVoice =
    new Set<AudioAssetId>();

  private wallSlide:
    ManagedAudioHandle | null = null;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly audio: AudioDirector,
    private readonly music: MusicDirector,
    private readonly player: PlayerController,
    private readonly combat: CombatSystem,
    private readonly health: PlayerHealthSystem,
    private readonly magic: MagicSystem
  ) {
    this.previousState = player.state;
    this.previousGrounded =
      player.isGrounded;
    this.previousHealth =
      health.currentHealth;
    this.previousAttack = null;
    this.previousCasts =
      magic.castsPerformed;
    this.previousX = player.x;

    scene.events.on(
      AUDIO_EVENTS.enemyTagChanged,
      this.onEnemyTag,
      this
    );

    scene.events.on(
      AUDIO_EVENTS.bossTagChanged,
      this.onBossTag,
      this
    );

    scene.events.on(
      AUDIO_EVENTS.combatHit,
      this.onCombatHit,
      this
    );

    scene.events.once(
      Phaser.Scenes.Events.SHUTDOWN,
      this.destroy,
      this
    );

    this.updateZone(true);
  }

  public update(
    deltaSeconds: number
  ): void {
    this.updateMovement(deltaSeconds);
    this.updateCombat();
    this.updateHealth();
    this.updateMagic();
    this.updateZone(false);

    this.previousState =
      this.player.state;
    this.previousGrounded =
      this.player.isGrounded;
    this.previousHealth =
      this.health.currentHealth;
    this.previousX =
      this.player.x;
  }

  private updateMovement(
    _deltaSeconds: number
  ): void {
    const state =
      this.player.state;

    if (
      state === "dash" &&
      this.previousState !== "dash"
    ) {
      this.playSpatial(
        "player_dash",
        0.9,
        110
      );
    }

    if (
      state === "wall-slide" &&
      this.previousState !== "wall-slide"
    ) {
      this.wallSlide =
        this.audio.play(
          "player_wall_slide_loop",
          {
            gain: 0.42,
            positionX:
              this.player.centerX,
            cooldownMs: 300,
            maxInstances: 1
          }
        );
    }

    if (
      state !== "wall-slide" &&
      this.previousState === "wall-slide"
    ) {
      this.wallSlide?.stop();
      this.wallSlide = null;
    }

    if (
      state === "rise" &&
      this.previousState !== "rise"
    ) {
      const id: AudioAssetId =
        this.previousState ===
          "wall-slide"
          ? "player_wall_jump"
          : this.previousGrounded
            ? "player_jump"
            : "player_double_jump";

      this.playSpatial(id, 0.75, 90);
    }

    if (
      this.player.isGrounded &&
      !this.previousGrounded
    ) {
      const hard =
        Math.abs(
          this.player.velocityY
        ) > 250;

      this.playSpatial(
        hard
          ? "player_land_hard"
          : "player_land_soft",
        hard ? 0.82 : 0.48,
        90
      );
    }

    if (
      state === "run" &&
      this.player.isGrounded
    ) {
      this.stepDistance +=
        Math.abs(
          this.player.x -
          this.previousX
        );

      if (this.stepDistance >= 42) {
        this.stepDistance = 0;
        this.stepVariant =
          !this.stepVariant;

        this.playSpatial(
          this.stepVariant
            ? "player_step_01"
            : "player_step_02",
          0.38,
          70,
          Phaser.Math.Between(
            -35,
            35
          )
        );
      }
    } else {
      this.stepDistance = 0;
    }
  }

  private updateCombat(): void {
    const animation =
      this.combat.animationState;

    if (
      animation.attackId &&
      animation.attackId !==
        this.previousAttack
    ) {
      const heavy =
        animation.attackId ===
          "combo-3" ||
        animation.attackId ===
          "launcher" ||
        animation.attackId ===
          "down-strike";

      const id: AudioAssetId =
        heavy
          ? "cane_swing_heavy"
          : animation.attackId ===
              "combo-2"
            ? "cane_swing_02"
            : "cane_swing_01";

      this.playSpatial(
        id,
        heavy ? 0.92 : 0.72,
        65,
        Phaser.Math.Between(
          -28,
          28
        )
      );

      if (
        animation.attackId ===
        "combo-3"
      ) {
        this.playSpatial(
          "combo_finisher",
          0.68,
          180
        );
      }
    }

    this.previousAttack =
      animation.attackId;
  }

  private updateHealth(): void {
    const health =
      this.health.currentHealth;

    if (health < this.previousHealth) {
      if (health <= 0) {
        this.music.stopMusic(200);

        this.playSpatial(
          "player_death",
          1,
          500
        );
      } else {
        this.playSpatial(
          "player_hurt",
          0.9,
          240
        );
      }
    } else if (
      this.previousHealth <= 0 &&
      health > 0
    ) {
      this.updateZone(true, true);
    }
  }

  private updateMagic(): void {
    const casts =
      this.magic.castsPerformed;

    if (casts === this.previousCasts) {
      return;
    }

    this.previousCasts = casts;

    this.playSpatial(
      "spotlight_cast",
      0.82,
      120
    );
  }

  private updateZone(
    immediate: boolean,
    force = false
  ): void {
    let nextIndex = 0;

    for (
      let index = 0;
      index < ZONES.length;
      index += 1
    ) {
      if (
        this.player.x >=
        ZONES[index]!.start
      ) {
        nextIndex = index;
      }
    }

    if (
      !force &&
      nextIndex === this.zoneIndex
    ) {
      return;
    }

    const previous =
      this.zoneIndex;

    this.zoneIndex = nextIndex;

    const generation =
      ++this.zoneLoadGeneration;

    const required =
      ZONE_AUDIO_IDS[nextIndex] ??
      [];

    void this.audio
      .preload(required)
      .then(() => {
        if (
          generation !==
          this.zoneLoadGeneration
        ) {
          return;
        }

        const zone =
          ZONES[nextIndex]!;

        this.music.setMusic(
          zone.music,
          immediate ? 0 : 1200
        );

        this.music.setAmbience(
          zone.ambience,
          immediate ? 0 : 1000
        );

        if (
          zone.voice &&
          !this.playedVoice.has(
            zone.voice
          )
        ) {
          this.playedVoice.add(
            zone.voice
          );

          this.scene.time.delayedCall(
            immediate ? 500 : 300,
            () => {
              this.audio.play(
                zone.voice!,
                {
                  gain: 1,
                  maxInstances: 1
                }
              );
            }
          );
        }

        if (previous >= 0) {
          this.audio.play(
            "world_checkpoint",
            {
              gain: 0.5,
              cooldownMs: 400
            }
          );
        }

        const upcoming =
          ZONE_AUDIO_IDS[
            nextIndex + 1
          ];

        if (upcoming) {
          void this.audio
            .preload(upcoming)
            .catch(error => {
              console.error(
                "[audio] Upcoming zone preload failed",
                error
              );
            });
        }
      })
      .catch(error => {
        console.error(
          `[audio] Zone ${nextIndex} load failed`,
          error
        );
      });
  }

  private readonly onEnemyTag = (
    tag: string,
    x: number
  ): void => {
    let id =
      ENEMY_TAG_AUDIO[tag];

    if (
      !id &&
      tag.endsWith("_defeat")
    ) {
      id = "enemy_defeat";
    }

    if (!id) {
      return;
    }

    this.audio.play(id, {
      gain:
        id === "enemy_defeat"
          ? 0.72
          : 0.62,
      positionX: x,
      cooldownMs: 90,
      maxInstances: 3,
      detune:
        Phaser.Math.Between(
          -24,
          24
        )
    });
  };

  private readonly onBossTag = (
    tag: string,
    x: number
  ): void => {
    if (
      tag.includes("phase_2") ||
      tag === "boss_transition_1_2"
    ) {
      this.music.setMusic(
        "music_11_conductor_phase_2",
        450
      );

      this.audio.play(
        "boss_phase_2",
        {
          gain: 0.9,
          positionX: x,
          cooldownMs: 1000
        }
      );

      this.playVoiceOnce(
        "vo_boss_phase_2"
      );
    } else if (
      tag.includes("phase_3") ||
      tag === "boss_transition_2_3"
    ) {
      this.music.setMusic(
        "music_12_conductor_phase_3",
        450
      );

      this.audio.play(
        "boss_phase_3",
        {
          gain: 0.95,
          positionX: x,
          cooldownMs: 1000
        }
      );

      this.playVoiceOnce(
        "vo_boss_phase_3"
      );
    } else if (
      tag.includes("shield_break")
    ) {
      this.audio.play(
        "boss_shield_break",
        {
          gain: 0.95,
          positionX: x,
          cooldownMs: 250
        }
      );
    } else if (
      tag.includes("defeat")
    ) {
      this.audio.play(
        "boss_defeat",
        {
          gain: 1,
          positionX: x,
          cooldownMs: 1200
        }
      );

      this.music.setMusic(
        "music_13_finale",
        900
      );

      this.playVoiceOnce(
        "vo_finale"
      );
    }
  };

  private readonly onCombatHit = (
    heavy: boolean,
    x: number
  ): void => {
    this.audio.triggerCombatDuck(
      heavy ? 0.26 : 0.14
    );

    this.audio.play(
      heavy
        ? "cane_hit_heavy"
        : "cane_hit_01",
      {
        gain:
          heavy ? 0.95 : 0.78,
        positionX: x,
        cooldownMs: 45,
        maxInstances: 4,
        detune:
          Phaser.Math.Between(
            -30,
            30
          )
      }
    );
  };

  private playVoiceOnce(
    id: AudioAssetId
  ): void {
    if (this.playedVoice.has(id)) {
      return;
    }

    this.playedVoice.add(id);

    this.audio.play(id, {
      gain: 1,
      maxInstances: 1
    });
  }

  private playSpatial(
    id: AudioAssetId,
    gain: number,
    cooldownMs: number,
    detune = 0
  ): void {
    this.audio.play(id, {
      gain,
      cooldownMs,
      maxInstances: 3,
      positionX:
        this.player.centerX,
      detune
    });
  }

  private destroy(): void {
    this.wallSlide?.stop();
    this.wallSlide = null;

    this.scene.events.off(
      AUDIO_EVENTS.enemyTagChanged,
      this.onEnemyTag,
      this
    );

    this.scene.events.off(
      AUDIO_EVENTS.bossTagChanged,
      this.onBossTag,
      this
    );

    this.scene.events.off(
      AUDIO_EVENTS.combatHit,
      this.onCombatHit,
      this
    );
  }
}
