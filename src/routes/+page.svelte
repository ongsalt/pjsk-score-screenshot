<script lang="ts">
  import FilesUploader from "$lib/components/files-uploader.svelte";
</script>

<svelte:head>
  <title>PJSK Result OCR Demo</title>
</svelte:head>

<main class="px-6 pt-4 space-y-2">
  <FilesUploader />
  <div class="border">
    <h2>Settings</h2>
  </div>
  
  <button class="border">start</button>
</main>
