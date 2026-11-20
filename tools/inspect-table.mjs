// 메모 표 만들기·고르기 점검 (P48 - 세션마다 늘린다, 구글 흉내 없이 · 날짜에 기대지 않는다).
//   1) ▦ 표 = 빈 표 3 × 3 → A1부터 친다 · Tab = 옆 칸 · 마지막 칸 Tab = 새 행 · 고치던 글도 Ctrl+S에 → 서버 tables → 카드에 표
//   2) ▦ 표만 만들고 비워 두면 표 없이 (글만 저장)
//   3) 고르기: A·B·C / 1·2·3 띠 · 칸 이름 줄 · ESC = 고르기 상태 · 방향키·Shift+방향키·Shift+누르기·열 머리 · Delete · ↶·Ctrl+Z ·
//      표 안 키가 앱 단축키(숫자 화면 이동·Space 한눈에·Ctrl+Z 저장 되돌리기)로 새지 않는다 · 한글 첫 글자 조합 · ESC 셋째 = 쓰는 칸 닫힘
//   4) 숫자 서식·꾸밈 (P48-2) · 5) 식 (P48-3): 점수 표 =SUM·=AVERAGE·=B2+C2·=RANK(…$…) → 위 칸을 고치면 곧바로 · 칸 이름 줄·칸을 누르면 식 ·
//      범위 안에 행을 넣으면 합계·석차 범위가 늘어남 · 오류 칸 까닭 → 서버 f·v → 카드에 결과 → 검색이 결과 글로 찾는다 → 다시 열면 식
//   6) Σ·채우기·정렬 (P48-4): 합계 머리 아래 Σ = 왼쪽 수 → ⇣ 채우기 D2:D5 → 범위 Σ = 행을 넣어 열마다(합계 열은 전체 합) →
//      정렬 ▾ 큰 것부터(제목·합계 줄 그대로, 안내) → ↶ → 다시 정렬 → 서버: 행마다 식이 제 행 → 카드도 그 차례
// 실행: 에뮬레이터 + 개발 서버(npm run dev:emu) 켠 채 node tools/inspect-table.mjs
import { collection, deleteDoc, getDocs } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const browser = await launch();
const DAY = '2026-10-08';
const MARK = '점검표만들기';
const startedAt = Date.now();

const madeHere = async () => {
  const snap = await getDocs(collection(em.db, 'spaces', sid, 'items'));
  return snap.docs.filter((d) => (d.data().createdAt ?? 0) >= startedAt && String(d.data().text).includes(MARK));
};
undo.add(async () => {
  for (const d of await madeHere()) await deleteDoc(d.ref);
});
/** 지금 초점이 든 표 칸 ('행-열' - 표 위에 뜬 글 칸 하나가 그 칸 자리에 선다) */
const focusedCell = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-table-input') ?? null);
const cellTexts = (doc) => doc?.tables?.map((t) => t.rows.map((row) => row.cells.map((c) => c.v)));

try {
  const { page, errors } = await newPage(browser);
  await open(page, `#/day/${DAY}`);
  await page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });

  r.section('▦ 표 = 빈 표 3 × 3 (P48-1)');
  await page.locator(sel('journal-add')).click();
  const panel = page.locator(sel('note-panel'));
  await waitFor(panel);
  await page.keyboard.type(`${MARK} 학급비`);
  await page.locator(sel('note-table-add')).click();
  const table = panel.locator(sel('note-table'));
  r.check(await waitFor(table), '▦ 표 = 본문 아래에 표');
  r.check((await table.locator('td[data-cell]').count()) === 9, `3행 × 3열 (${await table.locator('td[data-cell]').count()}칸)`);
  r.check((await focusedCell(page)) === '0-0', `곧바로 A1을 고친다 (${await focusedCell(page)})`);
  await page.keyboard.type('이름');
  await page.keyboard.press('Tab');
  await page.keyboard.type('금액');
  await page.keyboard.press('Tab');
  r.check((await focusedCell(page)) === '0-2', 'Tab = 옆 칸');
  await page.keyboard.press('Tab');
  r.check((await focusedCell(page)) === '1-0', '줄 끝 Tab = 다음 줄 첫 칸');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  r.check((await focusedCell(page)) === '2-2', '마지막 칸');
  await page.keyboard.press('Tab');
  r.check((await table.locator('tbody tr').count()) === 4, `마지막 칸 Tab = 새 행 (${await table.locator('tbody tr').count()}행)`);
  r.check((await focusedCell(page)) === '3-0', `새 행 첫 칸으로 (${await focusedCell(page)})`);
  await page.keyboard.type('합계');
  // 칸을 떠나지 않고 Ctrl+S - 고치던 글도 함께 저장된다
  await page.keyboard.press('Control+s');
  r.check(await waitFor(async () => (await panel.getAttribute('data-note-panel')) === 'edit', 8000), 'Ctrl+S → 수정 칸');
  const id = await panel.getAttribute('data-note-id');
  const saved = await serverUntil(async () => (await madeHere()).find((d) => d.id === id)?.data(), (d) => !!d?.tables);
  const texts = JSON.stringify(cellTexts(saved));
  r.check(texts === '[[["이름","금액",""],["","",""],["","",""],["합계","",""]]]', `서버: 표 칸 (고치던 '합계'까지 - ${texts})`);
  r.check(!!saved?.tables?.[0]?.id?.startsWith('tb_') && JSON.stringify(saved).indexOf('undefined') < 0, '서버: 표 id·빈 값 없음');
  // ESC 셋 = 칸 고치기 멈춤 → 고르기 풀기 → 쓰는 칸 닫기
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await panel.count()) === 0, 5000), 'ESC 셋째에 쓰는 칸이 닫힌다');
  const card = page.locator(sel('entry-card', id));
  r.check(await waitFor(card), '메모 카드');
  r.check(await waitFor(card.locator(sel('entry-table'))), '카드에 표가 작게');

  r.section('▦ 표만 만들고 비워 두면 표 없이');
  await waitFor(async () => (await panel.count()) === 0, 5000);
  await page.locator(sel('journal-add')).click();
  await waitFor(panel);
  await page.keyboard.type(`${MARK} 빈 표`);
  await page.locator(sel('note-table-add')).click();
  await waitFor(table);
  await page.keyboard.press('Escape'); // 칸 고치기 멈춤
  await page.locator(sel('note-text-input')).click();
  await page.keyboard.press('Control+s');
  r.check(await waitFor(async () => (await panel.getAttribute('data-note-panel')) === 'edit', 8000), '저장 → 수정 칸');
  const id2 = await panel.getAttribute('data-note-id');
  const saved2 = await serverUntil(async () => (await madeHere()).find((d) => d.id === id2)?.data(), (d) => !!d);
  r.check(!!saved2 && saved2.tables === undefined, `서버: 글만 (표 칸 없음 - ${JSON.stringify(saved2?.tables)})`);
  r.check(await waitFor(async () => (await table.count()) === 0, 3000), '저장한 뒤 빈 표는 칸에서도 빠진다');
  await page.keyboard.press('Escape');

  r.section('고르기·키·되돌리기 (P48-1 ■3)');
  await waitFor(async () => (await panel.count()) === 0, 5000);
  await page.evaluate(([s, d, i]) => window.sp5.openWindow('note', { sid: s, date: d, id: i, edit: true }), [sid, DAY, id]);
  await waitFor(table);
  const nameBox = () => table.locator(sel('table-name')).getAttribute('data-table-name');
  r.check((await table.locator(sel('table-col')).allTextContents()).join('') === 'ABC', '위 A·B·C 띠');
  r.check((await table.locator(sel('table-row')).allTextContents()).join('') === '1234', '왼쪽 1·2·3·4 띠');
  await table.locator('[data-cell="0-1"]').click();
  r.check((await nameBox()) === 'B1' && (await focusedCell(page)) === '0-1', `칸을 누르면 고치기 + 칸 이름 줄 (${await nameBox()})`);
  await page.keyboard.press('Escape');
  r.check(await panel.isVisible(), 'ESC = 고치기만 멈춘다 (쓰는 칸 그대로)');
  r.check((await focusedCell(page)) === '0-1' && (await table.locator('[data-table-editing]').count()) === 0, '고르기 상태 - 초점은 표 안');
  // 앱 글자 단축키가 끼어들지 않는다: 숫자 2(주간 화면)·Space(한눈에) - 고르기 상태에서 치면 그 칸을 새로 고친다
  const hash0 = new URL(page.url()).hash;
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('2');
  r.check(new URL(page.url()).hash === hash0, `숫자 키가 화면을 옮기지 않는다 (${new URL(page.url()).hash})`);
  r.check((await table.locator('[data-table-editing]').count()) === 1, '고르기 상태에서 글자 = 그 칸을 새로 고치기');
  await page.keyboard.type('0000');
  await page.keyboard.press('Enter');
  r.check((await table.locator('[data-cell="1-1"]').textContent()) === '20000' && (await nameBox()) === 'B3', `Enter = 넣고 아래 칸 (${await nameBox()})`);
  // 한글 첫 글자 조합 (IME - CDP로 조합을 흉내)
  const cdp = await page.context().newCDPSession(page);
  for (const t of ['ㅎ', '하', '한']) await cdp.send('Input.imeSetComposition', { text: t, selectionStart: t.length, selectionEnd: t.length });
  await cdp.send('Input.insertText', { text: '한' });
  for (const t of ['ㄱ', '그', '글']) await cdp.send('Input.imeSetComposition', { text: t, selectionStart: t.length, selectionEnd: t.length });
  await cdp.send('Input.insertText', { text: '글' });
  await page.keyboard.press('Enter');
  r.check((await table.locator('[data-cell="2-1"]').textContent()) === '한글', `한글 첫 글자부터 조합 그대로 (${await table.locator('[data-cell="2-1"]').textContent()})`);
  // 범위: B2에서 Shift+→·Shift+↓ = B2:C3, Delete = 비우기
  await table.locator('[data-cell="1-1"]').click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  r.check((await nameBox()) === 'B2:C3' && (await table.locator('[data-cell-on]').count()) === 4, `Shift+방향키 = 범위 (${await nameBox()})`);
  await page.keyboard.press('Delete');
  r.check((await table.locator('[data-cell="1-1"]').textContent()) === '' && (await table.locator('[data-cell="2-1"]').textContent()) === '', 'Delete = 범위 비우기');
  await page.keyboard.press('Control+z');
  r.check((await table.locator('[data-cell="2-1"]').textContent()) === '한글', 'Ctrl+Z = 표 되돌리기');
  r.check((await panel.getAttribute('data-note-panel')) === 'edit' && (await panel.isVisible()), 'Ctrl+Z가 앱의 저장 되돌리기로 가지 않는다 (쓰는 칸 그대로)');
  await table.locator(sel('table-op', 'undo')).click();
  r.check((await table.locator('[data-cell="2-1"]').textContent()) === '', '↶ = 한 번 더 (한글 넣기 전)');
  r.check((await focusedCell(page)) !== null, '↶를 눌러도 초점은 표 안');
  // Shift+누르기·열 머리
  await table.locator('[data-cell="0-0"]').click();
  await table.locator('[data-cell="3-2"]').click({ modifiers: ['Shift'] });
  r.check((await nameBox()) === 'A1:C4', `Shift+누르기 = 범위 (${await nameBox()})`);
  await table.locator('[data-table-col="1"]').click();
  r.check((await nameBox()) === 'B1:B4', `열 머리 = 그 열 (${await nameBox()})`);
  await table.locator('[data-table-row="3"]').click();
  await table.locator(sel('table-op', 'row-delete')).click();
  r.check((await table.locator('tbody tr').count()) === 3, '행 번호로 고른 행 빼기');
  // ESC: 고르기 풀기 → 셋째 ESC = 쓰는 칸 닫힘 (저장 안 한 것은 묻는다 - 메모는 쓰던 글 보관이 있어 묻지 않는다)
  await table.locator('[data-cell="0-0"]').click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  r.check((await nameBox()) === '' && (await panel.isVisible()), 'ESC 둘째 = 고르기 풀기 (쓰는 칸 그대로)');
  // 저장 안 한 것이 있으면 전역 ESC가 먼저 묻는다(점검은 '아니오') - 저장하고 닫는다
  await page.keyboard.press('Control+s');
  const after = await serverUntil(async () => (await madeHere()).find((d) => d.id === id)?.data(), (d) => d?.tables?.[0]?.rows?.length === 3);
  r.check(after?.tables?.[0]?.rows?.length === 3, `고르기 상태가 풀린 뒤 Ctrl+S = 보이는 칸 저장 (${after?.tables?.[0]?.rows?.length}행)`);
  await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await panel.count()) === 0, 5000), 'ESC 셋째 = 전역 ESC (쓰는 칸 닫힘)');

  r.section('숫자 서식·꾸밈 (P48-2)');
  await page.evaluate(([s, d, i]) => window.sp5.openWindow('note', { sid: s, date: d, id: i, edit: true }), [sid, DAY, id]);
  await waitFor(table);
  const cellAt = (rc) => table.locator(`[data-cell="${rc}"]`);
  const cssOf = (loc) => loc.evaluate((el) => ({ align: getComputedStyle(el).textAlign, weight: getComputedStyle(el).fontWeight, bg: getComputedStyle(el).backgroundColor }));
  // C2에 1234 → Enter → 위로 → 1,000 → 원 (사용자 말 그대로)
  await cellAt('1-2').click();
  await page.keyboard.type('1234');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  r.check((await cssOf(cellAt('1-2'))).align === 'right', '맞춤을 정하지 않은 수 칸 = 오른쪽');
  await table.locator(sel('table-op', 'num-comma')).click();
  r.check((await cellAt('1-2').textContent()) === '1,234', `1,000 = 세 자리 쉼표 (${await cellAt('1-2').textContent()})`);
  await table.locator(sel('table-op', 'num-won')).click();
  r.check((await cellAt('1-2').textContent()) === '1,234원', `원 = 1,234원 (${await cellAt('1-2').textContent()})`);
  r.check((await table.locator(sel('table-op', 'num-won')).getAttribute('aria-pressed')) === 'true', '원 단추가 켜져 보인다');
  r.check((await focusedCell(page)) === '1-2', '단추를 눌러도 초점은 표 안 (고른 칸 그대로)');
  // B2 '20000'도 원 - 키로 옮겨 단추
  await page.keyboard.press('ArrowLeft');
  await table.locator(sel('table-op', 'num-won')).click();
  r.check((await cellAt('1-1').textContent()) === '20,000원', `B2 = 20,000원 (${await cellAt('1-1').textContent()})`);
  // 다시 고치면 원래 수
  await page.keyboard.press('F2');
  r.check((await page.locator(sel('table-input')).inputValue()) === '20000', `다시 고치면 원래 수 (${await page.locator(sel('table-input')).inputValue()})`);
  await page.keyboard.press('Escape');
  // 머리 줄: 행 번호 1 → 굵게 · 맞춤 ▾ 가운데 · 칸 색 ▾ 노랑
  await table.locator('[data-table-row="0"]').click();
  await table.locator(sel('table-op', 'bold')).click();
  await table.locator(sel('table-op', 'align')).click();
  await table.locator(sel('table-op', 'align-center')).click();
  await table.locator(sel('table-op', 'fill')).click();
  await table.locator(sel('table-op', 'fill-yellow')).click();
  const head = await cssOf(cellAt('0-0'));
  r.check(head.weight === '700' && head.align === 'center' && head.bg === 'rgb(254, 249, 195)', `머리 줄 굵게·가운데·노랑 (${JSON.stringify(head)})`);
  r.check((await table.locator(sel('table-op', 'align-center')).count()) === 0, '고르면 ▾가 닫힌다');
  // Ctrl+B = 굵게 (두 번 = 풂)
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Control+b');
  r.check((await cssOf(cellAt('1-0'))).weight === '700', 'Ctrl+B = 굵게');
  await page.keyboard.press('Control+b');
  r.check((await cssOf(cellAt('1-0'))).weight === '400', 'Ctrl+B 한 번 더 = 풂');
  r.check((await panel.isVisible()) && (await focusedCell(page)) === '1-0', 'Ctrl+B가 표 밖으로 새지 않는다');
  // 낮은 표에서도 ▾ 고르기 끝 항목이 잘리지 않는다 (표 상자가 자르던 것)
  await table.locator(sel('table-op', 'fill')).click();
  const lastItem = table.locator(sel('table-op', 'fill-none'));
  r.check(await lastItem.evaluate((el) => { const b = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)); }), '칸 색 ▾ 끝 항목(없음)이 표 아래로 펼쳐져 보인다');
  await lastItem.click();
  await page.keyboard.press('Control+s');
  const fmt = await serverUntil(async () => (await madeHere()).find((d) => d.id === id)?.data(), (d) => d?.tables?.[0]?.rows?.[1]?.cells?.[2]?.v === '1,234원');
  const ft = fmt?.tables?.[0];
  const c2 = ft?.rows?.[1]?.cells?.[2];
  r.check(c2?.v === '1,234원' && c2?.n === 1234 && ft?.styles?.[c2?.s]?.nf === 'won', `서버: C2 v '1,234원' · n 1234 · 서식 원 (${JSON.stringify(c2)})`);
  const a1 = ft?.rows?.[0]?.cells?.[0];
  const headStyle = ft?.styles?.[a1?.s] ?? {};
  r.check(headStyle.b === 1 && headStyle.bg === '#fef9c3' && headStyle.ha === 'center' && Object.keys(headStyle).length === 3, `서버: 머리 칸 서식 (${JSON.stringify(headStyle)})`);
  r.check(JSON.stringify(fmt).indexOf('undefined') < 0 && ft?.styles?.length === 2, `서버: 쓰는 서식만 (${ft?.styles?.length}개)`);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await panel.count()) === 0, 5000), '닫힘');
  const cardTable = card.locator(sel('entry-table'));
  r.check(await waitFor(async () => (await cardTable.locator('[data-cell="1-2"]').textContent()) === '1,234원'), '카드에 1,234원');
  const cardCss = await cssOf(cardTable.locator('[data-cell="1-2"]'));
  const cardHead = await cssOf(cardTable.locator('[data-cell="0-0"]'));
  r.check(cardCss.align === 'right' && cardHead.weight === '700' && cardHead.bg === 'rgb(254, 249, 195)', `카드: 수 오른쪽·머리 굵게·노랑 (${JSON.stringify([cardCss, cardHead])})`);
  // 다시 열기: 보이는 글 그대로, 고치면 원래 수 · 친 수에 원이 입는다
  await page.evaluate(([s, d, i]) => window.sp5.openWindow('note', { sid: s, date: d, id: i, edit: true }), [sid, DAY, id]);
  await waitFor(table);
  r.check((await cellAt('1-2').textContent()) === '1,234원', '다시 열기 = 1,234원');
  await cellAt('1-2').click();
  r.check((await page.locator(sel('table-input')).inputValue()) === '1234', '다시 열어 고치면 1234');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('5000');
  await page.keyboard.press('Enter');
  r.check((await cellAt('1-2').textContent()) === '5,000원', `친 수에 원이 입는다 (${await cellAt('1-2').textContent()})`);
  await table.locator(sel('table-op', 'undo')).click();
  r.check((await cellAt('1-2').textContent()) === '1,234원', '↶ = 1,234원');
  for (let i = 0; i < 2; i++) await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await panel.count()) === 0, 5000), '바뀐 것 없이 ESC = 묻지 않고 닫힘');

  r.section('식 (P48-3)');
  await waitFor(async () => (await panel.count()) === 0, 5000);
  await page.locator(sel('journal-add')).click();
  await waitFor(panel);
  await page.keyboard.type(`${MARK} 점수`);
  await page.locator(sel('note-table-add')).click();
  await waitFor(table);
  const typeCells = async (...vs) => {
    for (const v of vs) {
      await page.keyboard.type(v);
      await page.keyboard.press('Tab');
    }
  };
  const textAt = (rc) => cellAt(rc).textContent();
  // 이름·국어·수학 / 가 90 80 / 나 70 60 / 합계 =SUM (소문자로도) / 평균 =AVERAGE
  await typeCells('이름', '국어', '수학', '가', '90', '80', '나', '70', '60', '합계', '=sum(b2:b3)', '=SUM(C2:C3)', '평균', '=AVERAGE(B2:B3)');
  await page.keyboard.type('=average(c2:c3)');
  await page.keyboard.press('Enter');
  const sums = [await textAt('3-1'), await textAt('3-2'), await textAt('4-1'), await textAt('4-2')];
  r.check(sums.join() === '160,140,80,70', `=SUM·=AVERAGE 결과 (${sums.join(', ')})`);
  r.check((await table.locator(sel('table-name')).textContent()).includes('=AVERAGE(C2:C3)'), `칸 이름 줄에 식 - 대문자로 다듬음 (${await table.locator(sel('table-name')).textContent()})`);
  // 열 둘 더: 총점(D) = B + C · 석차(E) = RANK(…, $D$2:$D$3)
  await table.locator('[data-table-col="2"]').click();
  await table.locator(sel('table-op', 'col-right')).click();
  await table.locator(sel('table-op', 'col-right')).click();
  await cellAt('0-3').click();
  for (const v of ['총점', '=B2+C2', '=b3+c3', '=SUM(D2:D3)']) {
    await page.keyboard.type(v);
    await page.keyboard.press('Enter');
  }
  await cellAt('0-4').click();
  for (const v of ['석차', '=RANK(D2,$D$2:$D$3)', '=RANK(D3,$D$2:$D$3)']) {
    await page.keyboard.type(v);
    await page.keyboard.press('Enter');
  }
  const totals = [await textAt('1-3'), await textAt('2-3'), await textAt('3-3'), await textAt('1-4'), await textAt('2-4')];
  r.check(totals.join() === '170,130,300,1,2', `=B2+C2·=SUM·=RANK (${totals.join(', ')})`);
  await cellAt('1-3').click();
  r.check((await page.locator(sel('table-input')).inputValue()) === '=B2+C2', `식 칸을 누르면 식 (${await page.locator(sel('table-input')).inputValue()})`);
  await page.keyboard.press('Escape');
  r.check((await textAt('1-3')) === '170', '떠나면 결과');
  // 위 칸을 고치면 곧바로: 나 국어 70 → 120 = 총점 180 · 석차가 바뀐다
  await cellAt('2-1').click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('120');
  await page.keyboard.press('Enter');
  const again = [await textAt('3-1'), await textAt('4-1'), await textAt('2-3'), await textAt('1-4'), await textAt('2-4')];
  r.check(again.join() === '210,105,180,2,1', `위 칸을 고치면 합계·평균·총점·석차가 곧바로 (${again.join(', ')})`);
  // 범위 안(3행 위)에 행을 넣으면 합계·석차 범위가 늘어난다
  await table.locator('[data-table-row="2"]').click();
  await table.locator(sel('table-op', 'row-above')).click();
  await typeCells('다', '80', '100');
  await page.keyboard.type('=A3&"점검식결과"');
  await page.keyboard.press('Tab');
  await page.keyboard.type('=B3/0');
  await page.keyboard.press('Enter');
  const grown = [await textAt('4-1'), await textAt('5-1'), await textAt('2-3'), await textAt('2-4')];
  r.check(grown.join() === '290,96.66666667,다점검식결과,#DIV/0!', `행을 넣은 뒤 합계·평균이 새 행까지 · 글 잇기 · 오류 (${grown.join(', ')})`);
  r.check((await cellAt('2-4').getAttribute('title'))?.includes('0으로 나눴습니다'), `오류 칸에 쉬운 까닭 (${await cellAt('2-4').getAttribute('title')})`);
  r.check((await textAt('3-4')) === '1' && (await textAt('1-4')) === '2', '석차 범위도 따라감 ($D$2:$D$4)');
  await page.keyboard.press('Control+s');
  r.check(await waitFor(async () => (await panel.getAttribute('data-note-panel')) === 'edit', 8000), 'Ctrl+S → 수정 칸');
  const fid = await panel.getAttribute('data-note-id');
  const fs1 = await serverUntil(async () => (await madeHere()).find((d) => d.id === fid)?.data(), (d) => d?.tables?.[0]?.rows?.[4]?.cells?.[1]?.v === '290');
  const rows1 = fs1?.tables?.[0]?.rows ?? [];
  const pick = (r1, c1) => {
    const c = rows1[r1]?.cells?.[c1];
    return c ? `${c.f ?? ''}→${c.v}` : '없음';
  };
  const want = {
    B5: ['=SUM(B2:B4)→290', pick(4, 1)],
    B6: ['=AVERAGE(B2:B4)→96.66666667', pick(5, 1)],
    D2: ['=B2+C2→170', pick(1, 3)],
    E4: ['=RANK(D4,$D$2:$D$4)→1', pick(3, 4)],
    D3: ['=A3&"점검식결과"→다점검식결과', pick(2, 3)],
    B3: ['→80', pick(2, 1)],
  };
  const wrong = Object.entries(want).filter(([, [a, b]]) => a !== b);
  r.check(!wrong.length, `서버: 식 f·결과 v (${wrong.length ? JSON.stringify(wrong) : Object.keys(want).join('·')})`);
  r.check(rows1[4]?.cells?.[1]?.n === undefined && JSON.stringify(fs1).indexOf('undefined') < 0, '서버: 결과가 바탕 글과 같으면 n 없음·빈 값 없음');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await panel.count()) === 0, 5000), '닫힘');
  const fcard = page.locator(sel('entry-card', fid)).locator(sel('entry-table'));
  r.check(await waitFor(async () => (await fcard.locator('[data-cell="4-1"]').textContent()) === '290'), '카드에 결과 290');
  // 검색은 결과 글로 찾는다 (식 글이 아니라)
  await page.locator(sel('header-search')).click();
  await waitFor(page.locator(sel('search-window')));
  await page.locator(sel('search-scope')).selectOption('all');
  await page.locator(sel('search-input')).fill('다점검식결과');
  r.check(await waitFor(page.locator(sel('search-hit', fid)), 8000), '검색: 식 결과 글로 찾는다');
  await page.keyboard.press('Escape');
  await waitFor(async () => (await page.locator(sel('search-window')).count()) === 0, 3000);
  // 다시 열기: 칸은 결과, 누르면 식
  await page.evaluate(([s, d, i]) => window.sp5.openWindow('note', { sid: s, date: d, id: i, edit: true }), [sid, DAY, fid]);
  await waitFor(table);
  r.check((await textAt('4-1')) === '290', '다시 열기 = 결과');
  await cellAt('4-1').click();
  r.check((await page.locator(sel('table-input')).inputValue()) === '=SUM(B2:B4)', `다시 열어 누르면 식 (${await page.locator(sel('table-input')).inputValue()})`);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await panel.count()) === 0, 5000), '바뀐 것 없이 ESC = 묻지 않고 닫힘');

  r.section('Σ·채우기·정렬 (P48-4)');
  await page.locator(sel('journal-add')).click();
  await waitFor(panel);
  await page.keyboard.type(`${MARK} 정렬`);
  await page.locator(sel('note-table-add')).click();
  await waitFor(table);
  // 이름·국어·수학 / 가 90 80 / 나 70 95 / 다 85 85 / 라 60 70 (마지막 칸 Tab = 새 행)
  await typeCells('이름', '국어', '수학', '가', '90', '80', '나', '70', '95', '다', '85', '85', '라', '60');
  await page.keyboard.type('70');
  await page.keyboard.press('Enter');
  await table.locator('[data-table-col="2"]').click();
  await table.locator(sel('table-op', 'col-right')).click();
  await cellAt('0-3').click();
  await page.keyboard.type('합계');
  await page.keyboard.press('Enter');
  r.check((await focusedCell(page)) === '1-3', `합계 머리 아래 D2 (${await focusedCell(page)})`);
  // Σ ▾ 합계 = 머리 이름 아래 칸이라 왼쪽 수(국어·수학)를 묶는다
  const op = (name) => table.locator(sel('table-op', name));
  await op('autosum').click();
  r.check((await table.locator('[data-table-op^="autosum-"]').count()) === 5, 'Σ ▾ = 합계·평균·개수·최대·최소');
  await op('autosum-sum').click();
  r.check((await textAt('1-3')) === '170', `Σ 합계 = 170 (${await textAt('1-3')})`);
  r.check((await table.locator(sel('table-name')).textContent()).includes('=SUM(B2:C2)'), `넣은 칸을 골라 칸 이름 줄에 식 (${await table.locator(sel('table-name')).textContent()})`);
  r.check((await focusedCell(page)) === '1-3', 'Σ 뒤에도 표 안 초점 (방향키가 표로)');
  // ⇣ 채우기: D2:D5
  await cellAt('4-3').click({ modifiers: ['Shift'] });
  await op('copy-down').click();
  const filled = [await textAt('2-3'), await textAt('3-3'), await textAt('4-3')];
  r.check(filled.join() === '165,170,130', `⇣ 채우기 = 행마다 합계 (${filled.join(', ')})`);
  // Σ 범위 B2:D5 → 표 끝이라 행을 하나 넣고 열마다 (합계 열은 전체 합)
  await cellAt('1-1').click();
  await cellAt('4-3').click({ modifiers: ['Shift'] });
  await op('autosum').click();
  await op('autosum-sum').click();
  r.check((await table.locator('tbody tr').count()) === 6, `표 끝이면 행을 넣어 (${await table.locator('tbody tr').count()}행)`);
  const colSums = [await textAt('5-1'), await textAt('5-2'), await textAt('5-3')];
  r.check(colSums.join() === '305,330,635', `열마다 합계 (${colSums.join(', ')})`);
  r.check((await table.locator(sel('table-name')).getAttribute('data-table-name')) === 'B6:D6', '넣은 칸을 고른다 (B6:D6)');
  r.check(await waitFor(page.locator('[data-toast]', { hasText: '6행을 넣어 적었습니다' }), 3000), '행을 넣었다는 안내');
  await cellAt('5-0').click();
  await page.keyboard.type('합계');
  await page.keyboard.press('Enter');
  // 정렬 ▾ 큰 것부터: D3을 골라 - 제목 줄·합계 줄은 그대로, 같은 점수는 처음 차례
  await cellAt('2-3').click();
  await page.keyboard.press('Escape');
  await op('sort').click();
  await op('sort-desc').click();
  const names = async () => (await table.locator('td[data-cell$="-0"]').allTextContents()).join(',');
  r.check((await names()) === '이름,가,다,나,라,합계', `합계 큰 것부터 (${await names()})`);
  r.check(await waitFor(page.locator('[data-toast]', { hasText: '2~5행을 D열 큰 것부터 정렬했습니다' }), 3000), '정렬한 행·열 안내');
  r.check((await table.locator(sel('table-name')).getAttribute('data-table-name')) === 'D3', '고른 칸 그대로 (D3)');
  await op('undo').click();
  r.check((await names()) === '이름,가,나,다,라,합계', `↶ = 정렬 전 (${await names()})`);
  await op('sort').click();
  await op('sort-desc').click();
  await page.keyboard.press('Control+s');
  r.check(await waitFor(async () => (await panel.getAttribute('data-note-panel')) === 'edit', 8000), 'Ctrl+S → 수정 칸');
  const sid4 = await panel.getAttribute('data-note-id');
  const fs4 = await serverUntil(async () => (await madeHere()).find((d) => d.id === sid4)?.data(), (d) => d?.tables?.[0]?.rows?.[2]?.cells?.[0]?.v === '다');
  const rows4 = fs4?.tables?.[0]?.rows ?? [];
  const at4 = (rr, cc) => {
    const c = rows4[rr]?.cells?.[cc];
    return c ? `${c.f ?? ''}→${c.v}` : '없음';
  };
  const want4 = {
    A3: ['→다', at4(2, 0)],
    D3: ['=SUM(B3:C3)→170', at4(2, 3)],
    D4: ['=SUM(B4:C4)→165', at4(3, 3)],
    B6: ['=SUM(B2:B5)→305', at4(5, 1)],
    D6: ['=SUM(D2:D5)→635', at4(5, 3)],
  };
  const wrong4 = Object.entries(want4).filter(([, [a, b]]) => a !== b);
  r.check(!wrong4.length, `서버: 정렬한 행의 식이 제 행·합계 그대로 (${wrong4.length ? JSON.stringify(wrong4) : Object.keys(want4).join('·')})`);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
  r.check(await waitFor(async () => (await panel.count()) === 0, 5000), '닫힘');
  const scard = page.locator(sel('entry-card', sid4)).locator(sel('entry-table'));
  r.check(await waitFor(async () => (await scard.locator('[data-cell="2-0"]').textContent()) === '다'), '카드도 정렬한 차례');

  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  await undo.run();
  r.done();
  process.exit();
}
