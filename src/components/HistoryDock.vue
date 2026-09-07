<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { House, Skull, KeyRound, Lock, Info, ChevronUp, ChevronDown } from '@lucide/vue'
import { recentHistory, isDockHidden } from '../lib/history'
import { viewportWidth, watchViewportWidth, LEFT_SIDEBAR_WIDTH, MOBILE_BREAKPOINT } from '../lib/layout'

const route = useRoute()

// Custom hover/focus tooltip showing a dot's destination label. Rendered via
// Teleport straight to <body> (see the template) rather than as a plain
// absolutely-positioned child of the dot, because .history-dock-window
// (below) is both `transform`-ed and `overflow: hidden` — which makes it the
// clipping containing block for anything positioned inside it, fixed-position
// included — so an in-place tooltip would get its top silently sliced off by
// that window's fixed height the moment it tried to render above the dock.
// Teleporting outside that subtree sidesteps the whole problem.
const tooltip = ref(null) // { label, x, y } | null

function showTooltip(event, entry) {
  const rect = event.currentTarget.getBoundingClientRect()
  // Clamps the tooltip's horizontal center so it can't run off either edge
  // of the viewport for a dot sitting near the edge of a wide (many-entry,
  // near max-width) dock. `half` is a deliberately generous estimate of the
  // tooltip's own half-width, chosen so it stays safely on-screen even for a
  // long monster name — the tooltip isn't rendered yet at this point (it
  // only appears once `tooltip` is set below), so its real width isn't
  // knowable without an extra layout pass, and this is close enough that no
  // one will notice a few px of imprecision on a hover tooltip.
  const half = 140
  const margin = 8
  const x = Math.min(Math.max(rect.left + rect.width / 2, half + margin), window.innerWidth - half - margin)
  tooltip.value = { label: entry.label, x, y: rect.top }
}

function hideTooltip() {
  tooltip.value = null
}

// recentHistory is newest-first (see lib/history.js's recordVisit), but the
// dock reads left-to-right as a timeline, oldest to newest — so the render
// order is the reverse of storage order.
const orderedHistory = computed(() => [...recentHistory.value].reverse())

// A dock with only 1-3 real visits looks sparse, so below 4 entries we pad
// the left (oldest) side with these landmark pages — the same 4 colored
// nav-shortcut destinations as App.vue's sidebar. Paths/types/labels match
// router/index.js's afterEach exactly, so a default entry is indistinguishable
// from — and correctly deduped against — the real entry recordVisit() writes
// once the user actually visits it. This is purely a display concern: the
// underlying recentHistory/localStorage data (and Save/Load game, which
// scans kn- keys) never sees these, only the rendered list does. Clicking a
// default dot navigates normally, which the router then records for real —
// it just quietly "graduates" from padding into real history.
const DEFAULT_ENTRIES = [
  { path: '/', type: 'home', label: 'Home' },
  { path: '/monsters', type: 'monsters', label: 'Monsters' },
  { path: '/room-generator', type: 'room-generator', label: 'Room Generator' },
  { path: '/locks-traps', type: 'locks-traps', label: 'Locks & Traps' },
]

const displayHistory = computed(() => {
  const real = orderedHistory.value
  if (real.length >= 4) return real
  const presentPaths = new Set(real.map((e) => e.path))
  const padding = DEFAULT_ENTRIES.filter((e) => !presentPaths.has(e.path)).slice(0, 4 - real.length)
  return [...padding, ...real]
})

// Never below this many, matching DEFAULT_ENTRIES' own floor above — a
// sparse-but-real dock is fine; one trimmed all the way to nothing (or to
// so few it looks broken) is not, even on a viewport narrow enough that
// showing more would genuinely overlap the left sidebar.
const MIN_VISIBLE = 4

// On a narrow (mobile) viewport the left sidebar goes off-canvas entirely
// (App.vue's own @media (max-width: 860px), a fixed design width, not a
// font measurement — safe to reuse as MOBILE_BREAKPOINT here) rather than
// occupying real layout space, so the overlap math below doesn't apply;
// this dock still needs its OWN cap there purely because a phone screen is
// narrow full stop, unrelated to the sidebar. 6 matches what this dock
// showed on mobile before this file started measuring anything at all.
const MOBILE_MAX_VISIBLE = 6

// Real, live-measured per-dot width and gap (see lib/layout.js's own
// comment for why this dock measures itself instead of relying on a
// hand-derived constant) — null until the first successful measurement.
// `overhead` is the dock's own padding + border, which — unlike dot
// width/gap — doesn't depend on how many dots are currently rendered, so
// it's safe to measure once from whatever count happens to be on screen
// and reuse it regardless of how that count changes afterward.
//
// Queried directly by class rather than a template ref on the
// <TransitionGroup> below: a ref on that built-in component doesn't
// reliably resolve to its rendered host element (tag="nav") across Vue
// versions the way a ref on a plain element does, whereas this component
// is only ever mounted once (App.vue), so its one nav.history-dock is
// unambiguous.
const dotMetrics = ref(null)

function measureDotMetrics() {
  // Below MOBILE_BREAKPOINT, .history-dot renders at its separate, smaller
  // mobile CSS size (see that media query below) — measuring here while
  // that's active would silently overwrite the cached desktop metrics with
  // the mobile ones the next time this fires, so a resize that dips
  // through the mobile range and back up would leave visibleCount's
  // desktop-range math using dot dimensions that don't match what's
  // actually rendered at desktop width, undercounting how much room each
  // dot really needs and letting the dock overlap the sidebar again. The
  // mobile branch doesn't consult dotMetrics at all (see visibleCount
  // below), so skipping the measurement there costs nothing.
  if (viewportWidth.value <= MOBILE_BREAKPOINT) return
  const nav = document.querySelector('.history-dock')
  if (!nav) return
  const dots = nav.querySelectorAll('.history-dot')
  // Needs at least 2 rendered dots to measure a gap between them. Always
  // true in practice — visibleHistory (below) never renders fewer than
  // MIN_VISIBLE — but guarded anyway rather than assumed.
  if (dots.length < 2) return
  const r0 = dots[0].getBoundingClientRect()
  const r1 = dots[1].getBoundingClientRect()
  // A zero-width read means the dock is currently display: none for some
  // reason outside this component's own control — skip rather than commit
  // a measurement that would only poison later calculations.
  if (r0.width === 0) return
  const dotWidth = r0.width
  const gap = r1.left - r0.right
  const navWidth = nav.getBoundingClientRect().width
  const overhead = navWidth - (dots.length * dotWidth + (dots.length - 1) * gap)
  dotMetrics.value = { dotWidth, gap, overhead }
}

let stopViewportWatch = null
let remeasureTimer = null

// Debounced, not immediate: a resize that changes visibleCount adds or
// removes dots through TransitionGroup's own enter/leave animations (see
// the .history-dot-leave-active rule below, which keeps a removed dot in
// the DOM — as position: absolute — for its whole 0.22s leave transition).
// Measuring right away would read that transitional DOM instead of the
// settled one: a leave-active dot's absolute positioning doesn't sit where
// plain flow layout would put it, which was throwing off the "first two
// dots" gap measurement (caught by watching it briefly go negative right
// after a count change). Waiting until 300ms after the last resize — comfortably
// past every transition duration used in this file — measures the DOM only
// once things have actually settled.
function scheduleRemeasure() {
  clearTimeout(remeasureTimer)
  remeasureTimer = setTimeout(measureDotMetrics, 300)
}

onMounted(() => {
  stopViewportWatch = watchViewportWidth()
  // Unlike scheduleRemeasure below, this one measures immediately: nothing
  // has had a chance to be mid-transition yet on first mount.
  measureDotMetrics()
  // Re-measure once the real 'Cinzel' web font finishes loading, in case
  // the very first paint happened against a fallback substitute — picks up
  // the correct metrics automatically rather than staying calibrated
  // against whatever rendered first.
  document.fonts?.ready?.then(measureDotMetrics)
})

onUnmounted(() => {
  stopViewportWatch?.()
  clearTimeout(remeasureTimer)
})

// Dot size (and gap) only actually changes at MOBILE_BREAKPOINT (compare
// .history-dot's two sizes below), so re-measuring on every single resize
// tick elsewhere would just keep re-confirming the same numbers — but it's
// a couple of getBoundingClientRect reads, cheap enough that doing it
// unconditionally here is simpler than trying to detect that one crossing
// specifically, and it stays correct even if that ever changes.
watch(viewportWidth, scheduleRemeasure)

// How many entries actually fit without this dock's own centered pill
// (see .history-dock-window's left: 50% below, same mechanism — and same
// "doesn't know about the sidebar" issue — as DiceDock's) sliding its left
// edge under the left sidebar. Below MOBILE_BREAKPOINT the sidebar isn't
// occupying layout space at all, so this uses the flat mobile cap instead;
// above it, but before the first real measurement lands, it conservatively
// shows only MIN_VISIBLE until dotMetrics is known, then grows to whatever
// actually fits.
const visibleCount = computed(() => {
  const total = displayHistory.value.length
  if (viewportWidth.value <= MOBILE_BREAKPOINT) {
    return Math.min(MOBILE_MAX_VISIBLE, total)
  }
  if (!dotMetrics.value) return Math.min(MIN_VISIBLE, total)
  const { dotWidth, gap, overhead } = dotMetrics.value
  // The widest this dock could be, centered, before its left edge reaches
  // the sidebar's own right edge — see DiceDock's overlapsLeftSidebar for
  // the identical derivation, just solved here for a dot count instead of
  // a yes/no.
  const available = viewportWidth.value - 2 * LEFT_SIDEBAR_WIDTH
  // available >= N*dotWidth + (N-1)*gap + overhead, solved for N.
  const maxFit = Math.floor((available - overhead + gap) / (dotWidth + gap))
  return Math.max(MIN_VISIBLE, Math.min(total, maxFit))
})

// Oldest-to-newest order is preserved by slicing off the FRONT (the
// oldest, least-relevant-right-now entries) when there isn't room for
// everything — "last N" reads the same as the old CSS
// nth-last-child(n+K) approach this replaces, just computed instead of
// hardcoded.
const visibleHistory = computed(() => displayHistory.value.slice(-visibleCount.value))

// One color triple per route "type" (see router/index.js's afterEach, which
// is the only place that writes these type strings). Home/Monsters/Room
// Generator/Locks & Traps reuse the exact colors of their sidebar
// nav-shortcut buttons (App.vue) so the dock reads as the same palette
// rather than a competing one; table-detail and about get new, distinct
// hues since no per-category table colors exist yet in this app.
const COLORS = {
  home: { bg: 'rgba(201, 152, 47, 0.14)', border: '#8a6a1f', fg: '#e6bb5c' },
  monsters: { bg: 'var(--accent-dim)', border: 'var(--accent)', fg: 'var(--accent-light)' },
  'monster-detail': { bg: 'var(--accent-dim)', border: 'var(--accent)', fg: 'var(--accent-light)' },
  'room-generator': { bg: 'rgba(71, 191, 255, 0.14)', border: '#1f7ea8', fg: '#47bfff' },
  'locks-traps': { bg: 'rgba(155, 111, 216, 0.14)', border: '#6b4f8a', fg: '#b79bdb' },
  'table-detail': { bg: 'rgba(95, 217, 180, 0.14)', border: '#1f7a63', fg: '#5fd9b4' },
  about: { bg: 'rgba(127, 114, 100, 0.12)', border: 'var(--border)', fg: 'var(--text-faint)' },
}

function dotStyle(entry) {
  const c = COLORS[entry.type] || COLORS['table-detail']
  return { background: c.bg, borderColor: c.border, color: c.fg }
}

// Icons only for "landmark" types — routes with exactly one destination, so
// the icon reliably identifies the entry (House = the one Home page, Lock =
// the one Locks & Traps page, ...). table-detail and monster-detail cover
// dozens of different destinations each; a shared icon there wouldn't tell
// one apart from another, so those fall through to the abbreviate() label
// below instead.
const ICONS = {
  home: House,
  monsters: Skull,
  'room-generator': KeyRound,
  'locks-traps': Lock,
  about: Info,
}

// Two words ("Room Generator", "Locks & Traps") become their initials ("RG",
// "LT"); a single word ("Events", "Goblin") becomes its first two letters
// ("Ev", "Go"). Best-effort by design — it just needs to be a recognizable
// hint, not a full label.
function abbreviate(label) {
  const words = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)

  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }

  const word = words[0] || label
  return word.length >= 2 ? word[0].toUpperCase() + word[1].toLowerCase() : word.toUpperCase()
}
</script>

<template>
  <div v-if="displayHistory.length" class="history-dock-window">
    <div class="history-dock-inner" :class="{ 'is-hidden': isDockHidden }">
      <button
        type="button"
        class="history-toggle"
        @click="isDockHidden = !isDockHidden"
        :aria-label="isDockHidden ? 'Show recent history' : 'Hide recent history'"
        :title="isDockHidden ? 'Show recent history' : 'Hide recent history'"
      >
        <ChevronUp v-if="isDockHidden" :size="14" :stroke-width="2.5" />
        <ChevronDown v-else :size="14" :stroke-width="2.5" />
      </button>

      <TransitionGroup tag="nav" name="history-dot" class="history-dock" aria-label="Recently visited">
        <router-link
          v-for="entry in visibleHistory"
          :key="entry.path"
          :to="entry.path"
          class="history-dot"
          :class="{ current: entry.path === route.path }"
          :style="dotStyle(entry)"
          :aria-label="entry.label"
          @mouseenter="showTooltip($event, entry)"
          @mouseleave="hideTooltip"
          @focus="showTooltip($event, entry)"
          @blur="hideTooltip"
        >
          <component :is="ICONS[entry.type]" v-if="ICONS[entry.type]" :size="15" :stroke-width="2" />
          <template v-else>{{ abbreviate(entry.label) }}</template>
        </router-link>
      </TransitionGroup>
    </div>

    <Teleport to="body">
      <div v-if="tooltip" class="history-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
        {{ tooltip.label }}
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Fixed to the viewport, not `.layout` — `.layout` has no transform/filter,
   so this still anchors to the screen's bottom-center regardless of sidebar
   widths or scroll position. z-index 12 sits below the mobile menu buttons
   (20) and open sidebars (15), so it never fights with them for clicks.

   This is a fixed-size window (height set below to match .history-toggle +
   .history-dock's own natural height exactly) with overflow: hidden —
   .history-dock-inner (toggle + dock together) normally sits fully inside
   it; toggling adds .is-hidden to that inner block, which sends it sliding
   straight down by transform. That's the whole mechanism: no property that
   affects layout ever changes here, only `transform` on .history-dock-inner
   (see .is-hidden below), so the browser never has to recompute page layout
   on any frame of the animation — earlier attempts that animated
   max-height/padding/margin instead were flashing the browser's real
   scrollbar for the transition's duration, apparently as an engine-level
   side effect of animating layout-affecting properties at all, even though
   nothing ever actually overflowed by any measurement. Because the window's
   own height never changes, this also sidesteps the *other* bug an earlier
   pure-transform attempt had: the toggle tab always stayed exactly where it
   started, which meant collapsing left a dead gap between the tab and the
   real screen edge (nothing was shrinking to pull it down). Sliding the
   toggle+dock as ONE rigid block, by exactly the dock's own height, fixes
   that: the tab lands precisely where the dock's own top used to be, i.e.
   the window's own bottom edge, i.e. flush with the real screen edge — see
   the exact math in .history-dock-inner.is-hidden below. */
.history-dock-window {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  z-index: 12;
  /* toggle (1.05rem) + dock (padding 0.4rem×2 + border 1px×2 + dot 2.3rem
     ≈ 3.225rem) + the dock's own bottom margin (1.1rem), minus the 1px the
     toggle and dock overlap by. Mobile's numbers differ (smaller dot,
     smaller margin) — see the media query below. */
  height: 5.31rem;
  overflow: hidden;
}

.history-dock-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 0.28s ease;
}

/* Slides toggle+dock down together by exactly the dock's own height plus
   its bottom margin (4.26rem = 3.225rem dock + 1.1rem margin, minus the 1px
   overlap) — not the window's full height. That distance is precisely how
   far the toggle has to travel to go from "sitting above the dock" to
   "sitting at the window's own bottom edge" (since that's where the dock's
   own top used to be), while the dock itself, having started 1.05rem lower
   than the toggle, ends up 4.26rem below THAT — fully past the window's
   bottom edge, clipped by its overflow: hidden. */
.history-dock-inner.is-hidden {
  transform: translateY(4.26rem);
}

/* Small pull-tab, overlapping the dock's top edge by 1px so there's no
   visible seam between the two backgrounds. */
.history-toggle {
  width: 2.4rem;
  height: 1.05rem;
  margin-bottom: -1px;
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: rgba(27, 22, 19, 0.85);
  backdrop-filter: blur(6px);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.12s ease;
}

.history-toggle:hover {
  color: var(--text);
}

/* Back to a plain, static box — no transition of its own at all. Visibility
   is entirely the .history-dock-window/.history-dock-inner mechanism
   above; this element never needs to know it's being hidden. */
.history-dock {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  /* Replaces the old fixed `bottom: 1.1rem` — now the offset from the
     screen edge instead of from the viewport directly, since positioning
     moved to .history-dock-window above. */
  margin-bottom: 1.1rem;
  border: 1px solid var(--border);
  max-width: calc(100vw - 1.5rem);
  /* overflow-x not `auto` — with a hard cap of 10 entries (6 on mobile,
     see the media query below) the dock never actually needs to scroll,
     and `auto` was the culprit behind a transient scrollbar: the enter
     animation's translateX momentarily paints the incoming dot a few px
     past the container's right edge, which was enough for the browser to
     compute a bigger scrollable area and flash a scrollbar for the
     transition's duration. `hidden` clips that overshoot instead.
     overflow-y stays `visible` so the hover-lift transform below (and the
     .current ring's box-shadow) can poke up above the pill without being
     clipped — .history-dock-window above has enough headroom reserved for
     exactly that, being sized off the toggle tab's height too, not just
     the dock's own. */
  overflow-x: hidden;
  overflow-y: visible;
  padding: 0.4rem;
  background: rgba(27, 22, 19, 0.85);
  border-radius: 999px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
}

.history-dot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.3rem;
  height: 2.3rem;
  border: 1px solid;
  border-radius: 50%;
  text-decoration: none;
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  user-select: none;
  transition:
    transform 0.12s ease,
    border-color 0.12s ease;
}

.history-dot:hover {
  transform: translateY(-3px);
}

/* Ring (not a filled swap) so it reads as "you're here" without hiding the
   dot's own type color. */
.history-dot.current {
  box-shadow:
    0 0 0 2px var(--bg),
    0 0 0 3px currentColor;
}

/* A revisit moves an entry back to the front (see lib/history.js) rather
   than duplicating it, so most updates are really a reorder, not an
   add/remove — this is what makes that reorder glide instead of snap.
   Vue applies -move automatically to every entry whose position changed. */
.history-dot-move {
  transition: transform 0.28s ease;
}

/* New entry (a fresh page, or the 11th visit bumping the list) arrives from
   the right, since that's where "now" lives on this oldest-to-newest
   timeline. */
.history-dot-enter-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.history-dot-enter-from {
  opacity: 0;
  transform: translateX(14px);
}

/* The oldest entry falling off the 10-item cap leaves toward the left,
   away from "now". Taken out of flow while animating (the standard
   TransitionGroup pattern) so the remaining dots can slide into its old
   spot via -move instead of snapping over once it's gone. */
.history-dot-leave-active {
  position: absolute;
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.history-dot-leave-to {
  opacity: 0;
  transform: translateX(-14px);
}

/* Teleported to <body> (see the template and the `tooltip` ref's comment in
   <script setup>), so this is positioned in true viewport coordinates —
   `left`/`top` are set inline from the hovered dot's own getBoundingClientRect,
   and the transform below just re-centers/lifts the box relative to that
   point, the same job `translateX(-50%)` + `bottom: 100%` would do for a
   normal in-place absolute tooltip. */
.history-tooltip {
  position: fixed;
  transform: translate(-50%, calc(-100% - 10px));
  z-index: 30;
  max-width: 260px;
  padding: 0.35rem 0.6rem;
  background: rgba(20, 16, 14, 0.95);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.3;
  letter-spacing: normal;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}

@media (max-width: 860px) {
  .history-dock-window {
    /* toggle (1.05rem) + smaller mobile dock (padding 0.4rem×2 + border
       1px×2 + 2.05rem dot ≈ 2.975rem) + margin (0.75rem), minus the 1px
       overlap — see the base rule's comment for the full reasoning. */
    height: 4.66rem;
  }

  .history-dock-inner.is-hidden {
    /* Mobile dock height (2.975rem) + margin (0.75rem), minus the 1px
       overlap — see the base .is-hidden rule for the reasoning. */
    transform: translateY(3.61rem);
  }

  .history-dock {
    margin-bottom: 0.75rem;
    gap: 0.4rem;
  }

  .history-dot {
    width: 2.05rem;
    height: 2.05rem;
    font-size: 0.66rem;
  }

  /* Full history still holds up to 10 entries (and still feeds Save/Load
     game) — visibleHistory in the script above is what actually narrows
     what's rendered on a small screen, where 10 dots would crowd or force
     horizontal scrolling; nothing left to do here in CSS. */
}
</style>
