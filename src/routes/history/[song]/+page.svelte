<script lang="ts">
  let { data } = $props();
</script>

<h2 class="text-2xl">
  {data.detail.song.title}
</h2>
<p>
  {data.detail.song.composer}
</p>

<div>
  {#each data.detail.difficulties as diff}
    <div>
      <span>{diff.musicDifficulty} {diff.playLevel} ({diff.totalNoteCount})</span>
    </div>
  {/each}
</div>
