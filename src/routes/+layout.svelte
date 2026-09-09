<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import "./layout.css";
  import Nav from "$lib/components/shell/nav.svelte";

  let { children } = $props();
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
