<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import "./layout.css";
  import Sidebar from "./sidebar.svelte";

  let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen">
  <Sidebar />
  <div class="flex-1">
    {@render children()}
  </div>
</div>
