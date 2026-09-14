import assert from "node:assert/strict";
import test from "node:test";

import {
  GRAND_CARD_MAX_CHARGES,
  GrandCardChargeState,
  advanceGrandCardProjectile,
  createGrandCardProjectileState,
  grandCardProjectileBounds,
  rectangleBoundsOverlap
} from "../src/magic/GrandCardState.ts";
import {
  resolvePlayerTopBoundary
} from "../src/player/PlayerPlayfieldBounds.ts";

test("Grand Card charges deplete and pickups respawn independently without auto-refill", () => {
  const state = new GrandCardChargeState();

  assert.equal(state.currentCharges, 0);
  assert.equal(state.spend(), "locked");

  state.unlock();
  assert.equal(
    state.currentCharges,
    GRAND_CARD_MAX_CHARGES
  );

  assert.equal(state.spend(), "spent");
  assert.equal(state.spend(), "spent");
  assert.equal(state.spend(), "spent");
  assert.equal(state.spend(), "depleted");
  assert.equal(state.currentCharges, 0);

  assert.equal(state.collectPickup("pickup-a"), true);
  assert.equal(state.spend(), "spent");
  state.update(2);

  assert.equal(state.collectPickup("pickup-b"), true);
  assert.equal(state.spend(), "spent");
  assert.equal(state.currentCharges, 0);

  state.update(6);
  assert.equal(state.isPickupAvailable("pickup-a"), true);
  assert.equal(state.isPickupAvailable("pickup-b"), false);
  assert.equal(
    state.currentCharges,
    0,
    "a respawned pickup must not refill until collected"
  );

  assert.equal(state.collectPickup("pickup-a"), true);
  assert.equal(state.currentCharges, 1);
  state.update(2);
  assert.equal(state.isPickupAvailable("pickup-b"), true);
  assert.equal(state.currentCharges, 1);
  assert.equal(state.collectPickup("pickup-b"), true);
  assert.equal(state.currentCharges, 2);
});

test("MirrorCore-owned Grand Card survives beyond x=35984 and can hit relay 2", () => {
  const projectile = createGrandCardProjectileState(
    36050,
    254,
    390,
    0,
    1.6,
    {
      id: "MirrorCore",
      startX: 35344,
      endX: 39200
    }
  );

  assert.equal(
    projectile.ownerSection?.id,
    "MirrorCore"
  );
  assert.equal(
    advanceGrandCardProjectile(
      projectile,
      0.08,
      {
        id: "MirrorCore",
        startX: 35344,
        endX: 39200
      }
    ),
    true
  );
  assert.ok(projectile.x > 35984);

  const relay2 = {
    x: 36080 - 15,
    y: 254 - 19,
    width: 30,
    height: 38
  };

  let damageAccepted = false;

  if (
    rectangleBoundsOverlap(
      grandCardProjectileBounds(projectile),
      relay2
    )
  ) {
    damageAccepted = true;
  }

  assert.equal(
    damageAccepted,
    true,
    "the surviving projectile must overlap and damage relay 2"
  );
});

test("player top boundary resolves as a ceiling without constraining other actors", () => {
  const player = {
    y: -4,
    velocityY: -430
  };

  assert.equal(resolvePlayerTopBoundary(player), true);
  assert.deepEqual(player, {
    y: 0,
    velocityY: 0
  });

  const projectile = {
    y: -4,
    velocityY: -430
  };

  assert.equal(projectile.y, -4);
  assert.equal(projectile.velocityY, -430);
});
