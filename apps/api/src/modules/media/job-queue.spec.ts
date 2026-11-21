import { JobQueue } from './job-queue.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('JobQueue', () => {
  it('never runs more jobs than its concurrency', async () => {
    const queue = new JobQueue(2, vi.fn());
    let active = 0;
    let peak = 0;
    const job = async () => {
      active += 1;
      peak = Math.max(peak, active);
      await tick();
      active -= 1;
    };

    for (let i = 0; i < 6; i += 1) {
      queue.enqueue(job);
    }
    await queue.onIdle();

    expect(peak).toBe(2);
    expect(queue.size).toBe(0);
  });

  it('reports failures and keeps processing', async () => {
    const onError = vi.fn();
    const queue = new JobQueue(1, onError);
    const done = vi.fn();

    queue.enqueue(() => Promise.reject(new Error('boom')));
    queue.enqueue(async () => {
      await tick();
      done();
    });
    await queue.onIdle();

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));
    expect(done).toHaveBeenCalledOnce();
  });

  it('resolves onIdle immediately when empty', async () => {
    await expect(new JobQueue(1, vi.fn()).onIdle()).resolves.toBeUndefined();
  });
});
