# Impressario Midnight Show

A hand-made 2D action platformer built for the Impressario Casino contest:
one continuous stage, eleven sections, three abilities, one boss.

**Play it here:** https://impressario-midnight-show.contact-541.workers.dev

Everything in this repository — code, level design, pixel animations, 95 original
audio assets and every soundtrack — was made by myself :-) .

---

## The run

One uninterrupted world, split into eleven sections with seamless soundtrack
transitions. No level select, no hub, no loading screens between areas: you
start in the Movement Rehearsal and you stop when the final boss is down.

1. Movement Rehearsal
2. Combat Rehearsal
3. The Main Stage
4. The Grand Gallery
5. The Gallery Gauntlet
6. The Spotlight Vault
7. The Card Sanctum
8. The Fractured Royal Box
9. The Mirror Core
10. Conductor Approach
11. Mirror Conductor

The first two sections teach the core movement and melee move set through
playable spaces and in-world signs rather than modal instruction screens.

Authored content as of build 0.7.0: a single world of 49,824 x 720 px with
295 collision bodies, 15 checkpoints, 19 gates, 26 enemy spawns, 36 hazards and
17 pickups — all hand-placed, no procedural generation.

Puzzle solutions, enemy patterns and boss mechanics are deliberately not
documented here. Finding them out is the game.

---

## Controls

| Action | Keyboard | Standard Gamepad |
|---|---|---|
| Move left / right | `A` `D` or Left / Right Arrow | Left Stick |
| Down / fast fall | `S` or Down Arrow | Left Stick down or D-pad down |
| Jump / double jump | `Space` | South face button (`A` on Xbox layouts) |
| Dash | `Shift` | East face button (`B`) or Right Trigger |
| Melee strike | `J` | West face button (`X`) |
| Grand Card (throw) | `L` | North face button (`Y`) |
| Spotlight | `K` | Right Shoulder (`RB`) |
| Pause / resume | `P` | Start / Menu |

`W` / Up and `S` / Down also select directional melee variants. `Escape` closes
an open pause menu.

Gameplay supports the W3C Standard Gamepad layout: the Left Stick moves, Left
Stick down or D-pad down performs down/fast-fall input, the south face button
jumps, the east face button or Right Trigger dashes, the west face button
performs a melee strike, the north face button throws a Grand Card, Right
Shoulder casts Spotlight, and Start/Menu pauses or resumes. Menu navigation and
text entry are keyboard-only, including player-name and claim-code entry, so a
gamepad alone cannot start a ranked run. This controller path is covered by
deterministic automated tests but has not been tested on physical hardware;
full gamepad support is not claimed.

## Abilities

**Melee** is the bread and butter: a ground combo plus a low strike, a launcher,
air attacks, a down-strike and a dash attack. Every move has its own wind-up and
reach, so spacing matters more than mashing.

**Grand Card** is the ranged option — a thrown card on a limited charge budget
that refills from pickups placed through the world.

**Spotlight** is the utility cast, paid for from a regenerating resource. Where
it matters, the level will tell you.

---

## Ranked runs and the claim code

Runs can be submitted to an online leaderboard. Name entry and the Turnstile
challenge happen only when you press **Start Game**, never on page load. The
Worker computes duration from server timestamps and updates deaths and hits only
through authenticated, sequenced in-run events. Implausible runs are flagged
automatically. Ranked starts are rate limited per IP.

Finishing the game shows a one-time **claim code** in the format
`XXXX-XXXX-XXXX-XXXX`, drawn from a 32-symbol alphabet (about 1.2 x 10^24
possible codes). The database stores only the SHA-256 hash of the code — there is
no plaintext column — and the issuing endpoint hands it out exactly once.

A code proves ownership of a specific run and can be checked by anyone, without
an account, either from the **Verify Claim Code** button in the main menu or by
deep link:

~~~
https://impressario-midnight-show.contact-541.workers.dev/?verify=XXXX-XXXX-XXXX-XXXX
~~~

The same lookup is available as a read-only endpoint, `POST /api/claims/verify`,
which returns the run's rank, player name, raw and ranked duration, death and hit
count, build version and completion timestamp. Unknown codes get a generic 404
with no hint, lookups are hash-only and rate limited per IP. Verification is
read-only: nothing is redeemed, consumed or changed.

---

## Tech

TypeScript on Phaser, bundled with Vite and served from a single Cloudflare
Worker. The leaderboard lives in Cloudflare D1, bot protection is Cloudflare
Turnstile, and both rate limiters are Worker rate-limiting bindings. The world is
authored in LDtk and synced into typed runtime data by repo scripts, so the level
data in code cannot silently drift from the editor file.

Combat and hazard timing uses accumulated gameplay delta time and fixed-step
simulation for consistent behaviour across supported frame rates.

Pausing freezes the simulation — combat, hazards and every in-run timer stop —
but the ranked clock is server-side and keeps running, so a pause costs ranked
time.

### Requirements

- Node.js >= 22.18.0
- npm
- For deployment: a Cloudflare account with Workers, D1 and Turnstile

### Development

~~~bash
npm install
npm run dev              # local dev server
npm run build            # level validation + type check + bundle
npm run levels:validate
~~~

### Tests

~~~bash
node --test tests/*.test.mjs   # deterministic runtime tests
npx playwright test            # browser tests (needs: npx playwright install)
~~~

The Node suite covers movement and frame-step behaviour, section boundaries,
audio persistence, ability targeting, pickup lifecycles, input handling and
encounter timing. The Playwright suite covers the menu, pause handling, ranked
startup, per-section audio and repeated traversal of every section boundary.

### Level pipeline

`assets/levels/impressario-world.ldtk` is the single source of truth. The sync
scripts regenerate runtime data and the validators fail the build on any
mismatch — `npm run build` runs them before the type check even starts.

~~~
assets/levels/   authored LDtk world
scripts/         LDtk sync + runtime validators
src/combat/      melee combo system
src/magic/       Spotlight, Grand Card, targeting
src/runtime/     input controllers
src/world/       sections, hazards, encounters
tests/           node:test suites and Playwright specs
worker/          Cloudflare Worker: leaderboard, claim codes, rate limits
~~~

### Deployment

~~~bash
npx wrangler secret put TURNSTILE_SECRET_KEY
npm run deploy
~~~

`wrangler.jsonc` holds the bindings: the D1 database, the ranked-start limiter,
the claim-verification limiter, the static asset binding, the Turnstile site key,
the allowed origin and the build version. The Turnstile secret is stored as an
encrypted Worker secret and is not part of this repository.

---

## Credits

Concept, level design, characters, enemies, code, pixel animations, all 82 sound
effects, voice cues and ambience beds, and every one of the 13 soundtracks:
**BlockShield Systems** (Demian).

## License

Copyright (c) 2026 BlockShield Systems. All rights reserved.
The source is published for review and verification purposes only — see
[LICENSE](LICENSE).
