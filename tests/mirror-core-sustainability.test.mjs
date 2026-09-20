import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PickupRespawnState
} from "../src/magic/GrandCardState.ts";
import {
  selectGrandCardTarget
} from "../src/magic/GrandCardTargeting.ts";
import {
  MIRROR_CORE_CASTER_HEALTH,
  MIRROR_CORE_GRAND_CARD_DAMAGE,
  MIRROR_CORE_GROUND_ENEMY_HEALTH,
  MIRROR_CORE_HEALTH_PICKUP_RESPAWN_SECONDS,
  grandCardHitsToDefeat
} from "../src/world/MirrorCoreBalance.ts";

function target(
  id,
  centerX,
  centerY,
  kind,
  group = "MirrorCore"
) {
  return {
    id,
    active: true,
    centerX,
    centerY,
    group,
    kind
  };
}

test("MirrorCore targeting prioritizes facing, caster threat, distance, then stable id", () => {
  const centerX = 36_768;
  const centerY = 400;
  const leftGround = target(
    "MirrorCoreDuelist",
    centerX - 100,
    centerY,
    "duelist"
  );
  const rightGround = target(
    "MirrorCoreMime",
    centerX + 45,
    centerY,
    "mime"
  );
  const rightCasterNear = target(
    "MirrorCoreCasterB",
    centerX + 180,
    centerY - 100,
    "caster"
  );
  const rightCasterFar = target(
    "MirrorCoreCasterA",
    centerX + 240,
    centerY - 100,
    "caster"
  );

  assert.equal(
    selectGrandCardTarget(
      [leftGround, rightGround, rightCasterFar, rightCasterNear],
      centerX,
      centerY,
      520,
      1,
      "MirrorCore"
    )?.id,
    "MirrorCoreCasterB",
    "a facing caster outranks a nearer facing ground target"
  );

  assert.equal(
    selectGrandCardTarget(
      [rightCasterNear, leftGround],
      centerX,
      centerY,
      520,
      -1,
      "MirrorCore"
    )?.id,
    "MirrorCoreDuelist",
    "the facing half-plane outranks enemy kind"
  );

  const tiedA = target(
    "MirrorCoreCasterA",
    centerX + 160,
    centerY - 120,
    "caster"
  );
  const tiedB = target(
    "MirrorCoreCasterB",
    centerX + 160,
    centerY + 120,
    "caster"
  );

  for (const registrationOrder of [
    [tiedA, tiedB],
    [tiedB, tiedA]
  ]) {
    assert.equal(
      selectGrandCardTarget(
        registrationOrder,
        centerX,
        centerY,
        520,
        1,
        "MirrorCore"
      )?.id,
      "MirrorCoreCasterA",
      "equal priorities and distances use lexicographic id, not registration order"
    );
  }
});

test("Grand Card runtime supplies section, facing, and stable MirrorCore metadata", async () => {
  const [combatSource, supportSource, coreSource] =
    await Promise.all([
      readFile(
        new URL(
          "../src/combat/CombatSystem.ts",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL(
          "../src/world/RoyalBoxSupportSystem.ts",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL(
          "../src/world/MirrorCoreSystem.ts",
          import.meta.url
        ),
        "utf8"
      )
    ]);

  assert.match(combatSource, /selectGrandCardTarget\(/);
  assert.match(
    supportSource,
    /this\.player\.facing,\s*ownerSection\?\.id \?\? null/
  );
  assert.match(coreSource, /return this\.spawn\.id;/);
  assert.match(coreSource, /return this\.spawn\.kind;/);
});

test("targeting outside MirrorCore remains nearest-distance first", () => {
  const nearestGround = target(
    "near-ground",
    20,
    0,
    "duelist",
    "RoyalBox"
  );
  const fartherCaster = target(
    "far-caster",
    80,
    0,
    "caster",
    "RoyalBox"
  );

  assert.equal(
    selectGrandCardTarget(
      [fartherCaster, nearestGround],
      0,
      0,
      520,
      1,
      "RoyalBox"
    )?.id,
    "near-ground"
  );
});

test("health pickups respawn independently and preserve timers while paused", () => {
  const respawns = new PickupRespawnState();

  assert.equal(
    respawns.collect(
      "CoreRoseE",
      MIRROR_CORE_HEALTH_PICKUP_RESPAWN_SECONDS
    ),
    true
  );
  respawns.update(2);
  assert.equal(
    respawns.collect(
      "CoreRoseF",
      MIRROR_CORE_HEALTH_PICKUP_RESPAWN_SECONDS
    ),
    true
  );

  respawns.update(4);
  const beforePause =
    respawns.remainingSeconds("CoreRoseE");
  respawns.update(30, false);
  assert.equal(
    respawns.remainingSeconds("CoreRoseE"),
    beforePause,
    "wall-clock pause duration cannot advance gameplay respawns"
  );

  respawns.update(6);
  assert.equal(respawns.isAvailable("CoreRoseE"), true);
  assert.equal(respawns.isAvailable("CoreRoseF"), false);
  assert.equal(
    respawns.remainingSeconds("CoreRoseF"),
    2
  );

  respawns.update(2);
  assert.equal(respawns.isAvailable("CoreRoseF"), true);
});

test("pickup lifecycle reset clears only the encounter-owned timers", () => {
  const respawns = new PickupRespawnState();

  respawns.collect("CoreRoseE", 12);
  respawns.collect("CoreRoseF", 12);
  respawns.collect("OtherSectionRose", 12);
  respawns.reset(["CoreRoseE", "CoreRoseF"]);

  assert.equal(respawns.isAvailable("CoreRoseE"), true);
  assert.equal(respawns.isAvailable("CoreRoseF"), true);
  assert.equal(respawns.isAvailable("OtherSectionRose"), false);
});

test("MirrorCore owns pickup cleanup on exit, death, and gate completion", async () => {
  const source = await readFile(
    new URL(
      "../src/world/MirrorCoreSystem.ts",
      import.meta.url
    ),
    "utf8"
  );
  const resetCalls =
    source.match(/this\.resetGauntletPickups\(\);/g) ?? [];

  assert.equal(
    resetCalls.length,
    3,
    "section exit, death reset, and gauntlet completion must each clear pickup state"
  );
  assert.match(
    source,
    /!this\.gauntletStarted \|\|\s*!this\.isPlayerInSection\(\)/,
    "gauntlet pickups must not render outside their active encounter"
  );
  assert.match(
    source,
    /resetGrandCardPickups\(\s*MIRROR_CORE_GAUNTLET_CARD_PICKUP_IDS\s*\)/
  );
});

test("all four MirrorCore enemies cost three Grand Card hits after rebalance", () => {
  assert.equal(MIRROR_CORE_CASTER_HEALTH, 40);
  assert.equal(MIRROR_CORE_GROUND_ENEMY_HEALTH, 42);
  assert.equal(MIRROR_CORE_GRAND_CARD_DAMAGE, 14);
  assert.equal(
    grandCardHitsToDefeat(MIRROR_CORE_CASTER_HEALTH),
    3
  );
  assert.equal(
    grandCardHitsToDefeat(MIRROR_CORE_GROUND_ENEMY_HEALTH),
    3
  );
  assert.equal(
    2 * grandCardHitsToDefeat(MIRROR_CORE_CASTER_HEALTH) +
      2 * grandCardHitsToDefeat(
        MIRROR_CORE_GROUND_ENEMY_HEALTH
      ),
    12
  );
});
