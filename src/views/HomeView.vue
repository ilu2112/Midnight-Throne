<script setup>
import { computed } from 'vue'
import { Star } from '@lucide/vue'
import { tables, monsters, findTable } from '../registry'
import { starredTables, starredMonsters } from '../lib/starred'
import { characterLevel } from '../lib/characterLevel'
import { overseerInfluence, resistantDamageType, parseInfluence } from '../lib/overseerInfluence'

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
        <label class="level-label" for="character-level">Character level</label>
        <input
          id="character-level"
          v-model.number="characterLevel"
          type="number"
          min="1"
          class="level-input"
        />
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
  </div>
</template>

<style scoped>
.home {
  max-width: 780px;
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
</style>
