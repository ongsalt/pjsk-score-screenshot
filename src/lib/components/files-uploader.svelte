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
  import Section from "./section.svelte";

  interface Props {
    state?: FilesUploaderState;
  }
  const { state: s = new FilesUploaderState() }: Props = $props();
</script>

<Section label="Upload images">
  <label>
    <input type="file" multiple accept="image/*" onchange={s.onFileChange} />
    <span class="text-teal-500"> Select screenshot </span>
  </label>
  <p>or drag and drop here</p>
</Section>

<div>
  {#each s.previewUrls as previewUrl}
    <img src={previewUrl} class="w-50" alt="" />
  {/each}
</div>
<!-- collapsible/sheet -->
