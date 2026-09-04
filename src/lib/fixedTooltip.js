// A hover tooltip (the ".trait-tip" / ".tooltip-box" pattern used for
// traits, damage types and weapon traits) that is CSS-positioned with
// `position: absolute` still counts toward the scrollable content size of
// any scrolling ancestor (e.g. a table's `overflow: auto` wrapper), even
// though it's visually meant to float over everything — which was showing
// up as a spurious horizontal scrollbar whenever a tooltip near the edge
// of a table popped outside the table's own bounds.
//
// This directive switches the tooltip box to `position: fixed` (which is
// positioned against the viewport, not any scrolling ancestor, so it can
// never enlarge that ancestor's scrollable area) and computes its
// on-screen position in JS on hover/focus, clamping it to stay within the
// viewport horizontally and flipping above/below vertically depending on
// available space.
export const fixedTooltip = {
  mounted(el) {
    const box = el.querySelector('.tooltip-box')
    if (!box) return

    function show() {
      // Switch to `fixed` (out of document flow) BEFORE making the box
      // visible and measuring anything. The box has no `position` in its
      // own CSS, so until this line it defaults to `static` — a plain
      // in-flow child of the (inline-block) trigger. If `display: block`
      // were flipped on first while still `static`, the 260px-wide box
      // would briefly lay out inline inside the trigger, widening it and
      // reflowing the surrounding text before we read `el`'s rect below,
      // which threw off the very first measurement (a second hover, with
      // `position` already left as `fixed` from before, always measured
      // correctly). Setting `fixed` first means the box is out of flow for
      // every measurement, first hover included.
      box.style.position = 'fixed'
      box.style.display = 'block'
      const triggerRect = el.getBoundingClientRect()
      const boxRect = box.getBoundingClientRect()

      let left = triggerRect.left
      const maxLeft = window.innerWidth - boxRect.width - 8
      left = Math.min(Math.max(left, 8), Math.max(maxLeft, 8))

      let top = triggerRect.top - boxRect.height - 8
      if (top < 8) {
        // Not enough room above — flip to showing below the trigger instead.
        top = triggerRect.bottom + 8
      }

      box.style.left = `${left}px`
      box.style.top = `${top}px`
    }

    function hide() {
      box.style.display = 'none'
    }

    el.addEventListener('mouseenter', show)
    el.addEventListener('mouseleave', hide)
    el.addEventListener('focus', show)
    el.addEventListener('blur', hide)

    el.__fixedTooltipCleanup = () => {
      el.removeEventListener('mouseenter', show)
      el.removeEventListener('mouseleave', hide)
      el.removeEventListener('focus', show)
      el.removeEventListener('blur', hide)
    }
  },
  unmounted(el) {
    el.__fixedTooltipCleanup?.()
  },
}
