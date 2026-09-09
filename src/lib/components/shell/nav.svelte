<script lang="ts">
  import { page } from "$app/state";
  import { settings } from "$lib/data/settings.svelte";

  // A tool's mode switcher, not an app tab bar: horizontal icon + label, an
  // accent rule on the active edge, hairline dividers between cells.
  const items = [
    {
      href: "/add",
      label: "Import",
      icon: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>`,
    },
    {
      href: "/",
      label: "History",
      icon: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>`,
    },
    {
      href: "/songs",
      label: "Songs",
      icon: `<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,
    },
    {
      href: "/settings",
      label: "Settings",
      icon: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10.6 3.09V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 16.11 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.43 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
    },
  ];

  function isActive(href: string) {
    const path = page.url.pathname;
    return href === "/" ? path === "/" : path.startsWith(href);
  }
</script>

<!-- desktop rail -->
<nav
  class="max-sm:hidden fixed top-0 left-0 h-screen w-56 flex flex-col border-r border-line bg-surface"
>
  <div class="flex items-center gap-2.5 h-13 px-4 border-b border-line">
    <div class="size-2 rounded-full bg-accent"></div>
    <span class="text-sm font-semibold tracking-tight">pjsk score</span>
    <span class="num text-[11px] text-ghost">0.0.1</span>
  </div>

  <div class="flex flex-col gap-0.5 p-2.5">
    {#each items as item}
      {@const active = isActive(item.href)}
      <a
        href={item.href}
        class="flex items-center gap-2.5 h-9 px-2.5 rounded-md transition-colors
               {active ? 'bg-accent-soft text-accent font-medium' : 'text-muted hover:bg-sunken'}"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round">{@html item.icon}</svg
        >
        <span class="text-[13px]">{item.label}</span>
      </a>
    {/each}
  </div>

  <div class="flex-1"></div>

  <div class="flex flex-col gap-2 p-4 border-t border-line">
    <span class="cap">Server</span>
    <div class="grid grid-cols-2 gap-0.5 p-0.5 border border-line rounded-md">
      {#each [["jp", "JP"], ["en", "EN"]] as [value, label]}
        <button
          class="h-7 rounded text-xs transition-colors
                 {settings.current.server === value
            ? 'bg-ink text-white font-medium'
            : 'text-muted hover:bg-sunken'}"
          onclick={() => (settings.current.server = value as "jp" | "en")}
        >
          {label}
        </button>
      {/each}
    </div>
    <a href="/about" class="text-xs text-faint hover:text-muted">About</a>
  </div>
</nav>

<!-- mobile mode strip -->
<nav
  class="sm:hidden fixed bottom-0 inset-x-0 z-20 grid grid-cols-4 border-t border-line bg-surface"
  style="padding-bottom: env(safe-area-inset-bottom)"
>
  {#each items as item, index}
    {@const active = isActive(item.href)}
    <a
      href={item.href}
      class="relative flex items-center justify-center gap-1.5 h-12
             {index > 0 ? 'border-l border-line-soft' : ''}
             {active ? 'text-accent bg-accent-soft' : 'text-muted'}"
    >
      {#if active}
        <span class="absolute inset-x-0 top-0 h-0.5 bg-accent"></span>
      {/if}
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round">{@html item.icon}</svg
      >
      <span class="text-[11.5px] {active ? 'font-medium' : ''}">{item.label}</span>
    </a>
  {/each}
</nav>
