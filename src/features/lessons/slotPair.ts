// 교과 모드 칸 글자 ↔ 두 칸(학년-반 · 과목) (V4 components/SlotPairInput.tsx의 joinSlot·splitSlot)
import { parseSlot } from '../../domain/teachingSlot';

/** 두 칸 → 칸 글자 하나 (반이 비면 과목만, 과목이 비면 반만) */
export function joinSlot(cls: string, subject: string): string {
  const c = cls.trim();
  const s = subject.trim().replace(/\s+/g, ' ');
  return c && s ? `${c} ${s}` : c || s;
}

/** 칸 글자 → 두 칸 */
export function splitSlot(text: string): { cls: string; subject: string } {
  const p = parseSlot(text);
  return { cls: p.cls, subject: p.cls ? p.subject : String(text ?? '').trim() };
}
