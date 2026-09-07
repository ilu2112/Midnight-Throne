<script setup>
import { computed, ref } from 'vue'
import { Star, Download, Upload } from '@lucide/vue'
import { tables, monsters, findTable } from '../registry'
import { starredTables, starredMonsters } from '../lib/starred'
import { characterLevel, characterName } from '../lib/characterLevel'
import { overseerInfluence, resistantDamageType, parseInfluence } from '../lib/overseerInfluence'
import { downloadSave, loadSaveFromFile } from '../lib/saveGame'

// Preserves the order things were starred in, rather than their
// alphabetical registry order.
const starredTableList = computed(() =>
  starredTables.slugs.value.map((slug) => tables.find((t) => t.slug === slug)).filter(Boolean),
)
const starredMonsterList = computed(() =>
  starredMonsters.slugs.value.map((slug) => monsters.find((m) => m.slug === slug)).filter(Boolean),
)

const overseerInfluenceTable = findTable('overseer_influence')
const overseerInfluenceOptions = computed(
  () => overseerInfluenceTable?.rows.map((r) => ({ d10: r.D10, ...parseInfluence(r['OVERSEER INFLUENCE']) })) || [],
)

// "Resistant" is rolled randomly against the Damage Type table (page 100)
// rather than being a fixed effect, so a second dropdown appears only when
// that's the active Influence, to record what it rolled.
const isResistantActive = computed(
  () => overseerInfluenceOptions.value.find((o) => o.d10 === overseerInfluence.value)?.name === 'Resistant',
)
const damageTypeTable = findTable('damage_type')
const damageTypeOptions = computed(() => {
  const seen = new Set()
  return (damageTypeTable?.rows || []).map((r) => r['DAMAGE TYPE']).filter((t) => t && !seen.has(t) && seen.add(t))
})

// --- Save game (download / load) ------------------------------------------
const fileInput = ref(null)
const pendingFile = ref(null)
const showLoadConfirm = ref(false)
const loadError = ref('')

function triggerDownload() {
  downloadSave(characterName.value)
}

function openFilePicker() {
  loadError.value = ''
  fileInput.value?.click()
}

function onFileChosen(event) {
  const file = event.target.files?.[0]
  event.target.value = '' // allow choosing the same file again later
  if (!file) return
  pendingFile.value = file
  showLoadConfirm.value = true
}

function cancelLoad() {
  showLoadConfirm.value = false
  pendingFile.value = null
}

async function confirmLoad() {
  const file = pendingFile.value
  showLoadConfirm.value = false
  pendingFile.value = null
  if (!file) return

  const result = await loadSaveFromFile(file)
  if (result.ok) {
    // Most persisted state lives in module-scoped refs that only read
    // localStorage once at import time, so a reload is the simplest way
    // to make every view pick up the freshly-loaded save.
    window.location.reload()
  } else {
    loadError.value = result.error || 'Could not load that save.'
  }
}
</script>

<template>
  <div class="home">
    <h1>Ker Nethalas — Gravebound Edition</h1>
    <p class="lead">
      A searchable reference for the rulebook's tables. Pick a table from the sidebar,
      or jump straight into the bestiary for full monster stat blocks.
    </p>

    <section class="level-section">
      <div class="level-col">
        <div class="level-row">
          <label class="level-label" for="character-name">Character name</label>
          <input
            id="character-name"
            v-model.trim="characterName"
            type="text"
            placeholder="Unnamed"
            class="level-input name-input"
          />
        </div>

        <div class="level-row">
          <label class="level-label" for="character-level">Character level</label>
          <input
            id="character-level"
            v-model.number="characterLevel"
            type="number"
            min="1"
            class="level-input"
          />
        </div>
        <p class="level-hint">
          Used on a monster's page to show which Level Adaptation changes already apply to your party — most monsters gain extra abilities at level 5 and level 10.
        </p>
      </div>

      <div class="level-col">
        <label class="level-label" for="overseer-influence">Current Overseer Influence</label>
        <select id="overseer-influence" v-model="overseerInfluence" class="level-input overseer-select">
          <option :value="null">None</option>
          <option v-for="opt in overseerInfluenceOptions" :key="opt.d10" :value="opt.d10">{{ opt.name }}</option>
        </select>
        <p class="level-hint">
          Rolled once per Domain and applied to every creature in it (except the Overseer itself) — pick it here to see how it currently affects a monster's page.
        </p>
        <!-- Page 62 — the two Domain-scoped XP rewards, anchored here since
             this is the app's other per-Domain control. -->
        <p class="level-hint">
          Entering a new Domain is worth <strong>+50 XP</strong>; defeating its Overseer is worth <strong>+200 XP</strong>.
        </p>

        <template v-if="isResistantActive">
          <label class="level-label" for="resistant-damage-type">Resistant to</label>
          <select id="resistant-damage-type" v-model="resistantDamageType" class="level-input overseer-select">
            <option :value="null">Not rolled yet</option>
            <option v-for="t in damageTypeOptions" :key="t" :value="t">{{ t }}</option>
          </select>
          <p class="level-hint">
            "Resistant" rolls a random type on the
            <router-link v-if="damageTypeTable" :to="`/table/${damageTypeTable.slug}`" class="hint-link">Damage Type</router-link>
            <template v-else>Damage Type</template>
            table (page 225) — pick what it rolled here to see it on a monster's page.
          </p>
        </template>
      </div>
    </section>

    <section class="featured">
      <h2>Starred tables</h2>

      <div v-if="starredTableList.length" class="featured-grid">
        <router-link
          v-for="t in starredTableList"
          :key="t.slug"
          :to="`/table/${t.slug}`"
          class="featured-card"
        >
          <button
            type="button"
            class="unstar-btn"
            aria-label="Unstar table"
            title="Unstar table"
            @click.stop.prevent="starredTables.toggleStar(t.slug)"
          >
            <Star :size="15" fill="currentColor" :stroke-width="1.75" />
          </button>
          <strong>{{ t.title }}</strong>
          <span v-if="t.pages.length">{{ t.isMultiPage ? 'pages' : 'page' }} {{ t.pages.join(', ') }}</span>
        </router-link>
      </div>
      <p v-else class="featured-empty">
        No starred tables yet — click the ☆ next to a table's name to add it here.
      </p>
    </section>

    <section class="featured">
      <h2>Starred monsters</h2>

      <div v-if="starredMonsterList.length" class="featured-grid">
        <router-link
          v-for="m in starredMonsterList"
          :key="m.slug"
          :to="`/monsters/${m.slug}`"
          class="featured-card"
          :class="{ 'featured-card-overseer': m.OVERSEER }"
        >
          <button
            type="button"
            class="unstar-btn"
            aria-label="Unstar monster"
            title="Unstar monster"
            @click.stop.prevent="starredMonsters.toggleStar(m.slug)"
          >
            <Star :size="15" fill="currentColor" :stroke-width="1.75" />
          </button>
          <strong>{{ m.name }}</strong>
          <span v-if="m.OVERSEER" class="overseer-tag">Overseer</span>
          <span v-else-if="m.TYPE">{{ m.TYPE }}</span>
        </router-link>
      </div>
      <p v-else class="featured-empty">
        No starred monsters yet — click the ☆ next to a monster's name to add it here.
      </p>
    </section>

    <section class="save-section">
      <h2>Save game</h2>
      <p class="level-hint save-hint">
        Downloads everything saved in this browser (level, experience, checked stats, starred entries, and so on) as one file, so you can back it up or move it to another device. Loading a save file replaces everything currently stored here.
      </p>
      <div class="save-actions">
        <button type="button" class="btn-secondary save-btn" @click="triggerDownload">
          <Download :size="15" />
          Download save
        </button>
        <button type="button" class="btn-secondary save-btn" @click="openFilePicker">
          <Upload :size="15" />
          Load save
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json"
          class="visually-hidden"
          @change="onFileChosen"
        />
      </div>
      <p v-if="loadError" class="save-error">{{ loadError }}</p>
    </section>

    <div v-if="showLoadConfirm" class="modal-overlay" @click.self="cancelLoad">
      <div class="modal">
        <h2>Load this save?</h2>
        <p>This replaces everything currently saved in this browser — level, experience, checked stats, starred entries, and so on. This can't be undone.</p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" @click="cancelLoad">Cancel</button>
          <button type="button" class="btn-danger" @click="confirmLoad">Load save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  max-width: var(--content-max-width);
}

.lead {
  color: var(--text-dim);
  line-height: 1.5;
  margin-bottom: 1.75rem;
}

.level-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.75rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

@media (max-width: 640px) {
  .level-section {
    grid-template-columns: 1fr;
  }
}

.level-col {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  align-content: flex-start;
  gap: 0.6rem 0.9rem;
}

.level-row {
  flex-basis: 100%;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem 0.9rem;
}

.level-label {
  font-weight: 600;
  color: var(--accent-light);
  font-size: 0.92rem;
}

.level-input {
  width: 5rem;
  padding: 0.4rem 0.6rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.95rem;
}

.overseer-select {
  width: 100%;
  cursor: pointer;
}

.name-input {
  width: 12rem;
  max-width: 100%;
}

.level-hint {
  flex-basis: 100%;
  margin: 0;
  color: var(--text-faint);
  font-size: 0.82rem;
  line-height: 1.5;
}

.hint-link {
  color: var(--accent-light);
  text-decoration: none;
  border-bottom: 1px dotted var(--accent-light);
}

.hint-link:hover {
  border-bottom-style: solid;
}

.save-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  margin-top: 2rem;
}

.save-section h2 {
  font-size: 1.05rem;
  margin: 0 0 0.5rem;
  color: var(--accent-light);
}

.save-hint {
  margin-bottom: 0.9rem;
}

.save-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.save-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.save-error {
  margin: 0.75rem 0 0;
  color: #e0473d;
  font-size: 0.85rem;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.featured h2 {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
}

.featured + .featured {
  margin-top: 2rem;
}

.featured-empty {
  color: var(--text-faint);
  font-size: 0.88rem;
  font-style: italic;
}

.featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.6rem;
}

.featured-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.75rem 2.1rem 0.75rem 0.85rem;
  text-decoration: none;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.unstar-btn {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  background: none;
  border: none;
  border-radius: 6px;
  color: #e6bb5c;
  cursor: pointer;
}

.unstar-btn:hover {
  background: var(--surface-2);
}

.featured-card:hover {
  border-color: var(--accent);
}

.featured-card span {
  font-size: 0.78rem;
  color: var(--text-faint);
}

.featured-card-overseer {
  border-color: #8a6a1f;
  background: linear-gradient(180deg, rgba(201, 152, 47, 0.1), var(--surface));
}

.featured-card-overseer:hover {
  border-color: #c9982f;
}

.overseer-tag {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #e6bb5c;
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
