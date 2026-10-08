// tools/inspect-notes.mjs - P3-2: 하루 화면 기록 칸·메모·기록 쓰는 칸을 실제 크롬에서 본다 (저장마다 서버 문서 하나만 바뀐다).
//   1) 하루 화면 기록 칸: 그날 기록 카드(라벨 칩·☑ n/m·🔗), 즐겨찾기가 맨 위, 메모·다른 날은 없다, 긴 기록은 접혀 있다.
//   2) ☐ 완료·☆ 즐겨찾기·체크 줄 = 그 기록 문서 하나(다른 기록의 updatedAt은 그대로), 안내 없이. ▲ 순서 = 문서 하나.
//   3) 🗑️ = 지운 표시 → 안내의 되돌리기.
//   4) + 추가 → 새 기록 칸(맨 위 라벨·커서는 글 칸) → '#라벨' 미리 보기 → Ctrl+S = 새 문서 하나 + 새 라벨, 칸은 그 기록의 수정 칸('#' 줄은 떼고).
//   5) 고치기 = 그 문서의 바뀐 칸만. 📅 날짜 빼기 → '옮기고 저장' = date null·fromDate(메모로), 안내의 되돌리기 = 원래 날.
//   6) ☑ 체크리스트 단추·Enter 이어 쓰기, 칸의 ☐ 완료 = 곧바로 그 칸만. + 메모 → 새 메모 칸(날짜 없음).
//   7) 쓰던 글 보관: 새 기록 칸에 적고 2초 → 새로고침 → 다시 열면 '저장하지 않은 글' → 되살리기, 버리기면 다시 묻지 않는다(IndexedDB sp5-drafts-{uid}).
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-notes.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 기록(insp_nt…)·라벨을 심고 끝에 지운다.
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const DAY = '2026-10-08';
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const labelRef = (id) => doc(em.db, 'spaces', sid, 'labels', id);
const read = async (id) => {
  const s = await getDoc(itemRef(id));
  return s.exists() ? s.data() : null;
};
/** 그날 문서들의 updatedAt (어느 문서가 바뀌었나 보기) */
const stamps = async () => {
  const snap = await getDocs(query(collection(em.db, 'spaces', sid, 'items'), where('date', '==', DAY)));
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data().updatedAt?.toMillis() ?? 0]));
};
const changed = (a, b) => Object.keys({ ...a, ...b }).filter((id) => a[id] !== b[id]);
const startedAt = Date.now();
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: startedAt, authorId: uid };
const NOTES = {
  insp_nt1: { text: '점검 기록 하나', labelIds: ['insp_nc'], order: 'Zz1', linkIds: ['x'] },
  insp_nt2: { text: '점검 기록 둘', labelIds: [], order: 'Zz2', favorite: true },
  insp_nt3: { text: '점검 장보기\n☐ 우유\n☑ 빵\n☐ 달걀', labelIds: [], order: 'Zz3' },
  insp_nt4: { text: '점검 긴 기록 '.repeat(20), labelIds: [], order: 'Zz4' },
  insp_nt9: { text: '점검 다른 날 기록', labelIds: [], order: 'Zz1', date: '2026-10-09' },
  insp_nm1: { text: '점검 메모', labelIds: [], order: 'Zz1', date: null },
};

try {
  await setDoc(labelRef('insp_np'), { kind: 'note', name: '점검상위', color: 'blue', parentId: null, order: 'Zz1', ...stamp });
  await setDoc(labelRef('insp_nc'), { kind: 'note', name: '점검하위', color: 'green', parentId: 'insp_np', order: 'Zz2', ...stamp });
  undo.add(() => deleteDoc(labelRef('insp_np')));
  undo.add(() => deleteDoc(labelRef('insp_nc')));
  for (const [id, data] of Object.entries(NOTES)) {
    await setDoc(itemRef(id), { kind: 'note', date: DAY, ...data, ...stamp });
    undo.add(() => deleteDoc(itemRef(id)));
  }

  const { page, errors } = await newPage(browser);
  await open(page, `#/day/${DAY}`);
  const card = (id) => page.locator(sel('entry-card', id));
  const shownIds = () => page.locator(`${sel('day-journal')} ${sel('entry-card')}`).evaluateAll((els) => els.map((e) => e.dataset.entryCard));

  r.section('하루 화면 기록 칸');
  r.check(await waitFor(card('insp_nt3')), '심은 기록 카드가 보인다');
  r.check((await card('insp_nt9').count()) === 0 && (await card('insp_nm1').count()) === 0, '다른 날 기록·메모는 없다');
  const chip = card('insp_nt1').locator(sel('entry-chip', 'insp_nc'));
  r.check(await chip.isVisible(), '라벨 칩');
  r.check((await chip.getAttribute('title')) === '점검상위 › 점검하위', '하위 라벨 칩 = 상위 › 하위');
  r.check((await card('insp_nt3').locator(sel('entry-checks')).getAttribute('data-entry-checks')) === '1/3', '☑ 1/3');
  r.check((await card('insp_nt1').locator(sel('entry-links')).textContent()).includes('1'), '🔗 링크 수');
  r.check((await card('insp_nt4').getAttribute('data-entry-collapsed')) === '1', '긴 기록은 접혀 있다');
  const firstShown = (await shownIds()).filter((id) => id.startsWith('insp_'))[0];
  r.check(firstShown === 'insp_nt2', `즐겨찾기한 기록이 맨 위 (${firstShown})`);

  r.section('완료·즐겨찾기·체크 줄·순서 = 문서 하나');
  let before = await stamps();
  await card('insp_nt1').locator(sel('entry-complete')).click();
  r.check(await waitFor(async () => (await card('insp_nt1').getAttribute('data-entry-done')) === '1', 2000), '☐ 누르면 곧바로 완료로 보인다');
  const done = await serverUntil(() => read('insp_nt1'), (d) => d?.done === true);
  r.check(done?.done === true && typeof done.doneAt === 'number', '서버: done·doneAt');
  let after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(JSON.stringify(changed(before, after)) === JSON.stringify(['insp_nt1']), `바뀐 문서는 그 기록 하나 (${changed(before, after).join(',')})`);
  await card('insp_nt1').locator(sel('entry-favorite-toggle')).click();
  r.check((await serverUntil(() => read('insp_nt1'), (d) => d?.favorite === true))?.favorite === true, '☆ = 즐겨찾기');
  r.check(await waitFor(async () => (await shownIds()).filter((id) => id.startsWith('insp_'))[0] !== 'insp_nt3'), '즐겨찾기는 위로');
  await card('insp_nt1').locator(sel('entry-favorite-toggle')).click();
  r.check((await serverUntil(() => read('insp_nt1'), (d) => d?.favorite === undefined))?.favorite === undefined, '★ 한 번 더 = 풀기 (칸을 지운다)');
  before = await stamps();
  await card('insp_nt3').locator(sel('check-line', 1)).click();
  const checked = await serverUntil(() => read('insp_nt3'), (d) => d?.text?.includes('☑ 우유'));
  r.check(checked?.text === '점검 장보기\n☑ 우유\n☑ 빵\n☐ 달걀', '체크 줄 누르기 = 그 글자만');
  after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(JSON.stringify(changed(before, after)) === JSON.stringify(['insp_nt3']), '체크도 문서 하나');
  r.check(await waitFor(async () => (await card('insp_nt3').locator(sel('entry-checks')).getAttribute('data-entry-checks')) === '2/3'), '☑ 2/3');
  r.check((await page.locator(sel('toast')).count()) === 0, '완료·즐겨찾기·체크에는 안내가 뜨지 않는다 (V4 그대로)');
  before = await stamps();
  await card('insp_nt4').locator(sel('entry-up')).click();
  after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(changed(before, after).length === 1, `▲ 한 번 = 문서 하나의 order (${changed(before, after).join(',')})`);

  r.section('지우기 = 지운 표시 → 되돌리기');
  await card('insp_nt3').hover();
  await card('insp_nt3').locator(sel('entry-delete')).click();
  const removed = await serverUntil(() => read('insp_nt3'), (d) => !!d?.deletedAt);
  r.check(!!removed?.deletedAt && removed.text.includes('장보기'), '서버: 지운 표시 (문서는 남는다)');
  r.check(await waitFor(async () => (await card('insp_nt3').count()) === 0), '목록에서 빠진다');
  await page.locator(sel('toast')).filter({ hasText: '기록을 삭제했습니다' }).locator('[data-toast-action="되돌리기"]').click();
  r.check((await serverUntil(() => read('insp_nt3'), (d) => d?.deletedAt === null))?.deletedAt === null, '안내의 되돌리기 → 되살아난다');
  r.check(await waitFor(card('insp_nt3')), '카드가 돌아온다');

  r.section('새 기록 칸 → #라벨 → 저장 = 문서 하나 + 새 라벨 → 수정 칸');
  undo.add(async () => {
    const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
    for (const d of snap.docs) if (d.data().createdAt >= startedAt && String(d.data().text).includes('점검') && !d.id.startsWith('insp_')) await deleteDoc(d.ref);
    const labels = await getDocs(collection(em.db, 'spaces', sid, 'labels'));
    for (const d of labels.docs) if (d.data().name === '점검새라벨') await deleteDoc(d.ref);
  });
  const panel = page.locator(sel('note-panel'));
  await page.locator(sel('journal-add')).click();
  r.check(await waitFor(panel), '+ 추가 → 오른쪽에 새 기록 칸');
  r.check((await panel.getAttribute('data-note-panel')) === 'new' && (await panel.getAttribute('data-note-noun')) === '기록', '새 기록');
  r.check(await page.evaluate(() => document.activeElement?.hasAttribute('data-note-text-input')), '열면 커서가 내용 칸에');
  r.check((await panel.locator('[data-label-pick][aria-pressed="true"]').count()) === 1, '맨 위 라벨을 골라 둔다');
  r.check((await page.locator(sel('note-date')).inputValue()) === DAY, '📅 날짜 = 보던 날');
  await page.keyboard.type('점검 새 기록');
  await page.keyboard.press('Enter');
  await page.keyboard.type('#점검새라벨');
  r.check(await waitFor(page.locator(sel('hash-label', '점검새라벨'))), "'#점검새라벨' 미리 보기 (새로 만듦)");
  before = await stamps();
  await page.keyboard.press('Control+s');
  r.check(await waitFor(async () => (await panel.getAttribute('data-note-panel')) === 'edit'), 'Ctrl+S → 그 기록의 수정 칸이 된다');
  const newId = await panel.getAttribute('data-note-id');
  after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(JSON.stringify(changed(before, after)) === JSON.stringify([newId]), `서버에 새 기록 문서 하나 (${changed(before, after).join(',')})`);
  const made = await read(newId);
  r.check(made?.kind === 'note' && made.date === DAY && made.text === '점검 새 기록' && made.deletedAt === null, "새 문서 모양 ('#' 줄은 떼고)");
  const newLabel = (await getDocs(collection(em.db, 'spaces', sid, 'labels'))).docs.find((d) => d.data().name === '점검새라벨');
  r.check(!!newLabel && made.labelIds.includes(newLabel.id), '새 라벨이 생기고 기록에 붙는다');
  r.check((await page.locator(sel('note-text-input')).inputValue()) === '점검 새 기록', "칸의 글에서도 '#' 줄이 빠진다");
  r.check(await waitFor(async () => ((await card(newId).getAttribute('class')) ?? '').includes('ring-primary')), '목록의 그 카드를 짚는다');

  r.section('고치기 = 바뀐 칸만 / 날짜 빼기 = 메모로 (date만)');
  before = await stamps();
  await page.locator(sel('note-text-input')).fill('점검 새 기록 (고침)');
  await page.locator(sel('note-save')).click();
  r.check((await serverUntil(() => read(newId), (d) => d?.text === '점검 새 기록 (고침)'))?.text === '점검 새 기록 (고침)', '서버: 글이 바뀐다');
  after = await serverUntil(stamps, (s) => changed(before, s).length > 0);
  r.check(JSON.stringify(changed(before, after)) === JSON.stringify([newId]), '바뀐 문서는 그 기록 하나');
  await page.locator(sel('note-date-clear')).click();
  r.check(await waitFor(page.locator(sel('note-place-hint'))), "'저장하면 메모로 옮깁니다'");
  await page.locator(sel('note-save')).click();
  const toMemo = await serverUntil(() => read(newId), (d) => d?.date === null);
  r.check(toMemo?.date === null && toMemo.fromDate === DAY && toMemo.text === '점검 새 기록 (고침)', '옮기고 저장 → date null · fromDate (같은 문서)');
  r.check(await waitFor(async () => (await card(newId).count()) === 0), '그날 기록에서 빠진다');
  r.check((await panel.getAttribute('data-note-noun')) === '메모', '칸은 같은 항목(이제 메모)을 가리킨다');
  await page.locator(sel('toast')).filter({ hasText: '메모로 옮겼습니다' }).locator('[data-toast-action="되돌리기"]').click();
  const back = await serverUntil(() => read(newId), (d) => d?.date === DAY);
  r.check(back?.date === DAY && back.fromDate === undefined && back.text === '점검 새 기록 (고침)', '안내의 되돌리기 → 원래 날 (자리만)');
  r.check(await waitFor(card(newId)), '카드가 돌아온다');

  r.section('체크리스트·완료·+ 메모');
  const input = page.locator(sel('note-text-input'));
  await input.fill('점검 할 일');
  await input.press('End');
  await page.locator(sel('checklist-toggle')).click();
  r.check((await input.inputValue()) === '☐ 점검 할 일', '☑ 체크리스트 → 줄 앞에 ☐');
  await input.press('End');
  await input.press('Enter');
  await page.keyboard.type('우유');
  r.check((await input.inputValue()) === '☐ 점검 할 일\n☐ 우유', 'Enter → 다음 줄도 ☐');
  before = await stamps();
  await page.locator(sel('note-flag', 'done')).click();
  r.check((await serverUntil(() => read(newId), (d) => d?.done === true))?.text === '점검 새 기록 (고침)', '칸의 ☐ 완료 = 곧바로 그 칸만 (쓰던 글은 저장하지 않는다)');
  r.check((await input.inputValue()) === '☐ 점검 할 일\n☐ 우유', '쓰던 글은 칸에 그대로');
  await page.locator(sel('note-close')).click();
  r.check(await waitFor(async () => (await panel.count()) === 0), '닫기 → 칸이 닫힌다 (저장 없이)');
  await page.locator(sel('journal-add-memo')).click();
  r.check(await waitFor(async () => (await panel.getAttribute('data-note-noun')) === '메모'), '+ 메모 → 새 메모 칸');
  r.check((await page.locator(sel('note-date')).inputValue()) === '', '날짜 없음');
  await page.locator(sel('note-close')).click();

  r.section('쓰던 글 보관 (이 기기)');
  await page.locator(sel('journal-add')).click();
  await waitFor(panel);
  await page.keyboard.type('점검 쓰던 글');
  await page.waitForTimeout(2600);
  r.check(
    await page.evaluate(async (u) => (await indexedDB.databases()).some((d) => d.name === `sp5-drafts-${u}`), uid),
    `IndexedDB sp5-drafts-{uid}가 생긴다`,
  );
  await page.reload();
  await waitFor(page.locator(sel('day-journal')), 10000);
  r.check((await panel.count()) === 0, '새로고침 → 칸이 없다');
  await page.locator(sel('journal-add')).click();
  r.check(await waitFor(page.locator(sel('draft-offer'))), "다시 열면 '저장하지 않은 글이 있습니다'");
  r.check((await page.locator(sel('note-text-input')).inputValue()) === '', '묻기만 하고 칸은 비어 있다');
  await page.locator(sel('draft-restore')).click();
  r.check((await page.locator(sel('note-text-input')).inputValue()) === '점검 쓰던 글', '되살리기 → 적던 글');
  await page.locator(sel('note-close')).click();
  await page.locator(sel('journal-add')).click();
  r.check(await waitFor(page.locator(sel('draft-offer'))), '닫아도 보관은 남는다 (다시 묻는다)');
  await page.locator(sel('draft-discard')).click();
  await page.locator(sel('note-close')).click();
  await page.locator(sel('journal-add')).click();
  await page.waitForTimeout(1500);
  r.check((await page.locator(sel('draft-offer')).count()) === 0, '버리기 → 다시 묻지 않는다');
  await page.locator(sel('note-close')).click();

  r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' / ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack || e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
