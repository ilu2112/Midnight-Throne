// App-wide feature toggles, editable from the About & Settings page
// (views/AboutView.vue). Persisted the same way every other per-viewer
// preference in this app is — a single `kn-` prefixed localStorage key —
// which lib/saveGame.js's save/load already picks up automatically (it
// scans for that prefix rather than a fixed list of keys), so this needs no
// dedicated wiring there to end up in a downloaded save file.
import { ref, watch } from 'vue'

const SETTINGS_STORAGE_KEY = 'kn-settings'

// highlightRolls and secondD100Enabled are both documented (in the Settings
// UI) as only doing anything while topDockEnabled is also on — the top dock
// is what actually produces the rolls either of them react to. They're
// still stored as their own independent flags rather than being folded into
// topDockEnabled or reset when it's turned off, the same way a CharacterPanel
// section remembers its own collapsed state even while the whole panel is
// hidden: turning the top dock back on later should restore whatever these
// were set to, not silently reappear at some hardcoded default.
const DEFAULTS = {
  topDockEnabled: true,
  highlightRolls: true,
  secondD100Enabled: true,
  bottomDockEnabled: true,
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    // Merge over the defaults (rather than trusting the stored object
    // outright) so a save made before some setting existed still gets a
    // sane value for it, instead of undefined.
    return { ...DEFAULTS, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
  } catch {
    return { ...DEFAULTS }
  }
}

export const settings = ref(loadSettings())

watch(
  settings,
  (value) => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Ignore write failures (quota, private mode, etc.) — the change
      // just won't survive a reload in that case.
    }
  },
  { deep: true },
)
