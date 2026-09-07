<script setup>
import { ref, watch } from 'vue'
import { findTable, monsters } from '../registry'
import { linkSegments } from '../lib/textLinks'

// A simplified version of the room-generation procedure on page 96: skips
// the "who is the Overseer" step entirely, and turns the Lair Check /
// Domain Exit check / Tension Die check into plain reminders (they use the
// Usage Die rules tracked on paper, not something this app rolls for you).
const shapeTable = findTable('room_corridor_shape')
const roomDescTable = findTable('room_description')
const corridorDescTable = findTable('corridor_description')
const combatGeneralTable = findTable('combat_encounters_general')
const combatTableA = findTable('combat_encounters_table_a')
const combatTableB = findTable('combat_encounters_table_b')
const eventsTable = findTable('events')
const scavengingTable = findTable('scavenging')
const growingDarknessTable = findTable('growing_darkness')

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1
}

// A table's die column stores either a single number (6) or a range string
// ("1-25", "26-100"). This matches a rolled value against either shape.
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

// Persist the last generated room across refreshes. Only the monster's slug
// is trusted from storage — the full monster is re-resolved from the
// current registry on load, in case the data has changed since.
const STORAGE_KEY = 'kn-room-generator-state'

function loadStoredResult() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.monster?.slug) {
      parsed.monster = monsters.find((m) => m.slug === parsed.monster.slug) || null
    }
    return parsed
  } catch {
    return null
  }
}

const enlargedImage = ref(null)
const result = ref(loadStoredResult())

watch(
  result,
  (value) => {
    try {
      if (value) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {}
  },
  { deep: true },
)

function generateRoom() {
  // Roll on the Room & Corridor Shape table (D100: 1-25 = corridor, 26-100 = room).
  const shapeRoll = rollDie(100)
  const isCorridor = shapeRoll <= 25
  const shapeRow = rowFor(shapeTable, shapeRoll)
  const shapeImage = shapeRow?.[shapeTable.columns[1]]

  // Flavor description, from whichever table matches what we just rolled.
  const descTable = isCorridor ? corridorDescTable : roomDescTable
  const descSides = isCorridor ? 20 : 100
  const descRoll = rollDie(descSides)
  const descRow = rowFor(descTable, descRoll)
  const descText = descRow?.[descTable.columns[1]]

  // Combat Encounter check (D20: 10+ for rooms, 15+ for corridors).
  const combatRoll = rollDie(20)
  const combatThreshold = isCorridor ? 15 : 10
  const hasCombat = combatRoll >= combatThreshold
  let monster = null
  let combatTableLabel = null
  if (hasCombat) {
    const genRoll = rollDie(6)
    const genRow = rowFor(combatGeneralTable, genRoll)
    const useTableA = genRow?.[combatGeneralTable.columns[1]]?.includes('Table A')
    const monsterTable = useTableA ? combatTableA : combatTableB
    combatTableLabel = useTableA ? 'A' : 'B'
    const monsterRoll = rollDie(20)
    const monsterRow = rowFor(monsterTable, monsterRoll)
    const monsterName = monsterRow?.[monsterTable.columns[1]]
    monster = monsters.find((m) => m.name === monsterName) || null
  }

  // No Combat Encounter -> roll on the Events table instead.
  let event = null
  if (!hasCombat) {
    const eventRoll = rollDie(100)
    const eventRow = rowFor(eventsTable, eventRoll)
    event = { roll: eventRoll, text: eventRow?.[eventsTable.columns[1]] }
  }

  result.value = {
    isCorridor,
    shapeRoll,
    shapeImage,
    descRoll,
    descSides,
    descText,
    combatRoll,
    combatThreshold,
    hasCombat,
    combatTableLabel,
    monster,
    event,
    scavenge: null,
  }
}

// Page 116: "Once per room, you can make a Scavenge check; if you pass it,
// you can roll on the Scavenging table." The pass/fail check itself is
// tracked on paper like the other Usage Die checks — this just rolls the
// D20 on the table once you've told us you passed.
function rollScavenging() {
  if (!result.value) return
  const roll = rollDie(20)
  const row = rowFor(scavengingTable, roll)
  const text = row?.[scavengingTable.columns[1]]
  result.value.scavenge = { roll, text }
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
  showClearConfirm.value = false
}
</script>

<template>
  <div class="room-generator">
    <h1>Room Generator</h1>
    <p class="lead">
      A streamlined version of the room generation procedure from page 96.
    </p>

    <div class="actions">
      <button type="button" class="generate-btn" @click="generateRoom">Generate new room</button>
      <button v-if="result" type="button" class="clear-btn" @click="requestClear">Clear</button>
    </div>

    <div v-if="result" class="result">
      <section class="block">
        <h2>{{ result.isCorridor ? 'Corridor' : 'Room' }} <span class="badge">D100: {{ result.shapeRoll }}</span></h2>
        <img
          v-if="result.shapeImage"
          :src="result.shapeImage"
          class="shape-image"
          alt="Room or corridor shape"
          @click="enlargedImage = result.shapeImage"
        />
      </section>

      <section class="block">
        <h2>Description <span class="badge">D{{ result.descSides }}: {{ result.descRoll }}</span></h2>
        <p>{{ result.descText }}</p>
      </section>

      <section class="block reminder">
        <h2>Reminders</h2>
        <!-- Page 96/98: "Each time you place a new room, you must make a Lair
             Check" — corridors never trigger it. Once the Lair's been found,
             it's replaced by a Domain Exit check "each time you enter a new
             room or corridor", so that one does apply either way. -->
        <ul>
          <li v-if="!result.isCorridor">
            Make a <strong>Lair Check</strong> (Usage Die, starting at D10) to see if this is
            the Domain's Overseer's Lair — unless the Overseer's Lair has already been found,
            in which case make a <strong>Domain Exit check</strong> instead (Usage Die,
            starting at D8).
          </li>
          <li v-else>
            No <strong>Lair Check</strong> here — that's only rolled when you place a new
            Room. If the Overseer's Lair has already been found, make a
            <strong>Domain Exit check</strong> instead (Usage Die, starting at D8).
          </li>
          <li>
            Make a <strong>Tension Die check</strong> (page 120) — rolling 1-2 on the D4 resets it back
            to D8 and triggers a roll on the
            <router-link v-if="growingDarknessTable" :to="`/table/${growingDarknessTable.slug}`" class="cell-link">Growing Darkness</router-link>
            <template v-else>Growing Darkness</template>
            table.
          </li>
          <!-- Page 17: "Your character's starting Aether points are D6+8, and
               all Aether is replenished upon entering a new room" — room-only,
               same as Lightsource/Scavenging below. -->
          <li v-if="!result.isCorridor">Your <strong>Aether</strong> is fully replenished upon entering this room.</li>
        </ul>
      </section>

      <section class="block">
        <h2>
          Combat Encounter
          <span class="badge">D20: {{ result.combatRoll }} (needs {{ result.combatThreshold }}+)</span>
        </h2>
        <p v-if="result.hasCombat">
          You've run into
          <router-link v-if="result.monster" :to="`/monsters/${result.monster.slug}`" class="cell-link">
            {{ result.monster.name }}
          </router-link>
          <span v-else>an unknown enemy</span>
          (Combat Encounters – Table {{ result.combatTableLabel }}).
        </p>
        <!-- Page 62: "Each time you defeat a regular Combat Encounter: +50
             XP" — the Overseer itself is worth +200 XP instead, but that's
             not something this simplified generator identifies on its own. -->
        <p v-if="result.hasCombat" class="note">Defeating it is worth <strong>+50 XP</strong>.</p>
        <p v-else class="note">No encounter.</p>
      </section>

      <section v-if="result.event" class="block">
        <h2>Event <span class="badge">D100: {{ result.event.roll }}</span></h2>
        <p>{{ result.event.text }}</p>
      </section>

      <section class="block reminder">
        <h2>Lightsource</h2>
        <!-- Page 96/99: a Torch or Lamp "will remain lit for 20 rooms" and
             "your lightsource will be spent as usual (once per room)" — it's
             only consumed by entering a Room, never a Corridor. -->
        <p v-if="!result.isCorridor">Tick off 1 use on your Lightsource tracker for entering this room.</p>
        <p v-else class="note">No Lightsource use — only rooms consume it, not corridors.</p>
      </section>

      <section class="block reminder">
        <h2>Scavenging</h2>
        <!-- Page 116: "Once per room, you can make a Scavenge check; if you
             pass it, you can roll on the Scavenging table." — same
             room-only wording as Lightsource, so it doesn't apply to corridors. -->
        <template v-if="!result.isCorridor">
          <p>
            Once per room, you can make a Scavenge check to roll on the
            <router-link v-if="scavengingTable" :to="`/table/${scavengingTable.slug}`" class="cell-link">Scavenging</router-link>
            <template v-else>Scavenging</template>
            table.
          </p>
          <button type="button" class="scavenge-btn" @click="rollScavenging">
            {{ result.scavenge ? 'Roll again' : 'Roll Scavenging' }}
          </button>
          <p v-if="result.scavenge" class="scavenge-result">
            <span class="badge">D20: {{ result.scavenge.roll }}</span>
            <span>
              <template v-for="(seg, si) in linkSegments(result.scavenge.text, scavengingTable?.slug)" :key="si">
                <router-link v-if="seg.to" :to="seg.to" class="cell-link">{{ seg.text }}</router-link>
                <template v-else>{{ seg.text }}</template>
              </template>
            </span>
          </p>
        </template>
        <p v-else class="note">No Scavenge check — that's once per room, not per corridor.</p>
      </section>
    </div>

    <div v-if="enlargedImage" class="lightbox" @click="enlargedImage = null">
      <img :src="enlargedImage" />
    </div>

    <div v-if="showClearConfirm" class="modal-overlay" @click.self="cancelClear">
      <div class="modal">
        <h2>Clear this room?</h2>
        <p>This removes the generated room and its saved state. This can't be undone.</p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" @click="cancelClear">Cancel</button>
          <button type="button" class="btn-danger" @click="confirmClear">Clear</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.room-generator {
  max-width: var(--content-max-width);
}

.lead {
  color: var(--text-dim);
  line-height: 1.5;
  margin-bottom: 1.25rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
}

.generate-btn {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 0.65rem 1.25rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

.generate-btn:hover {
  background: var(--accent-light);
  color: #12060a;
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

.scavenge-btn {
  display: inline-block;
  margin-top: 0.6rem;
  background: none;
  color: var(--accent-light);
  border: 1px solid var(--accent);
  padding: 0.4rem 0.9rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.scavenge-btn:hover {
  background: var(--accent-dim);
}

.scavenge-result {
  margin-top: 0.6rem !important;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
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

.block.reminder {
  border-style: dashed;
}

.block.reminder ul {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: var(--text);
  line-height: 1.5;
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

.shape-image {
  display: block;
  width: 160px;
  height: 160px;
  object-fit: contain;
  border-radius: 6px;
  background: var(--surface-2);
  cursor: zoom-in;
  margin-top: 0.25rem;
}

.cell-link {
  color: var(--accent-light);
  text-decoration: none;
  border-bottom: 1px dotted var(--accent-light);
}

.cell-link:hover {
  border-bottom-style: solid;
}

.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
  cursor: zoom-out;
}

.lightbox img {
  max-width: min(90vw, 500px);
  max-height: 90vh;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
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
