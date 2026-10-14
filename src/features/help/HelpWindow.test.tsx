// 사용 설명서 창 (V4 components/HelpModal.test.tsx에서 옮김 - P9-1). 글은 고쳐 가므로 설명서 표(HELP_CATEGORIES)에서 골라 본다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetHistoryForTest } from '../../app/history';
import { setShortcutOverrides } from '../../app/keys';
import { setPopupStyle } from '../../app/layoutPrefs';
import { useCommonSettings } from '../../app/prefs';
import { FIXED_SHORTCUTS } from '../../domain/shortcuts';
import HelpWindow, { type HelpParams } from './HelpWindow';
import { ALL_HELP_TOPICS, findHelpTopic, HELP_CATEGORIES, topicText } from './topics';

// 진짜 Firebase 앱을 띄우지 않는다 (CLAUDE.md 2장 - app/prefs가 설정 맞추기를 부른다)
vi.mock('../../data/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));

beforeEach(() => {
  resetHistoryForTest();
  setPopupStyle('center');
  // jsdom에는 scrollIntoView가 없다 (항목을 열 때 맨 위로 올린다)
  Element.prototype.scrollIntoView = vi.fn();
  setShortcutOverrides({});
  useCommonSettings.setState({ forwardDays: 14 });
  localStorage.removeItem('sp5-help-tree-hidden');
});

const open = (params?: HelpParams, raise = 0) => render(<HelpWindow params={params} close={vi.fn()} raise={raise} setParams={vi.fn()} />);
const q = (s: string) => document.querySelector<HTMLElement>(s)!;
const qa = (s: string) => [...document.querySelectorAll<HTMLElement>(s)];
/** 왼쪽 목차 */
const tree = () => within(screen.getByRole('navigation', { name: '설명서 목차' }));
const shownTopics = () => qa('[data-help-content] [data-help-topic]').map((b) => b.dataset.helpTopic);
const values = { keyOf: () => '없음', lookback: 14 };

/** 세부 설명에 다른 분류의 항목으로 가는 연결이 든 항목과 그 연결의 첫 항목 */
function crossLink() {
  const linkOf = (t: (typeof ALL_HELP_TOPICS)[number]) =>
    [...JSON.stringify(t.blocks).matchAll(/\[\[([a-z0-9-]+)\|/g)].map((m) => findHelpTopic(m[1])!).find((to) => to.category.id !== t.category.id);
  const from = ALL_HELP_TOPICS.find((t) => linkOf(t))!;
  return { from, to: linkOf(from)! };
}

type User = ReturnType<typeof userEvent.setup>;
const openCategory = (user: User, id: string) => user.click(q(`[data-help-category="${id}"]`));

describe('사용 설명서 - 기능별 분류 → 세부 기능 → 설명·사용 예', () => {
  it('첫 화면에는 기능별 분류만 보이고, 세부 기능은 보이지 않는다', () => {
    open();
    expect(screen.getByRole('heading', { name: '기능별 분류' })).toBeInTheDocument();
    for (const category of HELP_CATEGORIES) {
      const card = q(`[data-help-category="${category.id}"]`);
      expect(card).toHaveTextContent(`${category.topics.length}개 기능`);
      expect(card).toHaveTextContent(category.summary);
    }
    // 세부 기능은 분류를 눌러야 나온다 (목차도 분류가 접혀 있다)
    expect(qa('[data-help-topic]')).toHaveLength(0);
    expect(qa('[data-help-tree-topic]')).toHaveLength(0);
  });

  it('분류를 누르면 그 분류의 세부 기능 목록만 나온다', async () => {
    const user = userEvent.setup();
    open();
    const category = HELP_CATEGORIES.find((c) => c.id === 'attachments')!;
    await openCategory(user, category.id);

    expect(screen.getByRole('heading', { name: new RegExp(category.title) })).toBeInTheDocument();
    expect(shownTopics()).toEqual(category.topics.map((t) => t.id));
  });

  it('세부 기능을 누르면 세부 설명과 사용 예가 나온다', async () => {
    const user = userEvent.setup();
    open();
    const topic = HELP_CATEGORIES.find((c) => c.id === 'attachments')!.topics[0];
    await openCategory(user, 'attachments');
    await user.click(q(`[data-help-content] [data-help-topic="${topic.id}"]`));

    expect(q('[data-help-detail]').dataset.helpDetail).toBe(topic.id);
    expect(screen.getByRole('heading', { name: /세부 설명/ })).toBeInTheDocument();
    const examples = screen.getByRole('region', { name: /사용 예/ });
    expect(qa('[data-help-example]')).toHaveLength(topic.examples.length);
    expect(within(examples).getAllByRole('listitem').length).toBeGreaterThanOrEqual(topic.examples[0].steps.length);
  });

  it('위치 표시로 분류 목록과 첫 화면으로 돌아온다', async () => {
    const user = userEvent.setup();
    open();
    const events = HELP_CATEGORIES.find((c) => c.id === 'events')!;
    await openCategory(user, 'events');
    await user.click(q(`[data-help-content] [data-help-topic="${events.topics[1].id}"]`));

    const nav = screen.getByRole('navigation', { name: '설명서 위치' });
    expect(nav).toHaveTextContent('사용 설명서');
    expect(nav).toHaveTextContent(events.topics[1].title);

    await user.click(within(nav).getByRole('button', { name: `← ${events.title}` }));
    expect(shownTopics()).toEqual(events.topics.map((t) => t.id));

    await user.click(screen.getByRole('button', { name: '← 기능별 분류' }));
    expect(screen.getByRole('heading', { name: '기능별 분류' })).toBeInTheDocument();
  });

  it('이전 · 다음은 같은 분류 안에서만 오간다', async () => {
    const user = userEvent.setup();
    open();
    const category = HELP_CATEGORIES.find((c) => c.id === 'find')!;
    await openCategory(user, category.id);
    await user.click(q(`[data-help-content] [data-help-topic="${category.topics[0].id}"]`));

    // 분류의 첫 항목에는 '이전'이 없다 (앞 분류로 넘어가지 않는다)
    expect(document.querySelector('[data-help-prev]')).toBeNull();
    await user.click(q('[data-help-next]'));
    expect(q('[data-help-detail]').dataset.helpDetail).toBe(category.topics[1].id);
    // 분류의 마지막 항목에는 '다음'이 없다
    await user.click(q(`[data-help-tree-topic="${category.topics.at(-1)!.id}"]`));
    expect(document.querySelector('[data-help-next]')).toBeNull();
  });

  it('설명 안의 연결을 누르면 다른 분류의 항목으로도 간다', async () => {
    const { from, to } = crossLink();
    const user = userEvent.setup();
    open({ topic: from.id });

    await user.click(q(`[data-help-link="${to.id}"]`));
    expect(q('[data-help-detail]').dataset.helpDetail).toBe(to.id);
    expect(screen.getByRole('navigation', { name: '설명서 위치' })).toHaveTextContent(to.category.title);
  });

  it('찾기 칸에 적으면 분류와 상관없이 그 말이 들어 있는 기능만 남는다', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('설명서에서 찾기'), '캡처');
    const want = ALL_HELP_TOPICS.filter((t) => topicText(t, values).toLowerCase().includes('캡처')).map((t) => t.id);
    expect(want.length).toBeGreaterThan(0);
    expect(want.length).toBeLessThan(ALL_HELP_TOPICS.length);
    expect(new Set(shownTopics())).toEqual(new Set(want));
    expect(q('[data-help-results]').dataset.helpResults).toBe(String(want.length));
  });

  it('사용 예의 글도 찾기에 걸린다', async () => {
    const topic = findHelpTopic('evaluation')!;
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('설명서에서 찾기'), topic.examples[0].title.replace(/\*\*|\[\[[a-z0-9-]+\||\]\]/g, ''));
    expect(shownTopics()).toContain('evaluation');
  });

  it('찾는 말이 없으면 그렇다고 알린다', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('설명서에서 찾기'), '없는말없는말');
    expect(q('[data-help-results]').dataset.helpResults).toBe('0');
    expect(screen.getByText(/없는말없는말.*찾지 못했습니다/)).toBeInTheDocument();
  });

  it('환경설정에서 바꾼 단축키와 이월 기간을 그대로 보여준다', async () => {
    setShortcutOverrides({ scopeDay: { ctrl: false, alt: true, shift: false, key: 'D' } });
    useCommonSettings.setState({ forwardDays: 21 });
    const user = userEvent.setup();
    open({ topic: 'navigation' });
    // 세부 설명과 사용 예 모두 바꾼 키를 따른다
    const keys = qa('[data-help-key="scopeDay"]');
    expect(keys.length).toBeGreaterThan(1);
    for (const k of keys) expect(k).toHaveTextContent('Alt + D');

    // 위치 표시의 '사용 설명서'는 곧장 첫 화면으로 간다
    await user.click(q('[data-help-crumb-home]'));
    expect(q('[data-help-home]')).toBeInTheDocument();
    await user.click(q('[data-help-category="events"]'));
    await user.click(q('[data-help-content] [data-help-topic="forwarding"]'));
    expect(qa('[data-help-lookback]').length).toBeGreaterThan(0);
    for (const n of qa('[data-help-lookback]')) expect(n).toHaveTextContent('21');
  });

  it('모든 항목을 그렸을 때 꾸밈 기호·자리표가 글자로 남지 않는다 (굵은 글 안의 자리표도 푼다)', () => {
    const left: string[] = [];
    for (const topic of ALL_HELP_TOPICS) {
      const { unmount } = open({ topic: topic.id });
      const text = q('[data-help-detail]').textContent ?? '';
      if (/\*\*|\{key:|\{lookback\}|\[\[|\]\]/.test(text)) left.push(topic.id);
      unmount();
    }
    expect(left).toEqual([]);
  });

  it('단축키 목록은 지금 설정값으로 그린다', async () => {
    setShortcutOverrides({ trash: { ctrl: true, alt: false, shift: true, key: 'T' } });
    const user = userEvent.setup();
    open();
    await user.click(q('[data-help-shortcuts-open]'));
    expect(q('[data-help-detail]').dataset.helpDetail).toBe('shortcuts');
    expect(q('[data-help-shortcut="trash"] kbd')).toHaveTextContent('Ctrl + Shift + T');
    // 키가 없는 기능은 '없음'
    expect(q('[data-help-shortcut="help"] kbd')).toHaveTextContent('없음');
    for (const f of FIXED_SHORTCUTS) expect(screen.getByText(f.label)).toBeInTheDocument();
  });

  it('항목을 정해 열면 그 항목이 열리고, 열린 설명서를 다른 항목으로 다시 열면 그 항목으로 간다 (창의 설명서 주제)', () => {
    const { rerender } = open({ topic: 'seating' });
    expect(q('[data-help-detail]').dataset.helpDetail).toBe('seating');
    // 목차에서 그 분류가 펴져 짚여 있다
    expect(q('[data-help-tree-topic="seating"]')).toHaveAttribute('aria-current', 'page');

    rerender(<HelpWindow params={{ topic: 'trash' }} close={vi.fn()} raise={1} setParams={vi.fn()} />);
    expect(q('[data-help-detail]').dataset.helpDetail).toBe('trash');
    // 없는 항목이면 첫 화면
    open({ topic: 'no-such-topic' });
    expect(qa('[data-help-home]').length).toBeGreaterThan(0);
  });
});

describe('사용 설명서 - 찾기 차례', () => {
  it('제목에 찾는 말이 든 항목이 먼저 나온다', async () => {
    const user = userEvent.setup();
    open();
    await user.type(screen.getByLabelText('설명서에서 찾기'), '링크');
    const ids = shownTopics();
    const inTitle = (id: string | undefined) => {
      const t = findHelpTopic(id!)!;
      return `${t.title} ${t.summary}`.includes('링크');
    };
    expect(inTitle(ids[0])).toBe(true);
    // 제목에 든 것이 모두 앞에
    const firstMiss = ids.findIndex((id) => !inTitle(id));
    if (firstMiss >= 0) expect(ids.slice(firstMiss).some(inTitle)).toBe(false);
  });
});

// 설명서 왼쪽의 목차 트리 (V4 2026-10-02 사용자 요청). 분류 › 기능을 어디서든 곧장 고른다.
describe('사용 설명서 - 왼쪽 목차', () => {
  it('목차에 처음 화면·단축키와 모든 분류가 있고, 분류를 펴면 세부 기능이 나온다', async () => {
    const user = userEvent.setup();
    open();

    expect(q('[data-help-tree-home]')).toHaveAttribute('aria-current', 'page');
    expect(q('[data-help-tree-shortcuts]')).toBeInTheDocument();
    expect(qa('[data-help-tree-category]').map((b) => b.dataset.helpTreeCategory)).toEqual(HELP_CATEGORIES.map((c) => c.id));
    for (const category of HELP_CATEGORIES) {
      expect(q(`[data-help-tree-category="${category.id}"]`)).toHaveTextContent(String(category.topics.length));
    }

    const events = HELP_CATEGORIES.find((c) => c.id === 'events')!;
    await user.click(tree().getByRole('button', { name: `${events.title} 펴기` }));
    expect(qa('[data-help-tree-topic]').map((b) => b.dataset.helpTreeTopic)).toEqual(events.topics.map((t) => t.id));
    // 펴기만 해서는 내용이 바뀌지 않는다
    expect(screen.getByRole('heading', { name: '기능별 분류' })).toBeInTheDocument();
    await user.click(tree().getByRole('button', { name: `${events.title} 접기` }));
    expect(qa('[data-help-tree-topic]')).toHaveLength(0);
  });

  it('목차의 기능을 누르면 그 설명이 열리고, 목차에서 지금 기능이 짚인다', async () => {
    const user = userEvent.setup();
    open();
    const attach = HELP_CATEGORIES.find((c) => c.id === 'attachments')!;
    const topic = attach.topics[2];
    await user.click(q(`[data-help-tree-fold="${attach.id}"]`));
    await user.click(q(`[data-help-tree-topic="${topic.id}"]`));

    expect(q('[data-help-detail]').dataset.helpDetail).toBe(topic.id);
    expect(q(`[data-help-tree-topic="${topic.id}"]`)).toHaveAttribute('aria-current', 'page');
    expect(q('[data-help-tree-home]')).not.toHaveAttribute('aria-current');

    // 목차의 분류 이름은 그 분류의 기능 목록을 연다 - 그 분류가 목차에서도 펼쳐진다
    const events = HELP_CATEGORIES.find((c) => c.id === 'events')!;
    await user.click(q('[data-help-tree-category="events"]'));
    expect(shownTopics()).toEqual(events.topics.map((t) => t.id));
    expect(q(`[data-help-tree-topic="${events.topics[0].id}"]`)).toBeInTheDocument();

    await user.click(q('[data-help-tree-home]'));
    expect(screen.getByRole('heading', { name: '기능별 분류' })).toBeInTheDocument();
  });

  it('내용 칸에서 고르거나 설명 안의 연결로 다른 분류에 가도 목차가 그 분류를 펴서 짚는다', async () => {
    const { from, to } = crossLink();
    const user = userEvent.setup();
    open();
    await openCategory(user, from.category.id);
    await user.click(q(`[data-help-content] [data-help-topic="${from.id}"]`));
    expect(q(`[data-help-tree-topic="${from.id}"]`)).toHaveAttribute('aria-current', 'page');

    await user.click(q(`[data-help-link="${to.id}"]`));
    expect(q(`[data-help-tree-topic="${to.id}"]`)).toHaveAttribute('aria-current', 'page');
    // 앞서 연 분류도 펼친 채 남는다
    expect(q(`[data-help-tree-topic="${from.id}"]`)).not.toHaveAttribute('aria-current');
  });

  it('모두 펴기 · 모두 접기', async () => {
    const user = userEvent.setup();
    open();
    await user.click(q('[data-help-tree-all]'));
    expect(qa('[data-help-tree-fold][aria-expanded="true"]')).toHaveLength(HELP_CATEGORIES.length);
    expect(qa('[data-help-tree-topic]')).toHaveLength(ALL_HELP_TOPICS.length);

    await user.click(q('[data-help-tree-all]'));
    expect(qa('[data-help-tree-topic]')).toHaveLength(0);
  });

  it('머리말의 📚 목차 단추로 목차를 접고 다시 보이며, 접은 것을 이 기기에 기억한다', async () => {
    const user = userEvent.setup();
    const { unmount } = open();

    const toggle = q('[data-help-tree-toggle]');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(document.querySelector('[data-help-tree]')).toBeNull();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('sp5-help-tree-hidden')).toBe('1');
    // 내용은 그대로 보인다
    expect(screen.getByRole('heading', { name: '기능별 분류' })).toBeInTheDocument();

    // 다시 열어도 접힌 채
    unmount();
    open();
    expect(document.querySelector('[data-help-tree]')).toBeNull();
    await user.click(q('[data-help-tree-toggle]'));
    expect(q('[data-help-tree]')).toBeInTheDocument();
    expect(localStorage.getItem('sp5-help-tree-hidden')).toBe('0');
  });
});
