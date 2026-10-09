// 설정 문서의 모양 (DESIGN 4-8). 칸마다 기본값과 '믿을 만한 값인가'를 적어 두면, 읽기·적기·견주기가 그 표 하나를 본다.
//
// 문서에는 **기본값과 다른 칸만** 적는다(원칙 '계산할 수 있는 것은 저장하지 않는다'). 그래서
//   - 문서가 없거나 칸이 없으면 기본값이다. 기본값으로 되돌리면 그 칸이 문서에서 빠진다.
//   - 다른 판의 앱이 적었거나 손으로 고쳐 모양이 틀린 칸은 기본값으로 읽는다(V4는 이 기기 값을 두었다 -
//     그러면 기기마다 다른 값이 남아 '계정에 하나'가 깨진다).
//   - 모르는 칸(나중 판이 더한 것)은 읽지 않고, 적을 때도 다시 쓰지 않는다.

export interface SettingField<T> {
  def: T;
  /** 문서 값 → 믿을 만하면 그 값(다듬어서), 아니면 undefined */
  read: (v: unknown) => T | undefined;
}

export type SettingsSpec<T> = { [K in keyof T]: SettingField<T[K]> };

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** 문서 → 모든 칸이 찬 값 (없거나 틀린 칸은 기본값) */
export function readSettings<T>(spec: SettingsSpec<T>, data: unknown): T {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  const out = {} as T;
  for (const key of Object.keys(spec) as Array<keyof T>) {
    const field = spec[key];
    const v = d[key as string];
    out[key] = v === undefined ? field.def : (field.read(v) ?? field.def);
  }
  return out;
}

/** 값 → 문서에 적을 것 (기본값과 같은 칸은 뺀다) */
export function sparseSettings<T>(spec: SettingsSpec<T>, values: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(spec) as Array<keyof T>) {
    if (!same(values[key], spec[key].def)) out[key] = values[key];
  }
  return out;
}

/** 견주기용 글자. 칸 차례가 달라도 같은 값이면 같은 글자 */
export function settingsKey(data: Record<string, unknown>): string {
  return JSON.stringify(Object.keys(data).sort().map((k) => [k, data[k]]));
}

// ── 칸 만들기 도우미 ──

export const boolField = (def: boolean): SettingField<boolean> => ({
  def,
  read: (v) => (typeof v === 'boolean' ? v : undefined),
});

export function oneOfField<T extends string | number>(def: T, options: readonly T[]): SettingField<T> {
  return { def, read: (v) => (options.includes(v as T) ? (v as T) : undefined) };
}

/** 정수. 범위를 넘으면 끝으로 맞춘다(V4 clampLookbackDays) */
export function intField(def: number, min: number, max: number): SettingField<number> {
  return {
    def,
    read: (v) => {
      const n = Math.floor(Number(v));
      return v === null || v === '' || !Number.isFinite(n) ? undefined : Math.min(max, Math.max(min, n));
    },
  };
}

/** 모양을 따로 읽는 칸 (목록·표 - 읽기가 믿을 만한 것만 돌려준다) */
export function customField<T>(def: T, read: (v: unknown) => T | undefined): SettingField<T> {
  return { def, read };
}
