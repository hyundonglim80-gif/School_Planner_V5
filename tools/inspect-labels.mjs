// tools/inspect-labels.mjs - P2-3: 라벨 관리 창을 실제 크롬에서 본다 (끝 조건: 이름을 바꾸면 서버에서 그 라벨 문서 하나만 바뀐다).
//   1) ⋮ → 🏷️ 라벨 관리로 열린다. 서버에 심은 라벨이 보이고, 하위는 제 상위 밑에 들여 보인다.
//   2) 이름을 바꿔 💾 저장 → 서버에서 그 라벨 문서 하나(name)만 바뀐다 - 다른 라벨·항목의 updatedAt은 그대로.
//   3) 열어 둔 동안 다른 기기가 고친 것(색)이 들어온다.
//   4) 저장 안 한 것이 있으면 ESC가 먼저 묻는다.
//   5) 메모·기록 탭: 붙은 수(사본에서 바로) · 빈 라벨 정리 = 고른 것만 지운 표시.
//   6) 추가는 곧바로 저장(고른 상위 밑에), 안내의 되돌리기 = 지운 표시.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-labels.mjs
// 에뮬레이터 teacher 계정의 개인 공간에 점검 라벨(insp_…)과 항목을 심고 끝에 지운다.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();

const labelRef = (id) => doc(em.db, 'spaces', sid, 'labels', id);
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const readLabel = async (id) => {
  const s = await getDoc(labelRef(id));
  return s.exists() ? s.data() : null;
};
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid };
const LABELS = {
  insp_e1: { kind: 'event', name: '점검회의', color: 'blue', parentId: null, order: 'Zz1', props: { calendar: true } },
  insp_e2: { kind: 'event', name: '점검행사', color: 'red', parentId: null, order: 'Zz2' },
  insp_n1: { kind: 'note', name: '점검학교', color: 'blue', parentId: null, order: 'Zz1' },
  insp_n2: { kind: 'note', name: '점검A초', color: 'gray', parentId: 'insp_n1', order: 'Zz2' },
  insp_n3: { kind: 'note', name: '점검빈것', color: 'gray', parentId: null, order: 'Zz3' },
};

try {
  // 심기 (앞 차례 'Zz…'로 - 이 계정에 다른 라벨이 있어도 맨 앞에 선다)
  for (const [id, data] of Object.entries(LABELS)) {
    await setDoc(labelRef(id), { ...data, ...stamp });
    undo.add(() => deleteDoc(labelRef(id)));
  }
  await setDoc(itemRef('insp_item'), { kind: 'note', date: '2026-10-08', text: '점검 기록', labelIds: ['insp_n2'], order: 'a0', ...stamp });
  undo.add(() => deleteDoc(itemRef('insp_item')));

  const { page, errors, dialogs } = await newPage(browser);
  await open(page, '#/day/2026-10-08');
  const win = page.locator(sel('labels-window'));
  const row = (id) => page.locator(sel('label-row', id));

  r.section('창 열기');
  await page.locator(sel('more-menu')).click();
  await page.locator(sel('menu-item', 'labels')).click();
  r.check(await waitFor(win), '⋮ → 라벨 관리로 열린다');
  r.check(await waitFor(row('insp_e1')), '서버에 심은 일정 라벨이 보인다');

  r.section('이름 바꾸기 = 문서 하나 (끝 조건)');
  const before = {};
  for (const id of Object.keys(LABELS)) before[id] = (await readLabel(id)).updatedAt.toMillis();
  const itemBefore = (await getDoc(itemRef('insp_item'))).data().updatedAt.toMillis();
  await row('insp_e1').locator(sel('label-name')).fill('점검회의2');
  await page.locator(sel('label-save')).click();
  const e1 = await serverUntil(() => readLabel('insp_e1'), (d) => d?.name === '점검회의2');
  r.check(e1?.name === '점검회의2', '서버의 그 라벨 name이 바뀌었다', `name = ${e1?.name}`);
  const changed = [];
  for (const id of Object.keys(LABELS)) if ((await readLabel(id)).updatedAt.toMillis() !== before[id]) changed.push(id);
  r.check(changed.join() === 'insp_e1', '바뀐 라벨 문서는 그 하나뿐', `바뀐 문서: ${changed.join()}`);
  r.check((await getDoc(itemRef('insp_item'))).data().updatedAt.toMillis() === itemBefore, '항목은 고쳐 쓰지 않는다 (id로 가리킨다)');
  r.check(Object.keys(e1).sort().join() === Object.keys({ ...LABELS.insp_e1, ...stamp }).sort().join(), '다른 칸은 그대로 (name만)');
  r.check(await waitFor(page.locator(sel('toast-action', '되돌리기')).last()), '저장 안내에 되돌리기 단추');

  r.section('다른 기기가 고친 것');
  await updateDoc(labelRef('insp_e2'), { color: 'green', updatedAt: serverTimestamp() });
  const t0 = Date.now();
  r.check(
    await waitFor(async () => (await row('insp_e2').locator(sel('label-color')).getAttribute('data-color')) === 'green', 5000),
    `열어 둔 창에 들어온다 (${Date.now() - t0}ms)`,
  );

  r.section('ESC는 저장 안 한 것이 있으면 묻는다');
  await row('insp_e2').locator(sel('label-name')).fill('점검행사 고침');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  r.check(dialogs.seen.some((m) => m.includes('저장하지 않은')), '묻는 창이 떴다');
  r.check(await win.isVisible(), "'아니오'면 창이 그대로");
  await row('insp_e2').locator(sel('label-name')).fill('점검행사');

  r.section('메모·기록 탭 - 트리·붙은 수·빈 라벨 정리');
  await page.locator(sel('label-tab', 'note')).click();
  r.check(await waitFor(row('insp_n2')), '메모·기록 라벨이 보인다');
  r.check((await row('insp_n2').getAttribute('data-depth')) === '1', '하위는 들여 보인다');
  r.check((await page.locator(sel('label-usage', 'insp_n1')).getAttribute('data-total')) === '1', '상위는 하위가 붙은 항목도 센다');
  r.check((await page.locator(sel('label-usage', 'insp_n3')).getAttribute('data-total')) === '0', '안 붙은 라벨은 0');
  await page.locator(sel('label-prune')).click();
  // 이 계정의 다른 빈 라벨은 빼고 점검 라벨만 고른다
  for (const box of await page.locator(sel('label-prune-item')).all()) {
    const id = await box.getAttribute('data-label-prune-item');
    if ((await box.isChecked()) !== (id === 'insp_n3')) await box.click();
  }
  await page.locator(sel('label-prune-confirm')).click();
  const n3 = await serverUntil(() => readLabel('insp_n3'), (d) => !!d?.deletedAt);
  r.check(!!n3?.deletedAt, '고른 빈 라벨은 지운 표시 (휴지통)');
  r.check(!(await readLabel('insp_n1')).deletedAt, '고르지 않은 것은 그대로');

  r.section('추가 = 곧바로 저장, 되돌리기 = 지운 표시');
  await page.locator(sel('label-new-name', 'note')).fill('점검새것');
  await page.locator(sel('label-new-parent')).selectOption('insp_n1');
  await page.locator(sel('label-add', 'note')).click();
  const findNew = async () => {
    const snap = await getDocs(collection(em.db, 'spaces', sid, 'labels'));
    const hit = snap.docs.find((d) => d.data().name === '점검새것');
    return hit ? { id: hit.id, ...hit.data() } : null;
  };
  const made = await serverUntil(findNew, (d) => !!d);
  if (made) undo.add(() => deleteDoc(labelRef(made.id)));
  r.check(made?.parentId === 'insp_n1' && made?.kind === 'note', '서버에 새 라벨 (고른 상위 밑에)', JSON.stringify(made));
  r.check(await waitFor(row(made?.id ?? 'none')), '창에 곧바로 보인다');
  await page.locator(sel('toast-action', '되돌리기')).last().click();
  r.check(!!(await serverUntil(findNew, (d) => !!d?.deletedAt))?.deletedAt, '되돌리기 = 지운 표시');

  r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' / ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
