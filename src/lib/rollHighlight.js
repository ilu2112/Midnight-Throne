// Shared helper for reacting to the floating DiceDock's roll button
// (lib/dice.js) from whichever reference-table or monster page happens to
// be open. A table's first column almost always names the die it's keyed
// on — "D20", "D100", "D6", ... (see TableView.vue's own comment on that
// convention) — so a page can recognize a just-finished roll is relevant to
// IT specifically by parsing that header, without any per-table wiring: no
// registry entry says "this table reacts to the dice dock", the column name
// already says which die it wants.
import { ref, watch, nextTick } from 'vue'
import { isRolling, diceResults } from './dice'
import { settings } from './settings'

const DIE_COLUMN_PATTERN = /^D\s?(\d+)$/i

// "D20", "d20", "D 20" -> 20. Returns null for a non-die first column (e.g.
// TYPE, CONDITION, ITEM, WEAPON, SHIELD, TRAIT, HELMET, CHECK — tables keyed
// some other way, which this feature simply has nothing to highlight for).
export function dieSizeFromColumn(col) {
  if (typeof col !== 'string') return null
  const trimmed = col.trim()
  const m = trimmed.match(DIE_COLUMN_PATTERN)
  if (m) return Number(m[1])
  return trimmed.toUpperCase() === 'D%' ? 100 : null
}

// The currently rolled value for a given die size. D100 can have a second,
// independent roll stacked in the dock (see D100_SECOND_KEY in lib/dice.js)
// for opposed/percentile checks, but only the primary/top D100 result is
// ever used for table highlighting — the second roll is a separate result
// the player reads off the dock on its own, not something that should also
// light up a row in every open table (that was flashing two rows at once
// for D100-keyed tables, which is the bug this comment used to explain away
// as intentional — it wasn't).
function primaryRollFor(sides) {
  return sides === 100 ? diceResults.value[100] : diceResults.value[sides]
}

// Same "5" or "4-6" / "19-20" range matching every table-driven roll in this
// app already does by hand (see e.g. LocksTrapsView.vue's own matchesRoll) —
// kept as an independent copy here rather than importing that view's, since
// nothing about this feature is specific to Locks & Traps and it's a
// three-line function.
function cellMatchesRoll(cellValue, roll) {
  if (cellValue == null || roll == null) return false
  const str = String(cellValue).trim()
  if (str.includes('-')) {
    const [lo, hi] = str.split('-').map((n) => Number(n.trim()))
    return Number.isFinite(lo) && Number.isFinite(hi) && roll >= lo && roll <= hi
  }
  return Number(str) === roll
}

// Given an array of row-like objects and the property name holding that
// row's die value/range, returns the indices whose value matches the
// primary roll for `sides`. Normally at most one index (well-formed tables
// cover the roll range without overlap), but returns every match just in
// case.
export function matchingIndices(rows, dieKey, sides) {
  const roll = primaryRollFor(sides)
  const out = []
  rows.forEach((row, i) => {
    if (cellMatchesRoll(row[dieKey], roll)) out.push(i)
  })
  return out
}

// Which row to scroll to — same primary-roll match as matchingIndices,
// exposed separately for callers that just want the one index (e.g. as a
// scrollTo target) without building the full indices array themselves.
// Returns -1 if the primary roll doesn't match any row.
export function primaryMatchIndex(rows, dieKey, sides) {
  const roll = primaryRollFor(sides)
  return rows.findIndex((row) => cellMatchesRoll(row[dieKey], roll))
}

// Wires up "on the next dice-dock roll that finishes (isRolling true ->
// false — not the click itself, so this waits for the reel to actually
// settle on a value first), call `check()`, and if it returns some matching
// row indices, flash them for ~1s and scroll the relevant one into view."
//
// `check()` returns `{ indices, scrollTo? } | null` — null (or an empty
// `indices`) when this page's current table isn't keyed by a recognizable
// die at all, or the roll for that die didn't land on any of its rows
// (shouldn't normally happen for a well-formed table, but cheap to guard).
// `scrollTo` names which of those indices to actually scroll into view;
// omit it (or pass -1) to fall back to indices[0]. Re-run fresh on every
// call rather than cached,
// since the "current table" a page is showing can itself change without a
// remount (e.g. TableView.vue navigating between /table/:slug routes
// reuses the same component instance).
//
// `getRowEl(index)` returns the row's actual DOM element for scrollIntoView,
// or null/undefined if it isn't currently rendered (e.g. filtered out by an
// active search) — safely skipped in that case.
export function useRollHighlight(check, getRowEl) {
  const highlighted = ref(new Set())
  let clearTimer = null

  function onRollSettled() {
    const result = check()
    if (!result || !result.indices || !result.indices.length) return
    highlighted.value = new Set(result.indices)
    const scrollTo = result.scrollTo != null && result.scrollTo >= 0 ? result.scrollTo : result.indices[0]
    nextTick(() => {
      getRowEl(scrollTo)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    clearTimeout(clearTimer)
    clearTimer = setTimeout(() => {
      highlighted.value = new Set()
    }, 1000)
  }

  const stop = watch(isRolling, (rolling, wasRolling) => {
    if (!wasRolling || rolling) return
    // Settings page: "Highlight rolled results in tables" — off by default
    // only if the user turns it (or the top dock itself, which is what
    // actually produces a roll to react to) off; both on by default.
    if (!settings.value.topDockEnabled || !settings.value.highlightRolls) return
    onRollSettled()
  })

  return { highlighted, stop }
}
