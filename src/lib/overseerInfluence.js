// Persisted "current Overseer Influence" selection(s) — rolled once per
// Domain (rulebook page 100) and applied to every creature within it,
// EXCEPT the Overseer itself (page 98: "An Overseer is not affected by its
// own influence"). Picked on the Home page and used on a monster's page to
// show how it currently affects that monster.
//
// A Domain isn't limited to a single Influence over its lifetime — nothing
// in the rules says a second (or third) roll can't land on the same result
// twice — so this is a LIST of independent selections rather than one
// value: each entry is its own d10 pick, with its own "Resistant" damage
// type roll if that's what it landed on (two separate Resistant results can
// resolve to two different damage types). Module-scoped ref acts as a tiny
// singleton, same pattern as characterLevel.js.
import { ref, watch } from 'vue'

const STORAGE_KEY = 'kn-overseer-influences'

// Pre-list-support keys, migrated into the new array shape below and then
// removed so they don't linger as dead state.
const LEGACY_D10_KEY = 'kn-overseer-influence'
const LEGACY_RESISTANT_KEY = 'kn-overseer-resistant-damage-type'

function isValidEntry(e) {
  return e && typeof e === 'object' && Number.isFinite(e.d10) && e.d10 >= 1 && e.d10 <= 10
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
          .filter(isValidEntry)
          .map((e) => ({ d10: e.d10, resistantDamageType: e.resistantDamageType || null }))
      }
    }
  } catch {
    // Fall through to legacy migration / empty state.
  }

  // Migrate a pre-existing single-value save into a one-entry list.
  try {
    const legacyRaw = localStorage.getItem(LEGACY_D10_KEY)
    const legacyN = Number(legacyRaw)
    if (legacyRaw && Number.isFinite(legacyN) && legacyN >= 1 && legacyN <= 10) {
      const migrated = [{ d10: legacyN, resistantDamageType: localStorage.getItem(LEGACY_RESISTANT_KEY) || null }]
      localStorage.removeItem(LEGACY_D10_KEY)
      localStorage.removeItem(LEGACY_RESISTANT_KEY)
      return migrated
    }
  } catch {
    // Ignore — start empty below.
  }

  return []
}

export const overseerInfluences = ref(load())

watch(
  overseerInfluences,
  (value) => {
    try {
      if (!value.length) {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      }
    } catch {
      // Ignore write failures (quota, private mode, etc.).
    }
  },
  { deep: true },
)

// Appends a new, not-yet-picked entry for the Home page's "Add next" button
// to render as another row.
export function addOverseerInfluence() {
  overseerInfluences.value = [...overseerInfluences.value, { d10: null, resistantDamageType: null }]
}

export function removeOverseerInfluence(index) {
  overseerInfluences.value = overseerInfluences.value.filter((_, i) => i !== index)
}

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
