// tools/inspect-shortcut-record.mjs - P18-1 단축키 설정(메뉴·단추를 눌러 고르기)을 크롬으로 본다.
//   1) 단축키 탭 '⌨️ 단축키 설정' → 환경설정 창이 닫히고 아래 띠 · 고를 수 있는 단추에 점선 테두리
//   2) 표시 없는 단추(수업 접기 ▼)는 '만들 수 없습니다', 칸을 펴는 단추(계정 사진·⋮)는 아무 말 없음 · ⋮ → 시간표 = '고른 것: 시간표'(누른 것은 그대로 동작 - 시간표 창이 열린다)
//   3) 완료 → 누른 키는 앱 단축키로 가지 않는다(2 = 주간으로 안 감) → Ctrl+Alt+T → 저장 → 계정 settings/pc · 환경설정 단축키 탭이 그 줄을 짚는다
//   4) 창을 닫고 Ctrl+Alt+T = 시간표 창 · ⋮ 메뉴 시간표 옆 키 · 사용 설명서 단축키 표
//   5) 겹친 키: 머리줄 🗑️ → Ctrl+F = 고정 단축키라 막힘(#149) → 5 → '메모 화면'에서 뺀다는 안내 → 저장 → scopeMemo = 없음
//   6) ESC = 기록 취소(열린 창은 그대로, 키는 그대로)
//   7) 창 안 탭(P18-2): ⋮ → 환경설정 → 알림 탭 = '고른 것: 환경설정 → 알림' → Ctrl+Alt+N → 계정 tabShortcuts · '내가 만든 단축키' 줄 ·
//      열린 환경설정에서 그 키 = 알림 탭(다른 탭을 눌렀어도 다시) · 탭 툴팁 · 설명서 표 · 🗑️ → 메모 탭 = 휴지통 메모 탭으로 열림
//   8) 단축키 탭 줄(P28-1): 키 바꾸기 = 고르기 없이 띠의 키 단계(창은 그대로) · 해제 = 곧바로 빠짐 · 되돌리기
//   9) 환경설정 값(P28-2): 팝업창 모드여도 고르는 동안 환경설정은 큰 창 안 · 창 위치 팝업창 단추 = 'opt.popupStyle.popup' → Ctrl+Alt+P → 계정 customShortcuts ·
//      그 키 = 창을 열지 않고 팝업창 + 안내, 다시 = 오른쪽 칸 · 단추 툴팁 · 설명서 표 · 고대비 줄 = 'opt.contrast' → 키마다 켜고 끄기
//  10) 그 밖의 단추(P28-3): 하루 수업 접기도 고른다 · 메모 카드 안 ▼ = 항목마다라 못 만든다 · 머리줄 카드/목록 → Ctrl+Alt+L = 하루 화면에서도 메모 화면으로 가서 누름 ·
//      검색 창 메모 칩 → Ctrl+Alt+K = 닫혀 있으면 열고 누름 · 팝업창 모드면 팝업창 안에서('누르기' 소식) · 메모 칸 📎 → Ctrl+Alt+U = 열린 칸(숨은 탭)이면 누름, 닫혔으면 안내만
//  11) P34 모든 키: Ctrl+Tab(크롬)·Alt+Tab(윈도우) = 까닭 + 저장 막기 · Delete·F5·Backspace도 키 · 시간표 = Backspace → 누르면 시간표, 글 칸 안은 글 지우기 ·
//      사용 설명서 = Tab(안내) → 누르면 설명서 · 단축키 탭 줄 키 바꾸기 → 키 지우기 → 저장 = 빠짐
//      (크롬 예약·윈도우 키가 진짜로 앱까지 오지 않는지는 볼 수 없다 - Playwright 키(CDP)는 브라우저·윈도우를 거치지 않는다)
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-shortcut-record.mjs
// 에뮬레이터 teacher 계정의 V5 설정 문서(spaces/u_{uid}/settings/pc)를 쓴다 - 처음 것을 읽어 두고 끝에 되돌린다.
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const pcRef = doc(em.db, 'spaces', `u_${uid}`, 'settings', 'pc');
const undo = restorer();
const before = await getDoc(pcRef);
undo.add(() => (before.exists() ? setDoc(pcRef, before.data()) : deleteDoc(pcRef)));
// 기본 키에서 시작한다 (지난 점검이 남긴 것이 있으면 결과가 흔들린다)
await deleteDoc(pcRef);
const serverPc = async () => (await getDoc(pcRef)).data() ?? {};
// P28-3 카드 안 단추 - 메모 둘(진짜 id 모양 20자 - 카드가 '항목'으로 보인다)
for (const [i, id] of ['inspPressMemo0000001', 'inspPressMemo0000002'].entries()) {
  const ref = doc(em.db, 'spaces', `u_${uid}`, 'items', id);
  await setDoc(ref, { kind: 'note', date: null, text: `단축키 점검 메모 ${i + 1}`, labelIds: [], order: `Zz${i}`, deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid });
  undo.add(() => deleteDoc(ref));
}

const browser = await launch();
try {
  const a = await newPage(browser);
  const page = a.page;
  const bar = (stage) => page.locator(sel('shortcut-record', stage));
  const startRecord = async () => {
    await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'shortcuts' }));
    await page.locator(sel('shortcut-record-start')).click();
  };

  r.section('시작 - 띠·점선 테두리');
  await open(page, '#/day/2026-10-08');
  await page.click(sel('more-menu'));
  await page.click(sel('menu-item', 'settings'));
  await page.click(sel('settings-tab', 'shortcuts'));
  r.check(await waitFor(page.locator(sel('shortcut-record-start'))), "단축키 탭에 '⌨️ 단축키 설정' (PC)");
  await page.click(sel('shortcut-record-start'));
  r.check(await waitFor(bar('pick')), '누르면 아래 띠(고르기)');
  r.check(await waitFor(async () => (await page.locator(sel('settings-window')).count()) === 0), '환경설정 창은 닫힌다');
  const outline = await page.locator(sel('header-help')).evaluate((el) => getComputedStyle(el).outlineStyle);
  r.check(outline === 'dashed', `고를 수 있는 단추에 점선 테두리 (? = ${outline})`);
  const plain = await page.locator(sel('account')).evaluate((el) => getComputedStyle(el).outlineStyle);
  r.check(plain !== 'dashed', `고를 수 없는 단추는 테두리 없음 (계정 사진 = ${plain})`);
  r.check(await page.locator(sel('shortcut-record-done')).isDisabled(), '고르기 전에는 완료를 누를 수 없다');

  r.section('고르기 - 누른 것은 그대로 동작');
  await page.click(sel('account'));
  r.check(await waitFor(page.locator(sel('account-panel'))), '누른 것은 그대로 동작한다 (계정 칸이 열린다)');
  r.check((await page.locator(sel('shortcut-record-miss')).count()) === 0, '칸을 펴는 단추(계정 사진)는 나무라지 않는다 - 찾아 들어가는 길');
  await page.click(sel('lessons-collapse'));
  const pickedText = async () => ((await page.locator(sel('shortcut-record-picked')).textContent().catch(() => '')) ?? '').trim();
  // P28-3부터 표시 없는 단추도 고른다(그 단추를 대신 누르기) - 하루 화면 수업 칸은 보고 있는 날의 것이라 된다
  r.check(await waitFor(async () => (await pickedText()).includes('하루 → 수업 접기')), `표시 없는 단추(수업 접기 ▼)도 고른다 = '하루 → 수업 접기' (${await pickedText()})`);
  await page.click(sel('lessons-collapse'));
  await page.click(sel('more-menu'));
  await page.click(sel('menu-item', 'timetable'));
  r.check(await waitFor(page.locator(sel('shortcut-record-picked', 'timetable'))), "⋮ → 시간표 = '고른 것: 시간표'");
  r.check((await page.locator(sel('shortcut-record-picked')).textContent())?.includes('시간표'), `띠 글자 (${await page.locator(sel('shortcut-record-picked')).textContent()})`);
  r.check((await page.locator(sel('shortcut-record-miss')).count()) === 0, '고르면 만들 수 없다는 안내는 걷힌다');
  r.check(await waitFor(page.locator(sel('timetable-window'))), '시간표 창도 열린다 (평소처럼)');

  r.section('키 받기 → 저장');
  await page.click(sel('shortcut-record-done'));
  r.check(await waitFor(bar('key')), '완료 = 키 받기');
  await page.keyboard.press('Digit2');
  r.check((await page.locator(sel('shortcut-record-key')).textContent()) === '2', `누른 키가 칸에 (${await page.locator(sel('shortcut-record-key')).textContent()})`);
  r.check((await page.getAttribute(sel('scope-tab', 'day'), 'aria-pressed')) === 'true', '그 키가 앱 단축키로 가지 않는다 (2 = 주간으로 안 감 - #149 기본 키)');
  r.check(await waitFor(page.locator(sel('shortcut-record-typing'))), 'Ctrl·Alt 없는 키 = 글 칸 안내');
  await page.keyboard.press('Control+KeyV');
  r.check(((await page.locator(sel('shortcut-record-issue')).textContent().catch(() => '')) ?? '').includes('붙여넣기'), 'Ctrl+V = 글 칸 키라 까닭을 보인다 (P22-5 ■4)');
  await page.keyboard.press('Control+Alt+KeyT');
  r.check((await page.locator(sel('shortcut-record-key')).textContent()) === 'Ctrl + Alt + T', `Ctrl+Alt+T (${await page.locator(sel('shortcut-record-key')).textContent()})`);
  await page.click(sel('shortcut-record-save'));
  r.check(await waitFor(async () => (await page.locator(sel('shortcut-record')).count()) === 0), '저장하면 띠가 걷힌다');
  const saved = await serverUntil(serverPc, (d) => d.shortcutOverrides?.timetable?.key === 'T');
  r.check(
    JSON.stringify(saved.shortcutOverrides?.timetable) === JSON.stringify({ ctrl: true, alt: true, shift: false, key: 'T' }),
    `계정 settings/pc에 올라간다 (${JSON.stringify(saved.shortcutOverrides)})`,
  );
  r.check(await waitFor(page.locator(`${sel('shortcut-row', 'timetable')}[data-shortcut-row-focus]`)), '환경설정 단축키 탭이 그 줄을 짚는다');
  const rowKey = (id) => page.locator(`${sel('shortcut-row', id)} ${sel('shortcut-key')}`).textContent();
  r.check((await rowKey('timetable')) === 'Ctrl + Alt + T', `단축키 탭 그 줄 = Ctrl + Alt + T (${await rowKey('timetable')}) - 키가 없던 기능이 목록에 생긴다 (P28-1)`);

  r.section('그 키로 동작 · 메뉴·설명서에 보임');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await waitFor(async () => (await page.locator(sel('timetable-window')).count()) === 0);
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+Alt+KeyT');
  r.check(await waitFor(page.locator(sel('timetable-window'))), 'Ctrl+Alt+T = 시간표 창');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.click(sel('more-menu'));
  const menuKey = await page.locator(sel('menu-item', 'timetable')).textContent();
  r.check(menuKey?.includes('Ctrl + Alt + T'), `⋮ 메뉴 시간표 옆에 키 (${menuKey})`);
  await page.click(sel('more-menu'));
  await page.evaluate(() => window.sp5.openWindow('help', { topic: 'shortcuts' }));
  r.check(await waitFor(page.locator(sel('help-shortcut', 'timetable'))), '설명서 단축키 표');
  const helpKey = await page.locator(sel('help-shortcut', 'timetable')).textContent();
  r.check(helpKey?.includes('Ctrl + Alt + T'), `설명서 표 시간표 = Ctrl + Alt + T (${helpKey})`);
  await page.evaluate(() => window.sp5.closeAllWindows());

  r.section('겹친 키 = 다른 기능에서 뺀다');
  await startRecord();
  await waitFor(bar('pick'));
  await page.click(sel('header-trash'));
  r.check(await waitFor(page.locator(sel('shortcut-record-picked', 'trash'))), "머리줄 🗑️ = '고른 것: 휴지통 열기 / 닫기'");
  await page.click(sel('shortcut-record-done'));
  // 고정 단축키(검색 Ctrl + F - #149)의 키는 줄 수 없다
  await page.keyboard.press('Control+KeyF');
  const fixedIssue = (await page.locator(sel('shortcut-record-issue')).textContent().catch(() => '')) ?? '';
  r.check(fixedIssue.includes('고정 단축키(검색 열기)') && (await page.locator(sel('shortcut-record-save')).isDisabled()), `Ctrl+F = 고정 단축키라 저장을 막는다 (${fixedIssue})`);
  await page.keyboard.press('Digit5');
  const conflict = await page.locator(sel('shortcut-record-conflict')).textContent().catch(() => '');
  r.check(conflict.includes('메모 화면'), `저장 전에 알린다 (${conflict})`);
  await page.click(sel('shortcut-record-save'));
  const moved = await serverUntil(serverPc, (d) => d.shortcutOverrides?.trash?.key === '5');
  r.check(moved.shortcutOverrides?.trash?.key === '5' && moved.shortcutOverrides?.scopeMemo?.key === '', `휴지통 = 5, 메모 화면 = 없음 (${JSON.stringify(moved.shortcutOverrides)})`);
  r.check(await waitFor(page.locator(`${sel('shortcut-row', 'trash')}[data-shortcut-row-focus]`)), '단축키 탭이 휴지통 줄을 짚는다');
  r.check((await page.locator(sel('shortcut-row', 'scopeMemo')).count()) === 0, '단축키 탭에서 메모 화면 줄이 빠졌다 (키가 없다)');

  r.section('창 안 탭 (P18-2) - 환경설정 → 알림');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await startRecord();
  await waitFor(bar('pick'));
  await page.click(sel('more-menu'));
  await page.click(sel('menu-item', 'settings'));
  r.check(await waitFor(page.locator(sel('shortcut-record-picked', 'settings'))), "⋮ → 환경설정 = '고른 것: 환경설정'");
  const tabOutline = await page.locator(sel('settings-tab', 'notify')).evaluate((el) => getComputedStyle(el).outlineStyle);
  r.check(tabOutline === 'dashed', `창 안 탭에도 점선 테두리 (알림 탭 = ${tabOutline})`);
  await page.click(sel('settings-tab', 'notify'));
  r.check(await waitFor(page.locator(sel('shortcut-record-picked', 'settings:notify'))), "알림 탭 = '고른 것: 환경설정 → 알림' (마지막에 누른 것)");
  const pickedTab = await page.locator(sel('shortcut-record-picked')).textContent();
  r.check(pickedTab?.includes('환경설정 → 알림'), `띠 글자 (${pickedTab})`);
  r.check((await page.getAttribute(sel('settings-tab', 'notify'), 'aria-selected')) === 'true', '누른 탭은 그대로 열린다');
  await page.click(sel('shortcut-record-done'));
  await page.keyboard.press('Control+Alt+KeyN');
  r.check((await page.locator(sel('shortcut-record-key')).textContent()) === 'Ctrl + Alt + N', 'Ctrl+Alt+N');
  await page.click(sel('shortcut-record-save'));
  const tabSaved = await serverUntil(serverPc, (d) => d.tabShortcuts?.['settings:notify']?.key === 'N');
  r.check(
    JSON.stringify(tabSaved.tabShortcuts) === JSON.stringify({ 'settings:notify': { ctrl: true, alt: true, shift: false, key: 'N' } }),
    `계정 settings/pc tabShortcuts에 올라간다 (${JSON.stringify(tabSaved.tabShortcuts)})`,
  );
  r.check(!tabSaved.shortcutOverrides?.settings, '기능 키(shortcutOverrides)와 섞이지 않는다');
  const tabRow = `${sel('shortcut-group', '창 안 탭')} ${sel('shortcut-row', 'settings:notify')}`;
  r.check(await waitFor(page.locator(`${tabRow}[data-shortcut-row-focus]`)), "단축키 탭 '내가 만든 단축키'에 그 줄 (짚는다)");
  r.check((await page.locator(tabRow).textContent())?.includes('환경설정 → 알림'), '줄 이름 = 환경설정 → 알림');

  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+Alt+KeyN');
  r.check(await waitFor(async () => (await page.getAttribute(sel('settings-tab', 'notify'), 'aria-selected')) === 'true'), '열린 환경설정에서 그 키 = 알림 탭으로');
  await page.click(sel('settings-tab', 'view'));
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+Alt+KeyN');
  r.check(await waitFor(async () => (await page.getAttribute(sel('settings-tab', 'notify'), 'aria-selected')) === 'true'), '다른 탭을 눌렀어도 그 키 = 다시 알림 탭 (같은 탭으로 다시 열기)');
  const tip = await page.getAttribute(sel('settings-tab', 'notify'), 'title');
  r.check(tip?.includes('Ctrl + Alt + N'), `알림 탭 툴팁에 키 (${tip})`);
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+Alt+KeyN');
  r.check(await waitFor(page.locator(`${sel('settings-tab', 'notify')}[aria-selected="true"]`)), '닫혀 있으면 그 키 = 환경설정을 알림 탭으로 연다');
  await page.evaluate(() => window.sp5.openWindow('help', { topic: 'shortcuts' }));
  r.check(await waitFor(page.locator(sel('help-shortcut', 'settings:notify'))), "설명서 단축키 표 '내가 만든 단축키'");
  const helpTab = await page.locator(sel('help-shortcut', 'settings:notify')).textContent();
  r.check(helpTab?.includes('환경설정 → 알림') && helpTab?.includes('Ctrl + Alt + N'), `설명서 표 줄 (${helpTab})`);
  await page.evaluate(() => window.sp5.closeAllWindows());

  r.section('창 안 탭 - 휴지통 → 메모 (창 단추 다음에 탭)');
  await startRecord();
  await waitFor(bar('pick'));
  await page.click(sel('header-trash'));
  await waitFor(page.locator(sel('trash-tab', 'memo')));
  await page.click(sel('trash-tab', 'memo'));
  r.check(await waitFor(page.locator(sel('shortcut-record-picked', 'trash:memo'))), "🗑️ → 메모 탭 = '고른 것: 휴지통 → 메모'");
  await page.click(sel('shortcut-record-done'));
  await page.keyboard.press('Control+Alt+KeyM');
  await page.click(sel('shortcut-record-save'));
  await serverUntil(serverPc, (d) => d.tabShortcuts?.['trash:memo']?.key === 'M');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+Alt+KeyM');
  r.check(await waitFor(page.locator(`${sel('trash-tab', 'memo')}[aria-selected="true"]`)), 'Ctrl+Alt+M = 휴지통이 메모 탭으로 열린다');

  r.section('키 바꾸기 · 해제 (P28-1 - 단축키 탭 줄)');
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'shortcuts' }));
  await waitFor(page.locator(tabRow));
  await page.click(`${sel('shortcut-row', 'timetable')} ${sel('shortcut-change', 'timetable')}`);
  r.check(await waitFor(bar('key')), "키 바꾸기 = 고르기 없이 띠의 키 단계 ('시간표')");
  r.check(((await page.locator(sel('shortcut-record', 'key')).textContent()) ?? '').includes("'시간표'"), '띠에 그 이름');
  r.check((await page.locator(sel('settings-window')).count()) === 1, '환경설정 창은 열린 채');
  await page.keyboard.press('Control+Alt+KeyY');
  await page.click(sel('shortcut-record-save'));
  const changed = await serverUntil(serverPc, (d) => d.shortcutOverrides?.timetable?.key === 'Y');
  r.check(changed.shortcutOverrides?.timetable?.key === 'Y', '계정 = Ctrl + Alt + Y');
  r.check(await waitFor(async () => (await rowKey('timetable')) === 'Ctrl + Alt + Y'), '그 줄 = Ctrl + Alt + Y');
  await page.click(sel('shortcut-clear', 'settings:notify'));
  const cleared = await serverUntil(serverPc, (d) => !d.tabShortcuts?.['settings:notify']);
  r.check(JSON.stringify(cleared.tabShortcuts) === JSON.stringify({ 'trash:memo': { ctrl: true, alt: true, shift: false, key: 'M' } }), `해제 = 알림 탭 키만 곧바로 빠진다 (${JSON.stringify(cleared.tabShortcuts)})`);
  r.check(await waitFor(async () => (await page.locator(tabRow).count()) === 0), '그 줄이 빠진다');
  await page.locator(sel('toast')).filter({ hasText: '해제했습니다' }).last().locator('[data-toast-action="되돌리기"]').click();
  r.check(!!(await serverUntil(serverPc, (d) => !!d.tabShortcuts?.['settings:notify'])).tabShortcuts?.['settings:notify'], '안내의 되돌리기 = 다시 걸린다');
  await page.click(sel('shortcut-clear', 'settings:notify'));
  await serverUntil(serverPc, (d) => !d.tabShortcuts?.['settings:notify']);
  await page.evaluate(() => window.sp5.closeAllWindows());

  r.section('환경설정 값 (P28-2) - 창 위치 → 팝업창 · 고대비');
  const setStyle = (v) => page.evaluate(async (v) => (await import(window.__appModule('/src/app/layoutPrefs.ts'))).setPopupStyle(v), v);
  const styleNow = () => page.evaluate(async () => (await import(window.__appModule('/src/app/layoutPrefs.ts'))).useLayoutPrefs.getState().popupStyle);
  const lastToast = async () => (await page.locator(sel('toast')).last().textContent().catch(() => '')) ?? '';
  await page.evaluate(() => window.sp5.closeAllWindows());
  // 팝업창 모드에서 고른다 - 고르는 동안 연 창은 큰 창 안에 떠야 그 안을 누른 것을 띠가 본다
  await startRecord();
  await waitFor(bar('pick'));
  await setStyle('popup');
  const pagesBefore = page.context().pages().length;
  await page.click(sel('more-menu'));
  await page.click(sel('menu-item', 'settings'));
  r.check(await waitFor(page.locator(sel('settings-tab', 'view'))), '팝업창 모드여도 고르는 동안 환경설정은 큰 창 안에');
  r.check(page.context().pages().length === pagesBefore, `브라우저 팝업창은 뜨지 않는다 (창 ${page.context().pages().length}개)`);
  await page.click(sel('settings-tab', 'view'));
  const choiceOutline = await page.locator(sel('choice', 'popupStyle:popup')).evaluate((el) => getComputedStyle(el).outlineStyle);
  r.check(choiceOutline === 'dashed', `값 단추에 점선 테두리 (팝업창 = ${choiceOutline})`);
  const toggleOutline = await page.locator(sel('settings-toggle', 'contrast')).evaluate((el) => getComputedStyle(el.closest('label')).outlineStyle);
  r.check(toggleOutline === 'dashed', `켜기/끄기 줄에도 (고대비 = ${toggleOutline})`);
  await page.click(sel('choice', 'popupStyle:popup'));
  r.check(await waitFor(page.locator(sel('shortcut-record-picked', 'opt.popupStyle.popup'))), "창 위치 팝업창 = '고른 것: 창 위치 → 팝업창'");
  const pickedOpt = await page.locator(sel('shortcut-record-picked')).textContent();
  r.check(pickedOpt?.includes('창 위치 → 팝업창'), `띠 글자 (${pickedOpt})`);
  // 저장하면 단축키 탭을 다시 연다 - 오른쪽 칸으로 두고 저장한다(팝업창이면 브라우저 창이 뜬다)
  await setStyle('side');
  await page.click(sel('shortcut-record-done'));
  await page.keyboard.press('Control+Alt+KeyP');
  r.check((await page.locator(sel('shortcut-record-key')).textContent()) === 'Ctrl + Alt + P', 'Ctrl+Alt+P');
  await page.click(sel('shortcut-record-save'));
  const optSaved = await serverUntil(serverPc, (d) => d.customShortcuts?.['opt.popupStyle.popup']?.key === 'P');
  r.check(
    JSON.stringify(optSaved.customShortcuts) === JSON.stringify({ 'opt.popupStyle.popup': { ctrl: true, alt: true, shift: false, key: 'P' } }),
    `계정 settings/pc customShortcuts에 올라간다 (${JSON.stringify(optSaved.customShortcuts)})`,
  );
  r.check(!optSaved.tabShortcuts?.['opt.popupStyle.popup'], '창 안 탭 칸(tabShortcuts)과 섞이지 않는다');
  const optRow = `${sel('shortcut-group', '환경설정 값')} ${sel('shortcut-row', 'opt.popupStyle.popup')}`;
  r.check(await waitFor(page.locator(`${optRow}[data-shortcut-row-focus]`)), "단축키 탭 '내가 만든 단축키 (환경설정 값)'에 그 줄 (짚는다)");
  r.check((await page.locator(optRow).textContent())?.includes('창 위치 → 팝업창'), '줄 이름 = 창 위치 → 팝업창');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  const pagesNow = page.context().pages().length;
  await page.keyboard.press('Control+Alt+KeyP');
  r.check(await waitFor(async () => (await styleNow()) === 'popup'), 'Ctrl+Alt+P = 창 위치가 팝업창으로');
  r.check(await waitFor(async () => (await lastToast()).includes('⚙️ 창 위치: 팝업창')), `안내 '⚙️ 창 위치: 팝업창' (${await lastToast()})`);
  r.check((await page.locator(sel('settings-window')).count()) === 0 && page.context().pages().length === pagesNow, '창은 열지 않는다 (값만)');
  r.check((await serverUntil(serverPc, (d) => d.popupStyle === 'popup')).popupStyle === 'popup', '계정에도 팝업창');
  await page.keyboard.press('Control+Alt+KeyP');
  r.check(await waitFor(async () => (await styleNow()) === 'side'), '다시 누르면 = 앞 값(오른쪽 칸)으로');
  r.check(await waitFor(async () => (await lastToast()).includes('⚙️ 창 위치: 오른쪽 칸')), `안내 '⚙️ 창 위치: 오른쪽 칸' (${await lastToast()})`);
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'view' }));
  const optTip = await page.getAttribute(sel('choice', 'popupStyle:popup'), 'title');
  r.check(optTip?.includes('Ctrl + Alt + P'), `팝업창 단추 툴팁에 키 (${optTip})`);
  await page.evaluate(() => window.sp5.openWindow('help', { topic: 'shortcuts' }));
  r.check(await waitFor(page.locator(sel('help-shortcut', 'opt.popupStyle.popup'))), "설명서 단축키 표 '내가 만든 단축키 (환경설정 값)'");
  const helpOpt = await page.locator(sel('help-shortcut', 'opt.popupStyle.popup')).textContent();
  r.check(helpOpt?.includes('창 위치 → 팝업창') && helpOpt?.includes('Ctrl + Alt + P'), `설명서 표 줄 (${helpOpt})`);
  await page.evaluate(() => window.sp5.closeAllWindows());

  // 고대비 = 켜기/끄기 줄을 눌러 고른다 → 키는 늘 뒤집는다
  const hc = () => page.evaluate(() => document.documentElement.classList.contains('hc'));
  await startRecord();
  await waitFor(bar('pick'));
  await page.click(sel('more-menu'));
  await page.click(sel('menu-item', 'settings'));
  await page.click(sel('settings-tab', 'view'));
  // P26-1: 전체 점검에서 한 번 이 줄부터 셋이 틀렸다(혼자는 늘 통과) - 다시 나면 까닭을 가르게 누르기 전 값·칸 표시를 함께 적는다
  const hcBefore = await hc();
  const boxBefore = await page.locator(sel('settings-toggle', 'contrast')).isChecked();
  await page.locator(sel('settings-toggle', 'contrast')).click();
  r.check(await waitFor(page.locator(sel('shortcut-record-picked', 'opt.contrast'))), "고대비 줄 = '고른 것: 고대비 켜기 / 끄기'");
  r.check(await hc(), `누른 것은 그대로 (고대비가 켜졌다 - 누르기 전 html ${hcBefore} · 칸 ${boxBefore} → 칸 ${await page.locator(sel('settings-toggle', 'contrast')).isChecked()})`);
  await page.click(sel('shortcut-record-done'));
  await page.keyboard.press('Control+Alt+KeyH');
  await page.click(sel('shortcut-record-save'));
  await serverUntil(serverPc, (d) => d.customShortcuts?.['opt.contrast']?.key === 'H');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+Alt+KeyH');
  r.check(await waitFor(async () => !(await hc())), 'Ctrl+Alt+H = 고대비 끄기');
  await page.keyboard.press('Control+Alt+KeyH');
  r.check(await waitFor(hc), '다시 = 켜기 (늘 뒤집는다)');
  await page.keyboard.press('Control+Alt+KeyH');
  await waitFor(async () => !(await hc()));

  r.section('그 밖의 단추 (P28-3) - 메모 화면 카드/목록 · 카드 안 단추는 못 건다');
  const pickedId = async () => (await page.locator(sel('shortcut-record-picked')).getAttribute('data-shortcut-record-picked').catch(() => '')) ?? '';
  const keyOf = async (id) => (await serverPc()).customShortcuts?.[id]?.key;
  await page.evaluate(() => window.sp5.closeAllWindows());
  await open(page, '#/memo');
  await waitFor(page.locator(sel('memo-screen')));
  const viewNow = () => page.locator(sel('memo-view-toggle')).getAttribute('data-memo-view-toggle');
  if ((await viewNow()) !== 'card') await page.click(sel('memo-view-toggle'));
  await waitFor(async () => (await viewNow()) === 'card');
  await startRecord();
  await waitFor(bar('pick'));
  if ((await page.locator(sel('entry-collapse')).count()) > 0) {
    await page.locator(sel('entry-collapse')).first().click();
    r.check(await waitFor(page.locator(sel('shortcut-record-miss'))), '카드 안 단추(접기 ▼) = 만들 수 없다');
    const why = (await page.locator(sel('shortcut-record-miss')).textContent()) ?? '';
    r.check(why.includes('항목(날짜)마다'), `까닭 = 항목(날짜)마다 다른 단추 (${why})`);
    r.check((await pickedId()) === '', '고른 것은 없다');
    await page.locator(sel('entry-collapse')).first().click();
  } else r.check(false, '메모 카드가 없다 - seed부터');
  await page.click(sel('memo-view-toggle'));
  const viewPid = await pickedId();
  r.check(viewPid.startsWith('press.'), `머리줄 카드/목록 단추 = 그 단추를 고른다 (${viewPid})`);
  r.check((await pickedText()).includes('머리줄 →'), `띠 글자 (${await pickedText()})`);
  r.check((await page.locator(sel('shortcut-record-miss')).count()) === 0, '만들 수 없다는 안내는 걷힌다');
  r.check(await waitFor(async () => (await viewNow()) === 'list'), '누른 것은 그대로 (목록 보기로)');
  await page.click(sel('shortcut-record-done'));
  await page.keyboard.press('Control+Alt+KeyL');
  await page.click(sel('shortcut-record-save'));
  const viewSaved = await serverUntil(serverPc, (d) => d.customShortcuts?.[viewPid]?.key === 'L' && !!d.pressTargets?.[viewPid]);
  const viewTarget = viewSaved.pressTargets?.[viewPid];
  r.check(viewTarget?.screen === 'memo' && viewTarget?.attr === 'data-memo-view-toggle' && !viewTarget?.value, `계정 pressTargets = 메모 화면 · 이름만 (${JSON.stringify(viewTarget)})`);
  const pressRow = `${sel('shortcut-group', '단추')} ${sel('shortcut-row', viewPid)}`;
  r.check(await waitFor(page.locator(`${pressRow}[data-shortcut-row-focus]`)), "단축키 탭 '내가 만든 단축키 (단추 대신 누르기)'에 그 줄 (짚는다)");
  await page.evaluate(() => window.sp5.closeAllWindows());
  await open(page, '#/day/2026-10-08');
  await waitFor(page.locator('[data-screen="day"]'));
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+Alt+KeyL');
  r.check(await waitFor(page.locator('[data-screen="memo"]')), '하루 화면에서 Ctrl+Alt+L = 메모 화면으로 가서');
  r.check(await waitFor(async () => (await viewNow()) === 'card'), '그 단추를 대신 누른다 (목록 → 카드)');
  await page.keyboard.press('Control+Alt+KeyL');
  r.check(await waitFor(async () => (await viewNow()) === 'list'), '메모 화면에서 다시 = 또 누른다 (카드 → 목록)');
  await page.keyboard.press('Control+Alt+KeyL');
  await waitFor(async () => (await viewNow()) === 'card');

  r.section('그 밖의 단추 - 창 안 (검색 → 메모 칩) · 닫혀 있으면 열고 · 팝업창이면 팝업창 안에서');
  // 칩 규칙: 아무것도 안 고름 = 전체 켬 · 메모를 누르면 메모만(전체 꺼짐) · 다시 누르면 다시 전체 - '전체' 칩으로 본다
  const allOn = (p = page) => p.locator(sel('search-kind', 'all')).getAttribute('aria-pressed');
  await startRecord();
  await waitFor(bar('pick'));
  await page.click(sel('header-search'));
  await waitFor(page.locator(sel('search-kind', 'memo')));
  r.check((await allOn()) === 'true', '검색 창을 새로 열면 전체');
  await page.click(sel('search-kind', 'memo'));
  const kindPid = await pickedId();
  r.check(kindPid.startsWith('press.') && (await pickedText()).includes('검색 → 메모'), `검색 창 메모 칩 = '검색 → 메모' (${await pickedText()})`);
  await page.click(sel('shortcut-record-done'));
  await page.keyboard.press('Control+Alt+KeyK');
  await page.click(sel('shortcut-record-save'));
  const kindSaved = await serverUntil(serverPc, (d) => !!d.pressTargets?.[kindPid]);
  const kindTarget = kindSaved.pressTargets?.[kindPid];
  r.check(kindTarget?.win === 'search' && kindTarget?.value === 'memo' && !kindTarget?.only, `계정 = 검색 창 · 이름 = 값(칩이 여럿) · 열 수 있음 (${JSON.stringify(kindTarget)})`);
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+Alt+KeyK');
  r.check(await waitFor(page.locator(sel('search-kind', 'memo'))), '닫혀 있으면 Ctrl+Alt+K = 검색 창을 열고');
  r.check(await waitFor(async () => (await allOn()) === 'false'), '뜨면 메모 칩을 누른다 (메모만)');
  await page.keyboard.press('Control+Alt+KeyK');
  r.check(await waitFor(async () => (await allOn()) === 'true'), '열려 있으면 곧바로 누른다 (다시 전체)');
  await page.evaluate(() => window.sp5.closeAllWindows());
  // 창 위치 팝업창 - 검색 창이 브라우저 팝업창으로 뜨고, 그 안의 칩을 '누르기' 소식으로 누른다
  await setStyle('popup');
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  const popWait = page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null);
  await page.keyboard.press('Control+Alt+KeyK');
  const pop = await popWait;
  r.check(!!pop, '팝업창 모드 = 검색 창이 팝업창으로 뜬다');
  if (pop) {
    r.check(await waitFor(pop.locator(sel('search-kind', 'memo')), 15000), '팝업창에 검색 창');
    r.check(await waitFor(async () => (await allOn(pop)) === 'false', 10000), "팝업창 안의 메모 칩을 누른다 ('누르기' 소식 - 메모만)");
    await page.bringToFront();
    await page.locator('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+Alt+KeyK');
    r.check(await waitFor(async () => (await allOn(pop)) === 'true', 10000), '열린 팝업창이면 그 안에서 또 누른다 (다시 전체 - 같은 부탁은 한 번만)');
    await pop.close().catch(() => {});
  }
  await setStyle('side');

  r.section('그 밖의 단추 - 메모 칸 📎 (열려 있을 때만)');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await open(page, '#/memo');
  await startRecord();
  await waitFor(bar('pick'));
  await page.click(sel('memo-new'));
  await waitFor(page.locator(sel('note-attach')));
  const chooser1 = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
  await page.locator(sel('note-attach')).click();
  await chooser1;
  const attachPid = await pickedId();
  r.check(attachPid.startsWith('press.') && (await pickedText()).includes('메모 → 📎 파일 첨부'), `메모 칸 📎 = '메모 → 📎 파일 첨부' (${await pickedText()})`);
  await page.click(sel('shortcut-record-done'));
  await page.keyboard.press('Control+Alt+KeyU');
  await page.click(sel('shortcut-record-save'));
  const attachSaved = await serverUntil(serverPc, (d) => !!d.pressTargets?.[attachPid]);
  r.check(attachSaved.pressTargets?.[attachPid]?.only === true, `쓰는 칸 = 열려 있을 때만 (${JSON.stringify(attachSaved.pressTargets?.[attachPid])})`);
  // 저장하면 환경설정 단축키 탭이 보이는 탭 - 메모 칸은 숨은 탭으로 남는다
  r.check((await page.locator(sel('note-attach')).count()) === 1, '메모 칸은 열린 채 (숨은 탭)');
  const chooser2 = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+Alt+KeyU');
  r.check(!!(await chooser2), 'Ctrl+Alt+U = 열린 메모 칸의 📎 (파일 고르기 창) - 숨은 탭이어도');
  r.check(await page.locator(sel('note-attach')).isVisible(), '그 메모 칸이 보이는 탭이 된다');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await waitFor(async () => (await page.locator(sel('note-attach')).count()) === 0);
  await page.keyboard.press('Control+Alt+KeyU');
  r.check(await waitFor(async () => (await lastToast()).includes("'메모' 칸이 열려 있을 때")), `닫혀 있으면 열지 않고 안내 (${await lastToast()})`);
  r.check((await page.locator(sel('note-attach')).count()) === 0, '메모 칸을 열지 않는다');
  r.check(!!(await keyOf(viewPid)) && !!(await keyOf(kindPid)) && !!(await keyOf(attachPid)), '세 단추 키 모두 계정에');

  r.section('ESC = 기록 취소');
  await page.evaluate(() => window.sp5.closeAllWindows());
  await startRecord();
  await waitFor(bar('pick'));
  await page.evaluate(() => window.sp5.openWindow('timetable'));
  await waitFor(page.locator(sel('timetable-window')));
  await page.click(sel('more-menu'));
  await page.click(sel('menu-item', 'help'));
  await waitFor(page.locator(sel('shortcut-record-picked', 'help')));
  await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await page.locator(sel('shortcut-record')).count()) === 0), 'ESC = 띠가 걷힌다');
  r.check((await page.locator(sel('timetable-window')).count()) === 1, '열린 창은 그대로 (ESC가 오른쪽 칸을 닫지 않았다)');
  await page.waitForTimeout(1500);
  const after = await serverPc();
  r.check(!after.shortcutOverrides?.help, `취소한 것은 저장하지 않는다 (${JSON.stringify(after.shortcutOverrides)})`);
  const bodyMark = await page.evaluate(() => document.body.dataset.shortcutRecording ?? '');
  r.check(bodyMark === '', '점선 표시도 걷힌다 (body)');

  // P34 (11-12 사용자 'Backspace·Tab 같은 특수 키도 단축키로 - 윈도우·크롬이 먼저 쓰는 키만 빼고')
  r.section('P34 - Backspace·Delete·Tab도 키 · 크롬·윈도우가 먼저 쓰는 키는 막기 · 키 지우기');
  const keyText = async () => ((await page.locator(sel('shortcut-record-key')).textContent()) ?? '').trim();
  const issueText = async () => ((await page.locator(sel('shortcut-record-issue')).textContent().catch(() => '')) ?? '').trim();
  const pickMenu = async (id) => {
    await page.evaluate(() => window.sp5.closeAllWindows());
    await startRecord();
    await waitFor(bar('pick'));
    await page.click(sel('more-menu'));
    await page.click(sel('menu-item', id));
    await waitFor(page.locator(sel('shortcut-record-picked', id)));
    await page.click(sel('shortcut-record-done'));
    await waitFor(bar('key'));
  };
  const toBody = async () => {
    await page.evaluate(() => window.sp5.closeAllWindows());
    await waitFor(async () => (await page.locator(sel('settings-window')).count()) === 0);
    await page.locator('main').click({ position: { x: 5, y: 5 } });
  };
  await open(page, '#/day/2026-10-08');
  await pickMenu('timetable');
  r.check(!((await page.locator(sel('shortcut-record', 'key')).textContent()) ?? '').includes('Backspace = 지우기'), "띠에 'Backspace = 지우기' 안내가 없다");
  await page.keyboard.press('Control+Tab');
  r.check((await issueText()).includes('브라우저가 먼저 가져가는 키') && (await page.locator(sel('shortcut-record-save')).isDisabled()), `Ctrl+Tab = 크롬이 먼저 가져가 저장을 막는다 (${await issueText()})`);
  await page.keyboard.press('Alt+Tab');
  r.check((await issueText()).includes('창 바꾸기'), `Alt+Tab = 윈도우 창 바꾸기라 막는다 (${await issueText()})`);
  await page.keyboard.press('Delete');
  r.check((await keyText()) === 'Delete' && !(await issueText()), `Delete도 키 (${await keyText()})`);
  await page.keyboard.press('F5');
  r.check((await keyText()) === 'F5' && !(await issueText()) && (await page.locator(sel('shortcut-record')).count()) === 1, `F5도 키 - 새로고침되지 않는다 (${await keyText()})`);
  await page.keyboard.press('Backspace');
  r.check((await keyText()) === 'Backspace' && !(await issueText()), `Backspace도 키 - 지우기가 아니다 (${await keyText()})`);
  await page.click(sel('shortcut-record-save'));
  const bsSaved = await serverUntil(serverPc, (d) => d.shortcutOverrides?.timetable?.key === 'Backspace');
  r.check(
    JSON.stringify(bsSaved.shortcutOverrides?.timetable) === JSON.stringify({ ctrl: false, alt: false, shift: false, key: 'Backspace' }),
    `시간표 = Backspace 계정에 (${JSON.stringify(bsSaved.shortcutOverrides?.timetable)})`,
  );
  await toBody();
  await page.keyboard.press('Backspace');
  r.check(await waitFor(page.locator(sel('timetable-window'))), 'Backspace = 시간표 창');
  // 글 칸 안의 Backspace는 글 지우기 (단축키로 가지 않는다)
  await page.evaluate(() => window.sp5.closeAllWindows());
  await waitFor(async () => (await page.locator(sel('timetable-window')).count()) === 0);
  await page.evaluate(() => window.sp5.openWindow('help'));
  const helpSearch = page.locator(sel('help-search'));
  await waitFor(helpSearch);
  await helpSearch.fill('ab');
  await helpSearch.press('Backspace');
  await page.waitForTimeout(500);
  r.check((await helpSearch.inputValue()) === 'a' && (await page.locator(sel('timetable-window')).count()) === 0, `글 칸 안 Backspace = 글 지우기, 시간표를 열지 않는다 (${await helpSearch.inputValue()})`);

  await pickMenu('help');
  await page.keyboard.press('Tab');
  r.check((await keyText()) === 'Tab' && (await waitFor(page.locator(sel('shortcut-record-tab')))), `Tab도 키 + 'Tab으로 단추 사이를 옮겨 다니지 않게' 안내 (${await keyText()})`);
  await page.click(sel('shortcut-record-save'));
  await serverUntil(serverPc, (d) => d.shortcutOverrides?.help?.key === 'Tab');
  await toBody();
  await page.keyboard.press('Tab');
  r.check(await waitFor(page.locator(sel('help-window'))), 'Tab = 사용 설명서');

  // 키 지우기 (전에는 Backspace) - 단축키 탭 줄의 키 바꾸기에서
  await page.evaluate(() => window.sp5.closeAllWindows());
  await page.evaluate(() => window.sp5.openWindow('settings', { tab: 'shortcuts' }));
  await page.locator(`${sel('shortcut-row', 'help')} ${sel('shortcut-change')}`).click();
  await waitFor(bar('key'));
  r.check(await waitFor(page.locator(sel('shortcut-record-clear'))), '키가 있으면 띠에 키 지우기');
  await page.click(sel('shortcut-record-clear'));
  r.check((await keyText()) === '없음', `키 지우기 = 없음 (${await keyText()})`);
  await page.click(sel('shortcut-record-save'));
  const helpCleared = await serverUntil(serverPc, (d) => !d.shortcutOverrides?.help);
  r.check(!helpCleared.shortcutOverrides?.help, `저장하면 사용 설명서 키가 빠진다 (${JSON.stringify(helpCleared.shortcutOverrides)})`);
  r.check(await waitFor(async () => (await page.locator(sel('shortcut-row', 'help')).count()) === 0), '단축키 탭에서 그 줄이 빠진다');

  r.check(a.errors.length === 0, '화면 오류 없음', `화면 오류: ${a.errors.join(' | ')}`);
} catch (e) {
  // 예외가 '✔ 모두 통과'로 끝나지 않게 (P23-2)
  r.check(false, '점검이 도중에 멈췄다', String(e?.stack ?? e));
} finally {
  await browser.close();
  // 창이 1초 뒤 올리는 것이 끝난 뒤에 되돌린다
  await new Promise((res) => setTimeout(res, 1500));
  await undo.run();
  r.done();
  process.exit();
}
