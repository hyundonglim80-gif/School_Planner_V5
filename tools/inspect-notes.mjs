// tools/inspect-notes.mjs - P3-2: 하루 화면 기록 칸·메모·기록 쓰는 칸을 실제 크롬에서 본다 (저장마다 서버 문서 하나만 바뀐다).
//   1) 하루 화면 기록 칸: 그날 기록 카드(라벨 칩·☑ n/m·🔗), 즐겨찾기가 맨 위, 메모·다른 날은 없다, 긴 기록은 접혀 있다.
//   2) ☐ 완료·☆ 즐겨찾기·체크 줄 = 그 기록 문서 하나(다른 기록의 updatedAt은 그대로), 안내 없이. ▲ 순서 = 문서 하나.
//   3) 🗑️ = 지운 표시 → 안내의 되돌리기.
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

  r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' / ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack || e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
