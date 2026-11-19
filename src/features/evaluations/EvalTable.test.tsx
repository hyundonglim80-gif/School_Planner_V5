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
