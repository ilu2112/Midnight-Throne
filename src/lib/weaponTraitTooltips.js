// Highlights weapon trait names (Quick, Parrying, Two-Handed, ...) inside
// the Weapons table's NOTES column with a hover tooltip explaining what
// that trait does — sourced directly from the Weapon Traits table's own
// EFFECT column, so there's one source of truth.
import { findTable } from '../registry'

function buildDescriptions() {
  const table = findTable('weapon_traits')
  const map = {}
  if (table) {
    for (const row of table.rows) {
      const name = row['TRAIT']
      const effect = row['EFFECT']
      if (name && effect) map[name] = effect
    }
  }
  return map
}

export const WEAPON_TRAIT_DESCRIPTIONS = buildDescriptions()

const NAMES = Object.keys(WEAPON_TRAIT_DESCRIPTIONS).sort((a, b) => b.length - a.length)

function isWordChar(ch) {
  return !!ch && /[A-Za-z0-9]/.test(ch)
}

// Splits `text` into {text, tooltip?} segments: plain text runs, and runs
// that exactly match a weapon trait name (word-boundary safe) carrying its
// effect as `tooltip`.
export function weaponTraitSegments(text) {
  if (!text) return [{ text: text ?? '' }]
  const segments = []
  let pos = 0
  while (pos < text.length) {
    let bestIdx = -1
    let bestName = null
    for (const name of NAMES) {
      const idx = text.indexOf(name, pos)
      if (idx === -1) continue
      const before = text[idx - 1]
      const after = text[idx + name.length]
      if (isWordChar(before) || isWordChar(after)) continue
      if (bestIdx === -1 || idx < bestIdx) {
        bestIdx = idx
        bestName = name
      }
    }
    if (bestIdx === -1) {
      segments.push({ text: text.slice(pos) })
      break
    }
    if (bestIdx > pos) segments.push({ text: text.slice(pos, bestIdx) })
    segments.push({ text: bestName, tooltip: WEAPON_TRAIT_DESCRIPTIONS[bestName] })
    pos = bestIdx + bestName.length
  }
  return segments
}
