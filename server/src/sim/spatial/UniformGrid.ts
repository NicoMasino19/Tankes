export class UniformGrid {
  private readonly cells = new Map<string, string[]>();

  constructor(private readonly cellSize: number) {}

  clear(): void {
    this.cells.clear();
  }

  insert(entityId: string, x: number, y: number): void {
    const key = this.keyFor(x, y);
    const list = this.cells.get(key);
    if (list) {
      list.push(entityId);
      return;
    }
    this.cells.set(key, [entityId]);
  }

  queryNearby(x: number, y: number): string[] {
    const results: string[] = [];
    this.queryNearbyInto(x, y, results);
    return results;
  }

  queryNearbyInto(x: number, y: number, out: string[]): void {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);

    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const key = `${cx + ox}:${cy + oy}`;
        const cell = this.cells.get(key);
        if (cell) {
          out.push(...cell);
        }
      }
    }
  }

  private keyFor(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`;
  }
}
