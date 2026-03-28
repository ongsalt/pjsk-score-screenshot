<script module>
  export class FilesUploaderState {
    previewUrls: string[] = $state([]);
    files: File[] = $state([]);

    onFileChange = (event: Event) => {
      const target = event.currentTarget;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      this.files = [...(target.files ?? [])];
      this.previewUrls = this.files.map((it) => URL.createObjectURL(it));
    };

    removeFileAtIndex = (index: number) => {
      this.files.splice(index, 1);
    };
  }
</script>

<script lang="ts">
  interface Props {
    state?: FilesUploaderState;
  }
  const { state: s = new FilesUploaderState() }: Props = $props();
</script>

<div class="border">
  <h2>Upload images</h2>
  <label>
    <input type="file" accept="image/*" onchange={s.onFileChange} />
    <span class="text-blue-600"> Select screenshot </span>
  </label>
  <p>or drag and drop here</p>
</div>

<div>
  {#each s.previewUrls as previewUrl}
    <img src={previewUrl} class="w-50" alt="" />
  {/each}
</div>
<!-- collapsible/sheet -->
