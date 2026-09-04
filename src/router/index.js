import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import TableView from '../views/TableView.vue'
import MonsterListView from '../views/MonsterListView.vue'
import MonsterDetailView from '../views/MonsterDetailView.vue'
import RoomGeneratorView from '../views/RoomGeneratorView.vue'
import LocksTrapsView from '../views/LocksTrapsView.vue'
import AboutView from '../views/AboutView.vue'

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

export default router
