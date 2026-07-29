// Ported from the Gist Match prototype. Owns the board's tiles and all
// drag/match/cascade logic; the React page owns HUD text, the overlay, and
// the leaderboard, and is notified via the callbacks below.

const N = 6;
const TYPES = 6;
export const START_MOVES = 15;
const DRAG_THRESHOLD = 6;

interface Tile {
  id: number;
  type: number;
  row: number;
  col: number;
  el: HTMLDivElement;
}

interface DragState {
  tile: Tile;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  ghostEl: HTMLDivElement | null;
}

export interface MatchEngineCallbacks {
  onScore: (score: number) => void;
  onMoves: (moves: number) => void;
  onGameOver: (finalScore: number) => void;
}

/** Seeded PRNG: same date string produces the same board for everyone. */
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export class MatchEngine {
  private boardEl: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private styles: Record<string, string>;
  private callbacks: MatchEngineCallbacks;
  private reduceMotion: boolean;
  private fallMs: number;
  private clearMs: number;
  private swapMs: number;
  private shakeMs: number;

  private rng: () => number;
  private grid!: (number | null)[][];
  private tiles!: Map<number, Tile>;
  private nextTileId = 1;
  private cellSize = 0;
  private score = 0;
  private moves = START_MOVES;
  private busy = false;
  private gameOver = false;
  private dragState: DragState | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    boardEl: HTMLDivElement,
    toastEl: HTMLDivElement,
    styles: Record<string, string>,
    seedKey: string,
    callbacks: MatchEngineCallbacks
  ) {
    this.boardEl = boardEl;
    this.toastEl = toastEl;
    this.styles = styles;
    this.callbacks = callbacks;

    this.reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.fallMs = this.reduceMotion ? 10 : 280;
    this.clearMs = this.reduceMotion ? 10 : 180;
    this.swapMs = this.reduceMotion ? 10 : 200;
    this.shakeMs = this.reduceMotion ? 10 : 320;

    this.rng = mulberry32(xmur3(seedKey)());

    this.handleWindowResize = this.handleWindowResize.bind(this);
    window.addEventListener("resize", this.handleWindowResize);
    this.resizeObserver = new ResizeObserver(() => this.handleWindowResize());
    this.resizeObserver.observe(this.boardEl);

    this.measure();
    this.buildInitialBoard();
    this.callbacks.onScore(this.score);
    this.callbacks.onMoves(this.moves);
  }

  destroy() {
    this.destroyed = true;
    window.removeEventListener("resize", this.handleWindowResize);
    this.resizeObserver?.disconnect();
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.tiles?.forEach((tile) => tile.el.remove());
  }

  private handleWindowResize() {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.measure();
      this.repositionAll(true);
    }, 120);
  }

  private randType() {
    return Math.floor(this.rng() * TYPES);
  }

  private inBounds(r: number, c: number) {
    return r >= 0 && r < N && c >= 0 && c < N;
  }

  private tileAt(r: number, c: number): Tile | null {
    if (!this.inBounds(r, c)) return null;
    const id = this.grid[r][c];
    return id === null ? null : this.tiles.get(id) ?? null;
  }

  private typeOf(r: number, c: number) {
    const t = this.tileAt(r, c);
    return t ? t.type : -1;
  }

  private measure() {
    this.cellSize = this.boardEl.getBoundingClientRect().width / N;
  }

  private placeTile(tile: Tile, instant: boolean) {
    const size = this.cellSize * 0.86;
    const offset = (this.cellSize - size) / 2;
    const x = tile.col * this.cellSize + offset;
    const y = tile.row * this.cellSize + offset;
    if (instant) tile.el.classList.add(this.styles.isInstant);
    tile.el.style.width = size + "px";
    tile.el.style.height = size + "px";
    tile.el.style.setProperty("--tx", x + "px");
    tile.el.style.setProperty("--ty", y + "px");
    tile.el.style.transform = `translate(${x}px, ${y}px)`;
    if (instant) {
      void tile.el.offsetWidth;
      tile.el.classList.remove(this.styles.isInstant);
    }
  }

  private repositionAll(instant: boolean) {
    this.tiles.forEach((tile) => this.placeTile(tile, instant));
  }

  private createTile(row: number, col: number, type: number, spawnRow?: number): Tile {
    const id = this.nextTileId++;
    const el = document.createElement("div");
    el.className = this.styles.tile;
    const item = document.createElement("span");
    item.className = `${this.styles.item} ${this.styles["itemType" + type]}`;
    const wiggleSeed = (id * 2654435761) % 4294967296;
    item.style.animationDelay = "-" + ((wiggleSeed % 1700) / 100).toFixed(2) + "s";
    item.style.animationDuration = (3.1 + ((wiggleSeed >>> 8) % 240) / 100).toFixed(2) + "s";
    el.appendChild(item);
    this.boardEl.appendChild(el);

    const tile: Tile = { id, type, row: spawnRow === undefined ? row : spawnRow, col, el };
    (el as HTMLDivElement & { __tile?: Tile }).__tile = tile;
    this.tiles.set(id, tile);
    this.grid[row][col] = id;
    this.placeTile(tile, true);

    el.addEventListener("pointerdown", (e) => this.handlePointerDown(e, tile));
    el.addEventListener("pointermove", (e) => this.handlePointerMove(e, tile));
    el.addEventListener("pointerup", (e) => this.handlePointerUp(e, tile));
    el.addEventListener("pointercancel", (e) => this.handlePointerCancel(e, tile));

    if (spawnRow !== undefined) {
      tile.row = row;
      requestAnimationFrame(() => this.placeTile(tile, false));
    }
    return tile;
  }

  private buildInitialBoard() {
    if (this.tiles) this.tiles.forEach((tile) => tile.el.remove());
    this.grid = [];
    this.tiles = new Map();
    for (let r = 0; r < N; r++) this.grid.push(new Array(N).fill(null));

    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        let type: number;
        do {
          type = this.randType();
        } while (
          (col >= 2 && this.typeOf(row, col - 1) === type && this.typeOf(row, col - 2) === type) ||
          (row >= 2 && this.typeOf(row - 1, col) === type && this.typeOf(row - 2, col) === type)
        );
        this.createTile(row, col, type);
      }
    }
    if (!this.hasAvailableMove()) this.buildInitialBoard();
  }

  private findMatches(): Set<number> {
    const matched = new Set<number>();
    for (let r = 0; r < N; r++) {
      let runStart = 0;
      for (let c = 1; c <= N; c++) {
        const same = c < N && this.typeOf(r, c) === this.typeOf(r, runStart) && this.typeOf(r, runStart) !== -1;
        if (!same) {
          if (c - runStart >= 3) {
            for (let k = runStart; k < c; k++) matched.add(this.grid[r][k]!);
          }
          runStart = c;
        }
      }
    }
    for (let c2 = 0; c2 < N; c2++) {
      let runStart2 = 0;
      for (let r2 = 1; r2 <= N; r2++) {
        const same2 =
          r2 < N && this.typeOf(r2, c2) === this.typeOf(runStart2, c2) && this.typeOf(runStart2, c2) !== -1;
        if (!same2) {
          if (r2 - runStart2 >= 3) {
            for (let k2 = runStart2; k2 < r2; k2++) matched.add(this.grid[k2][c2]!);
          }
          runStart2 = r2;
        }
      }
    }
    return matched;
  }

  private snapshotTypes(): number[][] {
    const t: number[][] = [];
    for (let r = 0; r < N; r++) {
      const row: number[] = [];
      for (let c = 0; c < N; c++) row.push(this.typeOf(r, c));
      t.push(row);
    }
    return t;
  }

  private swapVals(t: number[][], r1: number, c1: number, r2: number, c2: number) {
    const tmp = t[r1][c1];
    t[r1][c1] = t[r2][c2];
    t[r2][c2] = tmp;
  }

  private runThrough(t: number[][], r: number, c: number) {
    const type = t[r][c];
    let count = 1;
    let cc = c - 1;
    while (cc >= 0 && t[r][cc] === type) { count++; cc--; }
    cc = c + 1;
    while (cc < N && t[r][cc] === type) { count++; cc++; }
    if (count >= 3) return true;
    count = 1;
    let rr = r - 1;
    while (rr >= 0 && t[rr][c] === type) { count++; rr--; }
    rr = r + 1;
    while (rr < N && t[rr][c] === type) { count++; rr++; }
    return count >= 3;
  }

  private hasAvailableMove() {
    const t = this.snapshotTypes();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (c + 1 < N) {
          this.swapVals(t, r, c, r, c + 1);
          const rightMatch = this.runThrough(t, r, c) || this.runThrough(t, r, c + 1);
          this.swapVals(t, r, c, r, c + 1);
          if (rightMatch) return true;
        }
        if (r + 1 < N) {
          this.swapVals(t, r, c, r + 1, c);
          const downMatch = this.runThrough(t, r, c) || this.runThrough(t, r + 1, c);
          this.swapVals(t, r, c, r + 1, c);
          if (downMatch) return true;
        }
      }
    }
    return false;
  }

  private swapGrid(a: Tile, b: Tile) {
    const tmp = this.grid[a.row][a.col];
    this.grid[a.row][a.col] = this.grid[b.row][b.col];
    this.grid[b.row][b.col] = tmp;
    const ar = a.row, ac = a.col;
    a.row = b.row; a.col = b.col;
    b.row = ar; b.col = ac;
  }

  private pointsForWave(count: number, combo: number) {
    const base = count === 3 ? 30 : count === 4 ? 60 : count === 5 ? 100 : 100 + (count - 5) * 40;
    return Math.round(base * combo);
  }

  private showToast(text: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastEl.textContent = text;
    this.toastEl.classList.add(this.styles.isVisible);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove(this.styles.isVisible), 1100);
  }

  private setScore(v: number) {
    this.score = v;
    this.callbacks.onScore(v);
  }

  private setMoves(v: number) {
    this.moves = v;
    this.callbacks.onMoves(v);
  }

  private typeAtId(id: number | null | undefined) {
    if (id === null || id === undefined) return -2;
    const t = this.tiles.get(id);
    return t ? t.type : -2;
  }

  private async clearMatches(idsSet: Set<number>) {
    const els: Tile[] = [];
    idsSet.forEach((id) => {
      const tile = this.tiles.get(id);
      if (tile) { tile.el.classList.add(this.styles.isClearing); els.push(tile); }
    });
    await wait(this.clearMs);
    if (this.destroyed) return;
    els.forEach((tile) => { tile.el.remove(); this.tiles.delete(tile.id); });
    idsSet.forEach((id) => {
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (this.grid[r][c] === id) this.grid[r][c] = null;
        }
      }
    });
  }

  private async collapseAndRefill() {
    for (let col = 0; col < N; col++) {
      const column: (number | null)[] = [];
      for (let r = 0; r < N; r++) column.push(this.grid[r][col]);
      const survivors = column.filter((id): id is number => id !== null);
      const emptyCount = N - survivors.length;
      for (let i = 0; i < survivors.length; i++) {
        const newRow = emptyCount + i;
        const tile = this.tiles.get(survivors[i])!;
        tile.row = newRow;
        tile.col = col;
        this.grid[newRow][col] = tile.id;
      }
      for (let row = 0; row < emptyCount; row++) {
        this.createTile(row, col, this.randType(), row - emptyCount);
      }
    }
    this.repositionAll(false);
    await wait(this.fallMs + 20);
  }

  private groupRuns(idsSet: Set<number>): number[] {
    const runs: number[] = [];
    for (let r = 0; r < N; r++) {
      let start = 0;
      for (let c = 1; c <= N; c++) {
        const idAtC = c < N ? this.grid[r][c] : null;
        const idAtStart = this.grid[r][start];
        const same = c < N && idsSet.has(idAtC!) && idsSet.has(idAtStart!) && this.typeAtId(idAtC) === this.typeAtId(idAtStart);
        if (!same) {
          if (c - start >= 3 && idsSet.has(idAtStart!)) runs.push(c - start);
          start = c;
        }
      }
    }
    for (let c2 = 0; c2 < N; c2++) {
      let start2 = 0;
      for (let r2 = 1; r2 <= N; r2++) {
        const idAtR = r2 < N ? this.grid[r2][c2] : null;
        const idAtStart2 = this.grid[start2][c2];
        const same2 =
          r2 < N && idsSet.has(idAtR!) && idsSet.has(idAtStart2!) && this.typeAtId(idAtR) === this.typeAtId(idAtStart2);
        if (!same2) {
          if (r2 - start2 >= 3 && idsSet.has(idAtStart2!)) runs.push(r2 - start2);
          start2 = r2;
        }
      }
    }
    return runs.length ? runs : [idsSet.size];
  }

  private async resolveCascade() {
    let combo = 0;
    let totalGained = 0;
    let matched = this.findMatches();
    while (matched.size > 0) {
      combo++;
      const runs = this.groupRuns(matched);
      const gained = runs.reduce((sum, run) => sum + this.pointsForWave(run, combo), 0);
      totalGained += gained;
      this.setScore(this.score + gained);
      await this.clearMatches(matched);
      if (this.destroyed) return combo;
      await this.collapseAndRefill();
      if (this.destroyed) return combo;
      matched = this.findMatches();
    }
    if (combo > 1) this.showToast("Chain x" + combo + "  +" + totalGained.toLocaleString());
    else if (combo === 1) this.showToast("+" + totalGained.toLocaleString());
    return combo;
  }

  private async trySwap(a: Tile, b: Tile) {
    this.busy = true;
    this.swapGrid(a, b);
    this.placeTile(a, false);
    this.placeTile(b, false);
    await wait(this.swapMs);
    if (this.destroyed) return;

    const matched = this.findMatches();
    if (matched.size === 0) {
      this.swapGrid(a, b);
      this.placeTile(a, false);
      this.placeTile(b, false);
      a.el.classList.add(this.styles.isShaking);
      b.el.classList.add(this.styles.isShaking);
      await wait(this.shakeMs);
      if (this.destroyed) return;
      a.el.classList.remove(this.styles.isShaking);
      b.el.classList.remove(this.styles.isShaking);
      this.busy = false;
      return;
    }

    this.setMoves(this.moves - 1);
    await this.resolveCascade();
    if (this.destroyed) return;

    if (this.moves <= 0) {
      this.gameOver = true;
      this.busy = false;
      this.callbacks.onGameOver(this.score);
      return;
    }

    if (!this.hasAvailableMove()) {
      await this.reshuffleBoard();
      if (this.destroyed) return;
    }

    this.busy = false;
  }

  private async reshuffleBoard() {
    this.showToast("Reshuffling board");
    await wait(300);
    if (this.destroyed) return;
    this.buildInitialBoard();
    this.repositionAll(true);
  }

  private createGhost(tile: Tile): HTMLDivElement {
    const ghost = document.createElement("div");
    ghost.className = `${this.styles.tile} ${this.styles.tileGhost}`;
    const item = document.createElement("span");
    item.className = `${this.styles.item} ${this.styles["itemType" + tile.type]}`;
    ghost.appendChild(item);
    this.boardEl.insertBefore(ghost, tile.el);
    const size = this.cellSize * 0.86;
    const offset = (this.cellSize - size) / 2;
    ghost.style.width = size + "px";
    ghost.style.height = size + "px";
    ghost.style.transform = `translate(${tile.col * this.cellSize + offset}px, ${tile.row * this.cellSize + offset}px)`;
    return ghost;
  }

  // Resolve the drop target by board math (which cell the pointer is over),
  // not DOM hit-testing -- items render at 86% of a cell for visual spacing,
  // so elementFromPoint would miss in the gap and silently treat a
  // well-aimed drop as "nowhere". This makes the whole cell count.
  private tileFromClientPoint(clientX: number, clientY: number): Tile | null {
    const rect = this.boardEl.getBoundingClientRect();
    const col = Math.floor((clientX - rect.left) / this.cellSize);
    const row = Math.floor((clientY - rect.top) / this.cellSize);
    return this.tileAt(row, col);
  }

  private handlePointerDown(e: PointerEvent, tile: Tile) {
    if (this.busy || this.gameOver || this.dragState) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    tile.el.setPointerCapture(e.pointerId);
    this.dragState = { tile, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, ghostEl: null };
  }

  private handlePointerMove(e: PointerEvent, tile: Tile) {
    const st = this.dragState;
    if (!st || st.pointerId !== e.pointerId || st.tile !== tile) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;

    if (!st.moved) {
      if (Math.hypot(dx, dy) <= DRAG_THRESHOLD) return;
      st.moved = true;
      st.ghostEl = this.createGhost(tile);
      tile.el.classList.add(this.styles.isDragging);
      tile.el.style.pointerEvents = "none";
    }

    const size = this.cellSize * 0.86;
    const offset = (this.cellSize - size) / 2;
    const baseX = tile.col * this.cellSize + offset;
    const baseY = tile.row * this.cellSize + offset;
    tile.el.style.transform = `translate(${baseX + dx}px, ${baseY + dy}px) scale(1.1)`;
  }

  private endDrag(tile: Tile, e: PointerEvent) {
    try { tile.el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    tile.el.classList.remove(this.styles.isDragging);
    tile.el.style.pointerEvents = "";
    if (this.dragState?.ghostEl) this.dragState.ghostEl.remove();
  }

  private handlePointerUp(e: PointerEvent, tile: Tile) {
    const st = this.dragState;
    if (!st || st.pointerId !== e.pointerId || st.tile !== tile) return;
    const wasMoved = st.moved;
    this.endDrag(tile, e);
    this.dragState = null;

    if (!wasMoved) {
      this.placeTile(tile, false);
      return;
    }

    const target = this.tileFromClientPoint(e.clientX, e.clientY);
    if (!target || target.id === tile.id || this.busy || this.gameOver) {
      this.placeTile(tile, false);
      return;
    }
    void this.trySwap(tile, target);
  }

  private handlePointerCancel(e: PointerEvent, tile: Tile) {
    const st = this.dragState;
    if (!st || st.pointerId !== e.pointerId || st.tile !== tile) return;
    this.endDrag(tile, e);
    this.dragState = null;
    this.placeTile(tile, false);
  }
}
