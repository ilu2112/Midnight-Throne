<script setup>
import { settings } from '../lib/settings'
</script>

<template>
  <div class="about">
    <h1>About & Settings</h1>

    <section class="block">
      <p>
        This is a fan-made companion site for the <strong>Ker Nethalas: Gravebound Edition</strong>
        tabletop RPG — a searchable reference for the rulebook's tables, a full bestiary, and a
        couple of small tools for running a session (Room Generator, Locks & Traps).
      </p>
      <p>
        All data on this site is transcribed from the <strong>Ker Nethalas: Gravebound Edition</strong>
        rulebook, version 1.2.
      </p>
    </section>

    <section class="block">
      <h2>Settings</h2>
      <p class="settings-intro">
        These preferences are saved in this browser, and are included in a downloaded save file
        (see Save game on the Home page) — so loading a save on another device brings them along
        too.
      </p>

      <div class="setting-group">
        <h3 class="setting-group-heading">Top dock</h3>
        <p class="setting-group-note">
          The top dock only shows up on wider screens — a desktop or a tablet in landscape — and
          stays hidden on phones and narrow windows regardless of this setting.
        </p>

        <div class="setting-row">
          <div class="setting-text">
            <span class="setting-label">Enable top dock</span>
            <p class="setting-desc">
              Shows the floating dice-roller pill docked to the top of the screen, for quick
              d4–d100 rolls from anywhere in the app.
            </p>
          </div>
          <button
            type="button"
            class="toggle"
            role="switch"
            :class="{ on: settings.topDockEnabled }"
            :aria-checked="settings.topDockEnabled"
            aria-label="Enable top dock"
            @click="settings.topDockEnabled = !settings.topDockEnabled"
          >
            <span class="toggle-knob" />
          </button>
        </div>

        <div class="setting-row" :class="{ dependent: !settings.topDockEnabled }">
          <div class="setting-text">
            <span class="setting-label">Highlight rolled results in tables</span>
            <p class="setting-desc">
              When a roll lands, briefly flashes the matching row wherever it's relevant — a
              reference table, a monster's Hit Location/Actions tables, or the sidebar's Hit
              Location list — and scrolls a long table to it if the match is currently out of
              view. Requires the top dock.
            </p>
          </div>
          <button
            type="button"
            class="toggle"
            role="switch"
            :class="{ on: settings.highlightRolls }"
            :disabled="!settings.topDockEnabled"
            :aria-checked="settings.highlightRolls"
            aria-label="Highlight rolled results in tables"
            @click="settings.highlightRolls = !settings.highlightRolls"
          >
            <span class="toggle-knob" />
          </button>
        </div>

        <div class="setting-row" :class="{ dependent: !settings.topDockEnabled }">
          <div class="setting-text">
            <span class="setting-label">Add a second D100 roll for opposed rolls</span>
            <p class="setting-desc">
              Stacks a second, independent D100 result below the first in the top dock, for
              checks that need two percentile rolls at once. A "double" (11, 22, ..., 99, or 100)
              on either roll glows as a critical hit. Requires the top dock.
            </p>
          </div>
          <button
            type="button"
            class="toggle"
            role="switch"
            :class="{ on: settings.secondD100Enabled }"
            :disabled="!settings.topDockEnabled"
            :aria-checked="settings.secondD100Enabled"
            aria-label="Add a second D100 roll for opposed rolls"
            @click="settings.secondD100Enabled = !settings.secondD100Enabled"
          >
            <span class="toggle-knob" />
          </button>
        </div>
      </div>

      <div class="setting-group">
        <h3 class="setting-group-heading">Bottom dock</h3>

        <div class="setting-row">
          <div class="setting-text">
            <span class="setting-label">Enable bottom dock</span>
            <p class="setting-desc">
              Shows the floating "recently visited" pill docked to the bottom of the screen, for
              jumping back to the last few tables and pages you had open.
            </p>
          </div>
          <button
            type="button"
            class="toggle"
            role="switch"
            :class="{ on: settings.bottomDockEnabled }"
            :aria-checked="settings.bottomDockEnabled"
            aria-label="Enable bottom dock"
            @click="settings.bottomDockEnabled = !settings.bottomDockEnabled"
          >
            <span class="toggle-knob" />
          </button>
        </div>
      </div>
    </section>

    <section class="block">
      <h2>Roadmap</h2>
      <p>
        Tables from the game's expansions are next on the list — planning to add those in
        soon.
      </p>
    </section>

    <section class="block">
      <h2>Feedback</h2>
      <p>
        Found a bug, a typo, or have a feature request? Feel free to reach out at
        <a href="mailto:marcinskiba91@gmail.com" class="mail-link">marcinskiba91@gmail.com</a>.
      </p>
    </section>
  </div>
</template>

<style scoped>
.about {
  max-width: var(--content-max-width);
}

.block {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.block h2 {
  font-size: 1rem;
  color: var(--accent-light);
  margin: 0 0 0.5rem;
}

.block p {
  margin: 0;
  color: var(--text-dim);
  line-height: 1.6;
}

.block p + p {
  margin-top: 0.6rem;
}

.block strong {
  color: var(--text);
}

.mail-link {
  color: var(--accent-light);
  text-decoration: none;
  border-bottom: 1px dotted var(--accent-light);
}

.mail-link:hover {
  border-bottom-style: solid;
}

/* .block p (below) sets margin: 0 on every paragraph inside a .block — a
   plain class selector alone can't outrank that class+tag combination by
   specificity regardless of source order, so this needs the same "class +
   tag" shape (.block p.settings-intro, not just .settings-intro) to
   actually win and get its own margin-bottom applied. */
.block p.settings-intro {
  margin-bottom: 1.1rem;
  font-size: 0.85rem;
  color: var(--text-faint);
}

.setting-group + .setting-group {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.setting-group-heading {
  margin: 0 0 0.4rem;
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Same ".block p" specificity gotcha as .settings-intro above — needs the
   "class + tag" shape to actually win its own margin-bottom. */
.block p.setting-group-note {
  margin: 0 0 0.5rem;
  color: var(--text-faint);
  font-size: 0.78rem;
  font-style: italic;
  line-height: 1.5;
}

.setting-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 0.75rem 0;
}

.setting-row + .setting-row {
  border-top: 1px solid var(--border);
}

.setting-text {
  flex: 1;
  min-width: 0;
}

.setting-label {
  display: block;
  color: var(--text);
  font-weight: 600;
  font-size: 0.92rem;
  margin-bottom: 0.2rem;
}

.setting-desc {
  margin: 0;
  color: var(--text-faint);
  font-size: 0.82rem;
  line-height: 1.5;
}

/* Settings 2 and 3 only do anything while the top dock itself is on (they
   both describe things that dock produces) — dimmed rather than hidden
   outright, so their own on/off state (and the fact that they're merely
   waiting on the top dock, not permanently unavailable) stays visible. */
.setting-row.dependent .setting-label,
.setting-row.dependent .setting-desc {
  opacity: 0.55;
}

.toggle {
  flex-shrink: 0;
  position: relative;
  width: 2.5rem;
  height: 1.4rem;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.toggle.on {
  background: var(--accent);
  border-color: var(--accent);
}

.toggle:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.toggle-knob {
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;
}

.toggle.on .toggle-knob {
  transform: translateX(1.1rem);
}
</style>
