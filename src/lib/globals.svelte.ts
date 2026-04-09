import type { TaskQueue } from "./shared/task-queue.svelte";

export const queues: TaskQueue[] = $state([])
