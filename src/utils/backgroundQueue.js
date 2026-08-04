import logger from './logger.js';

/**
 * Lightweight in-process background job runner with concurrency limit.
 * Suitable for CPU/image work without a full Redis queue.
 */
class BackgroundQueue {
  /**
   * @param {{ concurrency?: number, name?: string }} [options]
   */
  constructor(options = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 2);
    this.name = options.name || 'background';
    /** @type {Array<() => Promise<void>>} */
    this.#queue = [];
    this.#active = 0;
  }

  #queue;
  #active;

  /**
   * Enqueue a job. Returns immediately; errors are logged (not thrown to caller).
   *
   * @param {() => Promise<void>} job
   * @returns {void}
   */
  enqueue(job) {
    this.#queue.push(job);
    this.#pump();
  }

  get pending() {
    return this.#queue.length;
  }

  get active() {
    return this.#active;
  }

  #pump() {
    while (this.#active < this.concurrency && this.#queue.length > 0) {
      const job = this.#queue.shift();
      this.#active += 1;

      Promise.resolve()
        .then(() => job())
        .catch((err) => {
          logger.error(`[${this.name}] background job failed`, err);
        })
        .finally(() => {
          this.#active -= 1;
          this.#pump();
        });
    }
  }
}

export const imageCompressionQueue = new BackgroundQueue({
  concurrency: 2,
  name: 'image-compress',
});

export default BackgroundQueue;
