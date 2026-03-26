<script lang="ts">
  let selectedFile = $state<File | null>(null);
  let previewUrl = $state<string>("");

  function onFileChange(event: Event): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const file = target.files?.[0] ?? null;
    selectedFile = file;
    setPreview(file);
  }

  function setPreview(file: File | null): void {
    if (!file) {
      previewUrl = "";
      return;
    }

    previewUrl = URL.createObjectURL(file);
  }
</script>

<div class="border">
  <h2>Upload images</h2>
  <label>
    <input type="file" accept="image/*" onchange={onFileChange} />
    <span class="text-blue-600"> Select screenshot </span>
  </label>
  <p>or drag and drop here</p>

</div>

<div>
  <img src={previewUrl} class="w-50" alt="">
</div>
<!-- collapsible/sheet -->
