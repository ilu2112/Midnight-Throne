// Auto-discovers every table_*.json file in ./data and builds a normalized
// registry used for navigation, search and routing. New files dropped into
// src/data/ show up automatically — nothing else needs to change (they land
// in the "Other" category until given a home in TABLE_CATEGORIES below).

const tableModules = import.meta.glob('./data/table_*.json', { eager: true })
import monstersData from './data/combat_encounter_monsters.json'

function slugFromPath(path) {
  // './data/table_events.json' -> 'events'
  return path.replace('./data/table_', '').replace('.json', '')
}

// Display order for the sidebar's collapsible groups.
export const CATEGORY_ORDER = [
  'Character Background',
  'Combat & Encounters',
  'Hit Locations',
  'Armor & Equipment',
  'Magic Item Properties',
  'Loot & Treasure',
  'Exploration & Dungeon',
  'Status Effects & Conditions',
  'Other',
]

const TABLE_CATEGORIES = {
  // Character Background
  personal_goals: 'Character Background',
  random_mastery: 'Character Background',

  // Combat & Encounters
  combat_encounters_first_domain: 'Combat & Encounters',
  combat_encounters_general: 'Combat & Encounters',
  combat_encounters_table_a: 'Combat & Encounters',
  combat_encounters_table_b: 'Combat & Encounters',
  critical_failure_effect: 'Combat & Encounters',
  damage_type: 'Combat & Encounters',
  difficulty_modifiers: 'Combat & Encounters',
  enemy_type: 'Combat & Encounters',
  npc_monster_defensive_move: 'Combat & Encounters',
  npc_monster_fumbles: 'Combat & Encounters',
  player_defensive_move: 'Combat & Encounters',
  player_fumbles: 'Combat & Encounters',
  spoils: 'Combat & Encounters',

  // Hit Locations
  hit_location_arachnid: 'Hit Locations',
  hit_location_humanoid: 'Hit Locations',
  hit_location_insectoid: 'Hit Locations',
  hit_location_quadruped: 'Hit Locations',
  hit_location_serpentoid: 'Hit Locations',
  hit_location_winged_biped: 'Hit Locations',

  // Armor & Equipment
  armor_greaves: 'Armor & Equipment',
  armor_torso: 'Armor & Equipment',
  armor_vambraces: 'Armor & Equipment',
  helmets: 'Armor & Equipment',
  other_items_gear: 'Armor & Equipment',
  shields: 'Armor & Equipment',
  weapons: 'Armor & Equipment',
  weapon_traits: 'Armor & Equipment',

  // Magic Item Properties
  armor_magic_properties: 'Magic Item Properties',
  belt_magic_properties: 'Magic Item Properties',
  boots_magic_properties: 'Magic Item Properties',
  gloves_magic_properties: 'Magic Item Properties',
  item_rarity: 'Magic Item Properties',
  magic_item_peculiarity: 'Magic Item Properties',
  magic_item_type: 'Magic Item Properties',
  relics: 'Magic Item Properties',
  ring_magic_properties: 'Magic Item Properties',
  weapon_magic_properties: 'Magic Item Properties',

  // Loot & Treasure
  container_loot: 'Loot & Treasure',
  fragments: 'Loot & Treasure',
  gems_jewelry: 'Loot & Treasure',
  lore_books: 'Loot & Treasure',
  mundane_items: 'Loot & Treasure',
  potion_aging: 'Loot & Treasure',
  potions: 'Loot & Treasure',
  precious_items: 'Loot & Treasure',
  random_armor: 'Loot & Treasure',
  random_weapon: 'Loot & Treasure',
  resources: 'Loot & Treasure',
  scavenging: 'Loot & Treasure',
  shields_loot: 'Loot & Treasure',
  torso_armor_loot: 'Loot & Treasure',
  valuable_items: 'Loot & Treasure',
  vambraces_greaves_helmets_loot: 'Loot & Treasure',

  // Exploration & Dungeon
  corridor_description: 'Exploration & Dungeon',
  events: 'Exploration & Dungeon',
  growing_darkness: 'Exploration & Dungeon',
  is_there_a_door: 'Exploration & Dungeon',
  overseer_influence: 'Exploration & Dungeon',
  overseer_roll: 'Exploration & Dungeon',
  room_corridor_shape: 'Exploration & Dungeon',
  room_description: 'Exploration & Dungeon',
  traps: 'Exploration & Dungeon',

  // Status Effects & Conditions
  accumulated_exhaustion: 'Status Effects & Conditions',
  conditions: 'Status Effects & Conditions',
  madness: 'Status Effects & Conditions',
}

export const tables = Object.entries(tableModules)
  .map(([path, mod]) => {
    const data = mod.default ?? mod
    const slug = slugFromPath(path)
    return {
      slug,
      title: data.title || data.columns?.[1] || slug,
      mastery: data.mastery || null,
      pages: data.pages || (data.page ? [data.page] : []),
      columns: data.columns || [],
      numRows: data.num_rows ?? (data.rows ? data.rows.length : 0),
      rows: data.rows || [],
      isMultiPage: Array.isArray(data.pages),
      category: TABLE_CATEGORIES[slug] || 'Other',
    }
  })
  .sort((a, b) => a.title.localeCompare(b.title, 'en'))

// Tables grouped by category, in a fixed display order, ready for a
// collapsible sidebar.
export const groupedTables = CATEGORY_ORDER
  .map((category) => ({
    category,
    tables: tables.filter((t) => t.category === category),
  }))
  .filter((group) => group.tables.length > 0)

export const monsters = (monstersData.monsters || [])
  .map((m) => ({
    ...m,
    slug: m.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, ''),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))

export const monstersDescription = monstersData.description || ''

export function findTable(slug) {
  return tables.find((t) => t.slug === slug)
}

export function findMonster(slug) {
  return monsters.find((m) => m.slug === slug)
}
