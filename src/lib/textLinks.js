// Cross-reference linking shared by TableView and MonsterDetailView: any
// text whose content names a monster from the bestiary, or reads like
// "Roll on the X table", becomes a link — wherever in the string it
// appears, not just when it's the whole value. A few source phrases don't
// spell out the exact table title, so they're aliased explicitly.
import { tables, monsters } from '../registry'

export const TABLE_REFERENCE_ALIASES = {
  'Combat Encounters table': 'combat_encounters_general',
  'Combat Encounter table': 'combat_encounters_general',
  'Combat Encounters - Table A': 'combat_encounters_table_a',
  'Combat Encounters - Table B': 'combat_encounters_table_b',
  'Gems & Jewelry': 'gems_jewelry',
  'Random Weapon': 'random_weapon',
  'Random Armor': 'random_armor',
  'Random Mastery': 'random_mastery',
  'Random Potion': 'potions',
  'Lore Books': 'lore_books',
  'Lore Book': 'lore_books',
  'Valuable table': 'valuable_items',
  'Precious table': 'precious_items',
  Fragment: 'fragments',
  'Magic Item': 'magic_item_type',
}

// Longest phrase wins ties so a specific match (e.g. "Random Weapon table")
// is preferred over a shorter alias starting at the same position.
export const referenceEntries = [
  ...tables.map((t) => ({ phrase: `${t.title} table`, to: `/table/${t.slug}`, kind: 'table', slug: t.slug })),
  ...Object.entries(TABLE_REFERENCE_ALIASES).map(([phrase, slug]) => ({
    phrase,
    to: `/table/${slug}`,
    kind: 'table',
    slug,
  })),
  ...monsters.map((m) => ({ phrase: m.name, to: `/monsters/${m.slug}`, kind: 'monster', slug: m.slug })),
].sort((a, b) => b.phrase.length - a.phrase.length)

function findReferenceFrom(text, fromIndex, lowerText, excludeSlug) {
  let bestIdx = -1
  let bestEntry = null
  for (const entry of referenceEntries) {
    // A table never links to itself.
    if (entry.kind === 'table' && excludeSlug && entry.slug === excludeSlug) continue
    const idx = lowerText.indexOf(entry.phrase.toLowerCase(), fromIndex)
    if (idx === -1) continue
    if (bestIdx === -1 || idx < bestIdx || (idx === bestIdx && entry.phrase.length > bestEntry.phrase.length)) {
      bestIdx = idx
      bestEntry = entry
    }
  }
  return bestIdx === -1 ? null : { idx: bestIdx, entry: bestEntry }
}

// Splits `value` into {text, to?} segments: plain text runs, and runs that
// should render as a router-link to `to`. `excludeSlug` (a table's own
// slug) prevents a table from linking to itself.
export function linkSegments(value, excludeSlug) {
  if (typeof value !== 'string' || !value) {
    return [{ text: value == null ? '' : String(value) }]
  }
  const lowerText = value.toLowerCase()
  const segments = []
  let pos = 0
  while (pos < value.length) {
    const match = findReferenceFrom(value, pos, lowerText, excludeSlug)
    if (!match) {
      segments.push({ text: value.slice(pos) })
      break
    }
    if (match.idx > pos) segments.push({ text: value.slice(pos, match.idx) })
    segments.push({ text: value.slice(match.idx, match.idx + match.entry.phrase.length), to: match.entry.to })
    pos = match.idx + match.entry.phrase.length
  }
  return segments
}
