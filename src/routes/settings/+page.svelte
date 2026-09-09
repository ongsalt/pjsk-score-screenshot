<script lang="ts">
  import Toolbar from "$lib/components/shell/toolbar.svelte";
  import { musicRepository } from "$lib/data/music.svelte";
  import { playRecords } from "$lib/data/play-record.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { bestDevice, hasWebGPU, hasWebNN } from "$lib/pipeline/manga-ocr";

  const SERVERS = [
    ["jp", "Japan"],
    ["en", "English"],
  ] as const;

  const DEVICES = [
    { id: "auto", label: "Auto", available: () => true },
    { id: "webnn", label: "WebNN", available: hasWebNN },
    { id: "webgpu", label: "WebGPU", available: hasWebGPU },
    { id: "wasm", label: "WASM", available: () => true },
  ] as const;

  function exportJson() {
    const payload = {
      server: settings.current.server,
      exportedAt: new Date().toISOString(),
      records: playRecords.all,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `pjsk-records-${settings.current.server}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<Toolbar title="Settings" />

<div class="flex flex-col gap-6 p-4 max-w-2xl">
  <section class="flex flex-col gap-2.5">
    <span class="cap">Server</span>
    <div
      class="grid grid-cols-2 gap-1 p-1 rounded-md border border-line bg-surface"
    >
      {#each SERVERS as [value, label]}
        <button
          class="h-11 rounded text-sm transition-colors
                 {settings.current.server === value
            ? 'bg-ink text-white font-medium'
            : 'text-muted hover:bg-sunken'}"
          onclick={() => (settings.current.server = value)}
        >
          {label}
        </button>
      {/each}
    </div>
    <p class="text-xs leading-relaxed text-faint">
      Songs and records are kept per server — the same song has a different id
      on each, so switching shows that server's history.
    </p>
  </section>

  <section class="flex flex-col gap-2.5">
    <span class="cap">Recognizer</span>
    <div
      class="flex flex-col rounded-md border border-line bg-surface overflow-hidden"
    >
      <div
        class="flex items-center justify-between gap-3 px-3.5 py-3 border-b border-line-soft"
      >
        <div class="flex flex-col gap-0.5">
          <span class="text-sm">Model</span>
          <span class="num text-xs text-faint">manga-ocr · 112 MiB</span>
        </div>
        <span class="text-[13px] text-muted">Loaded on first import</span>
      </div>
      <div class="flex flex-col gap-2.5 px-3.5 py-3 border-line-soft">
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-sm">Acceleration</span>
          <span class="num text-xs text-faint">
            {settings.current.device === "auto"
              ? `auto · ${bestDevice()}`
              : settings.current.device}
          </span>
        </div>
        <div class="grid grid-cols-4 gap-1">
          {#each DEVICES as option}
            {@const active = settings.current.device === option.id}
            <button
              class="h-9 rounded text-[12px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                     {active ? 'bg-ink text-white font-medium' : 'border border-line text-muted'}"
              disabled={!option.available()}
              onclick={() => (settings.current.device = option.id)}
            >
              {option.label}
            </button>
          {/each}
        </div>
        <p class="text-xs leading-relaxed text-faint">
          WebNN uses the NPU where the device has one — quicker and much easier on battery than the
          GPU path. Unsupported operators fall back on their own, and a change applies to your next
          import.
        </p>
      </div>
    </div>
  </section>

  <section class="flex flex-col gap-2.5">
    <span class="cap">Data</span>
    <div
      class="flex flex-col rounded-md border border-line bg-surface overflow-hidden"
    >
      <div class="flex items-center justify-between gap-3 px-3.5 py-3">
        <div class="flex flex-col gap-0.5">
          <span class="text-sm">Records on this device</span>
          <span class="num text-xs text-faint">{playRecords.count} plays</span>
        </div>
        <button
          class="h-9 px-3 rounded border border-line text-[13px] text-muted"
          onclick={exportJson}
        >
          Export JSON
        </button>
      </div>
    </div>
  </section>

  <div class="flex items-center justify-between">
    <span class="num text-xs text-faint">pjsk score · v0.0.1</span>
    <a href="/about" class="text-[13px] text-accent">About</a>
  </div>
</div>
