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
