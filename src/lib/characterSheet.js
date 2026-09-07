// Character sheet quick-reference — the handful of fields from a Ker
// Nethalas character sheet (see ker-nethalas-character-sheet.pdf) that
// change most often during play: the four core stat pools (Health,
// Toughness, Aether, Sanity), Exhaustion, Lightsource, and the Usage Dice
// currently in play (Tension Die, Lair Check, Domain Exit Check, and any
// others the player wants to track). Everything here is a per-viewer
// convenience persisted to localStorage, same pattern as characterLevel.js
// and starred.js.
import { ref, watch } from 'vue'

// --- Core stat pools — current/max pairs. No "correct" starting values
// exist (they're entirely build-dependent), so these are just a neutral
// placeholder the player overwrites with their own character's numbers. ---
export const STAT_KEYS = ['health', 'toughness', 'aether', 'sanity']
const STATS_STORAGE_KEY = 'kn-character-stats'

function defaultStats() {
  return {
    health: { current: 10, max: 10 },
    toughness: { current: 10, max: 10 },
    aether: { current: 10, max: 10 },
    sanity: { current: 10, max: 10 },
  }
}

function loadStats() {
  const stats = defaultStats()
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY)
    if (!raw) return stats
    const parsed = JSON.parse(raw)
    for (const key of STAT_KEYS) {
      const entry = parsed?.[key]
      if (entry && typeof entry === 'object') {
        if (Number.isFinite(entry.current)) stats[key].current = entry.current
        if (Number.isFinite(entry.max)) stats[key].max = entry.max
      }
    }
    return stats
  } catch {
    return stats
  }
}

export const stats = ref(loadStats())

watch(
  stats,
  (value) => {
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Ignore write failures (quota, private mode, etc.).
    }
  },
  { deep: true },
)

// Quick +/- for a stat's current value (the "changes often" side of a
// current/max pair) — clamped at 0, but not clamped at max, in case
// something in play temporarily pushes a pool above its usual ceiling.
export function adjustStatCurrent(key, delta) {
  const stat = stats.value[key]
  if (!stat) return
  stat.current = Math.max(0, stat.current + delta)
}

// --- Exhaustion (page 90: Accumulated Exhaustion) — a single running
// total, no fixed maximum (the table's top bracket, 21+, is lethal rather
// than a hard cap). ---
const EXHAUSTION_STORAGE_KEY = 'kn-character-exhaustion'

function loadExhaustion() {
  try {
    const raw = localStorage.getItem(EXHAUSTION_STORAGE_KEY)
    const n = raw === null ? 0 : Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

export const exhaustion = ref(loadExhaustion())

watch(exhaustion, (value) => {
  try {
    localStorage.setItem(EXHAUSTION_STORAGE_KEY, String(Math.max(0, value)))
  } catch {
    // Ignore write failures (quota, private mode, etc.).
  }
})

export function adjustExhaustion(delta) {
  exhaustion.value = Math.max(0, exhaustion.value + delta)
}

// --- Lightsource (page 96/99: a Torch or Lamp "will remain lit for 20
// rooms", spent once per Room entered — not per Corridor; see the Room
// Generator's own Lightsource reminder). Tracked as current/max so a
// different light source's shorter or longer duration can be entered as
// its max, and "refuel" resets current back up to it. ---
const LIGHTSOURCE_STORAGE_KEY = 'kn-character-lightsource'

function defaultLightsource() {
  return { current: 20, max: 20 }
}

function loadLightsource() {
  const value = defaultLightsource()
  try {
    const raw = localStorage.getItem(LIGHTSOURCE_STORAGE_KEY)
    if (!raw) return value
    const parsed = JSON.parse(raw)
    if (Number.isFinite(parsed?.current)) value.current = parsed.current
    if (Number.isFinite(parsed?.max)) value.max = parsed.max
    return value
  } catch {
    return value
  }
}

export const lightsource = ref(loadLightsource())

watch(
  lightsource,
  (value) => {
    try {
      localStorage.setItem(LIGHTSOURCE_STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Ignore write failures (quota, private mode, etc.).
    }
  },
  { deep: true },
)

export function adjustLightsource(delta) {
  lightsource.value.current = Math.max(0, lightsource.value.current + delta)
}

export function refuelLightsource() {
  lightsource.value.current = lightsource.value.max
}

// --- Usage Dice (page 74: the general Usage Die mechanic — rolling the
// die on a 1-2 steps it down one size, following the chain
// D20→D12→D10→D8→D6→D4; reaching the bottom of a D4 roll of 1-2 triggers
// whatever that specific procedure does). This app doesn't roll dice for
// you (see the Room Generator's own reminders) — it's purely bookkeeping
// for each die's name and current size. ---
export const USAGE_DIE_SIZES = [20, 12, 10, 8, 6, 4]

// The three Usage Dice this app's own Room Generator reminders already
// call out as the ones used during exploration: the Lair Check and Domain
// Exit check (page 96/99, starting at D10 and D8 respectively), plus the
// Tension Die (page 120, which "always starts at D8").
export const DEFAULT_USAGE_DICE = [
  { name: 'Tension Die', size: 8 },
  { name: 'Lair Check', size: 10 },
  { name: 'Domain Exit Check', size: 8 },
]

const USAGE_DICE_STORAGE_KEY = 'kn-character-usage-dice'

let idCounter = 0
function makeId() {
  idCounter += 1
  return `ud-${Date.now()}-${idCounter}`
}

function loadUsageDice() {
  try {
    const raw = localStorage.getItem(USAGE_DICE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((d) => d && typeof d.name === 'string' && USAGE_DIE_SIZES.includes(d.size))
      .map((d) => ({
        id: typeof d.id === 'string' ? d.id : makeId(),
        name: d.name,
        size: d.size,
        // Dice saved before "max" existed just reset to whatever size they
        // were at, at that point.
        max: USAGE_DIE_SIZES.includes(d.max) ? d.max : d.size,
      }))
  } catch {
    return []
  }
}

export const usageDice = ref(loadUsageDice())

watch(
  usageDice,
  (value) => {
    try {
      localStorage.setItem(USAGE_DICE_STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Ignore write failures (quota, private mode, etc.).
    }
  },
  { deep: true },
)

export function addUsageDie(name = 'New Usage Die', size = 8) {
  const validSize = USAGE_DIE_SIZES.includes(size) ? size : 8
  const die = { id: makeId(), name, size: validSize, max: validSize }
  usageDice.value = [...usageDice.value, die]
  return die
}

export function removeUsageDie(id) {
  usageDice.value = usageDice.value.filter((d) => d.id !== id)
}

// direction 1 = step down (toward D4, matching a roll of 1-2); -1 = step
// up (manual correction). Stepping down again once already at D4 is the
// procedure "triggering" (page 74) — rather than doing nothing, it resets
// the die back to its own max, same as the Tension Die resetting to D8.
export function stepUsageDie(id, direction) {
  const die = usageDice.value.find((d) => d.id === id)
  if (!die) return
  const idx = USAGE_DIE_SIZES.indexOf(die.size)
  if (direction > 0 && idx === USAGE_DIE_SIZES.length - 1) {
    die.size = die.max
    return
  }
  const nextIdx = idx + direction
  if (nextIdx < 0 || nextIdx >= USAGE_DIE_SIZES.length) return
  // Stepping up (direction -1) can never make the die bigger than its own
  // configured max — Max is a ceiling, not just where "reset" lands.
  const maxIdx = USAGE_DIE_SIZES.indexOf(die.max)
  if (direction < 0 && nextIdx < maxIdx) return
  die.size = USAGE_DIE_SIZES[nextIdx]
}

// Removes any existing dice with the same names as the defaults (so
// re-clicking doesn't pile up duplicates), then adds fresh full-size ones
// at the top of the list, ahead of whatever custom dice remain.
export function addDefaultUsageDice() {
  const defaultNames = new Set(DEFAULT_USAGE_DICE.map((d) => d.name))
  const remaining = usageDice.value.filter((d) => !defaultNames.has(d.name))
  const fresh = DEFAULT_USAGE_DICE.map((d) => ({ id: makeId(), name: d.name, size: d.size, max: d.size }))
  usageDice.value = [...fresh, ...remaining]
}
