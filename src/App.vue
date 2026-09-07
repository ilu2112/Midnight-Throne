<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Star, Info, House, Skull, KeyRound, Lock, ChevronsRight } from '@lucide/vue'
import { tables, groupedTables, findTable } from './registry'
import { starredTables } from './lib/starred'
import CharacterPanel from './components/CharacterPanel.vue'

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

// Which category groups are currently expanded. A plain div+button pair
// (rather than <details>/<summary>) so the open/close transition below can
// actually animate — browsers snap <details> content open/closed instantly,
// with no reliable cross-browser way to animate it.
const openCategories = ref(new Set())
watch(
  activeCategory,
  (category) => {
    if (category) openCategories.value = new Set(openCategories.value).add(category)
  },
  { immediate: true },
)
function isCategoryOpen(category) {
  return openCategories.value.has(category)
}
function toggleCategory(category) {
  const next = new Set(openCategories.value)
  if (next.has(category)) next.delete(category)
  else next.add(category)
  openCategories.value = next
}

const isSearching = computed(() => navSearch.value.trim().length > 0)

const filteredTables = computed(() => {
  const q = navSearch.value.trim().toLowerCase()
  if (!q) return tables
  return tables.filter((t) => t.title.toLowerCase().includes(q) || (t.mastery || '').toLowerCase().includes(q))
})

const sidebarOpen = ref(false)

// Right-hand sidebar — the character quick-reference panel (level, core
// stats, exhaustion, lightsource, usage dice). Collapsible so it doesn't eat
// into the reading width on pages that don't need it; defaults to collapsed
// so it doesn't cost every page 320px of width unasked. Collapsed/expanded
// state is remembered across refreshes, same as the other small per-viewer
// preferences in this app.
const RIGHT_SIDEBAR_STORAGE_KEY = 'kn-right-sidebar-open'

function loadRightSidebarOpen() {
  try {
    const raw = localStorage.getItem(RIGHT_SIDEBAR_STORAGE_KEY)
    return raw === null ? false : raw === 'true'
  } catch {
    return false
  }
}

const rightSidebarOpen = ref(loadRightSidebarOpen())
watch(rightSidebarOpen, (value) => {
  try {
    localStorage.setItem(RIGHT_SIDEBAR_STORAGE_KEY, String(value))
  } catch {
    // Ignore write failures (quota, private mode, etc.) — the toggle just
    // won't be remembered across reloads in that case.
  }
})
</script>

<template>
  <div class="layout">
    <button class="menu-toggle" @click="sidebarOpen = !sidebarOpen" aria-label="Menu">☰</button>

    <button
      type="button"
      class="right-menu-toggle"
      :class="{ 'is-open': rightSidebarOpen }"
      @click="rightSidebarOpen = !rightSidebarOpen"
      :aria-label="rightSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'"
      :title="rightSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'"
    >
      <ChevronsRight :size="18" :stroke-width="2" />
    </button>

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
            <div
              v-for="group in groupedTables"
              :key="group.category"
              class="table-group"
              :class="{ open: isCategoryOpen(group.category) }"
            >
              <button type="button" class="group-summary" @click="toggleCategory(group.category)">
                <span class="group-arrow">▸</span>
                <span class="group-name">{{ group.category }}</span>
                <span class="group-count">({{ group.tables.length }})</span>
              </button>
              <div class="group-links-wrapper">
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
              </div>
            </div>
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

    <aside
      class="right-sidebar"
      :class="{ collapsed: !rightSidebarOpen }"
      @click="!rightSidebarOpen && (rightSidebarOpen = true)"
    >
      <button
        type="button"
        class="right-sidebar-toggle"
        :class="{ 'is-open': rightSidebarOpen }"
        @click.stop="rightSidebarOpen = !rightSidebarOpen"
        :aria-label="rightSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'"
        :title="rightSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'"
      >
        <ChevronsRight :size="17" :stroke-width="2" />
      </button>

      <div class="right-sidebar-content" v-show="rightSidebarOpen">
        <CharacterPanel />
      </div>
    </aside>
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

/* Mirrors .menu-toggle on the opposite corner — mobile-only trigger for the
   right sidebar, since its always-visible in-flow edge handle only makes
   sense in the desktop three-column layout. */
.right-menu-toggle {
  display: none;
  position: fixed;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 20;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  width: 2.5rem;
  height: 2.5rem;
  cursor: pointer;
}

.right-menu-toggle:hover {
  border-color: var(--accent);
  color: var(--accent-light);
}

.right-menu-toggle svg {
  transition: transform 0.2s ease;
}

.right-menu-toggle:not(.is-open) svg {
  transform: rotate(180deg);
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

.group-summary {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  cursor: pointer;
  padding: 0.4rem 0.3rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  user-select: none;
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.group-name {
  flex: 1;
  min-width: 0;
}

.group-arrow {
  display: inline-block;
  width: 1em;
  color: var(--text-faint);
  transition: transform 0.15s ease;
}

.table-group.open .group-arrow {
  transform: rotate(90deg);
}

.group-count {
  color: var(--text-faint);
  font-weight: 400;
  flex-shrink: 0;
  white-space: nowrap;
}

/* Animates open/close instead of the instant snap a native <details>
   element gives you: the wrapper's grid row goes from 0fr to 1fr (an
   animatable "auto height"), and the actual content — sized to fit as
   normal — gets clipped by overflow:hidden while that row is shrinking. */
.group-links-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.18s ease;
}

.table-group.open .group-links-wrapper {
  grid-template-rows: 1fr;
}

.group-links {
  overflow: hidden;
  min-height: 0;
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

/* Intentionally no max-width here: this is the one place page width is
   decided. Text/card-first views (Home, Room Generator, Locks & Traps,
   About) cap their own reading width via --content-max-width; data-first
   views (Bestiary, Table) leave it fluid on purpose. Either way, this flex
   item just fills whatever's left between the two sidebars. */
.content {
  flex: 1;
  padding: 2rem 2.5rem;
  min-width: 0;
}

.right-sidebar {
  width: 320px;
  flex-shrink: 0;
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: row;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  transition: width 0.2s ease;
}

.right-sidebar.collapsed {
  width: 2.25rem;
  cursor: pointer;
}

/* A permanent full-height strip docked to the sidebar's own left edge, in
   both states — its size never changes, so there's nothing to (mis-)animate
   when the sidebar itself expands or collapses. Collapsed, it IS the whole
   rail; expanded, it's a slim always-visible handle beside the content. */
.right-sidebar-toggle {
  flex-shrink: 0;
  width: 2.25rem;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
}

.right-sidebar:not(.collapsed) .right-sidebar-toggle {
  border-right: 1px solid var(--border);
}

.right-sidebar-toggle:hover {
  background: var(--surface-2);
  color: var(--accent-light);
}

.right-sidebar-toggle svg {
  transition: transform 0.2s ease;
}

/* Chevrons point right (away, off-screen) while open — click to collapse
   that way — and flip to point left (back toward the content) once
   collapsed, hinting at "bring it back". */
.right-sidebar-toggle:not(.is-open) svg {
  transform: rotate(180deg);
}

/* Fixed to the sidebar's own final (expanded) width rather than flexing to
   fill it. If this instead flexed to fill the animating parent, the browser
   would reflow its whole contents at every frame of the width transition —
   text rewrapping, rows resizing — which reads as the panel "assembling
   itself" as it opens. Pinned to its resting width, the content is always
   fully laid out; expanding/collapsing the (overflow: hidden) parent just
   reveals or hides more of it, so it reads as sliding in from behind the
   edge instead. */
.right-sidebar-content {
  width: calc(320px - 2.25rem);
  flex-shrink: 0;
  padding: 1rem;
  overflow-y: auto;
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
  /* Same slide-over treatment as the left .sidebar, mirrored to the right
     edge: hidden off-screen by default, sliding in over the content when
     opened via .right-menu-toggle (top-right corner) instead of living
     in-flow as a permanent narrow rail — there's no width to spare for
     that on small screens. Both states are written here (matching the
     ".right-sidebar.collapsed" specificity from the desktop rules above)
     so this media query's width/position reliably wins over it. */
  .right-sidebar,
  .right-sidebar.collapsed {
    position: fixed;
    right: 0;
    top: 0;
    z-index: 15;
    transform: translateX(100%);
    transition: transform 0.2s ease;
    width: 85vw;
    max-width: 320px;
    cursor: default;
  }
  .right-sidebar:not(.collapsed) {
    transform: translateX(0);
  }
  /* The always-visible edge handle only makes sense docked in the desktop
     layout — on mobile, .right-menu-toggle is the trigger instead. */
  .right-sidebar-toggle {
    display: none;
  }
  .right-menu-toggle {
    display: flex;
  }
  /* On mobile the whole sidebar slides via transform (not a width
     transition — see the .right-sidebar rule above), and with the toggle
     hidden, content is the only flex child. It should fill the sidebar's
     mobile width (85vw/320px) rather than stay pinned to the desktop
     content width computed above. */
  .right-sidebar-content {
    width: auto;
    flex: 1;
    min-width: 0;
  }
}
</style>
