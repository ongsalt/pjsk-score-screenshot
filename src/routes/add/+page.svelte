<script lang="ts">
  import FilesUploader, {
    FilesUploaderState,
  } from "$lib/components/files-uploader.svelte";
  import Section from "$lib/components/section.svelte";
  import TopInset from "$lib/components/shell/top-inset.svelte";

  let { data } = $props();

  const filesUploaderState = new FilesUploaderState();

  async function start() {}
</script>

<TopInset />
<main class="px-6 pt-4 space-y-2">
  <FilesUploader state={filesUploaderState} />

  <!-- <div class="border" id="canvas-host" >
  </div> -->

  <Section></Section>

  <button class="border" onclick={start}>start</button>
</main>
