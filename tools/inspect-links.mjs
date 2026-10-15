// tools/inspect-links.mjs - P4-3: 링크 연결·보기를 실제 크롬에서 본다.
//   1) 가져온 V4 링크처럼 양쪽에 linkIds를 심은 일정·기록 → 카드마다 🔗 1, 누르면 📑 연결된 데이터(지금 내용·표), 수업 링크·찾을 수 없는 항목.
//   2) 일정 칸 🔗 링크 추가 → 연결 창(기록 탭) → 담고 연결 저장 = 양쪽 linkIds 한 묶음(서버 문서 둘) → 창이 닫힌다.
//   3) '+ 새 기록 만들어 연결' → 같은 쓰는 칸 → 처음 저장하면 담긴다 → 연결 저장.
//   4) 📑의 🗑️ = 양쪽에서 끊기 → 안내의 되돌리기 = 다시 이어진다. 📌 이동 = 그날 하루 화면, ✏️ 수정 = 쓰는 칸.
//   5) 새 메모 칸의 🔗 링크 추가 = 먼저 저장(수정 칸이 된다) → 그 메모의 연결 창. 다른 항목의 📑은 탭으로 쌓인다.
//   6) P10-4: 그날 일정·수업 칸에 이은 메모가 그날 '메모' 칸에 한 번씩 (📌·🏫 표시, ▲▼ 없음) - 제 날짜 칸에는 표시 없이.
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
  // P10-4: 다른 날 메모를 이은 일정 · 수업 칸(3교시)에 이은 날짜 없는 메모
  insp_lkf: { kind: 'event', date: DAY, text: '점검링크 체험학습 준비', labelIds: [], order: 'Zz2', linkIds: ['insp_lkm'] },
  insp_lkm: { kind: 'note', date: '2026-10-01', text: '점검링크 체험학습 메모', labelIds: [], order: 'Zz3', linkIds: ['insp_lkf'] },
  insp_lkn: { kind: 'note', date: null, text: '점검링크 수업 메모', labelIds: [], order: 'Zz4', linkIds: [`lesson:${DAY}:3`] },
};
const lessonDayRef = doc(em.db, 'spaces', sid, 'lessonDays', DAY);
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
  // 그날 3교시에 메모 잇기 (수업 쪽 linkIds) - 끝에 그 칸을 되돌린다
  const dayBefore = await getDoc(lessonDayRef);
  const p3 = dayBefore.data()?.periods?.['3'] ?? {};
  await setDoc(
    lessonDayRef,
    { periods: { 3: { ...p3, linkIds: [...(p3.linkIds ?? []), 'insp_lkn'] } }, updatedAt: serverTimestamp(), v: (dayBefore.data()?.v ?? 0) + 1 },
    { merge: true },
  );
  undo.add(async () => {
    if (!dayBefore.exists()) return deleteDoc(lessonDayRef);
    await setDoc(lessonDayRef, { ...dayBefore.data(), updatedAt: serverTimestamp(), v: (dayBefore.data()?.v ?? 0) + 2 });
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
  r.check(kinds === 'note,lesson,missing', `메모·수업·찾을 수 없는 항목 (${kinds})`);
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
  await waitFor(evPanel, 8000);
  r.check((await evPanel.locator(sel('event-links-open')).getAttribute('data-event-links-open')) === '3', '일정 칸에 📑 연결 3개');
  await evPanel.locator(sel('event-link-add')).click();
  const linker = page.locator(sel('linker', 'insp_lke'));
  r.check(await waitFor(linker), '연결 창');
  await linker.locator(sel('linker-tab', 'note')).click();
  r.check((await linker.locator(sel('linker-item', 'insp_lkj')).isDisabled()) && (await linker.locator(sel('linker-item', 'insp_lkj')).textContent()).includes('연결됨'), '메모 탭 - 이미 이은 메모는 연결됨');
  await linker.locator(sel('linker-keyword')).fill('어제');
  await linker.locator(sel('linker-item', 'insp_lkk')).click();
  r.check((await linker.locator(sel('linker-picked', 'insp_lkk')).count()) === 1, '🛒에 담긴다');

  r.check((await linker.locator(sel('linker-tab')).evaluateAll((els) => els.map((e) => e.dataset.linkerTab).join(','))) === 'event,note,lesson', '탭 = 일정·메모·수업 (기록 탭 없음)');

  r.section("'+ 새 메모 만들어 연결'");
  await linker.locator(sel('linker-new', 'note')).click();
  const newPanel = page.locator(sel('note-panel', 'new'));
  r.check(await waitFor(newPanel), '같은 쓰는 칸(새 메모)이 열린다');
  await waitFor(() => newPanel.locator(sel('note-text-input')).evaluate((el) => el === document.activeElement));
  await page.keyboard.type('점검링크 새로 만든 메모');
  await page.keyboard.press('Control+s');
  const madePanel = page.locator(sel('note-panel', 'edit'));
  r.check(await waitFor(madePanel, 8000), '저장 → 수정 칸');
  const madeId = await madePanel.getAttribute('data-note-id');
  await page.locator(sel('side-tab')).filter({ hasText: '데이터 연결하기' }).locator('button').first().click();
  r.check(await waitFor(linker.locator(sel('linker-picked', madeId))), '만든 메모가 🛒에 담겼다');
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

  r.section("그날 '메모' 칸에 이은 메모 (P10-4)");
  await page.goto(page.url().replace(/#.*$/, `#/day/${DAY}`));
  const journal = page.locator(sel('day-journal', DAY));
  const inJournal = (id) => journal.locator(sel('entry-card', id));
  r.check(await waitFor(inJournal('insp_lkm'), 8000), '일정에 이은 다른 날 메모가 그날 칸에');
  r.check((await inJournal('insp_lkm').locator(sel('entry-from')).getAttribute('data-entry-from')) === 'event:insp_lkf', '📌 일정 표시');
  r.check(await waitFor(inJournal('insp_lkn')), '3교시에 이은 날짜 없는 메모도');
  r.check((await inJournal('insp_lkn').locator(sel('entry-from')).getAttribute('data-entry-from')) === 'lesson:3', '🏫 3교시 표시');
  r.check((await inJournal('insp_lkj').count()) === 1, '날짜 링크 + 일정에 이은 메모는 한 번만');
  r.check((await inJournal('insp_lkj').locator(sel('entry-from', 'event:insp_lke')).count()) === 1, '그 메모에도 📌 표시');
  r.check(await inJournal('insp_lkm').locator(sel('entry-up')).isDisabled(), '이은 것으로만 온 메모는 ▲▼ 없음');
  const count = Number(await journal.locator(sel('journal-count')).getAttribute('data-journal-count'));
  r.check(count === (await journal.locator(sel('entry-card')).count()), `머리줄 수 = 카드 수 (${count})`);
  await inJournal('insp_lkm').hover();
  await inJournal('insp_lkm').locator(sel('entry-link-add')).click();
  r.check(await waitFor(page.locator(sel('linker', 'insp_lkm'))), '메모 카드 🔗 (마우스를 올리면) = 그 메모의 연결 창');
  await page.keyboard.press('Escape');
  await page.goto(page.url().replace(/#.*$/, '#/day/2026-10-01'));
  const own = page.locator(`${sel('day-journal', '2026-10-01')} ${sel('entry-card', 'insp_lkm')}`);
  r.check(await waitFor(own), '제 날짜 칸에도');
  r.check((await own.locator(sel('entry-from')).count()) === 0, '제 날짜 칸에는 표시 없음');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
