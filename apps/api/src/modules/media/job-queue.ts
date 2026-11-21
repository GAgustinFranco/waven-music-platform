export type Job = () => Promise<void>;

/**
 * Minimal in-process queue with bounded concurrency. Progress lives in the
 * database (`Track.status`), so losing queued jobs on a restart is acceptable.
 */
export class JobQueue {
  private readonly pending: Job[] = [];
  private running = 0;
  private idleWaiters: (() => void)[] = [];

  constructor(
    private readonly concurrency: number,
    private readonly onError: (error: unknown) => void,
  ) {}

  get size(): number {
    return this.pending.length + this.running;
  }

  enqueue(job: Job): void {
    this.pending.push(job);
    this.next();
  }

  /** Resolves once every queued job has finished. */
  onIdle(): Promise<void> {
    if (this.size === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  private next(): void {
    while (this.running < this.concurrency) {
      const job = this.pending.shift();
      if (!job) {
        break;
      }
      this.running += 1;
      void job()
        .catch((error: unknown) => this.onError(error))
        .finally(() => {
          this.running -= 1;
          this.next();
          if (this.size === 0) {
            const waiters = this.idleWaiters;
            this.idleWaiters = [];
            waiters.forEach((resolve) => resolve());
          }
        });
    }
  }
}
