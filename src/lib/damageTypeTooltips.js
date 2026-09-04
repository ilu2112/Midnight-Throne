// Highlights damage-type names (Acid, Necrotic, Slashing, ...) inside a
// monster's action text with a hover tooltip explaining what that damage
// type actually does mechanically — sourced directly from the Damage Type
// table's own DESCRIPTION column, so there's one source of truth and this
// stays in sync if that table is ever edited.
import { findTable } from '../registry'

function buildDescriptions() {
  const table = findTable('damage_type')
  const map = {}
  if (table) {
    for (const row of table.rows) {
      const name = row['DAMAGE TYPE']
      const desc = row['DESCRIPTION']
      if (name && desc) map[name] = desc
    }
  }
  return map
}

export const DAMAGE_TYPE_DESCRIPTIONS = buildDescriptions()

const NAMES = Object.keys(DAMAGE_TYPE_DESCRIPTIONS).sort((a, b) => b.length - a.length)

function isWordChar(ch) {
  return !!ch && /[A-Za-z0-9]/.test(ch)
}

// Splits `text` into {text, tooltip?} segments: plain text runs, and runs
// that exactly match a damage type name (word-boundary safe) carrying its
// mechanical description as `tooltip`.
export function damageTypeSegments(text) {
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
    segments.push({ text: bestName, tooltip: DAMAGE_TYPE_DESCRIPTIONS[bestName] })
    pos = bestIdx + bestName.length
  }
  return segments
}

// A monster action's free-form prose (its D6_ACTIONS / ACTION text) reuses
// damage-type words in ways damageTypeSegments' bare word-match can't tell
// apart from an actual mechanical mention: a flavor title ("Infernal Claw",
// "Necrotic Burst", "Cursed Slash"), or the monster's own name recurring
// mid-description ("The Infernal Archon calls upon its mastery of fire...",
// "the Netherfiend's Infernal Mark"). What every genuine mention shares,
// throughout the rulebook's own text, is the phrase "<Type> damage" — so
// this only tags a name when "damage" actually follows it, optionally after
// an Oxford-comma list of other type names ("Resistant to Bludgeoning,
// Piercing, and Slashing damage" still tags all three, not just the last).
const DAMAGE_SUFFIX = /^(?:,\s*(?:and\s+)?[A-Za-z]+){0,4}\s+damage\b/

function hasDamageSuffix(text, afterIdx) {
  return DAMAGE_SUFFIX.test(text.slice(afterIdx, afterIdx + 200))
}

export function damageTypeProseSegments(text) {
  if (!text) return [{ text: text ?? '' }]
  const segments = []
  let pos = 0
  while (pos < text.length) {
    let bestIdx = -1
    let bestName = null
    for (const name of NAMES) {
      let searchFrom = pos
      let idx = -1
      for (;;) {
        const found = text.indexOf(name, searchFrom)
        if (found === -1) break
        const before = text[found - 1]
        const after = text[found + name.length]
        if (!isWordChar(before) && !isWordChar(after) && hasDamageSuffix(text, found + name.length)) {
          idx = found
          break
        }
        searchFrom = found + 1
      }
      if (idx === -1) continue
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
    segments.push({ text: bestName, tooltip: DAMAGE_TYPE_DESCRIPTIONS[bestName] })
    pos = bestIdx + bestName.length
  }
  return segments
}
