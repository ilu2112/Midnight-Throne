<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { RotateCw, ChevronUp, ChevronDown } from '@lucide/vue'
import {
  DIE_SIZES,
  diceResults,
  isRolling,
  rollAll,
  isDiceDockHidden,
  ROLL_ANIMATION_MS,
  D100_SECOND_KEY,
  isCriticalDouble,
} from '../lib/dice'
import {
  viewportWidth,
  watchViewportWidth,
  diceDockRightEdge,
  rightSidebarLeftEdge,
  LEFT_SIDEBAR_WIDTH,
} from '../lib/layout'
import { settings } from '../lib/settings'

// Real, live-measured width of the pill (see lib/layout.js's own comment
// for why this is measured rather than hand-derived) — 0 until the first
// successful measurement below.
const dockEl = ref(null)
const dockWidth = ref(0)

function measureDockWidth() {
  const el = dockEl.value
  if (!el) return
  const w = el.getBoundingClientRect().width
  // Only commit a nonzero reading. A read of exactly 0 means the pill is
  // currently display: none — either this component's own .is-hidden
  // toggle state doesn't affect width (it only translates the block, so
  // that's not actually a concern here) or, more likely, a resize just
  // crossed back below this dock's own overlapsLeftSidebar threshold
  // between the last measurement and this one. Keeping the last known-good
  // width instead of overwriting it with 0 is what makes this self-healing
  // across a resize that goes narrow and then wide again, rather than
  // getting stuck unmeasured.
  if (w > 0) dockWidth.value = w
}

let stopViewportWatch = null

onMounted(() => {
  stopViewportWatch = watchViewportWidth()
  measureDockWidth()
  // Re-measure once the real 'Cinzel' web font finishes loading, in case
  // the very first paint happened against a fallback substitute (slower
  // network, cache miss, ...) — picks up the correct width automatically
  // instead of staying calibrated against whatever rendered first.
  document.fonts?.ready?.then(measureDockWidth)
})

onUnmounted(() => {
  stopViewportWatch?.()
  // diceDockRightEdge is a module-scoped ref (lib/layout.js), not local
  // component state — it survives past this component's own teardown with
  // whatever value was last written to it. That's fine while this dock is
  // just temporarily hidden by its own width-based overlap check (still
  // mounted, still updating it), but this component can now also be
  // unmounted outright — Settings page's "Enable top dock" toggle — in
  // which case nothing would ever write to it again, leaving App.vue's
  // right-sidebar padding logic reading stale, possibly-nonzero geometry
  // from before the dock was turned off. Resetting it here guarantees a
  // disabled dock always reads as "doesn't reach anywhere", same as one
  // that was never mounted this session at all.
  diceDockRightEdge.value = 0
})

watch(viewportWidth, measureDockWidth)

// This dock is centered on the FULL viewport width (see .dice-dock-window's
// left: 50% below), which knows nothing about either sidebar — so once the
// window gets narrow enough, the centered pill's own edges start sliding
// underneath one of them. Both edges are plain arithmetic from the dock's
// own real measured width, since it's exactly centered: left edge sits at
// viewportWidth/2 - dockWidth/2, right edge at viewportWidth/2 + dockWidth/2.
const dockLeftEdge = computed(() => viewportWidth.value / 2 - dockWidth.value / 2)
const dockRightEdge = computed(() => viewportWidth.value / 2 + dockWidth.value / 2)

const overlapsLeftSidebar = computed(() => {
  if (!dockWidth.value) return false
  return dockLeftEdge.value < LEFT_SIDEBAR_WIDTH
})

// The right sidebar isn't a fixed width the way the left one is — it's
// either 332px open or 36px collapsed (see lib/layout.js's
// rightSidebarLeftEdge) — so this dock can reach under it well before it
// would ever reach the left sidebar, depending on which state it's
// currently in. Missing this case is exactly what let the dock visibly run
// under an OPEN right sidebar in a band of viewport widths where neither
// the old left-only check nor the mobile breakpoint caught it.
const overlapsRightSidebar = computed(() => {
  if (!dockWidth.value) return false
  return dockRightEdge.value > rightSidebarLeftEdge.value
})

const overlapsSidebar = computed(() => overlapsLeftSidebar.value || overlapsRightSidebar.value)

// Published for App.vue's .right-sidebar-content to read when deciding its
// own top clearance — see lib/layout.js's comment on diceDockRightEdge.
watch(
  [overlapsSidebar, dockWidth, viewportWidth],
  () => {
    diceDockRightEdge.value = !overlapsSidebar.value && dockWidth.value ? dockRightEdge.value : 0
  },
  { immediate: true },
)

// How many random "filler" numbers spin past before each reel lands on the
// real result (which is always the last item — see buildReel). Fixed across
// every die, which matters: it means the CSS keyframe's travel distance
// (see @keyframes dice-reel-spin) is a single constant, not something that
// has to be computed per-die in JS and pushed down as an inline style.
const REEL_FILLER_COUNT = 8

// Real slot machines don't stop all their reels at once — they stop in
// sequence, left to right, which is most of what reads as "mechanical" about
// them rather than just "a number changing". Same effect here: every die
// starts spinning at the same instant, but each gets its own animation
// duration, shortest die first, so they visibly stop one after another
// instead of freezing in unison. The last (longest) one always finishes
// exactly at ROLL_ANIMATION_MS, since that's what lib/dice.js's timeout uses
// to know when the whole roll is over.
const SPIN_MIN_MS = 350
const SPIN_DURATIONS_MS = Object.fromEntries(
  DIE_SIZES.map((sides, i) => [
    sides,
    Math.round(SPIN_MIN_MS + ((ROLL_ANIMATION_MS - SPIN_MIN_MS) * i) / (DIE_SIZES.length - 1)),
  ]),
)

// Per-die spin sequences, only populated (and only rendered) while a roll is
// animating — see the template's v-if. Rebuilt fresh on every roll from the
// real result (already decided by the time this runs — see rollAll in
// lib/dice.js), so the reel always ends on the true value with no swap
// needed afterwards.
const reelNumbers = ref({})

// Bumped on every roll and used as part of each reel-track's :key, so Vue
// throws away and remounts the element instead of patching it — the simplest
// reliable way to force the CSS animation to restart from its `from` state
// every time, even if the previous roll's reel happened to end in the same
// place.
const rollId = ref(0)

function buildReel(finalValue, sides) {
  const numbers = []
  for (let i = 0; i < REEL_FILLER_COUNT; i++) {
    numbers.push(Math.floor(Math.random() * sides) + 1)
  }
  numbers.push(finalValue)
  return numbers
}

function handleRoll() {
  if (isRolling.value) return
  rollAll() // decides diceResults synchronously and flips isRolling on
  const next = {}
  for (const sides of DIE_SIZES) {
    next[sides] = buildReel(diceResults.value[sides], sides)
  }
  // The second D100 roll spins as its own reel (100-sided filler, same as
  // the primary D100's), stacked below it in the template rather than
  // occupying its own dice-slot — see D100_SECOND_KEY's own comment in
  // lib/dice.js. Only built while the Settings page's "second D100 roll"
  // toggle is on — see settings.js and the template below, which skips
  // rendering the secondary reel entirely when it's off.
  if (settings.value.secondD100Enabled) {
    next[D100_SECOND_KEY] = buildReel(diceResults.value[D100_SECOND_KEY], 100)
  }
  reelNumbers.value = next
  rollId.value++
}
</script>

<template>
  <div class="dice-dock-window" :class="{ compact: !settings.secondD100Enabled }" v-show="!overlapsSidebar">
    <div class="dice-dock-inner" :class="{ 'is-hidden': isDiceDockHidden }">
      <nav ref="dockEl" class="dice-dock" aria-label="Dice roller">
        <button
          type="button"
          class="dice-roll-btn"
          :disabled="isRolling"
          @click="handleRoll"
          aria-label="Roll all dice"
          title="Roll all dice"
        >
          <RotateCw :size="12" :stroke-width="2.25" />
        </button>

        <div
          v-for="sides in DIE_SIZES"
          :key="sides"
          class="dice-slot"
          :class="{ 'dice-slot-d100': sides === 100 }"
          :aria-label="
            sides === 100
              ? settings.secondD100Enabled
                ? `d100: ${diceResults[100]} / ${diceResults[D100_SECOND_KEY]}`
                : `d100: ${diceResults[100]}`
              : `d${sides}: ${diceResults[sides]}`
          "
        >
          <span class="dice-slot-label">d{{ sides }}</span>

          <span v-if="sides !== 100" class="dice-reel-window" :class="{ 'is-spinning': isRolling }">
            <span
              v-if="isRolling"
              :key="`${sides}-${rollId}`"
              class="dice-reel-track"
              :style="{ animationDuration: SPIN_DURATIONS_MS[sides] + 'ms' }"
            >
              <span v-for="(n, i) in reelNumbers[sides]" :key="i" class="dice-slot-value">{{ n }}</span>
            </span>
            <span v-else class="dice-slot-value">{{ diceResults[sides] }}</span>
          </span>

          <!-- D100 without the Settings page's "second D100 roll" turned on
               is just a single reel like every other die — same markup as
               the v-if branch above, just still with the critical-double
               glow (a "double" is still a thing worth calling out on a lone
               D100 roll; only the SECOND roll is what's actually gated by
               that setting). -->
          <span v-else-if="!settings.secondD100Enabled" class="dice-reel-window" :class="{ 'is-spinning': isRolling }">
            <span
              v-if="isRolling"
              :key="`100-${rollId}`"
              class="dice-reel-track"
              :style="{ animationDuration: SPIN_DURATIONS_MS[100] + 'ms' }"
            >
              <span v-for="(n, i) in reelNumbers[100]" :key="i" class="dice-slot-value">{{ n }}</span>
            </span>
            <span v-else class="dice-slot-value"
              ><span class="dice-value-text" :class="{ critical: isCriticalDouble(diceResults[100]) }">{{
                diceResults[100]
              }}</span></span
            >
          </span>

          <!-- D100 gets a second, independent roll stacked below the first
               (see D100_SECOND_KEY's comment in lib/dice.js) — a critical
               "double" (11, 22, ..., 99, or 100) glows on whichever of the
               two it lands on, once the reel settles (never mid-spin, where
               it would just be a random filler number flashing by). -->
          <span v-else class="dice-reel-stack">
            <span class="dice-reel-window" :class="{ 'is-spinning': isRolling }">
              <span
                v-if="isRolling"
                :key="`100-${rollId}`"
                class="dice-reel-track"
                :style="{ animationDuration: SPIN_DURATIONS_MS[100] + 'ms' }"
              >
                <span v-for="(n, i) in reelNumbers[100]" :key="i" class="dice-slot-value">{{ n }}</span>
              </span>
              <span v-else class="dice-slot-value"
                ><span class="dice-value-text" :class="{ critical: isCriticalDouble(diceResults[100]) }">{{
                  diceResults[100]
                }}</span></span
              >
            </span>
            <span class="dice-reel-window dice-reel-window-secondary" :class="{ 'is-spinning': isRolling }">
              <span
                v-if="isRolling"
                :key="`${D100_SECOND_KEY}-${rollId}`"
                class="dice-reel-track"
                :style="{ animationDuration: SPIN_DURATIONS_MS[100] + 'ms' }"
              >
                <span v-for="(n, i) in reelNumbers[D100_SECOND_KEY]" :key="i" class="dice-slot-value dice-slot-value-secondary">{{
                  n
                }}</span>
              </span>
              <span v-else class="dice-slot-value dice-slot-value-secondary"
                ><span class="dice-value-text" :class="{ critical: isCriticalDouble(diceResults[D100_SECOND_KEY]) }">{{
                  diceResults[D100_SECOND_KEY]
                }}</span></span
              >
            </span>
          </span>
        </div>
      </nav>

      <button
        type="button"
        class="dice-toggle"
        @click="isDiceDockHidden = !isDiceDockHidden"
        :aria-label="isDiceDockHidden ? 'Show dice roller' : 'Hide dice roller'"
        :title="isDiceDockHidden ? 'Show dice roller' : 'Hide dice roller'"
      >
        <ChevronDown v-if="isDiceDockHidden" :size="14" :stroke-width="2.5" />
        <ChevronUp v-else :size="14" :stroke-width="2.5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Mirrors HistoryDock.vue's fixed-window mechanism (see that file's own
   comment for the full reasoning), just flipped top-to-bottom: this dock
   hangs from the viewport's top edge instead of its bottom, so hiding it
   slides the assembly UP instead of down. The window itself doesn't
   strictly need `overflow: hidden` to make that work — sliding something up
   past the real top of the viewport already makes it stop rendering, no
   clipping property required — but it's kept anyway for parity with
   HistoryDock and as a safety net against any rounding overshoot. Toggle +
   dock still slide together as one rigid block (`transform` only, so
   nothing here ever forces a layout reflow mid-animation), and the toggle
   tab still attaches directly to the pill rather than floating separately —
   just on the pill's bottom edge now (the side facing into the page) rather
   than its top. Desktop only — see the media query below for why this is
   hidden outright on narrow viewports rather than squeezed in. */
.dice-dock-window {
  position: fixed;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  z-index: 12;
  /* Measured directly (rather than hand-derived from font-size/padding/
     border — too many rounding sources to get right by arithmetic alone),
     same as HistoryDock.vue's window height: sized to exactly match the
     pill's top margin + its own content height + the toggle tab (minus the
     1px they overlap by), with no slack — see that file's comment for why
     a taller window than its content would leave dead, click-absorbing
     space below the toggle once collapsed. Re-measured after d100 grew a
     second, stacked reel row (see .dice-reel-stack below) — that's now
     what sets the pill's height, taller than the roll button which used to.
     Was 3.91rem before that; leaving the old window too short clipped the
     toggle tab clean off, caught by re-measuring with Playwright rather
     than eyeballing it. */
  height: 4.56rem;
  overflow: hidden;
}

/* Settings page: "second D100 roll" turned off — d100 goes back to being a
   single reel like every other die (see the template above), so the pill
   shrinks back to its pre-stack height instead of leaving a dead gap where
   the second row used to be. These are the exact pre-stack measurements
   this rule and .dice-dock-inner.is-hidden below used before that feature
   existed (re-measured with Playwright back then, not re-derived here). */
.dice-dock-window.compact {
  height: 3.91rem;
}

.dice-dock-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.28s ease;
}

/* Slides the pill+toggle block up by the pill's own top margin plus its
   content height, minus the 1px seam overlap — exactly the distance from
   the toggle's resting position up to the real viewport top, so it ends up
   flush with that edge (mirrors HistoryDock.vue's own .is-hidden, which
   lands its toggle flush with the viewport's bottom edge the same way,
   just in the other direction). This is NOT the same number as
   .dice-dock-window's height above — that height also includes the
   toggle's own thickness sitting past this slide distance; sliding by the
   full window height here would push the toggle above the top edge too,
   out of view along with the dock (an overshoot bug this value once had,
   caught by measuring the toggle's actual position with Playwright rather
   than trusting the arithmetic). Re-measured alongside the window height
   above for the same reason (was 2.86rem) — still window height minus the
   toggle's own 1.05rem thickness, just against the new taller window. */
.dice-dock-inner.is-hidden {
  transform: translateY(-3.51rem);
}

/* Matching compact counterpart to .dice-dock-window.compact's shorter
   height above — same pre-stack measurement this used before the second
   D100 roll existed. Two ancestor classes (.compact on the window,
   .is-hidden on this element) outweigh the plain .dice-dock-inner.is-hidden
   rule above by specificity, so this cleanly overrides it rather than
   needing !important. */
.dice-dock-window.compact .dice-dock-inner.is-hidden {
  transform: translateY(-2.86rem);
}

/* Small pull-tab attached to the dock's bottom edge (mirrors
   HistoryDock.vue's toggle, which attaches to its dock's TOP edge instead —
   see .dice-dock-window's comment for why the two are flipped). */
.dice-toggle {
  width: 2.4rem;
  height: 1.05rem;
  margin-top: -1px;
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 8px 8px;
  background: rgba(27, 22, 19, 0.85);
  backdrop-filter: blur(6px);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.12s ease;
}

.dice-toggle:hover {
  color: var(--text);
}

.dice-dock {
  display: flex;
  align-items: center;
  gap: 0;
  /* Gap between the pill and the real viewport top — smaller than
     HistoryDock's equivalent margin at the opposite edge, so this dock sits
     closer to the very top and leaves more clearance above the page's own
     heading below it. */
  margin-top: 0.6rem;
  border: 1px solid var(--border);
  max-width: calc(100vw - 1.5rem);
  overflow-x: auto;
  overflow-y: hidden;
  /* Unlike HistoryDock's list, this row never adds/removes entries (always
     exactly 7 dice + the roll button), so there's no TransitionGroup
     enter/leave overshoot to guard against — safe to scroll horizontally
     rather than hide overflow outright, for the rare narrow viewport where
     it doesn't all fit. */
  padding: 0.3rem 0.6rem;
  background: rgba(27, 22, 19, 0.85);
  border-radius: 999px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
}

/* Flat, divider-separated layout — no per-die pill/background/border like
   the previous version had. With 7 of these in a row, that many nested
   rounded rectangles (each with its own border and fill) added a lot of
   visual noise for very little payoff, and cost real horizontal space in
   padding+border on every single one. A plain vertical rule between slots
   keeps the same "each die is its own group" separation with much less
   clutter, and reads faster at a glance — which is the actual point of a
   dock you check quickly mid-session, not something meant to be studied. */
.dice-slot {
  flex-shrink: 0;
  display: flex;
  /* Not `baseline` — .dice-reel-window's own baseline (an inline-block with
     overflow: hidden) turned out to shift by about a pixel depending on
     whether its content was a single static span or the taller
     .dice-reel-track flex column, even though the window's own box height
     never changes — so the D? label visibly bobbed up the instant a roll
     started. `center` only depends on the two children's fixed box
     heights, not on either one's text-baseline metrics, so there's nothing
     left that a content swap could shift. */
  align-items: center;
  gap: 0.26rem;
  padding: 0 0.55rem;
  white-space: nowrap;
}

/* Adjacent-sibling (not :not(:first-child)) deliberately — the roll button
   now sits before the first die (see below), so "first-child" among ALL of
   .dice-dock's children is the button, not d4; this selector only cares
   whether the PRECEDING element is itself a .dice-slot, which correctly
   still excludes d4's own left edge regardless of what non-.dice-slot
   sibling comes before it. */
.dice-slot + .dice-slot {
  border-left: 1px solid var(--border);
}

/* Deliberately quiet — small, lighter weight, dim color — so the rolled
   number (below) is the thing that actually catches the eye in each slot,
   not the die-size label next to it. */
.dice-slot-label {
  font-family: 'Cinzel', serif;
  font-weight: 500;
  font-size: 0.66rem;
  letter-spacing: -0.01em;
  color: var(--text-faint);
}

/* Fixed single-line window each reel spins inside; overflow: hidden is what
   actually makes it look like a slot-machine column rather than a list of
   numbers sliding down the page — only whichever one number is currently
   aligned with this window is visible at all. Height is set once here and
   shared by every number inside it, so the "reel" never visibly changes
   size as it starts or stops spinning. inline-flex + align-items: flex-start
   (not the line-height/vertical-align approach this used at first, and NOT
   center either — see below) positions its one child — the static value,
   or the spinning .dice-reel-track — purely by box height, with no
   font-metric baseline math involved; that baseline math was what left the
   number sitting a couple of px low. flex-start specifically (found while
   verifying this session's other dock changes, unrelated to any of them):
   the static value's own height already equals this window's, so flex-start
   vs. center makes zero visual difference there — but .dice-reel-track is
   MUCH taller than the window (9 stacked items), and center was vertically
   centering that whole tall column at rest, which starts the window off
   partway down the strip instead of at its top. @keyframes dice-reel-spin
   below assumes a flush-top starting position; with the strip centered
   instead, the fixed travel distance overshot it clean past every item for
   most of each roll, so the "spin" was actually just a blank window for the
   ~70% of it that wasn't the brief flush-then-settle at either end. */
.dice-reel-window {
  display: inline-flex;
  align-items: flex-start;
  height: 1.1rem;
  /* overflow: hidden only while a reel is actually spinning (.is-spinning,
     bound in the template from isRolling) — that's when it's load-bearing,
     clipping the 9-stacked-item .dice-reel-track down to one visible line.
     Settled, this window holds a single .dice-slot-value whose own height
     already equals this box's, so clipping was doing nothing for the
     content itself — except also chopping a critical roll's soft glow
     halo (see .dice-slot-value.critical below) off dead square at this
     box's exact edge, which is what made it read as a hard-cornered plate
     instead of a soft round glow. Left visible outside of a spin, that halo
     can bleed a little into the surrounding padding the way a glow should. */
  overflow: visible;
}

.dice-reel-window.is-spinning {
  overflow: hidden;
}

.dice-reel-track {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  animation-name: dice-reel-spin;
  animation-timing-function: cubic-bezier(0.13, 0.85, 0.28, 1);
  animation-fill-mode: forwards;
}

/* Travels up by exactly (REEL_FILLER_COUNT + 1 − 1) line-heights, landing
   the LAST item (the real result — see buildReel in the script) flush in
   the window (which .dice-reel-window's flex-start alignment, above, starts
   flush at the FIRST item — this math only holds with that, not center).
   This distance only depends on REEL_FILLER_COUNT and the fixed line-height
   above, both constant across every die, so — unlike the old per-die
   flicker, which had nothing to keep in sync — this keyframe never needs a
   per-die value pushed in from JS; only animation-duration (set inline per
   die, see SPIN_DURATIONS_MS) varies, which is what actually staggers the
   dice into stopping one after another. Was -9.9rem (9 × 1.1rem) — one
   line-height too far, landing one past the real last item, into blank
   space past the end of the strip — corrected to match this comment's own
   formula: 9 items total (index 0-8), so reaching the last one (index 8)
   flush is 8 × 1.1rem, not 9. */
@keyframes dice-reel-spin {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-8.8rem); /* -(8 filler + 1 final − 1) × 1.1rem */
  }
}

.dice-slot-value {
  /* flex + align-items: center (rather than inline-block + line-height, the
     first approach here) centers this number's glyphs within its own fixed
     height by box geometry, not by leaning on the font's ascent/descent
     metrics to land a baseline in the middle — the line-height approach
     consistently rendered bold numerals a couple of px low. justify-content
     right-aligns the same way text-align: right used to, but actually works
     now that this is a flex container rather than plain inline content (see
     min-width's own comment below for why plain inline was wrong here too).
     Used in two places: as .dice-reel-window's only child when idle, and as
     each item stacked inside .dice-reel-track's flex column while spinning
     — flex-in-flex nests without issue either way. */
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text);
  height: 1.1rem;
  /* Fixed at exactly 3 digits wide (`ch` = the width of "0" in the current
     font, not a guessed em-multiple — an em-based guess here once measured
     out just barely too narrow for a bold "100", letting the dock's width
     twitch for a single animation frame) — the widest any of these dice
     can roll (d100's "100"). Applied to every value shown — the resting
     number and every number scrolling past inside a spinning reel alike —
     so nothing here ever changes width, whether that's a reel cycling
     through random digit-counts many times a second or the final result
     landing. Without this, the whole dock (centered via
     .dice-dock-window's own translateX(-50%)) would visibly shift sideways
     as any one slot's number changed width mid-roll. tabular-nums keeps the
     digits themselves from jittering left-right against that fixed box. */
  min-width: 3ch;
  font-variant-numeric: tabular-nums;
}

/* Holds d100's two stacked reel-windows (primary roll on top, the second
   independent roll below it — see D100_SECOND_KEY's comment in
   lib/dice.js). A tight column gap, not the dice-slot's own row gap, since
   these two lines belong to the same die rather than being separate
   label+value pairs. */
.dice-reel-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.05rem;
}

/* Same size as the primary roll (min-width: 3ch above still applies, so a
   second "100" never jitters the column width either) — only the color
   changes, to a dimmer shade than the primary's full-brightness --text, so
   the two rolls read as "same die, second roll" rather than two unrelated
   numbers of equal visual weight. */
.dice-slot-value-secondary {
  color: var(--text-dim);
}

/* Wraps just the digits themselves (not .dice-slot-value's own padded,
   fixed min-width: 3ch box) so a critical roll's glow — see below — can
   center on the actual glyphs. That distinction matters here specifically
   because .dice-slot-value is right-aligned (justify-content: flex-end)
   inside a box that's wider than a 2-digit number: centering the glow on
   the OUTER box (as this used to) put it noticeably left of a 2-digit
   roll's own visual center, since the box's geometric middle isn't where
   a right-aligned "55" actually sits — only 3-digit rolls (which fill the
   box edge-to-edge) happened to look centered. Anchoring to this inner,
   content-sized wrapper instead fixes that regardless of digit count.
   inline-block (not the parent's flex) is enough since it only ever holds
   plain text — no children to lay out. */
.dice-value-text {
  display: inline-block;
}

/* A "double" (11, 22, ..., 99, or 100 — see isCriticalDouble in
   lib/dice.js) is a critical hit regardless of which of the two D100 rolls
   it lands on. A color shift plus a soft halo behind the number, not a
   background/border/padding change on the number's own box — those would
   grow it and visibly nudge the whole dock sideways (it's horizontally
   centered via .dice-dock-window's translateX(-50%)), the same jitter
   min-width: 3ch on .dice-slot-value already exists to prevent. The halo
   itself is a separate ::before layer (below), not text-shadow directly on
   the glyphs — text-shadow's blur is cheap but, at a blur radius wide
   enough to read as a glow, it rendered as a hard-cornered rectangle rather
   than a soft round one (its blur is computed from the text's own
   rectangular run, and — this was the actual bug first reported — it was
   also getting clipped dead square by .dice-reel-window's old
   unconditional overflow: hidden, which is what made it look like a flat
   plate rather than glowing). position: relative + z-index: 0 gives this
   element its own local stacking context, so the halo's z-index: -1 only
   means "behind this number", not "behind the whole dock". */
.dice-value-text.critical {
  position: relative;
  z-index: 0;
  color: var(--accent-light);
  text-shadow: 0 0 4px rgba(232, 164, 143, 0.5);
}

/* The actual glow: a radial gradient (round and soft by construction,
   unlike a blurred rectangle of text) bled a bit beyond the number's own
   box, further softened with a blur filter, pulsing gently behind it. */
.dice-value-text.critical::before {
  content: '';
  position: absolute;
  inset: -0.45rem -0.6rem;
  z-index: -1;
  border-radius: 999px;
  background: radial-gradient(ellipse closest-side, rgba(232, 164, 143, 0.6), rgba(232, 164, 143, 0) 75%);
  filter: blur(2px);
  animation: dice-critical-glow 1.6s ease-in-out infinite;
  pointer-events: none;
}

@keyframes dice-critical-glow {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

.dice-roll-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  /* Was margin-left, back when this sat after the last die — now it's the
     dock's first element (moved to the left side), so the same breathing
     room goes on its trailing edge instead, between it and d4. */
  margin-right: 0.5rem;
  border: 1px solid var(--accent);
  border-radius: 50%;
  background: var(--accent-dim);
  color: var(--accent-light);
  cursor: pointer;
  transition: background 0.12s ease;
}

.dice-roll-btn:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}

.dice-roll-btn:disabled {
  cursor: default;
  opacity: 0.75;
}

/* Hidden outright below the tablet/phone breakpoint, rather than squeezed
   into a horizontally-scrolling strip the way it works on wider desktop
   windows: even after trimming the per-slot icons and the roll button's
   label, 7 dice + a button still don't fit in the narrow gap left between
   the mobile hamburger buttons in both top corners (App.vue's .menu-toggle
   / .right-menu-toggle) without scrolling — and a fiddly horizontal scroll
   wedged between two other fixed controls, right at the top of a phone
   screen, is worse than just not offering it there.

   The OTHER reason this dock disappears — narrow-but-still-desktop windows
   where it would otherwise slide under the left sidebar (always open) or
   the right one (open or collapsed) — used to be a second, wider
   breakpoint right here, hand-derived from a width measurement. That
   measurement was wrong (see lib/layout.js's own comment for exactly why),
   so rather than re-guess a corrected pixel value, that check now lives in
   the script above as overlapsSidebar, computed from this dock's own real
   measured width against both sidebars' actual current edges instead of a
   constant — see the v-show on .dice-dock-window in the template. */
@media (max-width: 860px) {
  .dice-dock-window {
    display: none;
  }
}
</style>
