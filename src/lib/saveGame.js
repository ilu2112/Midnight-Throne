// "Save game" — dumps every piece of the app's persisted state (all
// localStorage keys under the shared `kn-` prefix — see characterLevel.js,
// characterSheet.js, overseerInfluence.js, starred.js, and the per-view
// `kn-*-state` keys) into a single downloadable JSON file, and can load one
// of those files back in.
//
// This intentionally scans by prefix rather than listing keys by name, so a
// future `kn-` key doesn't need this file updated to be included in saves.

const KEY_PREFIX = 'kn-'
const SAVE_FORMAT = 'midnight-throne-save'
const SAVE_VERSION = 1

// --- Collecting current state -------------------------------------------

export function collectSaveData() {
  const data = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(KEY_PREFIX)) {
        data[key] = localStorage.getItem(key)
      }
    }
  } catch {
    // Ignore read failures (private mode, etc.) — data may end up empty.
  }
  return data
}

// --- Filename -------------------------------------------------------------

function slugify(name) {
  const slug = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'character'
}

function todayStamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function saveFileName(characterName) {
  return `${slugify(characterName)}-${todayStamp()}.json`
}

// --- Download ---------------------------------------------------------------

export function downloadSave(characterName) {
  const payload = {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    characterName: characterName || '',
    savedAt: new Date().toISOString(),
    data: collectSaveData(),
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = saveFileName(characterName)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// --- Load -------------------------------------------------------------------

// Reads a File (from an <input type="file"> or drop), validates its shape,
// and — if valid — replaces every existing `kn-` localStorage key with the
// ones from the save. Returns { ok: true } or { ok: false, error }. Never
// throws. Applying the imported state to the running app is the caller's
// job (a full page reload is the simplest way, since most persisted state
// lives in module-scoped refs that only read localStorage once at import).
export function loadSaveFromFile(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ ok: false, error: 'No file selected.' })
      return
    }

    const reader = new FileReader()
    reader.onerror = () => resolve({ ok: false, error: 'Could not read the file.' })
    reader.onload = () => {
      let parsed
      try {
        parsed = JSON.parse(String(reader.result))
      } catch {
        resolve({ ok: false, error: 'That file is not valid JSON.' })
        return
      }

      if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
        resolve({ ok: false, error: 'That file does not look like a Ker Nethalas save.' })
        return
      }

      try {
        // Clear existing kn- keys first, so a save made before some key
        // existed doesn't leave that key's old value behind.
        const toRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith(KEY_PREFIX)) toRemove.push(key)
        }
        toRemove.forEach((key) => localStorage.removeItem(key))

        for (const [key, value] of Object.entries(parsed.data)) {
          if (key.startsWith(KEY_PREFIX) && typeof value === 'string') {
            localStorage.setItem(key, value)
          }
        }
      } catch {
        resolve({ ok: false, error: 'Could not write the save to storage (browser storage may be full or unavailable).' })
        return
      }

      resolve({ ok: true })
    }
    reader.readAsText(file)
  })
}
