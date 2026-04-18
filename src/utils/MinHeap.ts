/** Generic min-heap keyed by a numeric priority. */
export class MinHeap<T> {
  private readonly heap: T[] = [];

  constructor(private readonly priority: (item: T) => number) {}

  get size(): number {
    return this.heap.length;
  }

  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T {
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  peek(): T {
    return this.heap[0];
  }

  clear(): void {
    this.heap.length = 0;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.priority(this.heap[parent]) <= this.priority(this.heap[i])) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.priority(this.heap[left]) < this.priority(this.heap[smallest])) {
        smallest = left;
      }
      if (right < n && this.priority(this.heap[right]) < this.priority(this.heap[smallest])) {
        smallest = right;
      }
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}
