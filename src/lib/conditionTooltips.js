// Descriptions for the CONDITIONS glossary (rulebook p.87-89: Bleeding,
// Blinded, Burning, Charmed, Concealed, Cursed, Dazed, Freezing,
// Frightened, Paralyzed, Poisoned, Prone, Restrained, Sickened, Sleeping,
// Stunned). Surfaced as hover tooltips anywhere a condition name shows up,
// mirroring the Trait/Damage Type/Weapon Trait tooltip pattern — see
// traitTooltips.js, damageTypeTooltips.js and weaponTraitTooltips.js.
import { findTable } from '../registry'

const conditionsTable = findTable('conditions')

export const CONDITION_DESCRIPTIONS = Object.fromEntries(
  (conditionsTable?.rows || []).map((r) => [r.CONDITION, r.EFFECT]),
)

const NAMES = Object.keys(CONDITION_DESCRIPTIONS).sort((a, b) => b.length - a.length)

function isWordChar(ch) {
  return !!ch && /[A-Za-z0-9]/.test(ch)
}

// Splits plain text into {text, tooltip?} segments wherever a Condition
// name appears (word-boundary safe, longest match first).
export function conditionSegments(text) {
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
    segments.push({ text: bestName, tooltip: CONDITION_DESCRIPTIONS[bestName] })
    pos = bestIdx + bestName.length
  }
  return segments
}

// Layers condition tooltips on top of segments already produced by another
// segmenter (link / damage-type / weapon-trait / trait), by further
// splitting only the still-plain-text runs — a segment that already has a
// `.to` link or a `.tooltip` from something else is left untouched, so
// nothing gets double-wrapped.
export function withConditionTooltips(segments) {
  const out = []
  for (const seg of segments) {
    if (seg.to || seg.tooltip) {
      out.push(seg)
    } else {
      out.push(...conditionSegments(seg.text))
    }
  }
  return out
}
