<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import "./layout.css";
  import Nav from "$lib/components/shell/nav.svelte";
  import { musicRepository } from "$lib/data/music.svelte";
  import { settings } from "$lib/data/settings.svelte";
  import { untrack } from "svelte";

  let { children } = $props();

  // song and chart ids only mean anything within one server, so switching has to
  // pull that server's database - load() itself is a no-op when it is unchanged
  $effect(() => {
    settings.current.server;
    untrack(() => musicRepository.load());
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>pjsk score</title>
</svelte:head>

<Nav />

<!-- rail on desktop, mode strip on mobile -->
<div class="sm:pl-56 pb-12 sm:pb-0 min-h-screen">
  {@render children()}
</div>
