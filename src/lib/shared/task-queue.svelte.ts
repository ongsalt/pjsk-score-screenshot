
export type Task<T> = () => Promise<T>;

export class TaskQueue {
  private queue: Task<void>[] = $state([]);
  private running: number = $state(0);
  private concurrency: number;
  private waiting: ((value: void | PromiseLike<void>) => void)[] = [];

  completed: number = $state(0);

  constructor(concurrency: number = 1) {
    this.concurrency = Math.max(1, concurrency);
  }

  public wait(): Promise<void> {
    if (this.queue.length === 0 && this.running === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  public enqueue<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          this.completed += 1;
          resolve(result);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
      this.processNext();
    });
  }

  private processNext(): void {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      if (this.queue.length === 0 && this.running === 0) {
        this.waiting.forEach((resolve) => resolve());
        this.waiting = [];
      }
      return;
    }

    const task = this.queue.shift();
    if (task) {
      this.running++;
      task().finally(() => {
        this.running--;
        this.processNext();
      });
    }
  }

  public get size(): number {
    return this.queue.length;
  }

  public get isRunning(): boolean {
    return this.running > 0;
  }
}
