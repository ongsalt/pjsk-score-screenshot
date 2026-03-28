<script lang="ts">
</script>

<nav
  class="sm:flex hidden border-r fixed top-0 h-screen self-start w-32 flex-col"
>
  <div class="p-4">
    <h1 class="text-xl">pjsk score</h1>
    <span class="opacity-50">v0.0.1</span>
  </div>

  <section class="flex-1 flex flex-col justify-between pb-4">
    <div class="flex flex-col">
      <a class="px-4 py-1 hover:underline" href="/">Home</a>
      <a class="px-4 py-1 hover:underline" href="/history">Play History</a>
      <a class="px-4 py-1 hover:underline" href="/stats">Stats</a>
    </div>
    <div class="flex flex-col">
      <a class="px-4 py-1 hover:underline" href="/settings">Settings</a>
      <a class="px-4 py-1 hover:underline" href="/about">About</a>
    </div>
  </section>
</nav>

<nav class="sm:hidden z-20 fixed top-4 left-4 backdrop-blur-lg border border-neutral-500/20">
  <details>
    <summary> Menu </summary>

    <section class="flex-1 flex flex-col justify-between pb-4">
      <div class="flex flex-col">
        <a class="px-4 py-1 hover:underline" href="/">Home</a>
        <a class="px-4 py-1 hover:underline" href="/history">Play History</a>
        <a class="px-4 py-1 hover:underline" href="/stats">Stats</a>
      </div>
      <div class="flex flex-col">
        <a class="px-4 py-1 hover:underline" href="/settings">Settings</a>
        <a class="px-4 py-1 hover:underline" href="/about">About</a>
      </div>
    </section>
  </details>
</nav>

<div class="sm:w-32">
  <!-- spacer -->
</div>
