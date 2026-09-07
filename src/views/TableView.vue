<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Star } from '@lucide/vue'
import { findTable } from '../registry'
import { linkSegments } from '../lib/textLinks'
import { damageTypeSegments, withDamageTypeProseTooltips } from '../lib/damageTypeTooltips'
import { weaponTraitSegments } from '../lib/weaponTraitTooltips'
import { withConditionTooltips } from '../lib/conditionTooltips'
import { starredTables } from '../lib/starred'
import { fixedTooltip } from '../lib/fixedTooltip'
import { dieSizeFromColumn, matchingIndices, primaryMatchIndex, useRollHighlight } from '../lib/rollHighlight'

const vFixedTooltip = fixedTooltip
const { isStarred, toggleStar } = starredTables

const props = defineProps({
  slug: { type: String, required: true },
})

const router = useRouter()
const search = ref('')
const sortCol = ref(null)
const sortDir = ref(1)

const table = computed(() => findTable(props.slug))

// A handful of tables (e.g. Room & Corridor Shape) store an image path as
// the cell value instead of text — rendered as a thumbnail, click to enlarge.
function isImagePath(value) {
  return typeof value === 'string' && /\.(png|jpe?g|svg|webp|gif)$/i.test(value)
}

const enlargedImage = ref(null)

// Cross-references: any cell whose text names a monster from the bestiary,
// or reads like "Roll on the X table", becomes a link — wherever in a cell
// it appears, not just when it's the whole value. Shared with
// MonsterDetailView via lib/textLinks. The DAMAGE column (e.g. in Weapons)
// gets a hover tooltip explaining that damage type's mechanical effect
// instead, sourced from the Damage Type table — shared with
// MonsterDetailView's action-text tooltips via lib/damageTypeTooltips. The
// Weapons table's NOTES column (Two-Handed, Quick, Parrying, ...) gets the
// same treatment sourced from the Weapon Traits table.
function segmentsForValue(value, col) {
  if (typeof value !== 'string' || !value) return [{ text: value == null ? '' : String(value) }]
  let segments
  if (col === 'DAMAGE') segments = damageTypeSegments(value)
  else if (col === 'NOTES' && table.value?.slug === 'weapons') segments = weaponTraitSegments(value)
  else segments = linkSegments(value, table.value?.slug)
  // Layered on top of whichever segmenter ran above, same as the Condition
  // pass below: any "<Type> damage" mention still left as plain text (e.g.
  // the Traps table's TRAP EFFECT column — "dealing 2D6 Piercing damage")
  // gets its own hover tooltip too. A no-op on the DAMAGE column itself,
  // since that segment is already tagged and gets skipped.
  segments = withDamageTypeProseTooltips(segments)
  // Layered on top of whichever segmenter ran above: any Condition name
  // (Bleeding, Poisoned, Restrained, ...) still left as plain text in any
  // column of any table gets its own hover tooltip from the Conditions
  // glossary — see lib/conditionTooltips.js. Skipped on the Conditions
  // table itself, where it would just be a condition name tooltipping its
  // own row.
  if (table.value?.slug === 'conditions') return segments
  return withConditionTooltips(segments)
}

// A column can hold a list of separate bullet points instead of one string
// (e.g. Relics' EFFECT, matching the rulebook's own bulleted layout) — each
// item still goes through the same link/tooltip segmenting as a plain cell.
function segmentsFor(row, col) {
  return segmentsForValue(row[col], col)
}

watch(
  () => props.slug,
  () => {
    search.value = ''
    sortCol.value = null
    sortDir.value = 1
  },
)

function cellText(row, col) {
  const v = row[col]
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

const filteredRows = computed(() => {
  if (!table.value) return []
  const q = search.value.trim().toLowerCase()
  let rows = table.value.rows
  if (q) {
    rows = rows.filter((row) => table.value.columns.some((c) => cellText(row, c).toLowerCase().includes(q)))
  }
  if (sortCol.value) {
    const col = sortCol.value
    rows = [...rows].sort((a, b) => {
      const av = a[col]
      const bv = b[col]
      const bothNumeric = typeof av === 'number' && typeof bv === 'number'
      const cmp = bothNumeric ? av - bv : cellText(a, col).localeCompare(cellText(b, col), 'pl')
      return cmp * sortDir.value
    })
  }
  return rows
})

function toggleSort(col) {
  if (sortCol.value === col) {
    sortDir.value = -sortDir.value
  } else {
    sortCol.value = col
    sortDir.value = 1
  }
}

// Whenever the floating DiceDock finishes a roll while this table happens to
// be open, briefly highlight (and scroll to) whichever row that roll landed
// on — see lib/rollHighlight.js. Only tables actually keyed by a die (first
// column reads "D20", "D100", ...) have anything to highlight; a table like
// Weapons or Conditions (first column TYPE/CONDITION/...) simply never
// matches and this quietly does nothing.
const rowEls = new Map()
function setRowRef(i, el) {
  if (el) rowEls.set(i, el)
  else rowEls.delete(i)
}

const { highlighted } = useRollHighlight(
  () => {
    const dieSize = dieSizeFromColumn(table.value?.columns[0])
    if (dieSize == null) return null
    const col = table.value.columns[0]
    return {
      indices: matchingIndices(filteredRows.value, col, dieSize),
      scrollTo: primaryMatchIndex(filteredRows.value, col, dieSize),
    }
  },
  (i) => rowEls.get(i),
)
</script>

<template>
  <div v-if="table" class="table-view">
    <header class="table-header">
      <h1 class="title-row">
        {{ table.title }}
        <button
          type="button"
          class="star-btn-lg"
          :class="{ starred: isStarred(table.slug) }"
          :aria-label="isStarred(table.slug) ? 'Unstar table' : 'Star table'"
          :title="isStarred(table.slug) ? 'Unstar table' : 'Star table'"
          @click="toggleStar(table.slug)"
        >
          <Star :size="22" :fill="isStarred(table.slug) ? 'currentColor' : 'none'" :stroke-width="1.75" />
        </button>
      </h1>
      <div class="meta">
        <span v-if="table.mastery" class="badge">{{ table.mastery }}</span>
        <span v-if="table.pages.length" class="badge muted">
          {{ table.isMultiPage ? 'pages' : 'page' }} {{ table.pages.join(', ') }}
        </span>
        <span class="badge muted">{{ table.numRows }} rows</span>
      </div>
    </header>

    <input v-model="search" type="search" class="search" placeholder="Search this table…" />

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th v-for="col in table.columns" :key="col" @click="toggleSort(col)">
              {{ col }}
              <span v-if="sortCol === col" class="sort-arrow">{{ sortDir === 1 ? '▲' : '▼' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in filteredRows"
            :key="i"
            :ref="(el) => setRowRef(i, el)"
            :class="{ 'row-highlight': highlighted.has(i) }"
          >
            <td v-for="(col, ci) in table.columns" :key="col">
              <img
                v-if="isImagePath(row[col])"
                :src="row[col]"
                class="cell-image"
                :alt="`${table.title} ${row[table.columns[0]]}`"
                @click="enlargedImage = row[col]"
              />
              <ul v-else-if="Array.isArray(row[col])" class="cell-list">
                <li v-for="(item, ii) in row[col]" :key="ii" :class="{ 'long-text': ci > 0 }">
                  <template v-for="(seg, si) in segmentsForValue(item, col)" :key="si">
                    <router-link v-if="seg.to" :to="seg.to" class="cell-link">{{ seg.text }}</router-link>
                    <span v-else-if="seg.tooltip" v-fixed-tooltip class="trait-tip">
                      {{ seg.text }}
                      <span class="tooltip-box">{{ seg.tooltip }}</span>
                    </span>
                    <template v-else>{{ seg.text }}</template>
                  </template>
                </li>
              </ul>
              <span v-else class="cell-text" :class="{ 'long-text': ci > 0 }">
                <template v-for="(seg, si) in segmentsFor(row, col)" :key="si">
                  <router-link v-if="seg.to" :to="seg.to" class="cell-link">{{ seg.text }}</router-link>
                  <span v-else-if="seg.tooltip" v-fixed-tooltip class="trait-tip">
                    {{ seg.text }}
                    <span class="tooltip-box">{{ seg.tooltip }}</span>
                  </span>
                  <template v-else>{{ seg.text }}</template>
                </template>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="filteredRows.length === 0" class="empty">No results for "{{ search }}".</p>
    </div>

    <div v-if="enlargedImage" class="lightbox" @click="enlargedImage = null">
      <img :src="enlargedImage" />
    </div>
  </div>

  <div v-else class="not-found">
    <h1>Table not found</h1>
    <p>The table "{{ slug }}" does not exist.</p>
    <button @click="router.push('/')">Back to home</button>
  </div>
</template>

<style scoped>
.table-header {
  margin-bottom: 1rem;
}

/* The star button is a plain inline element inside the h1 text (not a flex
   sibling) so `vertical-align` can align it against the actual text
   baseline/x-height — flex's cross-axis centering lines up boxes, not
   glyphs, and Cinzel's generous built-in headroom above its capital
   letters made that consistently look too high. */
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

.meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
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

.search {
  display: block;
  width: 100%;
  max-width: 360px;
  padding: 0.55rem 0.75rem;
  margin-bottom: 1.1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.9rem;
}

.table-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: auto;
  /* Was 72vh, assuming the other 28vh covered .content's padding (top+
     bottom) plus this view's own heading/search row above the table. That
     budget was sized back when only HistoryDock reserved space (bottom
     only, 2rem top + 5rem bottom = 7rem outside the table). Now DiceDock
     also reserves space at the top (2rem → 5rem) and HistoryDock's own
     bottom reservation grew too (5rem → 6rem, after the padding still
     wasn't quite enough on real pages — see .content's comment in
     App.vue), adding 4rem more reserved space total than the old 72vh
     accounted for — shrunk by roughly that same proportion (measured
     empirically at a 900px-tall viewport, the same way the original 72vh
     was arrived at) so the page goes back to fitting one viewport with no
     page-level scrollbar. */
  max-height: 64.5vh;
}

th {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

/* The first column is almost always a short die-roll value or range (e.g.
   "21-30") — never long prose — so it shouldn't wrap even when the column
   ends up narrow next to a much wider text column. */
td:first-child {
  white-space: nowrap;
}

/* Briefly lit up by lib/rollHighlight.js when the floating DiceDock's roll
   button finishes a roll that this table's first column recognizes as its
   own die (see dieSizeFromColumn) and lands on this row. The transition
   lives on the plain, unconditional rule (every td, all the time) rather
   than only inside .row-highlight's own selector — declaring it just on the
   highlighted state would only animate ADDING the background, since the
   instant the class is removed the element falls back to a rule with no
   transition property at all, snapping off instead of easing out. Here it
   animates smoothly in both directions: instantly-ish on ("this just lit
   up"), eased on off ~1s later. */
td {
  transition: background 0.4s ease;
}

tr.row-highlight td {
  background: rgba(232, 164, 143, 0.16);
}

.sort-arrow {
  color: var(--accent-light);
  font-size: 0.7rem;
}

.cell-link {
  color: var(--accent-light);
  text-decoration: none;
  border-bottom: 1px dotted var(--accent-light);
}

.cell-link:hover {
  text-decoration: none;
  border-bottom-style: solid;
}

.trait-tip {
  display: inline-block;
  cursor: help;
  color: var(--accent-light);
  border-bottom: 1px dotted var(--accent-light);
}

/* Positioned by the v-fixed-tooltip directive (position: fixed + computed
   top/left) rather than CSS, so it floats over the viewport instead of
   contributing to the table's own scrollable area — see lib/fixedTooltip.js
   for why that matters here. */
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

.cell-list {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.cell-list li {
  line-height: 1.6;
}

/* Same explicit line-height on every plain-value cell, long-text or not.
   A taller line-height doesn't just space out wrapped lines — it also adds
   "half-leading" above the very first line, pushing that line down. With
   the first column at one line-height and .long-text columns at another,
   a short first-column value (e.g. "Bleeding") and the long-text cell next
   to it in the same row started their text at visibly different heights
   even though both use vertical-align: top. Keeping this value identical
   everywhere is what actually fixes that — not just giving the first
   column *an* explicit line-height (which only fixed the case where it was
   otherwise left at the browser's own, differently-tall, default). */
.cell-text {
  line-height: 1.6;
}

/* Every column except the first (usually the die roll / short key value)
   reads easier a touch dimmer — same treatment as the Actions (D6) text on
   a monster's page (see MonsterDetailView's .action-text). Applied by
   column position now, not by a per-cell length check, so every cell in a
   column renders with the same font regardless of how long its own text
   happens to be. Line-height is intentionally NOT set here — see .cell-text
   above for why it has to match the first column's. */
.long-text {
  color: var(--text-dim);
}

.cell-image {
  display: block;
  width: 120px;
  height: 120px;
  object-fit: contain;
  border-radius: 4px;
  cursor: zoom-in;
  background: var(--surface-2);
}

.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  cursor: zoom-out;
}

.lightbox img {
  max-width: min(90vw, 500px);
  max-height: 90vh;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.empty {
  padding: 1rem;
  color: var(--text-faint);
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
