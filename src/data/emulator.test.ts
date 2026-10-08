import { describe, it, expect } from 'vitest';
import { emulatorEmail, USING_EMULATOR } from './emulator';

describe('에뮬레이터', () => {
  it('테스트·운영 빌드에서는 붙지 않는다', () => {
    expect(USING_EMULATOR).toBe(false);
  });

  it('?as=2|3 으로 seed 계정을 고른다 (V4와 같은 계정)', () => {
    expect(emulatorEmail('')).toBe('teacher@example.com');
    expect(emulatorEmail('?as=2')).toBe('teacher2@example.com');
    expect(emulatorEmail('?as=3')).toBe('teacher3@example.com');
    expect(emulatorEmail('?as=9')).toBe('teacher@example.com');
  });
});
