<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Heart, Star, Brain, HeartPulse, Dumbbell, Shield, Swords, Sparkles, TrendingUp, Flame, Crown } from '@lucide/vue'
import { findMonster, findTable } from '../registry'
import { linkSegments } from '../lib/textLinks'
import { traitSegments } from '../lib/traitTooltips'
import { damageTypeProseSegments } from '../lib/damageTypeTooltips'
import { conditionSegments, withConditionTooltips } from '../lib/conditionTooltips'
import { starredMonsters } from '../lib/starred'
import { characterLevel } from '../lib/characterLevel'
import { overseerInfluence, resistantDamageType, parseInfluence } from '../lib/overseerInfluence'
import { fixedTooltip } from '../lib/fixedTooltip'
import { matchingIndices, useRollHighlight } from '../lib/rollHighlight'

const vFixedTooltip = fixedTooltip
const { isStarred, toggleStar } = starredMonsters

const props = defineProps({
  slug: { type: String, required: true },
})

const router = useRouter()
const monster = computed(() => findMonster(props.slug))

const spoilsSegments = computed(() => withConditionTooltips(linkSegments(monster.value?.SPOILS)))
const traitTextSegments = computed(() => withConditionTooltips(traitSegments(monster.value?.TRAIT)))

// Action text is formatted as "Name (Physical/Magical): Description..." —
// the "Name" is a flavor title (e.g. "Cursed Slash", "Burning Grasp"), not
// mechanics text, so a Condition name that happens to show up there isn't
// actually invoking that condition and shouldn't get its tooltip; only the
// part after the first colon is real mechanics text. (damageTypeProseSegments
// below already guards against a Damage Type name in the title, or in the
// monster's own name recurring mid-description, by requiring "<Type>
// damage" to actually appear — this colon split additionally covers
// Condition names, which don't have as reliable a giveaway phrase.)
function actionSegments(text) {
  if (!text) return [{ text: text ?? '' }]
  const idx = text.indexOf(':')
  if (idx === -1) return withConditionTooltips(damageTypeProseSegments(text))
  const title = text.slice(0, idx + 1)
  const rest = text.slice(idx + 1)
  return [{ text: title }, ...withConditionTooltips(damageTypeProseSegments(rest))]
}

// D6 action tables often repeat the same action across a range (e.g. D6
// 1-2 share one action, encoded in the data as D6 2's Action reading
// "Same as 1"). Resolve those references and collapse consecutive entries
// that end up with the same action text into a single row with a range
// like "1-2" instead of listing the action twice.
const mergedActions = computed(() => {
  const acts = monster.value?.D6_ACTIONS
  if (!acts || !acts.length) return []
  const byD6 = new Map(acts.map((a) => [a.D6, a.Action]))
  function resolve(d6) {
    let text = byD6.get(d6)
    let guard = 0
    while (typeof text === 'string') {
      const m = text.match(/^Same as (\d+)$/i)
      if (!m) break
      text = byD6.get(Number(m[1]))
      guard += 1
      if (guard > 10) break
    }
    return text
  }
  const resolved = acts.map((a) => ({ d6: a.D6, action: resolve(a.D6) }))
  const groups = []
  for (const r of resolved) {
    const last = groups[groups.length - 1]
    if (last && last.action === r.action) {
      last.to = r.d6
    } else {
      groups.push({ from: r.d6, to: r.d6, action: r.action })
    }
  }
  return groups.map((g) => ({
    range: g.from === g.to ? String(g.from) : `${g.from}-${g.to}`,
    action: g.action,
  }))
})

// "HIT LOCATION" reads e.g. "Humanoid ( Head)" — the part before the
// parens names the Hit Location table for that body plan, and the part
// inside it is this monster's vulnerable point within that table.
const hitLocationInfo = computed(() => {
  const raw = monster.value?.['HIT LOCATION']
  if (!raw) return null
  const match = raw.match(/^(.*?)\s*\(\s*(.*?)\s*\)\s*$/)
  if (!match) return null
  const [, category, vulnerable] = match
  const slug = 'hit_location_' + category.trim().toLowerCase().replace(/\s+/g, '_')
  const table = findTable(slug)
  if (!table) return null
  return { table, vulnerable: vulnerable.trim() }
})

// Flash the matching row(s) whenever the dice dock finishes a roll — same
// shared engine TableView.vue uses for every reference table (see
// lib/rollHighlight.js), wired up by hand here since these two tables (Hit
// Location and Actions) are ad-hoc markup rather than the generic table
// renderer. Deliberately no scrolling here (getRowEl always returns null,
// so useRollHighlight's scrollIntoView call is a no-op): both tables live on
// a page the user is already reading top-to-bottom, and both are short
// enough to normally already be on screen, so auto-scrolling just yanked
// the view around distractingly instead of helping — unlike TableView.vue's
// tables, which can run to 70+ rows and genuinely need it.
const { highlighted: hitLocationHighlighted } = useRollHighlight(
  () => {
    const info = hitLocationInfo.value
    if (!info) return null
    const col = info.table.columns[0]
    return { indices: matchingIndices(info.table.rows, col, 20) }
  },
  () => null,
)

const { highlighted: actionsHighlighted } = useRollHighlight(
  () => {
    if (!mergedActions.value.length) return null
    return { indices: matchingIndices(mergedActions.value, 'range', 6) }
  },
  () => null,
)

// A monster's TYPE (e.g. "Undead, Construct") is a comma-separated list of
// entries from the Enemy Type table, which also carries the mechanical
// resistance/vulnerability/immunity effect each type grants — surfaced here
// as this monster's Racial Perks instead of duplicating that text per monster.
const enemyTypeTable = findTable('enemy_type')
const racialPerks = computed(() => {
  const raw = monster.value?.TYPE
  if (!raw || !enemyTypeTable) return []
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((type) => {
      const row = enemyTypeTable.rows.find((r) => r['ENEMY TYPE'] === type)
      return { type, effect: row?.EFFECT }
    })
    .filter((p) => p.effect)
})

const statFields = [
  ['MIND', 'Mind', Brain],
  ['ENDURANCE', 'Endurance', HeartPulse],
  ['BODY', 'Body', Dumbbell],
  ['HEALTH', 'Health', Heart],
  ['ARMOR', 'Armor', Shield],
  ['COMBAT SKILL', 'Combat Skill', Swords],
  ['MAGIC RESISTANCE', 'Magic Resistance', Sparkles],
  ['BONUS DAMAGE', 'Bonus Damage', Flame],
]

// Armor applying to the whole body is written as e.g. "1 (All Hit
// Locations)" — that annotation is redundant (there's no other location it
// could mean) and just adds noise, so it's dropped from display. Bonus
// Damage isn't a field the rulebook data has per monster at all — every
// monster starts at 0, and the only way it moves is a Level Adaptation
// change (see statBonus/statNotes below), so it's hardcoded here rather
// than read off `monster`.
function baseStatValue(key) {
  if (key === 'BONUS DAMAGE') return 0
  const value = monster.value?.[key]
  if (value === null || value === undefined || value === '') return '—'
  if (key === 'ARMOR' && typeof value === 'string') {
    return value.replace(/\s*\(all hit locations\)\s*$/i, '').trim() || value
  }
  return value
}

// Which Level Adaptation changes are currently in effect, given the
// entered party level (tiers are cumulative — level 11 has both the level
// 5 and level 10 adjustments active).
const activeAdaptationChanges = computed(() => {
  const tiers = monster.value?.['LEVEL ADAPTATION']
  if (!tiers || !tiers.length) return []
  return tiers.filter((t) => characterLevel.value >= t.min_level).flatMap((t) => t.changes || [])
})

const STAT_LABELS = {
  MIND: 'Mind',
  ENDURANCE: 'Endurance',
  BODY: 'Body',
  HEALTH: 'Health',
  ARMOR: 'Armor',
  'COMBAT SKILL': 'Combat Skill',
  'MAGIC RESISTANCE': 'Magic Resistance',
  // Rulebook data phrases these as plain "+1 damage" / "+2 damage" (clean,
  // additive) or dice-based "+D6 damage" (not additive — surfaced as a
  // note instead, same as Armor's location-qualified changes).
  'BONUS DAMAGE': 'damage',
}

// A change written as a plain "+10 Health" (rulebook data occasionally
// drops the leading "+" too) cleanly adds to the base value, so it's folded
// straight into that stat as "base + bonus" — this deliberately doesn't
// collapse it into a single total, so it stays visible *why* the number is
// higher than the sheet says. A change that also carries a qualifier (e.g.
// Armor's "+1 Armor (all Hit Locations except Abdomen)") is too conditional
// to fold into one number, so it's surfaced as a note under the tile
// instead of touching the value.
function cleanBonusPattern(key) {
  const label = STAT_LABELS[key]
  return label ? new RegExp(`^\\+?(\\d+)\\s*${label}$`, 'i') : null
}

function statBonus(key) {
  const pattern = cleanBonusPattern(key)
  if (!pattern) return 0
  return activeAdaptationChanges.value.reduce((sum, c) => {
    const m = pattern.exec(String(c).trim())
    return m ? sum + Number(m[1]) : sum
  }, 0)
}

function statNotes(key) {
  const label = STAT_LABELS[key]
  if (!label) return []
  const clean = cleanBonusPattern(key)
  const mentions = new RegExp(`\\b${label}\\b`, 'i')
  return activeAdaptationChanges.value.filter((c) => mentions.test(c) && !clean.test(String(c).trim()))
}

function hasLevelBonus(key) {
  return statBonus(key) > 0 || statNotes(key).length > 0
}

// The current Domain's Overseer Influence (rolled once per Domain, page
// 100) applies to every creature in it — EXCEPT the Overseer itself (page
// 98: "An Overseer is not affected by its own influence") — so it's
// suppressed entirely on an Overseer's own page.
const overseerInfluenceTable = findTable('overseer_influence')
const activeOverseerInfluence = computed(() => {
  if (overseerInfluence.value == null || monster.value?.OVERSEER) return null
  const row = overseerInfluenceTable?.rows.find((r) => r.D10 === overseerInfluence.value)
  const parsed = row ? parseInfluence(row['OVERSEER INFLUENCE']) : null
  // "Resistant" is rolled randomly (page 100: "Roll on the Damage Type
  // table") — once the type has been picked on Home, show the resolved
  // type here instead of the generic "1 random type of damage" text.
  if (parsed?.name === 'Resistant' && resistantDamageType.value) {
    return { ...parsed, effect: `Resistant to ${resistantDamageType.value} damage.` }
  }
  return parsed
})

// Piercing doesn't boost a stat tile — it grants the whole Domain's
// creatures an extra Trait, so it's surfaced there instead, in the same
// bright purple used for the rest of the Overseer Influence UI.
const OVERSEER_TRAIT_EFFECTS = {
  Piercing: { name: 'Penetrating', bonus: 1 },
}
const overseerTraitEffect = computed(() => {
  const influence = activeOverseerInfluence.value
  return influence ? OVERSEER_TRAIT_EFFECTS[influence.name] || null : null
})

// The rulebook says the grant "can stack with other instances of the same
// Trait" — so if the monster already has e.g. "Penetrating (2)", the
// Overseer's +1 merges into it as "Penetrating (2 + 1)" instead of listing
// Penetrating a second time. This finds that existing "(N)" to merge into.
const traitStackMatch = computed(() => {
  const effect = overseerTraitEffect.value
  const raw = monster.value?.TRAIT
  if (!effect || !raw) return null
  const re = new RegExp(`\\b${effect.name}\\s*\\((\\d+)\\)`, 'i')
  return re.exec(raw)
})

// The standalone purple trait chip only appears when there's nothing
// existing to stack it into (see traitStackMatch above and
// displayTraitSegments below, which handles the merged case inline).
const overseerGrantedTrait = computed(() => {
  const effect = overseerTraitEffect.value
  return effect && !traitStackMatch.value ? `${effect.name} (${effect.bonus})` : null
})

// Splits the one plain-text segment holding the matched "(N)" into three —
// the text up to the digits, a synthetic purple "+ bonus" run, and the
// closing ")" plus anything after — so "Penetrating (2)" renders inline as
// "Penetrating (2 + 1)" without disturbing the Trait name's own tooltip
// segment. Positions are tracked against the same raw TRAIT string
// traitTextSegments was built from, so they always line up.
const displayTraitSegments = computed(() => {
  const match = traitStackMatch.value
  if (!match) return traitTextSegments.value
  const bonus = overseerTraitEffect.value.bonus
  const closeIdx = match.index + match[0].length - 1
  let consumed = 0
  const out = []
  for (const seg of traitTextSegments.value) {
    const segText = seg.text || ''
    const segStart = consumed
    const segEnd = consumed + segText.length
    if (!seg.tooltip && closeIdx >= segStart && closeIdx < segEnd) {
      const localClose = closeIdx - segStart
      out.push({ text: segText.slice(0, localClose) })
      out.push({ text: ` + ${bonus}`, overseer: true })
      out.push({ text: segText.slice(localClose) })
    } else {
      out.push(seg)
    }
    consumed = segEnd
  }
  return out
})

// "–" is this data's placeholder for "no Trait" — real enough to render on
// its own, but not worth a leading ", " once the Overseer Influence adds
// one of its own (that would print as the confusing "–, Penetrating (1)").
const hasOwnTrait = computed(() => !!monster.value?.TRAIT && monster.value.TRAIT !== '–')

// Which base stat (if any) each Overseer Influence cleanly boosts — a
// small hardcoded table rather than pattern-matching the effect text like
// Level Adaptation's changes: several effects (Resistant, Corrupting)
// mention "damage" in a sense that has nothing to do with the Bonus Damage
// stat, so free-text matching would misfire here.
const OVERSEER_STAT_EFFECTS = {
  Vital: { key: 'HEALTH', note: true }, // scales with party level, not a flat number
  Frenzied: { key: 'BONUS DAMAGE', bonus: 1 },
  Skilled: { key: 'COMBAT SKILL', bonus: 10 },
  Magebane: { key: 'MAGIC RESISTANCE', bonus: 10 },
  Alert: { key: 'MIND', bonus: 20 },
}

function overseerEffectFor(key) {
  const influence = activeOverseerInfluence.value
  const effect = influence && OVERSEER_STAT_EFFECTS[influence.name]
  return effect && effect.key === key ? { ...effect, text: influence.effect } : null
}

function overseerStatBonus(key) {
  return overseerEffectFor(key)?.bonus || 0
}

function overseerStatNote(key) {
  const effect = overseerEffectFor(key)
  return effect?.note ? effect.text : null
}

function hasOverseerBonus(key) {
  return overseerStatBonus(key) > 0 || !!overseerStatNote(key)
}

// The headline number is the boosted total (so it reads at a glance as
// "this is what the monster has right now"); the un-boosted sheet value
// stays visible too, just heavily dimmed, via the template's stat-base-old
// span — rather than folding both into one "base + bonus" string.
function statValue(key) {
  const base = baseStatValue(key)
  const bonus = statBonus(key) + overseerStatBonus(key)
  const numericBase = Number(base)
  if (bonus > 0 && base !== '—' && Number.isFinite(numericBase)) return numericBase + bonus
  return base
}

// Experimental: a faint per-stat tint on the tile background/border, kept
// subtle on purpose (see the .stat-* rules below) so the row doesn't turn
// into a rainbow — easy to rip out again if it doesn't earn its keep.
function statSlug(key) {
  return key.toLowerCase().replace(/\s+/g, '-')
}
</script>

<template>
  <div v-if="monster" class="monster-detail">
    <button class="back" @click="router.push('/monsters')">← Bestiary</button>

    <header class="head">
      <h1 class="title-row">
        {{ monster.name }}
        <button
          type="button"
          class="star-btn-lg"
          :class="{ starred: isStarred(monster.slug) }"
          :aria-label="isStarred(monster.slug) ? 'Unstar monster' : 'Star monster'"
          :title="isStarred(monster.slug) ? 'Unstar monster' : 'Star monster'"
          @click="toggleStar(monster.slug)"
        >
          <Star :size="22" :fill="isStarred(monster.slug) ? 'currentColor' : 'none'" :stroke-width="1.75" />
        </button>
      </h1>
      <div class="badges">
        <span v-if="monster.OVERSEER" class="badge overseer">Overseer</span>
        <span v-if="monster.TYPE" class="badge">{{ monster.TYPE }}</span>
        <span v-if="monster.page" class="badge muted">p. {{ monster.page }}</span>
      </div>
      <p v-if="monster.DESCRIPTION" class="flavor">{{ monster.DESCRIPTION }}</p>
    </header>

    <section class="stats-grid">
      <div
        v-for="[key, label, Icon] in statFields"
        :key="key"
        class="stat"
        :class="'stat-' + statSlug(key)"
      >
        <span class="stat-label"><component :is="Icon" :size="13" class="stat-icon" />{{ label }}</span>
        <span class="stat-value">
          {{ statValue(key) }}
          <TrendingUp v-if="hasLevelBonus(key)" :size="12" class="level-up-icon" title="Boosted by party level" />
          <Crown v-if="hasOverseerBonus(key)" :size="12" class="overseer-up-icon" title="Boosted by the current Overseer Influence" />
          <span
            v-if="(statBonus(key) + overseerStatBonus(key)) > 0 && Number(baseStatValue(key)) !== 0"
            class="stat-base-old"
            title="Base value before the party-level / Overseer Influence bonus"
          >({{ baseStatValue(key) }})</span>
        </span>
        <div v-if="statNotes(key).length || overseerStatNote(key)" class="stat-note-list">
          <span v-for="(n, ni) in statNotes(key)" :key="'lvl-' + ni" class="stat-note">{{ n }}</span>
          <span v-if="overseerStatNote(key)" class="stat-note stat-note-overseer">{{ overseerStatNote(key) }}</span>
        </div>
      </div>
    </section>

    <section v-if="overseerInfluence != null" class="block overseer-banner">
      <h2>
        <Crown :size="15" class="overseer-icon" />
        Overseer Influence
      </h2>
      <p v-if="activeOverseerInfluence"><strong>{{ activeOverseerInfluence.name }}:</strong> {{ activeOverseerInfluence.effect }}</p>
      <p v-else class="note">This monster is the Overseer — it isn't affected by its own influence.</p>
    </section>

    <div class="detail-columns">
      <div class="col">
        <section class="block">
          <h2>
            Level Adaptation
            <span class="badge muted">Party level {{ characterLevel }}</span>
          </h2>
          <template v-if="monster['LEVEL ADAPTATION'] && monster['LEVEL ADAPTATION'].length">
            <div
              v-for="(adapt, i) in monster['LEVEL ADAPTATION']"
              :key="i"
              class="adaptation"
              :class="{ 'adaptation-active': characterLevel >= adapt.min_level }"
            >
              <span class="level-tag" :class="{ 'level-tag-active': characterLevel >= adapt.min_level }">
                Level {{ adapt.min_level }}+
                <span v-if="characterLevel >= adapt.min_level" class="active-tick">✓ Active</span>
              </span>
              <ul>
                <li v-for="(c, j) in adapt.changes" :key="j">{{ c }}</li>
              </ul>
            </div>
          </template>
          <p v-else class="note">This monster has no level adaptation.</p>
        </section>

        <section v-if="monster.TRAIT || overseerGrantedTrait" class="block">
          <h2>Trait</h2>
          <p>
            <template v-if="hasOwnTrait || !overseerGrantedTrait">
              <template v-for="(seg, i) in displayTraitSegments" :key="i">
                <span v-if="seg.tooltip" v-fixed-tooltip class="trait-tip">
                  {{ seg.text }}
                  <span class="tooltip-box">{{ seg.tooltip }}</span>
                </span>
                <span v-else-if="seg.overseer" class="overseer-trait-inline" title="Granted by the current Overseer Influence (Piercing)">{{ seg.text }}</span>
                <template v-else>{{ seg.text }}</template>
              </template>
            </template>
            <template v-if="hasOwnTrait && overseerGrantedTrait">, </template>
            <span v-if="overseerGrantedTrait" class="overseer-trait" title="Granted by the current Overseer Influence (Piercing)">{{ overseerGrantedTrait }}</span>
          </p>
        </section>

        <section v-if="racialPerks.length" class="block">
          <h2>
            Racial Perks —
            <router-link :to="`/table/${enemyTypeTable.slug}`" class="cell-link">{{ enemyTypeTable.title }}</router-link>
          </h2>
          <ul class="perks-list">
            <li v-for="perk in racialPerks" :key="perk.type">
              <strong>{{ perk.type }}:</strong>{{ ' ' }}
              <template v-for="(seg, si) in conditionSegments(perk.effect)" :key="si">
                <span v-if="seg.tooltip" v-fixed-tooltip class="trait-tip">
                  {{ seg.text }}
                  <span class="tooltip-box">{{ seg.tooltip }}</span>
                </span>
                <template v-else>{{ seg.text }}</template>
              </template>
            </li>
          </ul>
        </section>

        <section v-if="monster['HIT LOCATION']" class="block">
          <h2 v-if="hitLocationInfo">
            Hit Location —
            <router-link :to="`/table/${hitLocationInfo.table.slug}`" class="cell-link">{{ hitLocationInfo.table.title }}</router-link>
          </h2>
          <h2 v-else>Hit Location</h2>
          <table v-if="hitLocationInfo">
            <thead>
              <tr>
                <th style="width: 5rem">{{ hitLocationInfo.table.columns[0] }}</th>
                <th>{{ hitLocationInfo.table.columns[1] }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in hitLocationInfo.table.rows"
                :key="i"
                :class="{
                  vulnerable: row[hitLocationInfo.table.columns[1]] === hitLocationInfo.vulnerable,
                  'row-highlight': hitLocationHighlighted.has(i),
                }"
              >
                <td>{{ row[hitLocationInfo.table.columns[0]] }}</td>
                <td class="location-cell">
                  <Heart
                    v-if="row[hitLocationInfo.table.columns[1]] === hitLocationInfo.vulnerable"
                    class="heart-icon"
                    :size="14"
                    fill="currentColor"
                    :stroke-width="0"
                    title="Vulnerable point"
                  />
                  {{ row[hitLocationInfo.table.columns[1]] }}
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="note">This monster has no distinct hit location.</p>
        </section>

        <section v-if="monster.SPOILS" class="block">
          <h2>Spoils</h2>
          <p>
            <template v-for="(seg, i) in spoilsSegments" :key="i">
              <router-link v-if="seg.to" :to="seg.to" class="cell-link">{{ seg.text }}</router-link>
              <template v-else>{{ seg.text }}</template>
            </template>
          </p>
        </section>
      </div>

      <div class="col">
        <section v-if="mergedActions.length" class="block">
          <h2>Actions (D6)</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 3.5rem">D6</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(a, i) in mergedActions"
                :key="a.range"
                :class="{ 'row-highlight': actionsHighlighted.has(i) }"
              >
                <td>{{ a.range }}</td>
                <td class="action-text">
                  <template v-for="(seg, si) in actionSegments(a.action)" :key="si">
                    <span v-if="seg.tooltip" v-fixed-tooltip class="trait-tip">
                      {{ seg.text }}
                      <span class="tooltip-box">{{ seg.tooltip }}</span>
                    </span>
                    <template v-else>{{ seg.text }}</template>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-else-if="monster.ACTION" class="block">
          <h2>Action</h2>
          <p>
            <template v-for="(seg, si) in actionSegments(monster.ACTION)" :key="si">
              <span v-if="seg.tooltip" v-fixed-tooltip class="trait-tip">
                {{ seg.text }}
                <span class="tooltip-box">{{ seg.tooltip }}</span>
              </span>
              <template v-else>{{ seg.text }}</template>
            </template>
          </p>
          <p v-if="monster._note" class="note">{{ monster._note }}</p>
        </section>
      </div>
    </div>
  </div>

  <div v-else class="not-found">
    <h1>Monster not found</h1>
    <p>The monster "{{ slug }}" does not exist.</p>
    <button @click="router.push('/monsters')">Back to bestiary</button>
  </div>
</template>

<style scoped>
.back {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  padding: 0;
  margin-bottom: 1rem;
  font-size: 0.85rem;
}

.back:hover {
  color: var(--accent-light);
}

.head {
  margin-bottom: 1.25rem;
}

/* Inline inside the h1 text (not a flex sibling) so `vertical-align` lines
   it up with the actual text baseline/x-height — see the identical pattern
   and rationale on TableView's title. */
.star-btn-lg {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  width: 2.2rem;
  height: 2.2rem;
  margin-left: 0.35rem;
  background: none;
  border: none;
  border-radius: 8px;
  color: var(--text-faint);
  cursor: pointer;
}

.star-btn-lg:hover {
  background: var(--surface-2);
  color: var(--accent-light);
}

.star-btn-lg.starred {
  color: #e6bb5c;
}

.badges {
  display: flex;
  gap: 0.5rem;
}

.badge {
  display: inline-block;
  background: var(--accent-dim);
  color: var(--accent-light);
  border: 1px solid var(--accent);
  border-radius: 999px;
  padding: 0.2rem 0.65rem;
  font-size: 0.78rem;
}

.badge.muted {
  background: var(--surface-2);
  color: var(--text-dim);
  border-color: var(--border);
}

.badge.overseer {
  background: rgba(201, 152, 47, 0.16);
  color: #e6bb5c;
  border-color: #8a6a1f;
}

.flavor {
  margin-top: 0.85rem;
  max-width: 720px;
  color: var(--text-dim);
  font-style: italic;
  font-size: 0.85rem;
  line-height: 1.55;
}

.cell-link {
  color: var(--accent-light);
  text-decoration: none;
  border-bottom: 1px dotted var(--accent-light);
}

.cell-link:hover {
  border-bottom-style: solid;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 0.6rem;
  margin-bottom: 1.5rem;
}

.stat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

/* Experimental per-stat tint (see the comment near statFields/statSlug in
   the script). Alpha is kept low on purpose — this should read as "a hint
   of a different metal/color per stat", not a rainbow row of tiles. */
.stat-mind {
  background: rgba(124, 108, 186, 0.07);
  border-color: rgba(124, 108, 186, 0.35);
}

.stat-endurance {
  background: rgba(198, 133, 66, 0.07);
  border-color: rgba(198, 133, 66, 0.35);
}

.stat-body {
  background: rgba(150, 115, 75, 0.07);
  border-color: rgba(150, 115, 75, 0.35);
}

.stat-health {
  background: rgba(179, 56, 44, 0.08);
  border-color: rgba(179, 56, 44, 0.35);
}

.stat-armor {
  background: rgba(96, 122, 140, 0.08);
  border-color: rgba(96, 122, 140, 0.35);
}

.stat-combat-skill {
  background: rgba(168, 69, 44, 0.08);
  border-color: rgba(168, 69, 44, 0.35);
}

.stat-magic-resistance {
  background: rgba(107, 79, 138, 0.08);
  border-color: rgba(107, 79, 138, 0.35);
}

.stat-bonus-damage {
  background: rgba(217, 119, 6, 0.08);
  border-color: rgba(217, 119, 6, 0.35);
}

.stat-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.stat-icon {
  flex-shrink: 0;
  color: inherit;
}

.level-up-icon {
  color: #7fce8c;
  vertical-align: middle;
  margin-left: 0.2rem;
}

/* Bright purple is reserved for the current Domain's Overseer Influence,
   kept visually distinct from the green party-level bonus above so the two
   sources of a boosted stat never get confused at a glance. */
.overseer-up-icon {
  color: #c65cf0;
  vertical-align: middle;
  margin-left: 0.2rem;
}

/* The pre-bonus sheet value, kept visible next to the boosted total but
   pushed way down in contrast so it doesn't compete with it. */
.stat-base-old {
  font-size: 0.72rem;
  color: var(--text-faint);
  opacity: 0.6;
  margin-left: 0.3rem;
  font-weight: 400;
}

.stat-note-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.3rem;
}

.stat-note {
  font-size: 0.68rem;
  line-height: 1.35;
  color: #7fce8c;
}

.stat-note-overseer {
  color: #c65cf0;
}

.overseer-trait {
  color: #c65cf0;
  font-weight: 600;
}

/* Inline variant used when a monster already has its own instance of the
   trait the Overseer Influence would grant (e.g. it already rolled
   "Penetrating (2)") — instead of a duplicate standalone chip, the bonus is
   merged into the existing number: "Penetrating (2 + 1)", with just the
   "+ 1" part picked out in purple. */
.overseer-trait-inline {
  color: #c65cf0;
  font-weight: 600;
}

/* A standalone banner rather than a per-tile background — several
   Overseer Influence effects (Tough, Resistant, Corrupting, Unstable,
   Piercing) don't map onto any stat tile at all, so this is the one place
   the current Influence is always shown in full, regardless of whether it
   also boosted something above. Unlike the other .block sections here (plain
   text, no box), this one is boxed so the bright purple accent reads as a
   distinct "currently active" callout. */
.overseer-banner {
  background: rgba(198, 92, 240, 0.06);
  border: 1px solid rgba(198, 92, 240, 0.5);
  border-radius: 10px;
  padding: 0.9rem 1.1rem;
}

.overseer-banner h2 {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.overseer-icon {
  color: #c65cf0;
  flex-shrink: 0;
}

.overseer-banner p strong {
  color: #c65cf0;
}

.stat-value {
  font-size: 1.1rem;
  color: var(--text);
}

.detail-columns {
  display: grid;
  /* auto-fit reacts to the actual space this element has (which depends on
     the sidebar being open/collapsed, not just the window width), so it
     drops to a single column whenever a 320px column no longer fits. */
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem 2rem;
  align-items: start;
}

.col {
  min-width: 0;
}

.block {
  margin-bottom: 1.5rem;
  max-width: none;
}

.block h2 {
  font-size: 1rem;
  color: var(--accent-light);
  margin-bottom: 0.5rem;
}

.block p {
  color: var(--text-dim);
  line-height: 1.5;
}

.block table {
  max-width: 480px;
}

.action-text {
  /* Full-brightness text reads a bit harsh over a long paragraph; dim it
     down just a touch and loosen the line spacing for easier reading. */
  color: var(--text-dim);
  line-height: 1.6;
}

tr.vulnerable {
  background: rgba(179, 56, 44, 0.14);
}

/* Transition declared on the always-applying base rule (not inside
   .row-highlight itself) so it animates BOTH directions — adding the class
   fades the background in, removing it fades back out. Declaring it only
   inside .row-highlight would animate just the "on" direction; removal
   would snap back instantly, since the transition property leaves with the
   class. See the identical fix in TableView.vue. */
td {
  transition: background 0.4s ease;
}

/* Placed after tr.vulnerable so a just-rolled Hit Location match briefly
   outshines the static vulnerable-point tint rather than being masked by
   it — both are harmless to have active at once (they're just two
   backgrounds on the same rule specificity, last one in the stylesheet
   wins), and the highlight clears itself after ~1s regardless. */
tr.row-highlight td {
  background: rgba(232, 164, 143, 0.16);
}

.heart-icon {
  color: #e0453a;
  vertical-align: -2px;
  margin-right: 0.15rem;
}

/* Matches the dimmer tone used everywhere else in this view (block text,
   action descriptions) — by default a <td> inherits the page's bright
   --text color, which stood out against everything around it. */
.location-cell {
  color: var(--text-dim);
}

.trait-tip {
  display: inline-block;
  cursor: help;
  color: var(--accent-light);
  border-bottom: 1px dotted var(--accent-light);
}

/* Positioned by the v-fixed-tooltip directive (position: fixed + computed
   top/left) rather than CSS, so it floats over the viewport instead of
   contributing to a scrolling ancestor's scrollable area — see
   lib/fixedTooltip.js for why that matters (it fixed a spurious horizontal
   scrollbar on the Weapons table). */
.tooltip-box {
  display: none;
  z-index: 20;
  width: 260px;
  max-width: min(260px, calc(100vw - 16px));
  background: var(--surface-2);
  border: 1px solid var(--accent);
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  color: var(--text);
  font-size: 0.82rem;
  font-style: normal;
  line-height: 1.45;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  white-space: normal;
}

.adaptation {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem 0.9rem;
  margin-bottom: 0.6rem;
  opacity: 0.6;
}

/* Once the entered character level reaches this tier's min_level, it's a
   change that's already in effect for the current fight — so it's brought
   to full opacity and given an accent border instead of staying dimmed
   like a not-yet-relevant tier. */
.adaptation-active {
  opacity: 1;
  border-color: var(--accent);
}

.level-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--accent-light);
  margin-bottom: 0.35rem;
}

.level-tag-active {
  color: var(--accent-light);
}

.active-tick {
  font-size: 0.72rem;
  font-weight: 600;
  color: #7fce8c;
  letter-spacing: 0.02em;
}

.adaptation ul {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--text-dim);
}

.perks-list {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: var(--text-dim);
  line-height: 1.5;
}

.perks-list strong {
  color: var(--text);
}

.note {
  font-size: 0.85rem;
  color: var(--text-faint);
  font-style: italic;
}

.not-found button {
  margin-top: 0.75rem;
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
}
</style>
