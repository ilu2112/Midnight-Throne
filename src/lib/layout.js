// Shared layout geometry used by the floating docks (DiceDock, HistoryDock)
// and App.vue's right sidebar to stay clear of each other and of the
// (always-open, fixed-width) left sidebar.
//
// This used to be a handful of hardcoded viewport-width breakpoints — "hide
// the dice dock below 1130px", "history dock shows only 5 entries between
// 861-959px", "right sidebar needs 5rem top padding below 1320px" — each
// hand-derived by measuring the docks' rendered width in a test browser and
// doing the arithmetic once. All of them turned out to be wrong in the real
// app: the docks' D4/D6/... labels render in the 'Cinzel' web font, and the
// test browser this project's measurements were taken in has no route to
// fonts.googleapis.com at all (confirmed via the network proxy's own status
// endpoint — a flat 403 on that host), so every one of those measurements
// was actually taken against a fallback serif substitute, not Cinzel, and
// silently rendered narrower than the real thing. Every threshold derived
// from that measurement inherited the same error.
//
// Rather than re-measure by hand again (which would just as silently drift
// out of calibration the next time a label, font, or die count changes),
// the docks below measure their OWN real rendered width, live, in whatever
// browser is actually running the app — so there is no font metric anyone
// has to get right by hand, ever.
import { ref, computed, watch } from 'vue'

// Both sidebars' widths ARE safe to hardcode — they're plain fixed CSS
// pixel values (App.vue's .sidebar / .right-sidebar), not derived from any
// rendered text, so unlike a dock's width they can't drift by font.
export const LEFT_SIDEBAR_WIDTH = 312
export const RIGHT_SIDEBAR_WIDTH = 332

// The right sidebar's OTHER width, while collapsed to its always-visible
// toggle rail (App.vue's .right-sidebar.collapsed) — also a plain fixed CSS
// pixel value (2.25rem), so just as safe to hardcode as the two widths
// above.
export const RIGHT_SIDEBAR_COLLAPSED_WIDTH = 36

// Right sidebar's open/collapsed state, persisted across refreshes so it
// doesn't reset to collapsed on every visit. Lives here rather than in
// App.vue (where the toggle button and panel content actually render)
// because DiceDock needs to read it too — see rightSidebarLeftEdge below.
const RIGHT_SIDEBAR_STORAGE_KEY = 'kn-right-sidebar-open'

function loadRightSidebarOpen() {
  try {
    const raw = localStorage.getItem(RIGHT_SIDEBAR_STORAGE_KEY)
    return raw === null ? false : raw === 'true'
  } catch {
    return false
  }
}

export const rightSidebarOpen = ref(loadRightSidebarOpen())

watch(rightSidebarOpen, (value) => {
  try {
    localStorage.setItem(RIGHT_SIDEBAR_STORAGE_KEY, String(value))
  } catch {
    // Ignore write failures (quota, private mode, etc.) — the toggle just
    // won't be remembered across reloads in that case.
  }
})

// The breakpoint below which the left sidebar goes off-canvas (App.vue's
// own `@media (max-width: 860px)`) and stops occupying real layout space —
// a deliberate fixed design width, not a font measurement, so hardcoding it
// here alongside the sidebar widths above is the same kind of "this one's
// actually safe to hardcode" case.
export const MOBILE_BREAKPOINT = 860

export const viewportWidth = ref(typeof window === 'undefined' ? 0 : window.innerWidth)

let listenerCount = 0
function handleResize() {
  viewportWidth.value = window.innerWidth
}

// Ref-counted so DiceDock and HistoryDock can each call this from their own
// onMounted/onUnmounted independently without attaching two resize
// listeners or one tearing the shared listener down while the other still
// needs it.
export function watchViewportWidth() {
  if (typeof window === 'undefined') return () => {}
  if (listenerCount === 0) window.addEventListener('resize', handleResize)
  listenerCount++
  let released = false
  return () => {
    if (released) return
    released = true
    listenerCount--
    if (listenerCount === 0) window.removeEventListener('resize', handleResize)
  }
}

// Live right edge (px from the viewport's left edge) of the dice dock pill,
// written by DiceDock.vue after every measurement — read by App.vue's
// .right-sidebar-content to decide whether it needs top clearance for it.
// 0 whenever the dock isn't actually on screen (hidden by its own
// too-narrow-for-the-left-sidebar check, or by its separate mobile
// breakpoint), which is always safe for a consumer to treat as "doesn't
// reach anywhere".
export const diceDockRightEdge = ref(0)

// Right sidebar's live left edge (px from the viewport's left edge),
// accounting for whichever of its two fixed widths currently applies.
// Read by DiceDock to decide whether IT needs to hide itself to stay clear
// of the sidebar — the dock centers on the full viewport (see
// DiceDock.vue's .dice-dock-window, left: 50%), not on the space between
// the two sidebars, so when the right sidebar is open (332px) rather than
// collapsed (36px) the dock's centered position can reach under it well
// before it would ever reach the (always-312px) left sidebar — a case the
// dock's own overlap check used to miss entirely, since it only ever
// compared itself against the left sidebar.
export const rightSidebarLeftEdge = computed(
  () => viewportWidth.value - (rightSidebarOpen.value ? RIGHT_SIDEBAR_WIDTH : RIGHT_SIDEBAR_COLLAPSED_WIDTH),
)
