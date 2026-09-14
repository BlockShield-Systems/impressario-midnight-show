import type {
  AudioAssetId
} from "./AudioManifest";

export const BOOTSTRAP_AUDIO_IDS = [
  "music_01_opening_rehearsal",
  "amb_theatre_room",
  "vo_opening",
  "vo_movement_rehearsal",

  "player_step_01",
  "player_step_02",
  "player_jump",
  "player_double_jump",
  "player_dash",
  "player_wall_slide_loop",
  "player_wall_jump",
  "player_land_soft",
  "player_land_hard",
  "player_hurt",
  "player_death",

  "cane_swing_01",
  "cane_swing_02",
  "cane_swing_heavy",
  "cane_hit_01",
  "cane_hit_02",
  "cane_hit_heavy",
  "combo_finisher",

  "ui_move",
  "ui_confirm",
  "ui_error",
  "ui_leaderboard_success",
  "ui_leaderboard_fail"
] as const satisfies readonly AudioAssetId[];

export const SECTION_AUDIO_IDS = {
  MovementRehearsal: [
    ...BOOTSTRAP_AUDIO_IDS
  ],
  CombatRehearsal: [
    "music_02_combat_rehearsal",
    "amb_theatre_room",
    "vo_combat_rehearsal",

    "cane_hit_shield",
    "grand_card_cast",
    "grand_card_flight",
    "grand_card_hit",
    "spotlight_cast",
    "spotlight_hit",
    "enemy_defeat"
  ],
  MainStage: [
    "music_03_backstage_ambush",
    "amb_theatre_room",
    "vo_backstage_ambush",

    "stagehand_alert",
    "card_enemy_telegraph",
    "card_enemy_throw",

    "world_checkpoint",
    "world_gate_open",
    "world_gate_close",
    "world_objective_complete"
  ],
  GrandGallery: [
    "music_04_grand_gallery",
    "amb_gallery_whispers",
    "vo_grand_gallery"
  ],
  GalleryGauntlet: [
    "music_05_gallery_gauntlet",
    "amb_gallery_whispers",

    "acrobat_telegraph",
    "acrobat_leap",
    "acrobat_land",

    "world_hazard_telegraph",
    "world_hazard_active"
  ],
  SpotlightVault: [
    "music_06_spotlight_vault",
    "amb_spotlight_electric",
    "vo_spotlight_vault",

    "wraith_telegraph",
    "wraith_charge",
    "spotlight_cast",
    "spotlight_hit"
  ],
  CardSanctum: [
    "music_07_card_sanctum",
    "amb_spotlight_electric",
    "vo_card_sanctum",

    "sentry_lock",
    "sentry_fire",
    "grand_card_cast",
    "grand_card_flight",
    "grand_card_hit",
    "world_relay_activate"
  ],
  RoyalBox: [
    "music_08_royal_box",
    "amb_gallery_whispers",
    "vo_royal_box",

    "echo_duelist_telegraph",
    "echo_duelist_dash",
    "echo_caster_cast",
    "grand_card_cast",
    "grand_card_flight",
    "grand_card_hit",
    "world_rose_pickup"
  ],
  MirrorCore: [
    "music_09_mirror_core",
    "amb_mirror_core_machine",
    "vo_mirror_core",

    "core_mime_record",
    "core_mime_mimic",
    "world_mirror_move_loop",
    "world_rose_pickup",
    "grand_card_cast",
    "grand_card_flight",
    "grand_card_hit"
  ],
  ConductorApproach: [
    /*
     * The canonical authored catalog has no separate approach file.
     * Historical runtime mapping deliberately carries the Mirror Core
     * composition through this contiguous approach section.
     */
    "music_09_mirror_core",
    "amb_mirror_core_machine",
    "grand_card_cast",
    "grand_card_flight",
    "grand_card_hit",
    "world_rose_pickup"
  ],
  MirrorConductor: [
    "music_10_conductor_phase_1",
    "music_11_conductor_phase_2",
    "music_12_conductor_phase_3",
    "music_13_finale",

    "amb_mirror_core_machine",

    "vo_boss_intro",
    "vo_boss_phase_2",
    "vo_boss_phase_3",
    "vo_finale",

    "boss_intro_sting",
    "boss_shield_block",
    "boss_shield_break",
    "boss_projectile_volley",
    "boss_floor_warning",
    "boss_phase_2",
    "boss_phase_3",
    "boss_defeat",
    "grand_card_cast",
    "grand_card_flight",
    "grand_card_hit",
    "world_rose_pickup",

    "finale_firework_01",
    "finale_firework_02",
    "finale_curtain_close"
  ]
} as const satisfies
  Readonly<Record<string, readonly AudioAssetId[]>>;

export type AudioSectionId =
  keyof typeof SECTION_AUDIO_IDS;

export const ZONE_AUDIO_IDS =
  Object.values(SECTION_AUDIO_IDS);
