// tools/inspect-links.mjs - P4-3: 링크 연결·보기를 실제 크롬에서 본다.
//   1) 가져온 V4 링크처럼 양쪽에 linkIds를 심은 일정·기록 → 카드마다 🔗 1, 누르면 📑 연결된 데이터(지금 내용·표), 수업 링크·찾을 수 없는 항목.
//   2) 일정 칸 🔗 링크 추가 → 연결 창(기록 탭) → 담고 연결 저장 = 양쪽 linkIds 한 묶음(서버 문서 둘) → 창이 닫힌다.
//   3) '+ 새 기록 만들어 연결' → 같은 쓰는 칸 → 처음 저장하면 담긴다 → 연결 저장.
//   4) 📑의 🗑️ = 양쪽에서 끊기 → 안내의 되돌리기 = 다시 이어진다. 📌 이동 = 그날 하루 화면, ✏️ 수정 = 쓰는 칸.
//   5) 새 메모 칸의 🔗 링크 추가 = 먼저 저장(수정 칸이 된다) → 그 메모의 연결 창. 다른 항목의 📑은 탭으로 쌓인다.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-links.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 항목(insp_lk…)을 심고 끝에 지운다.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, hashOf, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const DAY = '2026-10-08';
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const read = async (id) => {
  const s = await getDoc(itemRef(id));
  return s.exists() ? s.data() : null;
};
const startedAt = Date.now();
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: startedAt, authorId: uid };
const ITEMS = {
  insp_lke: { kind: 'event', date: DAY, text: '점검링크 학부모 상담', labelIds: [], order: 'Zz1', linkIds: ['insp_lkj', `lesson:${DAY}:3`, 'insp_lk_gone'] },
  insp_lkj: { kind: 'note', date: DAY, text: '점검링크 상담 기록', labelIds: [], order: 'Zz1', linkIds: ['insp_lke'], tables: [{ id: 'tb1', rows: [{ cells: [{ v: '이름' }, { v: '내용' }] }], createdAt: 1 }] },
  insp_lkk: { kind: 'note', date: '2026-10-07', text: '점검링크 어제 기록', labelIds: [], order: 'Zz2' },
};
const madeHere = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
  return snap.docs.filter((d) => (d.data().createdAt ?? 0) >= startedAt && String(d.data().text).includes('점검링크') && !d.id.startsWith('insp_'));
};

try {
  for (const [id, data] of Object.entries(ITEMS)) {
    await setDoc(itemRef(id), { ...data, ...stamp });
    undo.add(() => deleteDoc(itemRef(id)));
  }
  undo.add(async () => {
    for (const d of await madeHere()) await deleteDoc(d.ref);
  });

  const { page, errors } = await newPage(browser);
  await open(page, `#/day/${DAY}`);
  const evCard = page.locator(sel('event-card', 'insp_lke'));
  const jrCard = page.locator(sel('entry-card', 'insp_lkj'));
  const viewer = (id) => page.locator(sel('link-viewer', id));

  r.section('가져온 링크 보기');
  r.check(await waitFor(evCard, 8000), '일정 카드');
  r.check((await evCard.locator(sel('event-links')).getAttribute('data-event-links')) === '3', '일정 카드 🔗 3');
  r.check((await jrCard.locator(sel('entry-links')).getAttribute('data-entry-links')) === '1', '기록 카드 🔗 1');
  await evCard.locator(sel('event-links')).click();
  r.check(await waitFor(viewer('insp_lke')), '🔗 누르기 = 📑 연결된 데이터');
  const kinds = await viewer('insp_lke').locator(sel('link-row')).evaluateAll((els) => els.map((e) => e.dataset.linkKind).join(','));
  r.check(kinds === 'journal,lesson,missing', `기록·수업·찾을 수 없는 항목 (${kinds})`);
  r.check((await viewer('insp_lke').locator(`${sel('link-row', 'insp_lkj')} ${sel('link-text')}`).textContent()) === '점검링크 상담 기록', '이은 기록의 지금 글');
  r.check((await viewer('insp_lke').locator(`${sel('link-row', 'insp_lkj')} ${sel('entry-table')}`).count()) === 1, '이은 기록의 표');
  await jrCard.locator(sel('entry-links')).click();
  r.check(await waitFor(viewer('insp_lkj')), '다른 항목의 📑 = 새 탭');
  r.check((await page.locator(sel('side-tab')).count()) === 2, '탭 둘');
  await evCard.locator(sel('event-links')).click();
  r.check((await page.locator(sel('side-tab')).count()) === 2 && (await viewer('insp_lke').isVisible()), '같은 항목이면 그 탭을 보인다');

  r.section('🗑️ 끊기·되돌리기');
  await viewer('insp_lke').locator(sel('link-unlink', 'insp_lkj')).click();
  const cut = await serverUntil(async () => [await read('insp_lke'), await read('insp_lkj')], ([e, j]) => !e?.linkIds?.includes('insp_lkj') && !j?.linkIds);
  r.check(!cut[0]?.linkIds?.includes('insp_lkj') && cut[0]?.linkIds?.length === 2, '일정 쪽에서 빠졌다 (수업·없는 항목은 그대로)');
  r.check(cut[1] && !cut[1].linkIds && !cut[1].deletedAt, '기록 쪽도 빠지고 기록은 그대로');
  await page.locator(sel('toast')).filter({ hasText: '연결을 끊었습니다' }).locator('[data-toast-action="되돌리기"]').click();
  const back = await serverUntil(async () => [await read('insp_lke'), await read('insp_lkj')], ([e, j]) => e?.linkIds?.includes('insp_lkj') && j?.linkIds?.includes('insp_lke'));
  r.check(back[0]?.linkIds?.includes('insp_lkj') && back[1]?.linkIds?.includes('insp_lke'), '되돌리기 = 양쪽 다시 이어진다');
  await page.keyboard.press('Escape');

  r.section('🔗 링크 추가 → 연결 창 → 저장');
  await evCard.locator(sel('event-edit')).click({ force: true });
  const evPanel = page.locator(sel('event-panel', 'edit'));
  await waitFor(evPanel);
  r.check((await evPanel.locator(sel('event-links-open')).getAttribute('data-event-links-open')) === '3', '일정 칸에 📑 연결 3개');
  await evPanel.locator(sel('event-link-add')).click();
  const linker = page.locator(sel('linker', 'insp_lke'));
  r.check(await waitFor(linker), '연결 창');
  await linker.locator(sel('linker-tab', 'journal')).click();
  r.check((await linker.locator(sel('linker-item', 'insp_lkj')).isDisabled()) && (await linker.locator(sel('linker-item', 'insp_lkj')).textContent()).includes('연결됨'), '이미 이은 기록은 연결됨');
  await linker.locator(sel('linker-keyword')).fill('어제');
  await linker.locator(sel('linker-item', 'insp_lkk')).click();
  r.check((await linker.locator(sel('linker-picked', 'insp_lkk')).count()) === 1, '🛒에 담긴다');

  r.section("'+ 새 기록 만들어 연결'");
  await linker.locator(sel('linker-new', 'journal')).click();
  const newPanel = page.locator(sel('note-panel', 'new'));
  r.check(await waitFor(newPanel), '같은 쓰는 칸(새 기록)이 열린다');
  await waitFor(() => newPanel.locator(sel('note-text-input')).evaluate((el) => el === document.activeElement));
  await page.keyboard.type('점검링크 새로 만든 기록');
  await page.keyboard.press('Control+s');
  const madePanel = page.locator(sel('note-panel', 'edit'));
  r.check(await waitFor(madePanel, 8000), '저장 → 수정 칸');
  const madeId = await madePanel.getAttribute('data-note-id');
  await page.locator(sel('side-tab')).filter({ hasText: '데이터 연결하기' }).locator('button').first().click();
  r.check(await waitFor(linker.locator(sel('linker-picked', madeId))), '만든 기록이 🛒에 담겼다');
  await page.locator(sel('linker-save')).click(); // 저장 단추는 창 아랫단 (data-linker 밖)
  const saved = await serverUntil(async () => [await read('insp_lke'), await read('insp_lkk'), await read(madeId)], ([e, k, m]) => e?.linkIds?.includes('insp_lkk') && e?.linkIds?.includes(madeId) && k?.linkIds && m?.linkIds);
  r.check(saved[0]?.linkIds?.includes('insp_lkk') && saved[0]?.linkIds?.includes(madeId), '서버: 일정 쪽에 둘');
  r.check(saved[1]?.linkIds?.[0] === 'insp_lke' && saved[2]?.linkIds?.[0] === 'insp_lke', '서버: 상대 쪽에도 일정');
  r.check(await waitFor(async () => (await linker.count()) === 0), '연결 저장하면 창이 닫힌다');
  r.check(await waitFor(async () => (await evCard.locator(sel('event-links')).getAttribute('data-event-links')) === '5'), '일정 카드 🔗 5');

  r.section('📌 이동·✏️ 수정');
  await page.keyboard.press('Escape');
  await page.goto(page.url().replace(/#.*$/, '#/day/2026-10-07'));
  await page.locator(sel('entry-card', 'insp_lkk')).locator(sel('entry-links')).click();
  r.check(await waitFor(viewer('insp_lkk')), '어제 기록의 📑');
  await viewer('insp_lkk').locator(sel('link-move', 'insp_lke')).click();
  r.check(await waitFor(async () => hashOf(page) === `#/day/${DAY}`), `📌 이동 = 그날 하루 화면 (${hashOf(page)})`);
  await viewer('insp_lkk').locator(sel('link-edit', 'insp_lke')).click();
  r.check(await waitFor(page.locator(sel('event-panel', 'edit'))), '✏️ 수정 = 일정 칸');
  await page.keyboard.press('Escape');

  r.section('새 메모 칸의 🔗 링크 추가');
  await page.goto(page.url().replace(/#.*$/, '#/memo'));
  await page.locator(sel('memo-new')).click();
  const memoPanel = page.locator(sel('note-panel'));
  await waitFor(memoPanel);
  await waitFor(() => memoPanel.locator(sel('note-text-input')).evaluate((el) => el === document.activeElement));
  await page.keyboard.type('점검링크 메모');
  await memoPanel.locator(sel('note-link-add')).click();
  r.check(await waitFor(async () => (await memoPanel.getAttribute('data-note-panel')) === 'edit', 8000), '먼저 저장된다 (수정 칸)');
  const memoId = await memoPanel.getAttribute('data-note-id');
  r.check(await waitFor(page.locator(sel('linker', memoId))), '그 메모의 연결 창');
  r.check((await read(memoId))?.date === null, '서버: 메모');
  await page.keyboard.press('Escape');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
