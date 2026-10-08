import { describe, it, expect } from 'vitest';
import { boolField, intField, oneOfField, readSettings, settingsKey, sparseSettings, type SettingsSpec } from './settings';

interface S {
  on: boolean;
  size: 'sm' | 'md' | 'lg';
  days: number;
  keys: Record<string, string>;
}

const SPEC: SettingsSpec<S> = {
  on: boolField(true),
  size: oneOfField<'sm' | 'md' | 'lg'>('md', ['sm', 'md', 'lg']),
  days: intField(14, 1, 60),
  keys: { def: {}, read: (v) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : undefined) },
};

describe('설정 문서 읽기', () => {
  it('문서가 없으면 모두 기본값', () => {
    expect(readSettings(SPEC, undefined)).toEqual({ on: true, size: 'md', days: 14, keys: {} });
    expect(readSettings(SPEC, null)).toEqual({ on: true, size: 'md', days: 14, keys: {} });
    expect(readSettings(SPEC, [1, 2])).toEqual({ on: true, size: 'md', days: 14, keys: {} });
  });

  it('있는 칸은 그 값, 틀린 칸은 기본값, 모르는 칸은 읽지 않는다', () => {
    const got = readSettings(SPEC, { on: false, size: 'xl', days: '30', zzz: 1, updatedAt: 5 });
    expect(got).toEqual({ on: false, size: 'md', days: 30, keys: {} });
    expect(got).not.toHaveProperty('zzz');
  });

  it('정수 칸은 범위 끝으로 맞추고, 숫자가 아니면 기본값', () => {
    expect(readSettings(SPEC, { days: 999 }).days).toBe(60);
    expect(readSettings(SPEC, { days: 0 }).days).toBe(1);
    expect(readSettings(SPEC, { days: 7.9 }).days).toBe(7);
    expect(readSettings(SPEC, { days: 'abc' }).days).toBe(14);
    expect(readSettings(SPEC, { days: null }).days).toBe(14);
  });
});

describe('설정 문서 적기', () => {
  it('기본값과 다른 칸만 적는다', () => {
    expect(sparseSettings(SPEC, { on: true, size: 'md', days: 14, keys: {} })).toEqual({});
    expect(sparseSettings(SPEC, { on: false, size: 'md', days: 14, keys: { a: 'x' } })).toEqual({ on: false, keys: { a: 'x' } });
  });

  it('읽고 적으면 그대로 (기본값으로 되돌리면 칸이 빠진다)', () => {
    const doc = { size: 'lg', days: 3 };
    expect(sparseSettings(SPEC, readSettings(SPEC, doc))).toEqual(doc);
  });

  it('견주기 글자는 칸 차례와 상관없다', () => {
    expect(settingsKey({ a: 1, b: 2 })).toBe(settingsKey({ b: 2, a: 1 }));
    expect(settingsKey({ a: 1 })).not.toBe(settingsKey({ a: 2 }));
  });
});
