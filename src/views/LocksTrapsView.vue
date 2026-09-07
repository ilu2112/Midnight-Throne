<script setup>
import { ref, watch, computed } from 'vue'
import { findTable } from '../registry'
import { linkSegments } from '../lib/textLinks'
import { withDamageTypeProseTooltips } from '../lib/damageTypeTooltips'
import { withConditionTooltips } from '../lib/conditionTooltips'
import { fixedTooltip } from '../lib/fixedTooltip'

const vFixedTooltip = fixedTooltip

// Locks & Traps (rulebook p.117-119). Only the GM-side dice — the parts that
// don't depend on a character's own Skills — are rolled here: whether a
// feature is trapped and which trap, whether it's locked, and the suggested
// Difficulty for the Perception check, the Disarm check (p.117, Resolution
// 2.A.I — "The Difficulty of this check is determined by a roll on the
// Random Difficulty table", a SEPARATE roll from Perception's own, even
// though both draw from the same table), the Pick the Lock check (p.118,
// Resolution 2.B.I — not spelled out as explicitly as the other two, but
// its failure clause, "reducing its Difficulty by one step", only makes
// sense if an initial Difficulty was rolled for it the same way), and the
// Brute Force check (2.B.II — the printed rulebook only describes a flat
// +20 per repeat attempt with no separate Difficulty, but per the game's
// author it should get its own rolled Difficulty here too, same as the
// other three checks). The actual checks (Perception, Thievery, Athletics)
// and the player's choice of how to resolve what's found are the player's
// own rolls and decisions, so those are left as a short reminder instead of
// something this tool can roll for you.
const difficultyTable = findTable('difficulty_modifiers')
const trapsTable = findTable('traps')

// Color-codes a rolled Difficulty so it actually stands out at a glance
// (favorable-to-hostile, green to red) instead of reading as just more
// prose — see .difficulty-chip's variants below for the actual colors.
// Keyed on the exact DIFFICULTY column values in
// data/table_difficulty_modifiers.json (note the curly apostrophe in
// "Child’s play" — matches the source PDF's own typography).
const DIFFICULTY_CLASS = {
  'Child’s play': 'diff-trivial',
  Effortless: 'diff-trivial',
  Easy: 'diff-easy',
  Normal: 'diff-normal',
  Demanding: 'diff-demanding',
  Hard: 'diff-hard',
  Impossible: 'diff-impossible',
}

function difficultyClass(name) {
  return DIFFICULTY_CLASS[name] ?? 'diff-normal'
}

function formatModifier(modifier) {
  return `${modifier >= 0 ? '+' : ''}${modifier}`
}

// Same link/tooltip pipeline TableView.vue applies to the Traps table's own
// TRAP EFFECT column, so hovering a damage type in this preview (e.g.
// "Piercing damage") matches hovering it on the Traps table itself, and a
// "Roll on the Combat Encounter table" effect (D10: 9) still links out.
function trapEffectSegments(text) {
  const linked = linkSegments(text, 'traps')
  const withDamage = withDamageTypeProseTooltips(linked)
  return withConditionTooltips(withDamage)
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1
}

function matchesRoll(cellValue, roll) {
  const str = String(cellValue).trim()
  if (str.includes('-')) {
    const [lo, hi] = str.split('-').map((n) => Number(n.trim()))
    return roll >= lo && roll <= hi
  }
  return Number(str) === roll
}

function rowFor(table, roll) {
  const dieCol = table.columns[0]
  return table.rows.find((r) => matchesRoll(r[dieCol], roll))
}

// Persist the last check across refreshes, same as Room Generator.
const STORAGE_KEY = 'kn-locks-traps-state'

function loadStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

const stored = loadStoredState()

const featureType = ref(stored?.featureType ?? 'door')
const result = ref(stored?.result ?? null)
// Whether a trap is present depends on the player's own Perception check
// against the rolled Difficulty — so the trap roll stays hidden from the
// table until the GM reveals it, instead of spoiling the outcome upfront.
const trapRevealed = ref(stored?.trapRevealed ?? false)

watch(
  [featureType, result, trapRevealed],
  ([featureTypeValue, resultValue, trapRevealedValue]) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ featureType: featureTypeValue, result: resultValue, trapRevealed: trapRevealedValue }),
      )
    } catch {}
  },
  { deep: true },
)

const hasResolutionReminders = computed(() => (trapRevealed.value && result.value?.isTrapped) || result.value?.isLocked)

function checkFeature() {
  trapRevealed.value = false
  const isContainer = featureType.value === 'container'

  // Suggested Difficulty for the Perception check the player makes to spot a trap.
  const difficultyRoll = rollDie(8)
  const difficultyRow = rowFor(difficultyTable, difficultyRoll)

  // Is it trapped? (D10, 7+)
  const trapRoll = rollDie(10)
  const isTrapped = trapRoll >= 7
  let trap = null
  let disarmDifficultyRoll = null
  let disarmDifficultyRow = null
  if (isTrapped) {
    const trapTypeRoll = rollDie(10)
    trap = { roll: trapTypeRoll, row: rowFor(trapsTable, trapTypeRoll) }
    // Disarm's own Difficulty — a separate roll from the Perception
    // Difficulty above, not a reuse of it (see this file's top comment).
    disarmDifficultyRoll = rollDie(8)
    disarmDifficultyRow = rowFor(difficultyTable, disarmDifficultyRoll)
  }

  // Is it locked? (D20 — Door 12+, Container 10+)
  const lockRoll = rollDie(20)
  const lockThreshold = isContainer ? 10 : 12
  const isLocked = lockRoll >= lockThreshold
  let pickLockDifficultyRoll = null
  let pickLockDifficultyRow = null
  let bruteForceDifficultyRoll = null
  let bruteForceDifficultyRow = null
  if (isLocked) {
    // Pick the Lock's own Difficulty — see this file's top comment.
    pickLockDifficultyRoll = rollDie(8)
    pickLockDifficultyRow = rowFor(difficultyTable, pickLockDifficultyRoll)
    // Brute Force's own Difficulty — a separate roll from Pick the Lock's,
    // not a reuse of it (same as Disarm vs. Perception above). Added per
    // the game's author — see this file's top comment.
    bruteForceDifficultyRoll = rollDie(8)
    bruteForceDifficultyRow = rowFor(difficultyTable, bruteForceDifficultyRoll)
  }

  result.value = {
    isContainer,
    difficultyRoll,
    difficultyName: difficultyRow?.DIFFICULTY,
    difficultyModifier: difficultyRow?.MODIFIER,
    trapRoll,
    isTrapped,
    trap,
    disarmDifficultyRoll,
    disarmDifficultyName: disarmDifficultyRow?.DIFFICULTY,
    disarmDifficultyModifier: disarmDifficultyRow?.MODIFIER,
    lockRoll,
    lockThreshold,
    isLocked,
    pickLockDifficultyRoll,
    pickLockDifficultyName: pickLockDifficultyRow?.DIFFICULTY,
    pickLockDifficultyModifier: pickLockDifficultyRow?.MODIFIER,
    bruteForceDifficultyRoll,
    bruteForceDifficultyName: bruteForceDifficultyRow?.DIFFICULTY,
    bruteForceDifficultyModifier: bruteForceDifficultyRow?.MODIFIER,
  }
}

const showClearConfirm = ref(false)

function requestClear() {
  showClearConfirm.value = true
}

function cancelClear() {
  showClearConfirm.value = false
}

function confirmClear() {
  result.value = null
  trapRevealed.value = false
  showClearConfirm.value = false
}
</script>

<template>
  <div class="locks-traps">
    <h1>Locks & Traps</h1>
    <p class="lead">Rolls the GM-side checks for a door or container (page 117) — whether it's trapped, which trap, and whether it's locked.</p>

    <div class="feature-toggle">
      <button
        type="button"
        :class="{ active: featureType === 'door' }"
        @click="featureType = 'door'"
      >
        Door
      </button>
      <button
        type="button"
        :class="{ active: featureType === 'container' }"
        @click="featureType = 'container'"
      >
        Container
      </button>
    </div>

    <div class="actions">
      <button type="button" class="check-btn" @click="checkFeature">Check Feature</button>
      <button v-if="result" type="button" class="clear-btn" @click="requestClear">Clear</button>
    </div>

    <div v-if="result" class="result">
      <section class="block">
        <h2>Perception Difficulty <span class="badge">D8: {{ result.difficultyRoll }}</span></h2>
        <p>
          <span class="difficulty-chip" :class="difficultyClass(result.difficultyName)">
            {{ result.difficultyName }} <span class="difficulty-mod">({{ formatModifier(result.difficultyModifier) }})</span>
          </span>
          — roll the player's Perception check against this Difficulty to spot a trap.
        </p>
      </section>

      <section class="block">
        <h2>
          Trapped?
          <span v-if="trapRevealed" class="badge">D10: {{ result.trapRoll }} (needs 7+)</span>
        </h2>
        <template v-if="!trapRevealed">
          <p class="note">Hidden until the player's Perception check is resolved.</p>
          <button type="button" class="reveal-btn" @click="trapRevealed = true">Reveal</button>
        </template>
        <template v-else-if="result.isTrapped">
          <p>
            Trapped —
            <router-link :to="`/table/${trapsTable.slug}`" class="cell-link">Traps</router-link>
            <span class="badge">D10: {{ result.trap.roll }}</span>
          </p>
          <p>
            <strong>{{ result.trap.row?.['SKILL CHECK TO AVOID'] }} check to avoid:</strong>{{ ' ' }}<template
              v-for="(seg, si) in trapEffectSegments(result.trap.row?.['TRAP EFFECT'])"
              :key="si"
            >
              <router-link v-if="seg.to" :to="seg.to" class="cell-link">{{ seg.text }}</router-link>
              <span v-else-if="seg.tooltip" v-fixed-tooltip class="trait-tip">
                {{ seg.text }}
                <span class="tooltip-box">{{ seg.tooltip }}</span>
              </span>
              <template v-else>{{ seg.text }}</template>
            </template>
          </p>
        </template>
        <p v-else class="note">Not trapped.</p>
      </section>

      <section class="block">
        <h2>Locked? <span class="badge">D20: {{ result.lockRoll }} (needs {{ result.lockThreshold }}+)</span></h2>
        <p>{{ result.isLocked ? 'Locked.' : 'Unlocked.' }}</p>
      </section>

      <section v-if="hasResolutionReminders" class="block reminder">
        <h2>Resolution reminders</h2>
        <!-- Page 62: "Successfully dismantle a trap: +10 XP" (Disarm is the
             one method that actually dismantles it — Bypass and voluntarily
             Triggering it just avoid or accept it) and "Open a locked door or
             container, regardless of the method: +10 XP" (both Pick the lock
             and Brute force count). -->
        <ul>
          <li v-if="trapRevealed && result.isTrapped" class="resolution-item">
            <div class="resolution-head">
              <strong>Disarm</strong>
              <span class="difficulty-chip" :class="difficultyClass(result.disarmDifficultyName)">
                {{ result.disarmDifficultyName }} <span class="difficulty-mod">({{ formatModifier(result.disarmDifficultyModifier) }})</span>
              </span>
              <span class="badge">D8: {{ result.disarmDifficultyRoll }}</span>
            </div>
            <p class="resolution-detail">Thievery check (Thieves' Tools) against this Difficulty. Failure triggers the trap. Success is worth <strong>+10 XP</strong>.</p>
          </li>
          <li v-if="trapRevealed && result.isTrapped" class="resolution-item">
            <div class="resolution-head"><strong>Bypass</strong> <span class="note-inline">(Environmental traps only)</span></div>
            <p class="resolution-detail">Skill check to avoid, +20. Failure triggers the trap.</p>
          </li>
          <li v-if="trapRevealed && result.isTrapped" class="resolution-item">
            <div class="resolution-head"><strong>Trigger voluntarily</strong></div>
            <p class="resolution-detail">+20 to the trap's avoidance check.</p>
          </li>
          <li v-if="result.isLocked" class="resolution-item">
            <div class="resolution-head">
              <strong>Pick the lock</strong>
              <span class="difficulty-chip" :class="difficultyClass(result.pickLockDifficultyName)">
                {{ result.pickLockDifficultyName }} <span class="difficulty-mod">({{ formatModifier(result.pickLockDifficultyModifier) }})</span>
              </span>
              <span class="badge">D8: {{ result.pickLockDifficultyRoll }}</span>
            </div>
            <p class="resolution-detail">Thievery check (Lockpick) against this Difficulty. Failure breaks the Lockpick, but the next attempt's Difficulty drops one step. Success is worth <strong>+10 XP</strong>.</p>
          </li>
          <li v-if="result.isLocked" class="resolution-item">
            <div class="resolution-head">
              <strong>Brute force</strong>
              <span class="difficulty-chip" :class="difficultyClass(result.bruteForceDifficultyName)">
                {{ result.bruteForceDifficultyName }} <span class="difficulty-mod">({{ formatModifier(result.bruteForceDifficultyModifier) }})</span>
              </span>
              <span class="badge">D8: {{ result.bruteForceDifficultyRoll }}</span>
            </div>
            <p class="resolution-detail">Athletics check against this Difficulty. Each attempt (success or failure) triggers a Tension Die check for the noise. Failed attempts after the first add +20 to it. Success is worth <strong>+10 XP</strong>.</p>
          </li>
        </ul>
      </section>
    </div>

    <div v-if="showClearConfirm" class="modal-overlay" @click.self="cancelClear">
      <div class="modal">
        <h2>Clear this check?</h2>
        <p>This removes the current result and its saved state. This can't be undone.</p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" @click="cancelClear">Cancel</button>
          <button type="button" class="btn-danger" @click="confirmClear">Clear</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.locks-traps {
  max-width: var(--content-max-width);
}

.lead {
  color: var(--text-dim);
  line-height: 1.5;
  margin-bottom: 1.25rem;
}

.feature-toggle {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.feature-toggle button {
  background: var(--surface);
  color: var(--text-dim);
  border: none;
  padding: 0.5rem 1.1rem;
  font-size: 0.9rem;
  cursor: pointer;
}

.feature-toggle button + button {
  border-left: 1px solid var(--border);
}

.feature-toggle button.active {
  background: var(--accent);
  color: #fff;
}

.actions {
  display: flex;
  gap: 0.75rem;
}

.check-btn {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 0.65rem 1.25rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

.clear-btn {
  background: none;
  color: var(--text-dim);
  border: 1px solid var(--border);
  padding: 0.65rem 1.25rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

.clear-btn:hover {
  border-color: var(--accent);
  color: var(--accent-light);
}

.check-btn:hover {
  background: var(--accent-light);
  color: #12060a;
}

.reveal-btn {
  background: none;
  color: var(--accent-light);
  border: 1px solid var(--accent);
  padding: 0.4rem 0.9rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 0.5rem;
}

.reveal-btn:hover {
  background: var(--accent);
  color: #fff;
}

.result {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.5rem;
}

.block {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.block h2 {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1rem;
  margin: 0 0 0.6rem;
  color: var(--accent-light);
}

.block p {
  margin: 0;
  line-height: 1.55;
  color: var(--text);
}

.block p + p {
  margin-top: 0.5rem;
}

.block.reminder {
  border-style: dashed;
}

.block.reminder ul {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  color: var(--text);
  line-height: 1.5;
}

.resolution-item {
  /* Was a single run-on sentence with the Difficulty buried mid-clause —
     splitting the check's name + its Difficulty chip onto their own row
     (resolution-head) from the rest of the description (resolution-detail)
     is what actually makes the Difficulty readable at a glance instead of
     something you have to hunt for in a paragraph. */
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.resolution-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.resolution-detail {
  margin: 0;
  color: var(--text-dim);
}

.note-inline {
  color: var(--text-faint);
  font-size: 0.85rem;
}

/* Color-coded by how favorable the roll is to the player attempting the
   check — green (easy) fading through neutral (Normal) to red (near-
   impossible) — so the Difficulty reads at a glance instead of disappearing
   into the surrounding prose as just another word. Colors are deliberately
   distinct from --accent (the app's own brand/danger red, used everywhere
   else for buttons and highlights) except at the "Impossible" end, where
   reusing that same red is fitting — that IS the worst case. */
.difficulty-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.85rem;
  border: 1px solid transparent;
  white-space: nowrap;
}

.difficulty-mod {
  font-weight: 600;
  font-size: 0.76rem;
  opacity: 0.85;
}

.difficulty-chip.diff-trivial {
  background: rgba(122, 178, 94, 0.16);
  color: #9bd17e;
  border-color: rgba(122, 178, 94, 0.4);
}

.difficulty-chip.diff-easy {
  background: rgba(178, 189, 94, 0.16);
  color: #c3cf8c;
  border-color: rgba(178, 189, 94, 0.4);
}

.difficulty-chip.diff-normal {
  background: var(--surface-2);
  color: var(--text-dim);
  border-color: var(--border);
}

.difficulty-chip.diff-demanding {
  background: rgba(201, 138, 61, 0.18);
  color: #e0a866;
  border-color: rgba(201, 138, 61, 0.45);
}

.difficulty-chip.diff-hard {
  background: rgba(194, 96, 58, 0.2);
  color: #e08c66;
  border-color: rgba(194, 96, 58, 0.5);
}

.difficulty-chip.diff-impossible {
  background: var(--accent-dim);
  color: var(--accent-light);
  border-color: var(--accent);
}

.note {
  color: var(--text-faint);
}

.badge {
  display: inline-block;
  background: var(--surface-2);
  color: var(--text-dim);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 400;
}

.cell-link {
  color: var(--accent-light);
  text-decoration: none;
  border-bottom: 1px dotted var(--accent-light);
}

.cell-link:hover {
  border-bottom-style: solid;
}

.trait-tip {
  display: inline-block;
  cursor: help;
  color: var(--accent-light);
  border-bottom: 1px dotted var(--accent-light);
}

/* Positioned by the v-fixed-tooltip directive (position: fixed + computed
   top/left) rather than CSS — see lib/fixedTooltip.js. */
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

.btn-danger {
  background: #b3382c;
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-danger:hover {
  background: #d1493b;
}
</style>
