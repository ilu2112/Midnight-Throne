import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import TableView from '../views/TableView.vue'
import MonsterListView from '../views/MonsterListView.vue'
import MonsterDetailView from '../views/MonsterDetailView.vue'
import RoomGeneratorView from '../views/RoomGeneratorView.vue'
import LocksTrapsView from '../views/LocksTrapsView.vue'
import AboutView from '../views/AboutView.vue'
import { findTable, findMonster } from '../registry'
import { recordVisit } from '../lib/history'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/monsters', name: 'monsters', component: MonsterListView },
    { path: '/monsters/:slug', name: 'monster-detail', component: MonsterDetailView, props: true },
    { path: '/room-generator', name: 'room-generator', component: RoomGeneratorView },
    { path: '/locks-traps', name: 'locks-traps', component: LocksTrapsView },
    { path: '/about', name: 'about', component: AboutView },
    { path: '/table/:slug', name: 'table-detail', component: TableView, props: true },
  ],
})

// Feeds the floating "recently visited" dock (src/components/HistoryDock.vue,
// backed by src/lib/history.js): every successful navigation records an
// entry keyed by its resolved path, with a human-readable label and a
// `type` the dock uses to pick that entry's icon and color. The static
// route names below map straight to a fixed label; the two dynamic routes
// look their label up from the registry and are silently skipped (no
// history entry) if the slug doesn't resolve — e.g. a stale/bad link —
// rather than recording something unlabeled.
const STATIC_LABELS = {
  home: 'Home',
  monsters: 'Monsters',
  'room-generator': 'Room Generator',
  'locks-traps': 'Locks & Traps',
  about: 'About & Settings',
}

router.afterEach((to) => {
  let label
  if (to.name === 'monster-detail') {
    label = findMonster(to.params.slug)?.name
  } else if (to.name === 'table-detail') {
    label = findTable(to.params.slug)?.title
  } else {
    label = STATIC_LABELS[to.name]
  }
  if (!label) return

  recordVisit({ path: to.path, type: to.name, label })
})

export default router
