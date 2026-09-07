// Auto-tracked "recently visited" history for the floating history dock —
// unlike starred.js, this is never edited by hand: router/index.js calls
// recordVisit() after every navigation, and the dock (components/HistoryDock.vue)
// just renders whatever ends up in here. Same singleton-ref-plus-localStorage
// pattern as starred.js, one shared store for the whole app.
import { ref, watch } from 'vue'

const STORAGE_KEY = 'kn-recent-history'
const MAX_ENTRIES = 10

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter(
          (e) => e && typeof e.path === 'string' && typeof e.type === 'string' && typeof e.label === 'string',
        )
      : []
  } catch {
    // Private-browsing mode, corrupted value, storage disabled, etc. — just
    // start empty rather than breaking the page.
    return []
  }
}

export const recentHistory = ref(load())

watch(
  recentHistory,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Ignore write failures (quota, private mode, etc.) — history just
      // won't persist across reloads in that case.
    }
  },
  { deep: true },
)

// Records a visit to `entry` ({ path, type, label }), most-recent-first.
// Revisiting a path that's already in the list moves it back to the front
// instead of adding a duplicate, and the list is capped at MAX_ENTRIES,
// dropping the oldest entry once full.
export function recordVisit(entry) {
  const withoutExisting = recentHistory.value.filter((e) => e.path !== entry.path)
  recentHistory.value = [entry, ...withoutExisting].slice(0, MAX_ENTRIES)
}

// Whether the dock (components/HistoryDock.vue) is collapsed via its
// toggle tab — a UI preference, not history data, but persisted the same
// way so it survives a reload instead of always starting back open.
const HIDDEN_STORAGE_KEY = 'kn-history-dock-hidden'

function loadHidden() {
  try {
    return localStorage.getItem(HIDDEN_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export const isDockHidden = ref(loadHidden())

watch(isDockHidden, (value) => {
  try {
    localStorage.setItem(HIDDEN_STORAGE_KEY, String(value))
  } catch {
    // Ignore write failures — the preference just won't persist.
  }
})
