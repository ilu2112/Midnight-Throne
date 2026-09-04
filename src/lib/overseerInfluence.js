// Persisted "current Overseer Influence" selection — rolled once per
// Domain (rulebook page 100) and applied to every creature within it,
// EXCEPT the Overseer itself (page 98: "An Overseer is not affected by its
// own influence"). Picked once on the Home page and used on a monster's
// page to show how it currently affects that monster. Module-scoped ref
// acts as a tiny singleton, same pattern as characterLevel.js.
import { ref, watch } from 'vue'

const STORAGE_KEY = 'kn-overseer-influence'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null
  } catch {
    return null
  }
}

export const overseerInfluence = ref(load())

watch(overseerInfluence, (value) => {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, String(value))
    }
  } catch {
    // Ignore write failures (quota, private mode, etc.).
  }
})

// The Overseer Influence table packs a short name and its effect into one
// string ("Tough: Immune to Critical Strikes.") — split on the first colon
// so both the Home dropdown and the monster page can show the name and
// effect separately.
export function parseInfluence(text) {
  if (!text) return null
  const idx = text.indexOf(':')
  if (idx === -1) return { name: text.trim(), effect: '' }
  return { name: text.slice(0, idx).trim(), effect: text.slice(idx + 1).trim() }
}

// "Resistant" (page 100) says to roll on the Damage Type table to find out
// which type — that roll isn't something this app can usefully randomize
// for you (it's a one-time-per-Domain result you'd want to keep), so it's
// picked once on Home instead and remembered here the same way.
const RESISTANT_STORAGE_KEY = 'kn-overseer-resistant-damage-type'

function loadResistantType() {
  try {
    return localStorage.getItem(RESISTANT_STORAGE_KEY) || null
  } catch {
    return null
  }
}

export const resistantDamageType = ref(loadResistantType())

watch(resistantDamageType, (value) => {
  try {
    if (!value) {
      localStorage.removeItem(RESISTANT_STORAGE_KEY)
    } else {
      localStorage.setItem(RESISTANT_STORAGE_KEY, value)
    }
  } catch {
    // Ignore write failures (quota, private mode, etc.).
  }
})
