// Persisted party/character level, entered once on the Home page and used
// on a monster's page to highlight which of its Level Adaptation tiers
// (min_level 5, 10, ...) currently apply. Module-scoped ref acts as a tiny
// singleton, same pattern as starred.js.
import { ref, watch } from 'vue'

const STORAGE_KEY = 'kn-character-level'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const n = raw ? Number(raw) : 1
    return Number.isFinite(n) && n > 0 ? n : 1
  } catch {
    return 1
  }
}

export const characterLevel = ref(load())

watch(characterLevel, (value) => {
  try {
    const n = Number(value)
    localStorage.setItem(STORAGE_KEY, String(Number.isFinite(n) && n > 0 ? n : 1))
  } catch {
    // Ignore write failures (quota, private mode, etc.).
  }
})

// --- Experience Points (page 62: "In order to level up, you must accrue a
// total of 1,000 Experience Points") — a plain running total, no fixed cap.
// This app doesn't auto-level on reaching 1,000: picking a Leveling Up
// benefit is a player decision, so Level and Experience are tracked as two
// independent numbers here rather than one deriving the other. ---
const EXPERIENCE_STORAGE_KEY = 'kn-character-experience'

function loadExperience() {
  try {
    const raw = localStorage.getItem(EXPERIENCE_STORAGE_KEY)
    const n = raw === null ? 0 : Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

export const experience = ref(loadExperience())

watch(experience, (value) => {
  try {
    localStorage.setItem(EXPERIENCE_STORAGE_KEY, String(Math.max(0, value)))
  } catch {
    // Ignore write failures (quota, private mode, etc.).
  }
})

// Quick +/- for Experience — clamped at 0 (page 62 never has a "spend XP"
// mechanic, so it only ever goes up in play, but a stray -50 shouldn't be
// able to go negative from a bookkeeping slip).
export function adjustExperience(delta) {
  experience.value = Math.max(0, experience.value + delta)
}

// --- Character Name — free text, entered on the Home page. Used only for
// labeling (e.g. the default save-game filename); has no rules meaning. ---
const NAME_STORAGE_KEY = 'kn-character-name'

function loadCharacterName() {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export const characterName = ref(loadCharacterName())

watch(characterName, (value) => {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, value || '')
  } catch {
    // Ignore write failures (quota, private mode, etc.).
  }
})
