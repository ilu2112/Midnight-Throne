<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Star, Info, House, Skull, KeyRound, Lock } from '@lucide/vue'
import { tables, groupedTables, findTable } from './registry'
import { starredTables } from './lib/starred'

const { isStarred, toggleStar } = starredTables

const route = useRoute()
const navSearch = ref('')

// On load (including a page refresh landing directly on a table URL), open
// the sidebar group that contains the table currently being viewed instead
// of leaving it collapsed with only a hidden active link inside.
const activeCategory = computed(() => {
  if (route.name !== 'table-detail') return null
  return findTable(route.params.slug)?.category ?? null
})

const isSearching = computed(() => navSearch.value.trim().length > 0)

const filteredTables = computed(() => {
  const q = navSearch.value.trim().toLowerCase()
  if (!q) return tables
  return tables.filter((t) => t.title.toLowerCase().includes(q) || (t.mastery || '').toLowerCase().includes(q))
})

const sidebarOpen = ref(false)
</script>

<template>
  <div class="layout">
    <button class="menu-toggle" @click="sidebarOpen = !sidebarOpen" aria-label="Menu">☰</button>

    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-scroll">
        <router-link to="/" class="brand" @click="sidebarOpen = false">
          <span class="brand-title">Ker Nethalas</span>
          <span class="brand-sub">Gravebound Edition — reference tables</span>
        </router-link>

        <router-link to="/" class="home-link" @click="sidebarOpen = false">
          <House :size="16" :stroke-width="2" />
          Home
        </router-link>

        <router-link to="/monsters" class="monsters-link" @click="sidebarOpen = false">
          <Skull :size="16" :stroke-width="2" />
          Monsters
        </router-link>

        <router-link to="/room-generator" class="room-generator-link" @click="sidebarOpen = false">
          <KeyRound :size="16" :stroke-width="2" />
          Room Generator
        </router-link>

        <router-link to="/locks-traps" class="locks-traps-link" @click="sidebarOpen = false">
          <Lock :size="16" :stroke-width="2" />
          Locks & Traps
        </router-link>

        <input
          v-model="navSearch"
          type="search"
          placeholder="Search tables…"
          class="nav-search"
        />

        <nav class="table-nav">
          <template v-if="isSearching">
            <div v-for="t in filteredTables" :key="t.slug" class="table-link-row">
              <router-link :to="`/table/${t.slug}`" class="table-link" @click="sidebarOpen = false">
                {{ t.title }}<span v-if="t.mastery" class="table-link-sub"> — {{ t.mastery }}</span>
              </router-link>
              <button
                type="button"
                class="star-btn"
                :class="{ starred: isStarred(t.slug) }"
                :aria-label="isStarred(t.slug) ? 'Unstar table' : 'Star table'"
                :title="isStarred(t.slug) ? 'Unstar table' : 'Star table'"
                @click="toggleStar(t.slug)"
              >
                <Star :size="14" :fill="isStarred(t.slug) ? 'currentColor' : 'none'" :stroke-width="1.75" />
              </button>
            </div>
            <p v-if="filteredTables.length === 0" class="nav-empty">No results</p>
          </template>

          <template v-else>
            <details
              v-for="group in groupedTables"
              :key="group.category"
              class="table-group"
              :open="group.category === activeCategory"
            >
              <summary>
                <span class="group-name">{{ group.category }}</span>
                <span class="group-count">({{ group.tables.length }})</span>
              </summary>
              <div class="group-links">
                <div v-for="t in group.tables" :key="t.slug" class="table-link-row">
                  <router-link :to="`/table/${t.slug}`" class="table-link" @click="sidebarOpen = false">
                    {{ t.title }}<span v-if="t.mastery" class="table-link-sub"> — {{ t.mastery }}</span>
                  </router-link>
                  <button
                    type="button"
                    class="star-btn"
                    :class="{ starred: isStarred(t.slug) }"
                    :aria-label="isStarred(t.slug) ? 'Unstar table' : 'Star table'"
                    :title="isStarred(t.slug) ? 'Unstar table' : 'Star table'"
                    @click="toggleStar(t.slug)"
                  >
                    <Star :size="14" :fill="isStarred(t.slug) ? 'currentColor' : 'none'" :stroke-width="1.75" />
                  </button>
                </div>
              </div>
            </details>
          </template>
        </nav>
      </div>

      <div class="sidebar-footer">
        <router-link to="/about" class="about-link" @click="sidebarOpen = false">
          <Info :size="15" :stroke-width="2" />
          About
        </router-link>
      </div>
    </aside>

    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.menu-toggle {
  display: none;
  position: fixed;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 20;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1.1rem;
}

.sidebar {
  width: 300px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
}

/* Everything above the About button scrolls in its own area (min-height: 0
   is what lets a flex child actually shrink and scroll instead of pushing
   the sidebar's height past 100vh) — the footer below it, outside this
   area, then stays pinned to the bottom of the sidebar no matter how long
   the table list gets. */
.sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1rem 0.75rem;
  gap: 0.75rem;
}

.brand {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0.25rem;
}

.brand-title {
  font-family: 'Cinzel', serif;
  font-size: 1.3rem;
  color: var(--accent);
  letter-spacing: 0.02em;
}

.brand-sub {
  font-size: 0.75rem;
  color: var(--text-dim);
}

/* Boxed like .monsters-link below it, but in a different hue (gold instead
   of the red accent) so the two buttons stay visually distinct instead of
   blending together. */
.home-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: rgba(201, 152, 47, 0.1);
  border: 1px solid #8a6a1f;
  border-radius: 8px;
  text-decoration: none;
  color: #e6bb5c;
  font-weight: 600;
}

.home-link:hover {
  border-color: #c9982f;
}

.home-link.router-link-active {
  background: #e6bb5c;
  color: #2a1d08;
}

.monsters-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: var(--accent-dim);
  border: 1px solid var(--accent);
  border-radius: 8px;
  text-decoration: none;
  color: var(--accent-light);
  font-weight: 600;
}

.monsters-link.router-link-active {
  background: var(--accent);
  color: #12060a;
}

.room-generator-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: rgba(71, 191, 255, 0.1);
  border: 1px solid #1f7ea8;
  border-radius: 8px;
  text-decoration: none;
  color: #47bfff;
  font-weight: 600;
}

.room-generator-link:hover {
  border-color: #47bfff;
}

.room-generator-link.router-link-active {
  background: #47bfff;
  color: #062230;
}

.locks-traps-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: rgba(155, 111, 216, 0.1);
  border: 1px solid #6b4f8a;
  border-radius: 8px;
  text-decoration: none;
  color: #b79bdb;
  font-weight: 600;
}

.locks-traps-link:hover {
  border-color: #b79bdb;
}

.locks-traps-link.router-link-active {
  background: #b79bdb;
  color: #241a33;
}

.nav-search {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.7rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.9rem;
}

.table-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  overflow-y: auto;
}

.table-group {
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.35rem;
  margin-bottom: 0.15rem;
}

.table-group summary {
  cursor: pointer;
  padding: 0.4rem 0.3rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  list-style: none;
  user-select: none;
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.group-name {
  flex: 1;
  min-width: 0;
}

.table-group summary::-webkit-details-marker {
  display: none;
}

.table-group summary::before {
  content: '▸';
  display: inline-block;
  width: 1em;
  color: var(--text-faint);
}

.table-group[open] > summary::before {
  content: '▾';
}

.group-count {
  color: var(--text-faint);
  font-weight: 400;
  flex-shrink: 0;
  white-space: nowrap;
}

.group-links {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding-left: 0.5rem;
}

.table-link-row {
  display: flex;
  align-items: center;
  gap: 0.1rem;
}

.table-link {
  flex: 1;
  min-width: 0;
  padding: 0.45rem 0.65rem;
  border-radius: 6px;
  text-decoration: none;
  color: var(--text-dim);
  font-size: 0.88rem;
  line-height: 1.3;
}

.star-btn {
  flex-shrink: 0;
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

.table-link:hover {
  background: var(--surface-2);
  color: var(--text);
}

.table-link.router-link-active {
  background: var(--accent-dim);
  color: var(--accent-light);
}

.table-link-sub {
  color: var(--text-faint);
}

.nav-empty {
  color: var(--text-faint);
  font-size: 0.85rem;
  padding: 0.5rem 0.65rem;
}

/* Pinned footer, outside .sidebar-scroll, so it stays put at the bottom of
   the sidebar instead of scrolling away with the table list. */
.sidebar-footer {
  flex-shrink: 0;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border);
}

.about-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem 0.75rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-faint);
  font-size: 0.85rem;
  font-weight: 400;
}

.about-link:hover {
  background: var(--surface-2);
  border-color: var(--border);
  color: var(--text-dim);
}

.about-link.router-link-active {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent-light);
}

.content {
  flex: 1;
  padding: 2rem 2.5rem;
  min-width: 0;
}

@media (max-width: 860px) {
  .menu-toggle {
    display: block;
  }
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 15;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    width: 85vw;
    max-width: 320px;
  }
  .sidebar.open {
    transform: translateX(0);
  }
  /* Room for the fixed hamburger button (top: 0.75rem, height 2.5rem),
     which sits above the sidebar (z-index 20) — without this the brand
     logo/title at the top of the sidebar renders underneath it. */
  .sidebar-scroll {
    padding-top: 4rem;
  }
  .content {
    padding: 4.5rem 1.25rem 2rem;
  }
}
</style>
