// Shared "starred" state, one small store per collection (tables,
// monsters), each persisted to its own localStorage key. Module-scoped
// refs act as tiny singletons — every component that imports a given
// store reads and writes the same reactive state.
import { ref, watch } from 'vue'

function load(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : []
  } catch {
    // Private-browsing mode, corrupted value, storage disabled, etc. — just
    // start empty rather than breaking the page.
    return []
  }
}

function createStarredStore(storageKey) {
  const slugs = ref(load(storageKey))

  watch(
    slugs,
    (value) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value))
      } catch {
        // Ignore write failures (quota, private mode, etc.) — starring just
        // won't persist across reloads in that case.
      }
    },
    { deep: true },
  )

  function isStarred(slug) {
    return slugs.value.includes(slug)
  }

  function toggleStar(slug) {
    const idx = slugs.value.indexOf(slug)
    if (idx === -1) {
      slugs.value = [...slugs.value, slug]
    } else {
      slugs.value = slugs.value.filter((s) => s !== slug)
    }
  }

  return { slugs, isStarred, toggleStar }
}

export const starredTables = createStarredStore('kn-starred-tables')
export const starredMonsters = createStarredStore('kn-starred-monsters')
