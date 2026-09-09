<script module>
  // There will be only 1 of this
  const logEntries: any[] = $state([]);

  export function appendLog(log: any) {
    logEntries.push(log)
  }
</script>

<script lang="ts">
</script>

<div class="prose">
  {#each logEntries as entry}
    {#if typeof entry === "object"}
      <pre>{JSON.stringify(entry, null, 2)}</pre>
    {:else}
      <pre>jsonDisplay</pre>
    {/if}
  {/each}
</div>
