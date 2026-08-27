// One clock seam for timestamps in durable lead history. Tests may replace it
// without depending on the host clock.
let clock: () => number = () => Date.now();

export function now(): number {
  return clock();
}

export function setClockForTests(next: () => number): void {
  clock = next;
}
