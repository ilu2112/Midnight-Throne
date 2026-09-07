<script setup>
import { nextTick, computed, ref, watch } from 'vue'
import { Heart, Shield, Sparkles, Brain, BatteryLow, Flashlight, Dices, Star, Trophy, IdCard, PersonStanding, Plus, Minus, X, ChevronUp, ChevronDown, RotateCcw } from '@lucide/vue'
import { findTable } from '../registry'
import { characterLevel, experience, adjustExperience } from '../lib/characterLevel'
import {
  stats,
  STAT_KEYS,
  adjustStatCurrent,
  exhaustion,
  adjustExhaustion,
  lightsource,
  adjustLightsource,
  refuelLightsource,
  usageDice,
  USAGE_DIE_SIZES,
  addUsageDie,
  removeUsageDie,
  stepUsageDie,
  addDefaultUsageDice,
} from '../lib/characterSheet'

// One small visual identity per stat — icon + accent color — so the four
// rows stay easy to tell apart at a glance in a narrow column, without
// needing a label to do all the work.
const STAT_META = {
  health: { label: 'Health', icon: Heart, color: '#c0453a' },
  toughness: { label: 'Toughness', icon: Shield, color: '#5b8fc7' },
  aether: { label: 'Aether', icon: Sparkles, color: '#9b6fd6' },
  sanity: { label: 'Sanity', icon: Brain, color: '#4fae95' },
}

const LEVEL_COLOR = '#e6bb5c'
const EXPERIENCE_COLOR = '#d97b3f'

function adjustLevel(delta) {
  characterLevel.value = Math.max(1, (characterLevel.value || 1) + delta)
}

// Page 90: a plain running total, no fixed max — shown as a quiet hint of
// which bracket currently applies rather than a big callout.
const exhaustionTable = findTable('accumulated_exhaustion')
const exhaustionEffect = computed(() => {
  if (!exhaustionTable) return null
  const row = exhaustionTable.rows.find((r) => {
    const range = String(r['ACCUMULATED EXHAUSTION']).replace('+', '')
    if (range.includes('-')) {
      const [lo, hi] = range.split('-').map(Number)
      return exhaustion.value >= lo && exhaustion.value <= hi
    }
    return exhaustion.value >= Number(range)
  })
  return row?.EFFECT || null
})

const dieInputs = new Map()
function setDieInputRef(id, el) {
  if (el) dieInputs.set(id, el)
  else dieInputs.delete(id)
}

function handleAddDie() {
  const die = addUsageDie()
  nextTick(() => {
    const el = dieInputs.get(die.id)
    if (el) {
      el.focus()
      el.select()
    }
  })
}

const showDefaultConfirm = ref(false)
function confirmAddDefaultUsageDice() {
  addDefaultUsageDice()
  showDefaultConfirm.value = false
}

// Which dice currently have their "Max" row expanded — collapsed by
// default so the common case (name + current size + remove) stays a
// single compact line; Max is a rarely-changed setting, tucked away
// behind clicking the size badge instead of always taking its own row.
const expandedDice = ref(new Set())
function isDieExpanded(id) {
  return expandedDice.value.has(id)
}
function toggleDieExpanded(id) {
  const next = new Set(expandedDice.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedDice.value = next
}

// Collapsed/expanded state for each of the panel's own sections. General
// Stats and Usage Dice default open (unchanged from before this was
// collapsible); Hit Location defaults collapsed since it's a supplementary
// lookup rather than something adjusted turn to turn. Persisted per-viewer,
// same pattern as App.vue's rightSidebarOpen.
const SECTIONS_STORAGE_KEY = 'kn-character-panel-sections'

function loadSectionsOpen() {
  const defaults = { general: true, usageDice: true, hitLocation: false }
  try {
    const raw = localStorage.getItem(SECTIONS_STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    return { ...defaults, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
  } catch {
    return defaults
  }
}

const sectionsOpen = ref(loadSectionsOpen())

watch(
  sectionsOpen,
  (value) => {
    try {
      localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Ignore write failures (quota, private mode, etc.).
    }
  },
  { deep: true },
)

function toggleSection(key) {
  sectionsOpen.value[key] = !sectionsOpen.value[key]
}

// Page 80/81: a quick D20 → body-part lookup so a hit doesn't need a trip to
// the full Hit Locations table mid-combat. Two columns to fit the sidebar's
// width. The Head entry gets its own marker — page 81: "As a human, your
// Weak Spot is located on your head," and striking a Weak Spot doubles the
// attack's damage.
const hitLocationHumanoidTable = findTable('hit_location_humanoid')
const WEAK_SPOT_LOCATION = 'Head'
</script>

<template>
  <div class="character-panel">
    <section class="cp-section cp-general">
      <button type="button" class="cp-heading cp-collapsible" @click="toggleSection('general')">
        <IdCard :size="17" :stroke-width="2" />
        <span class="cp-heading-label">General Stats</span>
        <span class="cp-collapse-arrow" :class="{ open: sectionsOpen.general }">▸</span>
      </button>

      <div class="cp-collapse-wrapper" :class="{ open: sectionsOpen.general }">
      <div class="cp-collapse-inner cp-general-inner">

      <div class="stat-row" :style="{ borderLeftColor: LEVEL_COLOR }">
        <div class="stat-header" :style="{ color: LEVEL_COLOR }">
          <Star :size="16" :stroke-width="2" />
          <span>Level</span>
        </div>
        <div class="stat-values">
          <button type="button" class="stat-btn" aria-label="Decrease level" :disabled="characterLevel <= 1" @click="adjustLevel(-1)">
            <Minus :size="14" :stroke-width="2.5" />
          </button>
          <input
            id="sidebar-character-level"
            v-model.number="characterLevel"
            type="number"
            min="1"
            class="stat-current"
            aria-label="Character level"
          />
          <button type="button" class="stat-btn" aria-label="Increase level" @click="adjustLevel(1)">
            <Plus :size="14" :stroke-width="2.5" />
          </button>
        </div>
      </div>

      <!-- Page 62: XP mostly comes in +10s (doors, containers, traps, Lore
           Books) and +50s (Combat Encounters, new Domains), plus a plain
           +/-1 for one-off corrections. Six buttons don't fit alongside a
           label on one line at this width, so — unlike every other row —
           this one wraps to a second line just for its button cluster. -->
      <div class="stat-row exp-row" :style="{ borderLeftColor: EXPERIENCE_COLOR }">
        <div class="exp-top-row">
          <div class="stat-header" :style="{ color: EXPERIENCE_COLOR }">
            <Trophy :size="16" :stroke-width="2" />
            <span>Experience</span>
          </div>
          <input v-model.number="experience" type="number" min="0" class="stat-current exp-current" aria-label="Experience" />
        </div>
        <div class="exp-buttons-row">
          <button type="button" class="stat-btn exp-btn" aria-label="Decrease experience by 50" :disabled="experience <= 0" @click="adjustExperience(-50)">-50</button>
          <button type="button" class="stat-btn exp-btn" aria-label="Decrease experience by 10" :disabled="experience <= 0" @click="adjustExperience(-10)">-10</button>
          <button type="button" class="stat-btn exp-btn" aria-label="Decrease experience by 1" :disabled="experience <= 0" @click="adjustExperience(-1)">-1</button>
          <button type="button" class="stat-btn exp-btn" aria-label="Increase experience by 1" @click="adjustExperience(1)">+1</button>
          <button type="button" class="stat-btn exp-btn" aria-label="Increase experience by 10" @click="adjustExperience(10)">+10</button>
          <button type="button" class="stat-btn exp-btn" aria-label="Increase experience by 50" @click="adjustExperience(50)">+50</button>
        </div>
      </div>

      <div v-for="key in STAT_KEYS" :key="key" class="stat-row" :style="{ borderLeftColor: STAT_META[key].color }">
        <div class="stat-header" :style="{ color: STAT_META[key].color }">
          <component :is="STAT_META[key].icon" :size="16" :stroke-width="2" />
          <span>{{ STAT_META[key].label }}</span>
        </div>
        <div class="stat-values">
          <button type="button" class="stat-btn" aria-label="Decrease current" @click="adjustStatCurrent(key, -1)">
            <Minus :size="14" :stroke-width="2.5" />
          </button>
          <input v-model.number="stats[key].current" type="number" class="stat-current" aria-label="Current" />
          <button type="button" class="stat-btn" aria-label="Increase current" @click="adjustStatCurrent(key, 1)">
            <Plus :size="14" :stroke-width="2.5" />
          </button>
          <span class="stat-sep">/</span>
          <input v-model.number="stats[key].max" type="number" class="stat-max" aria-label="Maximum" title="Maximum" />
        </div>
      </div>

      <div class="counter-card">
        <div class="counter-row">
          <div class="counter-label">
            <BatteryLow :size="16" :stroke-width="2" />
            <span>Exhaustion</span>
          </div>
          <div class="counter-values">
            <button type="button" class="stat-btn" aria-label="Decrease Exhaustion" @click="adjustExhaustion(-1)">
              <Minus :size="14" :stroke-width="2.5" />
            </button>
            <input v-model.number="exhaustion" type="number" class="stat-current" aria-label="Exhaustion" />
            <button type="button" class="stat-btn" aria-label="Increase Exhaustion" @click="adjustExhaustion(1)">
              <Plus :size="14" :stroke-width="2.5" />
            </button>
          </div>
        </div>
        <p v-if="exhaustionEffect" class="counter-hint">{{ exhaustionEffect }}</p>
      </div>

      <div class="counter-card">
        <div class="counter-row">
          <div class="counter-label">
            <Flashlight :size="16" :stroke-width="2" />
            <span>Lightsource</span>
          </div>
          <div class="counter-values">
            <button type="button" class="stat-btn" aria-label="Decrease Lightsource" @click="adjustLightsource(-1)">
              <Minus :size="14" :stroke-width="2.5" />
            </button>
            <input v-model.number="lightsource.current" type="number" class="stat-current" aria-label="Current Lightsource" />
            <span class="stat-sep">/</span>
            <input v-model.number="lightsource.max" type="number" class="stat-max" aria-label="Maximum Lightsource" title="Maximum" />
            <button type="button" class="stat-btn refuel-btn" aria-label="Refuel to maximum" title="Refuel to maximum" @click="refuelLightsource">
              <RotateCcw :size="14" :stroke-width="2.5" />
            </button>
          </div>
        </div>
      </div>

      </div>
      </div>
    </section>

    <section class="cp-section cp-usage-dice">
      <button type="button" class="cp-heading cp-collapsible" @click="toggleSection('usageDice')">
        <Dices :size="17" :stroke-width="2" />
        <span class="cp-heading-label">Usage Dice</span>
        <span class="cp-collapse-arrow" :class="{ open: sectionsOpen.usageDice }">▸</span>
      </button>

      <div class="cp-collapse-wrapper" :class="{ open: sectionsOpen.usageDice }">
      <div class="cp-collapse-inner">

      <div v-if="usageDice.length" class="die-list">
        <div v-for="die in usageDice" :key="die.id" class="die-item">
          <div class="die-row">
            <input
              :ref="(el) => setDieInputRef(die.id, el)"
              v-model="die.name"
              type="text"
              class="die-name"
              aria-label="Usage die name"
            />
            <button
              type="button"
              class="die-step"
              aria-label="Step up"
              title="Step up"
              :disabled="die.size === die.max"
              @click="stepUsageDie(die.id, -1)"
            >
              <ChevronUp :size="14" :stroke-width="2.5" />
            </button>
            <button
              type="button"
              class="die-size-label"
              :title="isDieExpanded(die.id) ? 'Hide max' : 'Set max'"
              @click="toggleDieExpanded(die.id)"
            >
              D{{ die.size }}
            </button>
            <button
              type="button"
              class="die-step"
              aria-label="Step down"
              :title="USAGE_DIE_SIZES.indexOf(die.size) === USAGE_DIE_SIZES.length - 1 ? 'Reset to max' : 'Step down'"
              @click="stepUsageDie(die.id, 1)"
            >
              <ChevronDown :size="14" :stroke-width="2.5" />
            </button>
            <button type="button" class="die-remove" aria-label="Remove usage die" @click="removeUsageDie(die.id)">
              <X :size="15" :stroke-width="2.25" />
            </button>
          </div>
          <div v-if="isDieExpanded(die.id)" class="die-max-row">
            <label class="die-max">
              Max
              <select v-model.number="die.max" aria-label="Maximum die size">
                <option v-for="s in USAGE_DIE_SIZES" :key="s" :value="s">D{{ s }}</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      <p v-else class="cp-empty">No Usage Dice yet.</p>

      <div class="cp-usage-actions">
        <button type="button" class="cp-add-btn" @click="handleAddDie">+ Add usage die</button>
        <button type="button" class="cp-default-btn" @click="showDefaultConfirm = true">Add default usage dice</button>
      </div>

      </div>
      </div>
    </section>

    <section class="cp-section cp-hitloc">
      <button type="button" class="cp-heading cp-collapsible" @click="toggleSection('hitLocation')">
        <PersonStanding :size="17" :stroke-width="2" />
        <span class="cp-heading-label">Hit Location — Humanoid</span>
        <span class="cp-collapse-arrow" :class="{ open: sectionsOpen.hitLocation }">▸</span>
      </button>

      <div class="cp-collapse-wrapper" :class="{ open: sectionsOpen.hitLocation }">
      <div class="cp-collapse-inner">

      <div class="hitloc-grid">
        <div
          v-for="row in hitLocationHumanoidTable?.rows || []"
          :key="row['HIT LOCATION - HUMANOID']"
          class="hitloc-cell"
        >
          <span class="hitloc-range">{{ row.D20 }}</span>
          <span class="hitloc-name">
            {{ row['HIT LOCATION - HUMANOID'] }}
            <Heart
              v-if="row['HIT LOCATION - HUMANOID'] === WEAK_SPOT_LOCATION"
              :size="11"
              fill="#e0473d"
              color="#e0473d"
              class="weak-spot-icon"
              title="Weak Spot — a hit here doubles the attack's damage (page 81)."
            />
          </span>
        </div>
      </div>

      </div>
      </div>
    </section>

    <div v-if="showDefaultConfirm" class="modal-overlay" @click.self="showDefaultConfirm = false">
      <div class="modal">
        <h2>Add default Usage Dice?</h2>
        <p>
          This adds the Tension Die (D8) and the two exploration checks, Lair Check (D10) and Domain Exit Check (D8),
          to the top of your list below. If any of these three already exist, they're replaced with fresh ones.
        </p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" @click="showDefaultConfirm = false">Cancel</button>
          <button
            type="button"
            class="btn-confirm"
            @click="confirmAddDefaultUsageDice"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cp-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cp-general {
  gap: 0.35rem;
}

.stat-row {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border);
  border-radius: 6px;
  padding: 0.3rem 0.45rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  font-weight: 600;
  flex: 1;
  min-width: 0;
}

.stat-header span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-values {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.stat-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  background: none;
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-dim);
  cursor: pointer;
}

.stat-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent-light);
}

.stat-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

/* Six adjust buttons don't fit on one line alongside a label, so this row
   stacks: label + current value on top, the full button cluster below —
   compound selector so it reliably wins over the plain .stat-row rule
   regardless of source order. */
.stat-row.exp-row {
  flex-direction: column;
  align-items: stretch;
  gap: 0.3rem;
}

.exp-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.exp-buttons-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Experience's buttons show their value as text rather than an icon, and
   share the row's full width evenly rather than sitting at a fixed size. */
.exp-btn {
  flex: 1;
  width: auto;
  padding: 0.2rem 0.1rem;
  font-size: 0.68rem;
  font-weight: 700;
}

/* Compound selector so this reliably wins over the later, equal-specificity
   .stat-current width rule regardless of source order. */
.stat-current.exp-current {
  width: 3rem;
  font-size: 0.8rem;
  padding: 0.15rem 0.1rem;
}

/* A little extra breathing room before the refuel button — it's a
   separate action from the current/max pair right before it, not part of
   that cluster, so it shouldn't sit as tight as the other gaps. */
.refuel-btn {
  margin-left: 0.2rem;
}

.stat-current {
  flex-shrink: 0;
  width: 1.75rem;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  font-size: 0.8rem;
  padding: 0.15rem 0.05rem;
}

.stat-sep {
  color: var(--text-faint);
  font-size: 0.75rem;
}

.stat-max {
  flex-shrink: 0;
  width: 1.75rem;
  text-align: center;
  background: none;
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-dim);
  font-size: 0.75rem;
  padding: 0.15rem 0.05rem;
}

.counter-card {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.3rem 0.45rem;
}

.counter-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.counter-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: var(--text-dim);
  flex: 1;
  min-width: 0;
}

.counter-label span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.counter-values {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.counter-hint {
  margin: 0.3rem 0 0;
  font-size: 0.7rem;
  color: var(--text-faint);
  line-height: 1.4;
}

.cp-heading {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--accent-light);
  margin: 0;
}

/* Every section heading doubles as its own collapse toggle — same visual
   language (rotating ▸ arrow, animated grid-row height) as the left sidebar's
   collapsible table categories in App.vue, just scoped to this component. */
.cp-heading.cp-collapsible {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--accent-light);
  user-select: none;
}

.cp-heading-label {
  flex: 1;
  min-width: 0;
}

.cp-collapse-arrow {
  display: inline-block;
  width: 1em;
  flex-shrink: 0;
  color: var(--text-faint);
  transition: transform 0.15s ease;
}

.cp-collapse-arrow.open {
  transform: rotate(90deg);
}

/* Animates open/close via an animatable "auto height" (grid row 0fr → 1fr)
   instead of an instant snap — see the matching App.vue comment on
   .group-links-wrapper, which this mirrors. */
.cp-collapse-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.18s ease;
}

.cp-collapse-wrapper.open {
  grid-template-rows: 1fr;
}

.cp-collapse-inner {
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cp-general-inner {
  gap: 0.35rem;
}

.hitloc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.3rem;
}

.hitloc-cell {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.3rem 0.45rem;
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  font-size: 0.72rem;
}

.hitloc-range {
  flex-shrink: 0;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.hitloc-name {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weak-spot-icon {
  flex-shrink: 0;
}

.die-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.die-item {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.3rem 0.4rem;
}

.die-row {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.die-max-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.3rem;
  margin-top: 0.3rem;
  border-top: 1px dashed var(--border);
}

.die-name {
  flex: 1;
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  font-size: 0.8rem;
  padding: 0.25rem 0.4rem;
}

/* Doubles as the "click to reveal Max" trigger — dotted underline is this
   app's established hint for "clickable but not a full button" (see
   .cell-link / .hint-link elsewhere). */
.die-size-label {
  flex-shrink: 0;
  background: none;
  border: none;
  font-size: 0.75rem;
  color: var(--text-dim);
  min-width: 1.75rem;
  text-align: center;
  border-bottom: 1px dotted var(--text-faint);
  cursor: pointer;
}

.die-size-label:hover {
  color: var(--accent-light);
  border-bottom-style: solid;
}

.die-max {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.68rem;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.die-max select {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-dim);
  font-size: 0.75rem;
  padding: 0.1rem 0.25rem;
  text-transform: none;
  letter-spacing: normal;
  cursor: pointer;
}

/* Hide native number-input spinners — the app's own +/- buttons replace
   them, and the browser's default arrows would just double up. */
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type='number'] {
  appearance: textfield;
  -moz-appearance: textfield;
}

.die-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.3rem;
  height: 1.3rem;
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
}

.die-step:hover:not(:disabled) {
  color: var(--accent-light);
}

.die-step:disabled {
  opacity: 0.35;
  cursor: default;
}

.die-remove {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  background: none;
  border: none;
  border-radius: 5px;
  color: var(--text-faint);
  cursor: pointer;
}

.die-remove:hover {
  background: var(--surface-2);
  color: var(--accent-light);
}

.cp-empty {
  margin: 0;
  color: var(--text-faint);
  font-size: 0.78rem;
  font-style: italic;
}

.cp-usage-actions {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.3rem;
}

.cp-add-btn {
  background: none;
  color: var(--accent-light);
  border: 1px dashed var(--accent);
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.cp-add-btn:hover {
  background: var(--accent-dim);
}

.cp-default-btn {
  background: none;
  color: var(--text-dim);
  border: 1px solid var(--border);
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
}

.cp-default-btn:hover {
  border-color: var(--accent);
  color: var(--accent-light);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
  padding: 1rem;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 360px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal h2 {
  margin: 0 0 0.6rem;
  color: var(--accent-light);
  font-size: 1.1rem;
}

.modal p {
  margin: 0;
  color: var(--text-dim);
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.25rem;
}

.btn-secondary {
  background: none;
  color: var(--text-dim);
  border: 1px solid var(--border);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn-secondary:hover {
  color: var(--text);
  border-color: var(--text-dim);
}

.btn-confirm {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-confirm:hover {
  background: var(--accent-light);
  color: #12060a;
}
</style>
