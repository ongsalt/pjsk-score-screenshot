<script>
  let { children } = $props();
</script>

<main class="grid grid-cols-2 h-screen">
  <section class="border-r">
    <div class="border-b">
      <p>search and filter</p>
      <label>
        <input type="checkbox" />
        only song that has data
      </label>
    </div>

    <div class="flex flex-col">
      {#each { length: 100 } as _, i}
        <a href="/history/{i}" class="hover:underline px-2 py-0.5">
          {i}
        </a>
      {/each}
    </div>
  </section>

  <section>
    {@render children?.()}
  </section>
</main>
