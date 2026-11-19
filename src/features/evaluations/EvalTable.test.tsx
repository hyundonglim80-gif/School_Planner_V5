import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EvalTable from './EvalTable';
import type { EvalItem } from './evalData';

const ev = (extra: Partial<EvalItem> = {}): EvalItem =>
  ({
    id: 'e1',
    date: '2027-03-02',
    period: 1,
    classId: '2027-5-2',
    title: '단원평가',
    type: 'eval',
    indiv: true,
    group: false,
    steps: ['잘함', '보통', '노력'],
    students: [
      { sid: 'a', num: 1, name: '가람' },
      { sid: 'b', num: 2, name: '나래' },
    ],
    values: {},
    ...extra,
  }) as unknown as EvalItem;

const free = (extra: Partial<EvalItem> = {}) => ev({ steps: [], free: true, ...extra });

describe("조사표 표 - 평가 단계 '기타' (P46-1)", () => {
  it('단계 평가는 결과가 고르기 그대로', () => {
    const { container } = render(<EvalTable ev={ev()} values={{}} canEdit onChange={() => {}} />);
    expect(container.querySelectorAll('select[data-eval-indiv-score]')).toHaveLength(2);
    expect(container.querySelector('input[data-eval-indiv-score]')).toBeNull();
  });

  it('기타는 결과가 글 칸 - 친 숫자·글자가 그대로 값', () => {
    const onChange = vi.fn();
    const { container } = render(<EvalTable ev={free()} values={{ a: { indiv: '85' } }} canEdit onChange={onChange} />);
    const cells = container.querySelectorAll<HTMLInputElement>('input[data-eval-indiv-score]');
    expect(cells).toHaveLength(2);
    expect(container.querySelector('select[data-eval-indiv-score]')).toBeNull();
    expect(cells[0].value).toBe('85');
    fireEvent.change(cells[1], { target: { value: 'A+' } });
    expect(onChange).toHaveBeenLastCalledWith({ a: { indiv: '85' }, b: { indiv: 'A+' } });
  });

  it('기타 전체 일괄 적용 = 글 칸 - 모든 학생에 같은 글 (조별도)', () => {
    const onChange = vi.fn();
    const { container } = render(<EvalTable ev={free({ group: true, groups: [{ name: '1모둠', members: ['a', 'b'] }] })} values={{}} canEdit onChange={onChange} />);
    fireEvent.change(container.querySelector<HTMLInputElement>('input[data-eval-all-indiv]')!, { target: { value: '통과' } });
    expect(onChange).toHaveBeenLastCalledWith({ a: { indiv: '통과' }, b: { indiv: '통과' } });
    fireEvent.change(container.querySelector<HTMLInputElement>('input[data-eval-all-group]')!, { target: { value: '90' } });
    expect(onChange).toHaveBeenLastCalledWith({ a: { group: '90' }, b: { group: '90' } });
  });

  it('고칠 수 없는 조사표(그룹의 남의 것)의 기타 글 칸은 읽기만, 일괄 줄 없음', () => {
    const { container } = render(<EvalTable ev={free({ group: true, groups: [{ name: '1모둠', members: ['a', 'b'] }] })} values={{}} canEdit={false} onChange={() => {}} />);
    expect(container.querySelector<HTMLInputElement>('input[data-eval-indiv-score]')!.readOnly).toBe(true);
    expect(container.querySelector<HTMLInputElement>('input[data-eval-group-score]')!.readOnly).toBe(true);
    expect(container.querySelector('[data-eval-all]')).toBeNull();
  });
});

describe('조사표 표 - 점수로 단계 자동 매기기 (P46-2)', () => {
  const scored = (extra: Partial<EvalItem> = {}) => ev({ steps: ['우수', '보통', '노력요함'], cuts: [10, 5], ...extra });

  it('결과 칸 왼쪽에 점수 칸 - 7을 치면 결과가 보통', () => {
    const onChange = vi.fn();
    const { container } = render(<EvalTable ev={scored()} values={{}} canEdit onChange={onChange} />);
    const row = container.querySelector('[data-eval-row="a"]')!;
    const cells = [...row.querySelectorAll('td')];
    const scoreAt = cells.findIndex((td) => td.querySelector('[data-eval-score="indiv"]'));
    expect(scoreAt).toBeGreaterThan(-1);
    expect(cells[scoreAt + 1].querySelector('select[data-eval-indiv-score]')).not.toBeNull();
    fireEvent.change(row.querySelector('[data-eval-score="indiv"]')!, { target: { value: '7' } });
    expect(onChange).toHaveBeenLastCalledWith({ a: { score: '7', indiv: '보통' } });
  });

  it('숫자가 아닌 점수(결석)는 붉은 칸 · 결과는 비운다', () => {
    const onChange = vi.fn();
    const { container } = render(<EvalTable ev={scored()} values={{ a: { score: '결석' }, b: { score: '7', indiv: '보통' } }} canEdit onChange={onChange} />);
    expect(container.querySelector('[data-eval-row="a"] [data-eval-score="indiv"]')!.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('[data-eval-row="b"] [data-eval-score="indiv"]')!.getAttribute('aria-invalid')).toBeNull();
    fireEvent.change(container.querySelector('[data-eval-row="b"] [data-eval-score="indiv"]')!, { target: { value: '결석' } });
    expect(onChange).toHaveBeenLastCalledWith({ a: { score: '결석' }, b: { score: '결석', indiv: '' } });
  });

  it('전체 일괄 점수·조 점수 칸', () => {
    const onChange = vi.fn();
    const { container } = render(<EvalTable ev={scored({ group: true, groups: [{ name: '1모둠', members: ['a', 'b'] }] })} values={{}} canEdit onChange={onChange} />);
    fireEvent.change(container.querySelector('[data-eval-all-score="indiv"]')!, { target: { value: '10' } });
    expect(onChange).toHaveBeenLastCalledWith({ a: { score: '10', indiv: '우수' }, b: { score: '10', indiv: '우수' } });
    fireEvent.change(container.querySelector('[data-eval-row="b"] [data-eval-score="group"]')!, { target: { value: '4' } });
    expect(onChange).toHaveBeenLastCalledWith({ b: { groupScore: '4', group: '노력요함' } });
  });

  it('기준이 없으면 점수 칸도 없다', () => {
    const { container } = render(<EvalTable ev={ev()} values={{}} canEdit onChange={() => {}} />);
    expect(container.querySelector('[data-eval-score]')).toBeNull();
  });
});
