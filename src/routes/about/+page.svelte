<script lang="ts">
  import Toolbar from "$lib/components/shell/toolbar.svelte";
</script>

<Toolbar title="About" back="/settings" />

<div class="flex flex-col gap-4 p-4 max-w-2xl">
  <p class="text-sm leading-relaxed text-muted">
    Reads Project Sekai result screenshots on your device and keeps the play history the game
    does not. Nothing is uploaded.
  </p>

  <div class="flex flex-col rounded-md border border-line bg-surface overflow-hidden">
    <a
      class="flex items-center justify-between gap-3 px-3.5 py-3 border-b border-line-soft"
      href="https://github.com/ongsalt/pjsk-score-screenshot"
    >
      <span class="text-sm">Source</span>
      <span class="text-[13px] text-accent">GitHub</span>
    </a>
    <a
      class="flex items-center justify-between gap-3 px-3.5 py-3"
      href="https://github.com/Sekai-World/sekai-master-db-diff"
    >
      <span class="text-sm">Song data</span>
      <span class="text-[13px] text-accent">Sekai World</span>
    </a>
  </div>

  <span class="num text-xs text-faint">v0.0.1</span>
</div>
