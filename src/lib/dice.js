// Backing store for the floating dice-roller dock (components/DiceDock.vue),
// mounted at the top of the screen — a sibling feature to the "recently
// visited" history dock (lib/history.js) at the bottom, but simpler: there's
// no list to grow or dedupe, just one current result per die size plus
// whether a roll is currently animating.
import { ref, watch } from 'vue'

// The standard polyhedral set, in the order players expect to see them
// together — smallest to largest, not alphabetical or insertion order.
export const DIE_SIZES = [4, 6, 8, 10, 12, 20, 100]

// A second, independent D100 roll, displayed stacked below the primary D100
// result in DiceDock.vue rather than replacing it — some checks (e.g. a
// percentile roll that also wants a damage-multiplier or a second target)
// want two D100s rolled together. Keyed '100b' (deliberately not a
// DIE_SIZES member, so it doesn't show up as an 8th die slot) so it rides
// along in the same rolled-results object — and the same localStorage
// entry — without needing its own ref, watcher, or storage key to keep in
// sync with the rest of a roll.
export const D100_SECOND_KEY = '100b'

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1
}

function rollAllOnce() {
  const results = {}
  for (const sides of DIE_SIZES) {
    results[sides] = rollDie(sides)
  }
  results[D100_SECOND_KEY] = rollDie(100)
  return results
}

// A "double" — both digits the same (11, 22, ..., 99), or 100 (the
// percentile equivalent of "00", i.e. both digits zero) — called out as a
// critical hit regardless of which of the two D100 rolls it lands on.
export function isCriticalDouble(n) {
  return n === 100 || (n >= 11 && n <= 99 && n % 11 === 0)
}

// Persisted the same way isDiceDockHidden below is — a refresh shouldn't
// silently reroll every die out from under someone who was in the middle of
// reading them off. Falls back to a fresh roll (not all-zero/empty) when
// there's nothing stored yet, or the stored value doesn't parse, so the dock
// still never renders blank on a first visit.
const RESULTS_STORAGE_KEY = 'kn-dice-dock-results'

function loadResults() {
  try {
    const raw = localStorage.getItem(RESULTS_STORAGE_KEY)
    if (!raw) return rollAllOnce()
    const parsed = JSON.parse(raw)
    // Guard against a stale shape (e.g. an older/different DIE_SIZES set, or
    // a save from before the second D100 roll existed) — only trust it if
    // every current die size AND the second D100 slot actually have a
    // numeric entry, otherwise fall back to a fresh roll rather than
    // rendering NaN/undefined.
    if (DIE_SIZES.every((sides) => typeof parsed[sides] === 'number') && typeof parsed[D100_SECOND_KEY] === 'number') {
      return parsed
    }
    return rollAllOnce()
  } catch {
    return rollAllOnce()
  }
}

export const diceResults = ref(loadResults())

watch(
  diceResults,
  (value) => {
    try {
      localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Ignore write failures (quota, private mode, etc.) — the last roll
      // just won't survive a reload in that case.
    }
  },
  // immediate: true so a fresh visit's very first pre-roll (see loadResults'
  // fallback above) gets written on the spot too — otherwise a reload before
  // ever clicking "roll" would still reroll every time, since nothing would
  // have been stored yet to load back.
  { deep: true, immediate: true },
)

// True for the duration of the roll animation — the dock spins each die's
// icon and disables the roll button while this is true, so a second click
// can't stack another roll on top of one already in flight.
export const isRolling = ref(false)

// Matches the dock's longest-running reel animation (see DiceDock.vue's
// SPIN_DURATIONS_MS, which staggers each die to stop in sequence like a
// real slot machine) — kept here, not read from the DOM, so this timeout
// and that animation can never drift out of sync. Shortened from the old
// flicker animation's 1200ms; a slot-reel sells the "rolling" illusion in
// much less time than a flicker did.
export const ROLL_ANIMATION_MS = 650

export function rollAll() {
  if (isRolling.value) return
  // Decided immediately, not after the animation — the reel in DiceDock.vue
  // needs the real result up front so it can build a spin sequence that
  // ends on it, rather than swapping the number in afterwards. isRolling
  // staying true for ROLL_ANIMATION_MS is what actually hides the real
  // value behind the spinning reel in the meantime.
  diceResults.value = rollAllOnce()
  isRolling.value = true
  setTimeout(() => {
    isRolling.value = false
  }, ROLL_ANIMATION_MS)
}

// Whether the dock is collapsed via its toggle tab — a UI preference, not a
// roll result, but persisted the same way history.js's isDockHidden is, so
// it survives a reload instead of always starting back open.
const HIDDEN_STORAGE_KEY = 'kn-dice-dock-hidden'

function loadHidden() {
  try {
    return localStorage.getItem(HIDDEN_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export const isDiceDockHidden = ref(loadHidden())

watch(isDiceDockHidden, (value) => {
  try {
    localStorage.setItem(HIDDEN_STORAGE_KEY, String(value))
  } catch {
    // Ignore write failures — the preference just won't persist.
  }
})
