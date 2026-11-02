// tools/inspect-shortcut-record.mjs - P18-1 단축키 설정(메뉴·단추를 눌러 고르기)을 크롬으로 본다.
//   1) 단축키 탭 '⌨️ 단축키 설정' → 환경설정 창이 닫히고 아래 띠 · 고를 수 있는 단추에 점선 테두리
//   2) 표시 없는 단추(수업 접기 ▼)는 '만들 수 없습니다', 칸을 펴는 단추(계정 사진·⋮)는 아무 말 없음 · ⋮ → 시간표 = '고른 것: 시간표'(누른 것은 그대로 동작 - 시간표 창이 열린다)
//   3) 완료 → 누른 키는 앱 단축키로 가지 않는다(Shift+2 = 주간으로 안 감) → Ctrl+Alt+T → 저장 → 계정 settings/pc · 환경설정 단축키 탭이 그 줄을 짚는다
//   4) 창을 닫고 Ctrl+Alt+T = 시간표 창 · ⋮ 메뉴 시간표 옆 키 · 사용 설명서 단축키 표
//   5) 겹친 키: 머리줄 🗑️ → Ctrl+F → '검색 열기'에서 뺀다는 안내 → 저장 → search = 없음
//   6) ESC = 기록 취소(열린 창은 그대로, 키는 그대로)
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-shortcut-record.mjs
// 에뮬레이터 teacher 계정의 V5 설정 문서(spaces/u_{uid}/settings/pc)를 쓴다 - 처음 것을 읽어 두고 끝에 되돌린다.
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
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
  r.check(await waitFor(page.locator(sel('shortcut-record-miss'))), "수업 접기 ▼ = '이 단추는 단축키로 만들 수 없습니다'");
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
  await page.keyboard.press('Shift+Digit2');
  r.check((await page.locator(sel('shortcut-record-key')).textContent()) === 'Shift + 2', `누른 키가 칸에 (${await page.locator(sel('shortcut-record-key')).textContent()})`);
  r.check((await page.getAttribute(sel('scope-tab', 'day'), 'aria-pressed')) === 'true', '그 키가 앱 단축키로 가지 않는다 (Shift+2 = 주간으로 안 감)');
  r.check(await waitFor(page.locator(sel('shortcut-record-typing'))), 'Ctrl·Alt 없는 키 = 글 칸 안내');
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
  r.check((await page.inputValue(`${sel('shortcut-row', 'timetable')} ${sel('shortcut-key')}`)) === 'T', '단축키 탭 그 줄 = T');
  const mods = await page.locator(`${sel('shortcut-row', 'timetable')} ${sel('shortcut-mod')}`).evaluateAll((els) => els.filter((e) => e.checked).map((e) => e.dataset.shortcutMod));
  r.check(mods.join() === 'Ctrl,Alt', `Ctrl·Alt 체크 (${mods.join()})`);

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
  await page.keyboard.press('Control+KeyF');
  const conflict = await page.locator(sel('shortcut-record-conflict')).textContent().catch(() => '');
  r.check(conflict.includes('검색 열기'), `저장 전에 알린다 (${conflict})`);
  await page.click(sel('shortcut-record-save'));
  const moved = await serverUntil(serverPc, (d) => d.shortcutOverrides?.trash?.key === 'F');
  r.check(moved.shortcutOverrides?.trash?.key === 'F' && moved.shortcutOverrides?.search?.key === '', `휴지통 = Ctrl+F, 검색 열기 = 없음 (${JSON.stringify(moved.shortcutOverrides)})`);
  r.check(await waitFor(page.locator(`${sel('shortcut-row', 'trash')}[data-shortcut-row-focus]`)), '단축키 탭이 휴지통 줄을 짚는다');
  r.check((await page.inputValue(`${sel('shortcut-row', 'search')} ${sel('shortcut-key')}`)) === '', '단축키 탭 검색 열기 = 없음');

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

  r.check(a.errors.length === 0, '화면 오류 없음', `화면 오류: ${a.errors.join(' | ')}`);
} finally {
  await browser.close();
  // 창이 1초 뒤 올리는 것이 끝난 뒤에 되돌린다
  await new Promise((res) => setTimeout(res, 1500));
  await undo.run();
  r.done();
  process.exit();
}
