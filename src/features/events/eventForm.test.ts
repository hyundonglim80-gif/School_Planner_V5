import { describe, expect, it, vi } from 'vitest';
import { labelTreeOf } from '../../data/select';
import {
  createData,
  editChanges,
  effectiveAttrs,
  formOf,
  labelAttrs,
  newForm,
  periodOf,
  propsToStore,
  sameForm,
  withAttr,
  withLabels,
  withStartDate,
} from './eventForm';
import type { ItemDoc } from './eventOps';

// data/select → session이 Firebase 앱을 띄운다 - 띄우면 시험이 끝난 뒤 Firebase가 IndexedDB를 열다 '처리하지 않은 오류'가 남는다
vi.mock('../../data/firebase', () => ({ auth: {}, db: {} }));

const base = { deletedAt: null, v: 1, createdAt: 0, authorId: 'me', parentId: null, kind: 'event' };
const labels = {
  cal: { ...base, id: 'cal', name: '달력', color: 'red', order: 'a0', props: { calendar: true } },
  fwd: { ...base, id: 'fwd', name: '이월', color: 'green', order: 'a1', props: { calendar: false, forward: true } },
  skip: { ...base, id: 'skip', name: '수업X', color: 'orange', order: 'a2', props: { calendar: true, skip: true } },
  gone: { ...base, id: 'gone', name: '지움', color: 'red', order: 'a3', props: { forward: true }, deletedAt: 1 },
} as never;
const tree = labelTreeOf(labels, 'event');

const item = (more: Partial<ItemDoc> = {}): ItemDoc =>
  ({ id: 'e1', kind: 'event', date: '2026-10-08', text: '회의', labelIds: ['fwd'], order: 'a0', ...more }) as ItemDoc;

describe('속성 = 라벨 먼저, 이 일정만 다른 것만 적는다', () => {
  it('라벨이 정한 값 - 하나라도 켰으면 켬, 라벨이 없으면 달력만, 지운 라벨은 빼고', () => {
    expect(labelAttrs([], tree)).toEqual({ calendar: true, forward: false, skip: false, gcal: false });
    expect(labelAttrs(['fwd'], tree)).toEqual({ calendar: false, forward: true, skip: false, gcal: false });
    expect(labelAttrs(['fwd', 'skip'], tree)).toEqual({ calendar: true, forward: true, skip: true, gcal: false });
    expect(labelAttrs(['gone'], tree)).toEqual({ calendar: true, forward: false, skip: false, gcal: false });
  });

  it('따로 정한 것이 이긴다, 라벨과 같으면 적지 않는다', () => {
    const f = withAttr(newForm('2026-10-08', tree), 'forward', true);
    expect(f.labelIds).toEqual(['cal']); // 맨 위 라벨
    expect(effectiveAttrs(f, tree).forward).toBe(true);
    expect(propsToStore(f, tree)).toEqual({ forward: true });
    expect(propsToStore(withAttr(f, 'calendar', true), tree)).toEqual({ forward: true });
    expect(propsToStore(withAttr(f, 'forward', false), tree)).toBeUndefined();
  });

  it('라벨을 바꾸면 따로 정한 것을 걷는다 (새 라벨 속성이 따라 켜진다)', () => {
    const f = withLabels(withAttr(newForm('2026-10-08', tree), 'skip', true), ['fwd']);
    expect(f.props).toEqual({});
    expect(effectiveAttrs(f, tree)).toMatchObject({ calendar: false, forward: true, skip: false });
  });
});

describe('새로 만들기·고치기', () => {
  it('새 일정 - 글은 앞뒤만 다듬고, 빈 칸은 적지 않는다', () => {
    const f = { ...newForm('2026-10-08', tree), text: '  회의 \n' };
    expect(createData(f, tree, 'a5')).toEqual({ kind: 'event', date: '2026-10-08', text: '회의', labelIds: ['cal'], order: 'a5' });
    const g = { ...withAttr(f, 'gcal', true), time: '09:30', due: '2026-10-10' };
    expect(createData(g, tree, 'a5')).toMatchObject({ props: { gcal: true }, time: '09:30', due: '2026-10-10' });
  });

  it('고치기 = 바뀐 칸만, 손대지 않으면 빈 것', () => {
    const it0 = item({ props: { forward: true } }); // 라벨과 같은 값이 적혀 있던 것 (가져온 일정)
    expect(editChanges(it0, formOf(it0), tree)).toEqual({});
    expect(editChanges(it0, { ...formOf(it0), text: '회의 2' }, tree)).toEqual({ text: '회의 2' });
    expect(editChanges(it0, withAttr(formOf(it0), 'skip', true), tree)).toEqual({ props: { skip: true } });
  });

  it('알림·기한을 빼면 칸을 지운다, 시각을 바꾸면 다시 울린다', () => {
    const it0 = item({ time: '09:00', alarmDone: true, due: '2026-10-10' });
    expect(editChanges(it0, { ...formOf(it0), time: '', due: '' }, tree)).toEqual({ time: undefined, alarmDone: undefined, due: undefined });
    expect(editChanges(it0, { ...formOf(it0), time: '10:00' }, tree)).toEqual({ time: '10:00', alarmDone: undefined });
  });

  it('날짜를 바꾸면 date만 (울린 알림은 다시)', () => {
    const it0 = item();
    expect(editChanges(it0, { ...formOf(it0), date: '2026-10-09' }, tree)).toEqual({ date: '2026-10-09' });
    const rung = item({ time: '09:00', alarmDone: true });
    expect(editChanges(rung, { ...formOf(rung), date: '2026-10-09' }, tree)).toEqual({ date: '2026-10-09', alarmDone: undefined });
  });

  it('sameForm - 글 끝 빈칸·라벨과 같은 속성은 손댄 것이 아니다', () => {
    const f = formOf(item());
    expect(sameForm(f, { ...f, text: '회의  ' }, tree)).toBe(true);
    expect(sameForm(f, withAttr(f, 'forward', true), tree)).toBe(true);
    expect(sameForm(f, withAttr(f, 'forward', false), tree)).toBe(false);
  });
});

describe('기간 (끝 날)', () => {
  it('끝 날이 날짜보다 뒤일 때만 기간 - 주말 빼기는 기본 켬, 뺀 날은 범위 안만', () => {
    const f = newForm('2026-10-14', tree);
    expect(f.workdays).toBe(true);
    expect(periodOf({ ...f, endDate: '2026-10-14' }).endDate).toBe('');
    expect(periodOf({ ...f, endDate: '2026-10-20', skipDates: ['2026-10-30', '2026-10-15'] })).toEqual({
      endDate: '2026-10-20',
      workdays: true,
      skipDates: ['2026-10-15'],
    });
    expect(createData({ ...f, text: '기말고사', endDate: '2026-10-20' }, tree, 'a0')).toMatchObject({ endDate: '2026-10-20', workdays: true });
    expect(createData({ ...f, text: '하루', endDate: '' }, tree, 'a0')).not.toHaveProperty('endDate');
  });

  it('시작 날을 옮기면 끝 날·뺀 날도 같은 날 수만큼', () => {
    const f = { ...newForm('2026-10-14', tree), endDate: '2026-10-20', skipDates: ['2026-10-16'] };
    expect(withStartDate(f, '2026-10-21')).toMatchObject({ date: '2026-10-21', endDate: '2026-10-27', skipDates: ['2026-10-23'] });
    expect(withStartDate({ ...f, endDate: '' }, '2026-10-21')).toMatchObject({ date: '2026-10-21', endDate: '' });
  });

  it('고치기: 끝 날 넣기·빼기 = 그 칸들만', () => {
    const one = item({ date: '2026-10-14' });
    expect(editChanges(one, { ...formOf(one), endDate: '2026-10-20' }, tree)).toEqual({ endDate: '2026-10-20', workdays: true });
    const span = item({ date: '2026-10-14', endDate: '2026-10-20', workdays: true, skipDates: ['2026-10-16'], doneDates: ['2026-10-14'] });
    expect(editChanges(span, formOf(span), tree)).toEqual({});
    expect(editChanges(span, { ...formOf(span), endDate: '' }, tree)).toEqual({
      endDate: undefined,
      workdays: undefined,
      skipDates: undefined,
      doneDates: undefined,
    });
    expect(editChanges(span, { ...formOf(span), workdays: false }, tree)).toEqual({ workdays: undefined });
  });

  it('통째로 옮기면 끝낸 날도 함께, 범위를 줄이면 범위 안만', () => {
    const span = item({ date: '2026-10-14', endDate: '2026-10-20', workdays: true, doneDates: ['2026-10-14', '2026-10-19'] });
    expect(editChanges(span, withStartDate(formOf(span), '2026-10-21'), tree)).toEqual({
      date: '2026-10-21',
      endDate: '2026-10-27',
      doneDates: ['2026-10-21', '2026-10-26'],
    });
    expect(editChanges(span, { ...formOf(span), endDate: '2026-10-16' }, tree)).toEqual({ endDate: '2026-10-16', doneDates: ['2026-10-14'] });
  });
});
