export interface KeyboardAxisControllerConfig {
  holdBindings: Record<string, -1 | 1>;
  doubleTapBindings?: Record<string, -1 | 1>;
  centerBindings?: string[];
  holdUnitsPerSecond: number;
  snapUnitsPerSecond: number;
  centerUnitsPerSecond: number;
  doubleTapThresholdMs?: number;
  min?: number;
  max?: number;
}

interface TargetMotion {
  target: number;
  unitsPerSecond: number;
}

export class KeyboardAxisController {
  private value = 0;
  private readonly min: number;
  private readonly max: number;
  private readonly holdBindings: Record<string, -1 | 1>;
  private readonly doubleTapBindings: Record<string, -1 | 1>;
  private readonly centerBindings: Set<string>;
  private readonly holdUnitsPerSecond: number;
  private readonly snapUnitsPerSecond: number;
  private readonly centerUnitsPerSecond: number;
  private readonly doubleTapThresholdMs: number;
  private readonly activeHoldKeys = new Set<string>();
  private readonly lastTapTimestamps = new Map<string, number>();
  private targetMotion: TargetMotion | null = null;

  constructor(config: KeyboardAxisControllerConfig) {
    this.min = config.min ?? -1;
    this.max = config.max ?? 1;
    this.holdBindings = config.holdBindings;
    this.doubleTapBindings = config.doubleTapBindings ?? config.holdBindings;
    this.centerBindings = new Set(config.centerBindings ?? []);
    this.holdUnitsPerSecond = config.holdUnitsPerSecond;
    this.snapUnitsPerSecond = config.snapUnitsPerSecond;
    this.centerUnitsPerSecond = config.centerUnitsPerSecond;
    this.doubleTapThresholdMs = config.doubleTapThresholdMs ?? 300;
  }

  public getValue(): number {
    return this.value;
  }

  public setValue(nextValue: number): void {
    this.value = this.clamp(nextValue);
  }

  public center(): void {
    this.targetMotion = {
      target: 0,
      unitsPerSecond: this.centerUnitsPerSecond,
    };
  }

  public handleKeyDown(code: string, timestampMs: number, repeat = false): boolean {
    const holdDirection = this.holdBindings[code];
    const doubleTapDirection = this.doubleTapBindings[code];
    if (holdDirection !== undefined || doubleTapDirection !== undefined) {
      if (!repeat) {
        if (holdDirection !== undefined) {
          this.activeHoldKeys.add(code);
        }

        const previousTap = this.lastTapTimestamps.get(code);
        const isDoubleTap = previousTap !== undefined && (timestampMs - previousTap) <= this.doubleTapThresholdMs;

        this.lastTapTimestamps.set(code, timestampMs);

        if (isDoubleTap) {
          this.targetMotion = {
            target: (doubleTapDirection ?? holdDirection) === -1 ? this.min : this.max,
            unitsPerSecond: this.snapUnitsPerSecond,
          };
        } else if (holdDirection !== undefined) {
          this.targetMotion = null;
        }
      }

      return true;
    }

    if (!repeat && this.centerBindings.has(code)) {
      this.center();
      return true;
    }

    return false;
  }

  public handleKeyUp(code: string): boolean {
    if (this.holdBindings[code] === undefined) {
      return false;
    }

    this.activeHoldKeys.delete(code);
    return true;
  }

  public clearHeldKeys(): void {
    this.activeHoldKeys.clear();
  }

  public update(dtSeconds: number): boolean {
    const previousValue = this.value;
    const dt = Math.max(0, dtSeconds);

    if (this.targetMotion) {
      this.value = this.moveToward(this.value, this.targetMotion.target, this.targetMotion.unitsPerSecond * dt);

      if (this.value === this.targetMotion.target) {
        this.targetMotion = null;
      }
    } else {
      const holdDirection = this.getActiveHoldDirection();
      if (holdDirection !== 0) {
        this.value = this.clamp(this.value + holdDirection * this.holdUnitsPerSecond * dt);
      }
    }

    return this.value !== previousValue;
  }

  private getActiveHoldDirection(): -1 | 0 | 1 {
    let total = 0;

    for (const code of this.activeHoldKeys) {
      total += this.holdBindings[code];
    }

    if (total === 0) {
      return 0;
    }

    return total < 0 ? -1 : 1;
  }

  private clamp(nextValue: number): number {
    return Math.min(this.max, Math.max(this.min, nextValue));
  }

  private moveToward(current: number, target: number, maxStep: number): number {
    if (Math.abs(target - current) <= maxStep) {
      return target;
    }

    return current + Math.sign(target - current) * maxStep;
  }
}
