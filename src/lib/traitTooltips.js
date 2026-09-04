// Descriptions for the formal Trait glossary (rulebook p.132-133, "CREATURE
// TRAITS"). Monster TRAIT fields also contain free-form phrases that aren't
// in that glossary (e.g. "Elemental Affinity: Fire", "Vulnerable to Cold
// damage") — those are left as plain text since the rulebook never defines
// them as a named, reusable Trait.
export const TRAIT_DESCRIPTIONS = {
  Alert:
    'This creature cannot be surprised in any way. This Trait supersedes any Ability, gear or effects that may allow PCs to always surprise their opponents.',
  Frightening:
    'A Frightening creature requires a successful Resolve check at the start of combat. Failure causes the loss of 2 Sanity. When Frightening creatures come in groups, you must only make a single Resolve check for the whole group.',
  Horrifying:
    'A Horrifying creature requires a successful Resolve check at the start of combat. Failure causes the loss of 4 Sanity. When Horrifying creatures come in groups, you must only make a single Resolve check for the whole group.',
  Pack: 'The creature receives +5 Combat Skill for each other similar Pack creature still alive in the room.',
  Penetrating: "This creature's attacks ignore an amount of Armor points equal to the (X) value.",
  Ruthlessness:
    'This Trait grants the creature a number of additional turns per round equal to the (X) value. When affected by conditions that cause the loss of actions (such as Paralyzed, or Stunned), the creature loses a turn per stack of the condition in question. For example, a creature with Ruthlessness (2) acts a total of 3 times during the same turn; if this creature were to receive the Stunned (2) condition, it would reduce the number of actions by 2, meaning the creature would still act once during their turn, and immediately after lose the Stunned condition (since it would be already spent).',
  Savage:
    "Characters cannot Parry (i.e. use their weapon Skill) the creature's attacks, they can only use their Dodge Skill to avoid them.",
  Swift: 'The creature ignores all Reaction negative modifiers.',
  Venomous:
    'When damaged by this creature you must pass an Endurance check or receive the Poisoned (1) condition. Venomous only triggers with a successful hit.',
}

const NAMES = Object.keys(TRAIT_DESCRIPTIONS).sort((a, b) => b.length - a.length)

function isWordChar(ch) {
  return !!ch && /[A-Za-z0-9]/.test(ch)
}

// Splits a TRAIT string into {text, tooltip?} segments: plain text runs,
// and runs that exactly match a glossary trait name (word-boundary safe)
// carrying its description as `tooltip`. Other phrases in the field (not
// in the glossary) are left as plain text untouched.
export function traitSegments(text) {
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
    segments.push({ text: bestName, tooltip: TRAIT_DESCRIPTIONS[bestName] })
    pos = bestIdx + bestName.length
  }
  return segments
}
