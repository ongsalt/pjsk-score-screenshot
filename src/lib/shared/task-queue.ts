export type Task<T> = () => Promise<T>;

export class TaskQueue {
  private queue: Task<void>[] = [];
  private running: number = 0;
  private concurrency: number;

  constructor(concurrency: number = 1) {
    this.concurrency = Math.max(1, concurrency);
  }

  public enqueue<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
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
