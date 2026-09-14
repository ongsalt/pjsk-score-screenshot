<script lang="ts">
  interface Props {
    src: string;
    alt?: string;
  }

  let { src, alt = "" }: Props = $props();
  let dialog: HTMLDialogElement | undefined = $state();
</script>

<!-- the whole shot, never cropped: the corrections depend on reading it -->
<button
  type="button"
  class="group block w-full text-left cursor-zoom-in"
  onclick={() => dialog?.showModal()}
>
  <img {src} {alt} class="w-full h-auto rounded-md border border-line" />
  <span class="mt-1.5 block text-[11px] text-faint group-hover:text-muted">Click to expand</span>
</button>

<!-- native dialog: escape closes it, focus is trapped, backdrop is free -->
<dialog
  bind:this={dialog}
  class="m-auto max-w-[96vw] max-h-[96vh] p-0 bg-transparent backdrop:bg-black/85 cursor-zoom-out"
  onclick={() => dialog?.close()}
>
  <img {src} {alt} class="max-w-[96vw] max-h-[96vh] object-contain rounded-md" />
</dialog>
