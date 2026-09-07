<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Star, Info, House, Skull, KeyRound, Lock, ChevronsRight, Table } from '@lucide/vue'
import { tables, groupedTables, findTable, monsters } from './registry'
import { starredTables, starredMonsters } from './lib/starred'
import { settings } from './lib/settings'
import {
  viewportWidth,
  watchViewportWidth,
  diceDockRightEdge,
  rightSidebarOpen,
  rightSidebarLeftEdge,
  MOBILE_BREAKPOINT,
} from './lib/layout'
import CharacterPanel from './components/CharacterPanel.vue'
import HistoryDock from './components/HistoryDock.vue'
import DiceDock from './components/DiceDock.vue'

let stopViewportWatch = null
onMounted(() => {
  stopViewportWatch = watchViewportWidth()
})
onUnmounted(() => {
  stopViewportWatch?.()
})

// Whether DiceDock's real, live-measured right edge (see lib/layout.js and
// DiceDock.vue's own comments — this used to be a hand-derived "below
// 1320px" breakpoint that turned out to be measured against the wrong
// font) currently reaches far enough right to pass under the expanded
// right sidebar, which needs to know that to reserve top clearance for it.
// Compared against rightSidebarLeftEdge (not a hardcoded width) so this
// stays correct however the sidebar happens to be sized — though in
// practice DiceDock itself already hides outright the moment it would
// otherwise run under the sidebar in EITHER state (see that component's own
// overlapsRightSidebar), so diceDockRightEdge is only ever nonzero here
// while the sidebar is open anyway. Also gated on settings.topDockEnabled
// directly (not just relying on diceDockRightEdge falling back to 0 once
// DiceDock unmounts — see that ref's own reset in DiceDock.vue's
// onUnmounted) so this can never read stale/leftover geometry from before
// the dock was turned off in Settings.
const diceDockReachesRightSidebar = computed(
  () => settings.value.topDockEnabled && diceDockRightEdge.value > rightSidebarLeftEdge.value,
)

// Only overrides .right-sidebar-content's padding-top above the mobile
// breakpoint — below it the sidebar becomes a full off-canvas slide-over
// panel with its own separate mobile padding rule (see that media query
// below), unrelated to DiceDock (which is hidden outright on mobile
// anyway) — undefined here lets that CSS rule apply normally instead of
// this inline style clobbering it.
const rightSidebarPaddingTop = computed(() => {
  if (viewportWidth.value <= MOBILE_BREAKPOINT) return undefined
  return diceDockReachesRightSidebar.value ? '5rem' : '1.5rem'
})

// .content's own top/bottom padding (see that rule's own comment) reserves
// room for DiceDock/HistoryDock unconditionally whenever each is enabled —
// same "always reserve the max, don't reactively resize on every viewport
// wobble" reasoning as rightSidebarPaddingTop's own comment, just simpler
// here since .content doesn't need to react to a dock's width or position,
// only to whether it exists at all. Settings: "Enable top/bottom dock" off
// drops the corresponding side back to the same 2rem baseline every other
// page section uses, instead of leaving dead reserved space where a
// disabled dock used to float — which is exactly the mismatch a disabled
// top dock left behind against the right sidebar's own (already-conditional)
// 1.5rem, before this existed.
const contentPaddingTop = computed(() => (settings.value.topDockEnabled ? '5rem' : '2rem'))
const contentPaddingBottom = computed(() => (settings.value.bottomDockEnabled ? '6rem' : '2rem'))

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

// Left sidebar's two tabs: the full categorized/searchable table list, or a
// flat view of everything currently starred (tables and monsters alike).
const sidebarTab = ref('all')

// Preserves the order things were starred in, rather than registry order —
// same computeds as HomeView's "Starred tables"/"Starred monsters" sections.
const starredTableList = computed(() =>
  starredTables.slugs.value.map((slug) => tables.find((t) => t.slug === slug)).filter(Boolean),
)
const starredMonsterList = computed(() =>
  starredMonsters.slugs.value.map((slug) => monsters.find((m) => m.slug === slug)).filter(Boolean),
)

// Tables first, then monsters — one flat list for the "Starred items" tab,
// each row tagged with its kind so the template can pick an icon.
const starredItems = computed(() => [
  ...starredTableList.value.map((t) => ({
    kind: 'table',
    key: `table-${t.slug}`,
    to: `/table/${t.slug}`,
    title: t.title,
    mastery: t.mastery,
  })),
  ...starredMonsterList.value.map((m) => ({
    kind: 'monster',
    key: `monster-${m.slug}`,
    to: `/monsters/${m.slug}`,
    title: m.name,
    mastery: null,
  })),
])

const sidebarOpen = ref(false)

// Right-hand sidebar — the character quick-reference panel (level, core
// stats, exhaustion, lightsource, usage dice). Collapsible so it doesn't eat
// into the reading width on pages that don't need it; defaults to collapsed
// so it doesn't cost every page 332px of width unasked. Collapsed/expanded
// state (rightSidebarOpen, imported above) is remembered across refreshes,
// same as the other small per-viewer preferences in this app — it lives in
// lib/layout.js rather than here because DiceDock needs to read it too (see
// that module's own comment on rightSidebarLeftEdge for why).
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
      <div class="sidebar-header">
        <router-link to="/" class="brand" @click="sidebarOpen = false">
          <span class="brand-title">Ker Nethalas</span>
          <span class="brand-sub">Gravebound Edition — reference tables</span>
        </router-link>

        <div class="nav-shortcuts">
          <router-link to="/" class="home-link" @click="sidebarOpen = false">
            <House :size="14" :stroke-width="2" />
            Home
          </router-link>

          <router-link to="/monsters" class="monsters-link" @click="sidebarOpen = false">
            <Skull :size="14" :stroke-width="2" />
            Monsters
          </router-link>

          <router-link to="/room-generator" class="room-generator-link" title="Room Generator" @click="sidebarOpen = false">
            <KeyRound :size="14" :stroke-width="2" />
            Room Gen.
          </router-link>

          <router-link to="/locks-traps" class="locks-traps-link" @click="sidebarOpen = false">
            <Lock :size="14" :stroke-width="2" />
            Locks & Traps
          </router-link>
        </div>
      </div>

      <div class="sidebar-scroll">
        <div class="sidebar-tabgroup">
        <div class="sidebar-tabs">
          <button
            type="button"
            class="sidebar-tab"
            :class="{ active: sidebarTab === 'all' }"
            @click="sidebarTab = 'all'"
          >
            All tables
          </button>
          <button
            type="button"
            class="sidebar-tab"
            :class="{ active: sidebarTab === 'starred' }"
            @click="sidebarTab = 'starred'"
          >
            Starred items
          </button>
        </div>

        <div class="sidebar-tab-panel">
          <template v-if="sidebarTab === 'all'">
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
          </template>

          <template v-else>
            <nav class="table-nav starred-nav">
              <div v-if="starredItems.length" class="starred-items-list">
                <div v-for="item in starredItems" :key="item.key" class="table-link-row">
                  <router-link :to="item.to" class="table-link starred-item-link" @click="sidebarOpen = false">
                    <Table v-if="item.kind === 'table'" :size="13" class="starred-item-icon" />
                    <Skull v-else :size="13" class="starred-item-icon" />
                    <span class="starred-item-text">
                      {{ item.title }}<span v-if="item.mastery" class="table-link-sub"> — {{ item.mastery }}</span>
                    </span>
                  </router-link>
                </div>
              </div>
              <p v-else class="nav-empty">Nothing starred yet — click the ☆ next to a table or monster's name to add it here.</p>
            </nav>
          </template>
        </div>
        </div>
      </div>

      <div class="sidebar-footer">
        <router-link to="/about" class="about-link" @click="sidebarOpen = false">
          <Info :size="15" :stroke-width="2" />
          About & Settings
        </router-link>
      </div>
    </aside>

    <main class="content" :style="{ paddingTop: contentPaddingTop, paddingBottom: contentPaddingBottom }">
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

      <div class="right-sidebar-content" v-show="rightSidebarOpen" :style="{ paddingTop: rightSidebarPaddingTop }">
        <CharacterPanel />
      </div>
    </aside>

    <HistoryDock v-if="settings.bottomDockEnabled" />
    <DiceDock v-if="settings.topDockEnabled" />
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
  /* A bit wider than a plain 300px reading width would need — the
     scrollbar (10px, see style.css) is no longer given its own reserved
     gutter, so it overlaps the last few pixels of content when it appears.
     This extra width is slack for that, so a visible thumb doesn't feel
     like it's crowding the table list. */
  width: 312px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
}

/* The brand logo and the four quick-nav buttons stay put above the
   scrollable table list — never worth scrolling away, since they're how you
   get back Home or over to Monsters from anywhere in a long list. Sized to
   its content (flex-shrink: 0) rather than participating in the
   flex:1/min-height:0 scroll area below. */
.sidebar-header {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem 1rem 0.75rem;
}

/* Everything below the header scrolls in its own area (min-height: 0 is
   what lets a flex child actually shrink and scroll instead of pushing the
   sidebar's height past 100vh) — the footer below it, outside this area,
   then stays pinned to the bottom of the sidebar no matter how long the
   table list gets. overflow-y: scroll (not auto) plus scrollbar-gutter:
   stable together reserve the scrollbar's width up front on as many
   browsers as possible — scrollbar-gutter alone doesn't do anything on
   Safari versions that don't recognize the property, but plain
   overflow: scroll has forced classic (non-overlay) scrollbars to reserve
   their space in every browser for decades, so it catches Safari as a
   fallback. Together they mean the table list doesn't shift a few pixels
   narrower right as a category is expanded past the visible height. */
.sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: scroll;
  scrollbar-gutter: stable;
  display: flex;
  flex-direction: column;
  padding: 0 1rem 0.75rem;
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

/* Four quick-nav shortcuts, 2-per-row so they take half the vertical space
   of a single stacked column. */
.nav-shortcuts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem;
}

.home-link,
.monsters-link,
.room-generator-link,
.locks-traps-link {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.5rem;
  border-radius: 7px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.74rem;
  line-height: 1.15;
  white-space: nowrap;
}

.home-link svg,
.monsters-link svg,
.room-generator-link svg,
.locks-traps-link svg {
  flex-shrink: 0;
}

/* Boxed like .monsters-link below it, but in a different hue (gold instead
   of the red accent) so the two buttons stay visually distinct instead of
   blending together. */
.home-link {
  background: rgba(201, 152, 47, 0.1);
  border: 1px solid #8a6a1f;
  color: #e6bb5c;
}

.home-link:hover {
  border-color: #c9982f;
}

.home-link.router-link-active {
  background: #e6bb5c;
  color: #2a1d08;
}

.monsters-link {
  background: var(--accent-dim);
  border: 1px solid var(--accent);
  color: var(--accent-light);
}

.monsters-link.router-link-active {
  background: var(--accent);
  color: #12060a;
}

.room-generator-link {
  background: rgba(71, 191, 255, 0.1);
  border: 1px solid #1f7ea8;
  color: #47bfff;
}

.room-generator-link:hover {
  border-color: #47bfff;
}

.room-generator-link.router-link-active {
  background: #47bfff;
  color: #062230;
}

.locks-traps-link {
  background: rgba(155, 111, 216, 0.1);
  border: 1px solid #6b4f8a;
  color: #b79bdb;
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

/* Two switchable "document archive" style tabs above the table list — the
   whole group is one flex column with zero internal gap, so the active
   tab's bottom edge (border-bottom removed, pulled down 1px via negative
   margin) overlaps the panel's top border exactly and the two read as one
   continuous card instead of two separate floating pieces. */
.sidebar-tabgroup {
  display: flex;
  flex-direction: column;
}

.sidebar-tabs {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.sidebar-tab {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  padding: 0.45rem 0.8rem;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text-faint);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px 8px 0 0;
}

.sidebar-tab:hover {
  color: var(--text-dim);
}

.sidebar-tab.active {
  color: var(--accent-light);
  background: var(--bg);
  border-color: var(--border);
  border-bottom: none;
  margin-bottom: -1px;
  padding-bottom: calc(0.45rem + 1px);
}

.sidebar-tab-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 0 8px 8px 8px;
  padding: 0.65rem;
}

.starred-items-list {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.starred-item-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.starred-item-icon {
  flex-shrink: 0;
  color: var(--text-faint);
}

.starred-item-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
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
  /* Top AND bottom padding are both well past the usual "breathing room"
     2rem — top clears DiceDock (fixed to the viewport top), bottom clears
     HistoryDock (fixed to the viewport bottom); both float there regardless
     of how far the page has scrolled, so without this, a short-enough
     viewport (or scrolling to the very end of a long page — Monsters,
     Locks & Traps, a long table, ...) puts real content directly behind one
     of them with no way to see past it. Bottom is a bit more generous than
     HistoryDock's own footprint strictly requires — measuring the gap on
     real pages at a plain 900px-tall viewport left only ~11px of breathing
     room, thin enough that ordinary variance (a shorter window, browser
     chrome, a monster with an unusually long stat block) was enough to
     tip it into a real, reported overlap. TableView's .table-wrap sizes
     itself off a fixed vh (see that file), assuming the rest of one
     viewport covers both paddings plus the table's own heading/search row
     above it, so padding here beyond what the docks actually need eats
     into that and re-introduces a several-px whole-page scrollbar on table
     pages — keep the two in sync if either padding changes again. */
  padding: 5rem 2.5rem 6rem;
  min-width: 0;
}

.right-sidebar {
  /* Same reasoning as .sidebar above — a bit of slack for the unreserved
     scrollbar to appear into without crowding the character panel. */
  width: 332px;
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
  width: calc(332px - 2.25rem);
  flex-shrink: 0;
  /* Top padding here is NOT the same blanket "clears a fixed dock" reasoning
     as .content's — DiceDock centers on the full viewport width (its window
     uses left: 50%), not on the space between the two sidebars, so its
     right edge only reaches into this column below a certain viewport
     width. 1.5rem is this rule's baseline/fallback value (also what's used
     before JS has measured anything, and on mobile — see the media query
     below); rightSidebarPaddingTop in the script bumps it to 5rem right
     here via inline style whenever DiceDock's own real, live-measured
     right edge (lib/layout.js's diceDockRightEdge) actually reaches this
     column, instead of a fixed width breakpoint. That used to be a
     hand-derived "below 1320px" media query, which turned out to be
     measured against the wrong font (see lib/layout.js's own comment for
     why) and either left a dead gap above "General Stats" on some windows
     or, worse, not enough clearance on others — reacting to the dock's
     actual measured position instead of a guessed constant fixes both.
     Bottom keeps the .content-matching 6rem regardless of width — unlike
     DiceDock, HistoryDock's pill never gets remotely close to this column
     at any width above the mobile breakpoint, so 6rem here is just generous
     breathing room for the sidebar's own scrolling content, not dock
     clearance; no width-dependent reason to trim it. */
  padding: 1.5rem 1rem 6rem;
  /* scroll (not auto) + scrollbar-gutter together — see the .sidebar-scroll
     comment for why both are needed to reserve the scrollbar's width on
     Safari versions that don't support scrollbar-gutter. */
  overflow-y: scroll;
  scrollbar-gutter: stable;
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
    max-width: 312px;
  }
  .sidebar.open {
    transform: translateX(0);
  }
  /* Room for the fixed hamburger button (top: 0.75rem, height 2.5rem),
     which sits above the sidebar (z-index 20) — without this the brand
     logo/title at the top of the sidebar renders underneath it. Applied to
     the header now, since that's what actually holds the brand link. */
  .sidebar-header {
    padding-top: 4rem;
  }
  .content {
    /* Top padding is purely for the fixed hamburger button now — DiceDock
       hides itself outright below this breakpoint (see its own media query)
       rather than trying to squeeze in, so there's no dock footprint to add
       on top of that. Bottom still needs its own reserved space for
       HistoryDock, bumped the same amount as the base .content rule above
       and for the same reason — see its comment. */
    padding: 4.5rem 1.25rem 4.5rem;
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
    max-width: 332px;
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
     mobile width (85vw/332px) rather than stay pinned to the desktop
     content width computed above. */
  .right-sidebar-content {
    width: auto;
    flex: 1;
    min-width: 0;
    /* The desktop rule's 5rem top padding exists to clear DiceDock — which
       hides itself outright below this same breakpoint (see its own media
       query), so there's nothing left to clear here... except the mobile
       trigger button itself: .right-menu-toggle is fixed at top: 0.75rem,
       height 2.5rem (z-index 20, above this panel's z-index 15), so its
       bottom edge sits 3.25rem down — a plain 1rem left this panel's own
       "General Stats" heading and part of the stat rows underneath it
       rendering right under the button, unreadable, before anyone reported
       it. 4rem matches the exact same button (same top/height, same
       reasoning) on the LEFT sidebar's own .sidebar-header rule above —
       0.75rem gap + 2.5rem button height + a little breathing room.
       Bottom keeps the desktop value's reasoning (HistoryDock still shows
       on mobile), just matched to .content's own mobile bottom padding
       instead of the desktop one. */
    padding-top: 4rem;
    padding-bottom: 4.5rem;
  }
}
</style>
