<script setup></script>

<template>
  <div class="about">
    <h1>About</h1>

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
  max-width: 640px;
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
</style>
