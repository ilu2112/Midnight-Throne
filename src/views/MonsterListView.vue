<script setup>
import { ref, computed } from 'vue'
import { Star } from '@lucide/vue'
import { monsters } from '../registry'
import { starredMonsters } from '../lib/starred'

const { isStarred, toggleStar } = starredMonsters

const search = ref('')
const typeFilter = ref('')
const kindFilter = ref('')

const types = computed(() => {
  const set = new Set(monsters.map((m) => m.TYPE).filter(Boolean))
  return [...set].sort()
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return monsters.filter((m) => {
    if (typeFilter.value && m.TYPE !== typeFilter.value) return false
    if (kindFilter.value === 'overseer' && !m.OVERSEER) return false
    if (kindFilter.value === 'standard' && m.OVERSEER) return false
    if (!q) return true
    return (
      m.name.toLowerCase().includes(q) ||
      (m.TRAIT || '').toLowerCase().includes(q) ||
      (m.TYPE || '').toLowerCase().includes(q)
    )
  })
})
</script>

<template>
  <div class="monster-list">
    <h1>Bestiary</h1>

    <div class="controls">
      <input v-model="search" type="search" class="search" placeholder="Search monsters…" />
      <select v-model="typeFilter" class="type-select">
        <option value="">All types</option>
        <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="kindFilter" class="type-select">
        <option value="">Standard &amp; Overseer</option>
        <option value="standard">Standard</option>
        <option value="overseer">Overseer</option>
      </select>
    </div>

    <p class="count">{{ filtered.length }} / {{ monsters.length }} monsters</p>

    <div class="grid">
      <router-link
        v-for="m in filtered"
        :key="m.slug"
        :to="`/monsters/${m.slug}`"
        class="card"
        :class="{ 'card-overseer': m.OVERSEER }"
      >
        <button
          type="button"
          class="star-btn"
          :class="{ starred: isStarred(m.slug) }"
          :aria-label="isStarred(m.slug) ? 'Unstar monster' : 'Star monster'"
          :title="isStarred(m.slug) ? 'Unstar monster' : 'Star monster'"
          @click.stop.prevent="toggleStar(m.slug)"
        >
          <Star :size="15" :fill="isStarred(m.slug) ? 'currentColor' : 'none'" :stroke-width="1.75" />
        </button>
        <div class="card-top">
          <strong>{{ m.name }}</strong>
          <span v-if="m.OVERSEER" class="overseer-badge">Overseer</span>
          <span v-if="m.TYPE" class="type-badge">{{ m.TYPE }}</span>
        </div>
      </router-link>
    </div>

    <p v-if="filtered.length === 0" class="empty">No results.</p>
  </div>
</template>

<style scoped>
.lead {
  color: var(--text-dim);
  max-width: 700px;
  margin-bottom: 1.25rem;
}

.controls {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}

.search,
.type-select {
  padding: 0.55rem 0.75rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.9rem;
}

.search {
  flex: 1;
  min-width: 220px;
  max-width: 360px;
}

.count {
  color: var(--text-faint);
  font-size: 0.82rem;
  margin-bottom: 1rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}

.card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.85rem 2.2rem 0.85rem 0.95rem;
  text-decoration: none;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.star-btn {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.7rem;
  height: 1.7rem;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--text-faint);
  cursor: pointer;
}

.star-btn:hover {
  background: var(--surface-2);
  color: var(--accent-light);
}

.star-btn.starred {
  color: #e6bb5c;
}

.card:hover {
  border-color: var(--accent);
}

.card-overseer {
  border-color: #8a6a1f;
  background: linear-gradient(180deg, rgba(201, 152, 47, 0.1), var(--surface));
}

.card-overseer:hover {
  border-color: #c9982f;
}

.card-top {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.card-top strong {
  font-family: 'Cinzel', serif;
}

.overseer-badge {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #e6bb5c;
  background: rgba(201, 152, 47, 0.16);
  border: 1px solid #8a6a1f;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
  width: fit-content;
}

.type-badge {
  font-size: 0.72rem;
  color: var(--text-faint);
  font-weight: 400;
}

.card-stats {
  display: flex;
  gap: 0.75rem;
  font-size: 0.82rem;
  color: var(--text-dim);
  flex-wrap: wrap;
}

.empty {
  color: var(--text-faint);
  margin-top: 1rem;
}
</style>
