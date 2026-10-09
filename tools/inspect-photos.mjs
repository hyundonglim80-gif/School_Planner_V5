// tools/inspect-photos.mjs - P7-1 ■3: 학생 사진·@이름 학생 태그를 실제 크롬에서 본다.
// 구글 드라이브는 page.route로 흉내 낸다(School_Planner / Students_Poto / 2026-5-2 폴더를 메모리에) - 드라이브 선택창(Picker)은 apis.google.com이라 PC에서.
//   1) 명렬표 📷 사진: 켜야 드라이브를 부른다 · 사진 칸·사진 n/m명 · 빈 칸에 올리기 = 앱 폴더에 '2026-5-2-02-이두리' · 여러 장 업로드(이름으로 짝짓기·결과 띠)
//      · 끌어다 놓기(같은 학생 = 갈아끼우기) · 크게 보기(아래 '사진 바꾸기') · 타일 보기 · 검색 탭의 사진 · 📁 사진 폴더 = 드라이브 그 폴더
//   2) 토큰이 만료돼 있으면 '구글 연결이 끊겨' 줄(로그인 창을 스스로 띄우지 않는다) → 단추 = 그때 불러오기
//   3) 학급 화면 '이름 / 📷 사진'(명렬표와 따로 켠다) · 사진 카드
//   4) 쓰는 칸 '@이름'(초성) → 목록 → Enter = 이름 + 🧑‍🎓 칩, Esc = 목록만, 글에 적은 '#26050203' = 저장할 때 그 학생,
//      '+ 학생 고르기'·칩 ✕ → 서버 studentIds('{classId}/{sid}') · 카드의 학생 칩
//   5) 로그아웃하면 이 기기의 사진 담아 두기(IndexedDB sp5-student-photos)를 지운다
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-photos.mjs
// 에뮬레이터 teacher의 classes를 비우고 점검 학급을 심었다가 끝에 되돌린다. 점검 기록('점검학생…')은 끝에 지운다.
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const browser = await launch();
const ref = (c, id) => doc(em.db, 'spaces', sid, c, id);
const year = (() => {
  const d = new Date();
  return d.getMonth() + 1 >= 3 ? d.getFullYear() : d.getFullYear() - 1;
})();
const yy = String(year % 100).padStart(2, '0');
const CLASS_ID = `${year}-5-2`;
const DAY = `${year}-10-08`;
const startedAt = Date.now();

// ── 드라이브 흉내 ─────────────────────────────────────────
const FOLDER = 'application/vnd.google-apps.folder';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
const drive = { tokenOk: true, files: new Map(), next: 1, created: [], replaced: [], media: 0 };
const addFile = (f) => drive.files.set(f.id, { trashed: false, modifiedTime: new Date().toISOString(), ...f });
addFile({ id: 'SP', name: 'School_Planner', mimeType: FOLDER, parent: null });
addFile({ id: 'ROOT', name: 'Students_Poto', mimeType: FOLDER, parent: 'SP' });
addFile({ id: 'CLS', name: CLASS_ID, mimeType: FOLDER, parent: 'ROOT' });
addFile({ id: 'P1', name: `${CLASS_ID}-01-김하나.png`, mimeType: 'image/png', parent: 'CLS' });
const inClass = () => [...drive.files.values()].filter((f) => f.parent === 'CLS' && !f.trashed).map((f) => f.name);
const shape = (f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime });

async function mockDrive(ctx) {
  await ctx.route(/oauth2\.googleapis\.com\/tokeninfo/, (route) =>
    route.fulfill({ status: drive.tokenOk ? 200 : 400, headers: CORS, json: drive.tokenOk ? { expires_in: 3000 } : { error: 'invalid_token' } }),
  );
  await ctx.route(/www\.googleapis\.com\/(upload\/)?drive\/v3\/files/, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const upload = url.pathname.startsWith('/upload/');
    const idInPath = url.pathname.split('/files/')[1];
    // 목록·찾기
    if (req.method() === 'GET' && !idInPath) {
      const q = url.searchParams.get('q') || '';
      const parent = /'([^']+)' in parents/.exec(q)?.[1];
      const names = [...q.matchAll(/name='((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\(.)/g, '$1'));
      const folderOnly = q.includes(`mimeType='${FOLDER}'`);
      const hits = [...drive.files.values()].filter((f) => !f.trashed && (!parent || f.parent === parent) && (names.length === 0 || names.includes(f.name)) && (!folderOnly || f.mimeType === FOLDER));
      return route.fulfill({ status: 200, headers: CORS, json: { files: hits.map(shape) } });
    }
    // 사진 내려받기
    if (req.method() === 'GET' && idInPath && url.searchParams.get('alt') === 'media') {
      drive.media += 1;
      return route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'image/png' }, body: PNG });
    }
    // 폴더 만들기
    if (req.method() === 'POST' && !upload) {
      const meta = JSON.parse(req.postData() || '{}');
      const id = `F${drive.next++}`;
      addFile({ id, name: meta.name, mimeType: meta.mimeType, parent: meta.parents?.[0] ?? null });
      return route.fulfill({ status: 200, headers: CORS, json: { id } });
    }
    // 새 사진 (multipart: 앞쪽에 메타데이터 JSON)
    if (req.method() === 'POST' && upload) {
      const body = (req.postDataBuffer() ?? Buffer.alloc(0)).toString('latin1');
      const json = /\{"name":.*?"parents":\[[^\]]*\]\}/.exec(body)?.[0] ?? '{}';
      const meta = JSON.parse(Buffer.from(json, 'latin1').toString('utf8'));
      const id = `U${drive.next++}`;
      addFile({ id, name: meta.name, mimeType: meta.mimeType, parent: meta.parents?.[0] ?? null });
      drive.created.push(meta.name);
      return route.fulfill({ status: 200, headers: CORS, json: shape(drive.files.get(id)) });
    }
    // 내용 갈아끼우기
    if (req.method() === 'PATCH' && upload) {
      const f = drive.files.get(idInPath);
      if (f) f.modifiedTime = new Date(Date.now() + drive.next++ * 1000).toISOString();
      drive.replaced.push(f?.name);
      return route.fulfill({ status: 200, headers: CORS, json: f ? shape(f) : {} });
    }
    // 휴지통으로
    if (req.method() === 'PATCH') {
      const f = drive.files.get(idInPath);
      if (f) f.trashed = true;
      return route.fulfill({ status: 200, headers: CORS, json: {} });
    }
    return route.fulfill({ status: 404, headers: CORS, json: {} });
  });
  await ctx.route(/drive\.google\.com\/drive\/folders/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>드라이브</p>' }));
}

const pngFile = (name) => ({ name, mimeType: 'image/png', buffer: PNG });
/** 파일을 끌어다 놓기 (크롬의 진짜 끌기처럼 DragEvent + DataTransfer) */
const dropFiles = (locator, names) =>
  locator.evaluate(
    async (el, { names, b64 }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      for (const n of names) dt.items.add(new File([bytes], n, { type: 'image/png' }));
      el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
      el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    },
    { names, b64: PNG.toString('base64') },
  );

try {
  // 점검 학급 (classes를 비우고 끝에 되돌린다)
  const before = (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs.map((d) => [d.id, d.data()]);
  for (const [id] of before) await deleteDoc(ref('classes', id));
  undo.add(async () => {
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs) await deleteDoc(d.ref);
    for (const [id, data] of before) await setDoc(ref('classes', id), data);
  });
  const student = (s, num, name) => ({ sid: s, num, name, status: 'active' });
  await setDoc(ref('classes', CLASS_ID), {
    year,
    grade: 5,
    num: 2,
    students: [student('p1', 1, '김하나'), student('p2', 2, '이두리'), student('p3', 3, '박세나')],
    authorId: uid,
    deletedAt: null,
    updatedAt: serverTimestamp(),
    v: 1,
    createdAt: Date.now(),
  });
  undo.add(async () => {
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'items'))).docs) {
      if ((d.data().createdAt ?? 0) >= startedAt && String(d.data().text).includes('점검학생')) await deleteDoc(d.ref);
    }
  });

  const { ctx, page, errors, dialogs } = await newPage(browser);
  dialogs.answer = true;
  await mockDrive(ctx);
  await ctx.addInitScript(() => sessionStorage.setItem('sp5-google-token', 'tok'));
  const count = page.locator('[data-roster-photo-count]');
  const countIs = (n) => waitFor(async () => (await count.getAttribute('data-roster-photo-count').catch(() => null)) === String(n), 8000);
  const row = (i) => page.locator(sel('roster-row', i));

  r.section('명렬표 📷 사진');
  await open(page, '#/class');
  await page.locator(sel('class-mode', 'roster')).click();
  await page.locator(sel('roster', CLASS_ID)).waitFor({ timeout: 8000 });
  r.check((await page.locator('[data-roster-table] th').first().textContent()) !== '사진' && drive.media === 0, '사진을 켜기 전에는 사진 칸이 없고 드라이브를 부르지 않는다');
  await page.locator(sel('roster-photos')).click();
  r.check((await page.locator(sel('roster-photos')).getAttribute('aria-pressed')) === 'true', '📷 사진 = 켬');
  r.check(await countIs(1), '사진 1/3명 (앱 폴더 Students_Poto/2026-5-2에서)');
  r.check(await waitFor(row(0).locator('[data-photo] img')), '1번 김하나 줄에 사진');
  r.check(await row(1).locator('[data-photo-empty]').isVisible(), '2번은 빈 사진 칸');

  r.section('한 장 올리기');
  await row(1).locator('[data-photo-file-input]').setInputFiles(pngFile('아무이름.png'));
  r.check(await countIs(2), '빈 칸에 올리기 = 사진 2/3명');
  r.check(inClass().includes(`${CLASS_ID}-02-이두리.png`), `드라이브 학급 폴더에 '${CLASS_ID}-02-이두리.png' (${drive.created.join(', ')})`);

  r.section('여러 장 업로드');
  r.check(await page.locator(sel('photo-bulk-group')).isVisible(), "'사진 여러 장 업로드' 📁 기기 · ☁️ 구글 드라이브");
  await page.locator(sel('photo-bulk-input')).setInputFiles([pngFile('03_박세나.png'), pngFile('모르는사람.png')]);
  const report = page.locator('[data-photo-bulk-report]');
  r.check(await waitFor(report, 8000), '여러 장 결과 띠');
  r.check((await report.getAttribute('data-photo-bulk-report')) === '1' && (await report.textContent()).includes('모르는사람'), `고른 2개 중 1장 · 짝을 못 찾은 파일 이름 (${(await report.textContent()).slice(0, 60)}…)`);
  r.check(await countIs(3), '사진 3/3명');
  r.check(inClass().includes(`${CLASS_ID}-03-박세나.png`), '파일 이름은 앱 약속대로 바꿔 올린다');

  r.section('끌어다 놓기');
  const replacedBefore = drive.replaced.length;
  await dropFiles(page.locator('[data-roster-drop]'), ['2-이두리.png']);
  r.check(await waitFor(() => drive.replaced.length > replacedBefore, 8000), '목록 위에 놓기 = 같은 학생의 사진을 갈아끼운다 (두 장이 되지 않는다)');
  r.check(inClass().filter((n) => n.includes('이두리')).length === 1, '이두리 사진은 한 장');

  r.section('크게 보기');
  await row(0).locator('[data-photo]').click();
  r.check(await waitFor(page.locator(sel('image-viewer'))), '사진을 누르면 크게');
  r.check(await page.locator(sel('photo-replace')).isVisible(), "아래 '📷 사진 바꾸기'·'☁️ 드라이브에서 고르기'");
  await page.keyboard.press('Escape');
  r.check(await waitFor(async () => !(await page.locator(sel('image-viewer')).isVisible())), 'ESC = 사진 창만 닫는다');
  r.check(await page.locator(sel('roster', CLASS_ID)).isVisible(), '명렬표는 그대로');

  r.section('타일·검색·사진 폴더');
  await page.locator(sel('roster-view', 'tile')).click();
  r.check(await waitFor(page.locator('[data-roster-tiles]')), '타일 보기');
  r.check((await page.locator('[data-roster-tile] [data-photo] img').count()) === 3, '타일 셋 모두 사진');
  await page.locator(sel('roster-tab', 'search')).click();
  r.check(await waitFor(page.locator('[data-search-hit] [data-photo] img').first()), '검색 탭 - 고른 학급은 사진과 함께');
  await page.locator(sel('roster-tab', 'manage')).click();
  const popupP = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  await page.locator(sel('roster-photo-folder')).click();
  const popup = await popupP;
  r.check(!!popup && popup.url().includes('/drive/folders/CLS'), `📁 사진 폴더 = 드라이브의 그 학급 폴더 (${popup?.url() ?? '열리지 않음'})`);
  await popup?.close();
  await page.locator(sel('roster-photos')).click();
  r.check(
    (await page.locator(sel('roster-photos')).getAttribute('aria-pressed')) === 'false' && (await waitFor(page.locator('[data-roster-table]'))) && !(await page.locator('[data-roster-table] [data-photo] img').count()),
    '사진을 끄면 목록 보기·사진 칸 없음',
  );

  r.section('구글 연결이 끊겼을 때');
  await page.locator(sel('roster-photos')).click();
  await countIs(3);
  drive.tokenOk = false;
  const popups = [];
  page.on('popup', (p) => popups.push(p));
  await page.reload();
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
  // 학급 화면의 '명렬표' 고름은 이 탭에서만 기억한다 - 다시 연 탭은 학급 도구
  await page.locator(sel('class-mode', 'roster')).click();
  r.check(await waitFor(page.locator(sel('photo-needs-auth')), 8000), "토큰이 만료 = '구글 연결이 끊겨' 줄 (켜 둔 것은 이 기기에 남는다)");
  r.check(popups.length === 0 && (await page.locator(sel('roster-row', 0)).isVisible()), '로그인 창을 스스로 띄우지 않고, 명단은 그대로');
  drive.tokenOk = true;
  await page.locator(sel('photo-auth')).click();
  r.check(await countIs(3), "'구글 연결하고 사진 불러오기' = 그때 불러온다");
  r.check(errors.length === 0, '화면 오류 없음', errors.join(' | '));

  r.section('학급 화면 이름 / 📷 사진');
  await page.locator(sel('class-mode', 'hub')).click();
  await page.locator('[data-class-students]').waitFor({ timeout: 8000 });
  r.check((await page.locator(sel('class-view', 'name')).getAttribute('aria-pressed')) === 'true', '처음은 이름 (명렬표의 사진 켬과 따로)');
  await page.locator(sel('class-view', 'photo')).click();
  r.check(await waitFor(page.locator('[data-class-photo-grid] [data-photo] img').nth(2), 8000), '📷 사진 = 사진 카드 셋');
  r.check((await page.locator('[data-class-photo-count]').getAttribute('data-class-photo-count')) === '3', '사진 3/3명');

  r.section('@이름 학생 태그');
  await page.goto(page.url().split('#')[0] + `#/day/${DAY}`);
  await page.locator(sel('day-journal', DAY)).waitFor({ timeout: 8000 });
  await page.locator(sel('journal-add')).click();
  const panel = page.locator(sel('note-panel'));
  await waitFor(panel);
  const input = page.locator(sel('note-text-input'));
  await input.click();
  await page.keyboard.type('점검학생 오늘 @ㄱㅎ');
  const list = page.locator('[data-student-mention]');
  r.check(await waitFor(list), "'@ㄱㅎ' = 학생 목록 (초성)");
  r.check((await list.locator('[data-mention-option]').count()) === 1 && (await list.locator(sel('mention-option', `${CLASS_ID}/p1`)).isVisible()), '김하나 하나');
  await page.keyboard.press('Enter');
  r.check(await waitFor(async () => (await input.inputValue()) === '점검학생 오늘 김하나 '), `Enter = '@ㄱㅎ'가 이름으로 (${JSON.stringify(await input.inputValue())})`);
  r.check(await page.locator(sel('note-student', `${CLASS_ID}/p1`)).isVisible(), '🧑‍🎓 김하나 칩');
  await page.keyboard.type('@');
  r.check(await waitFor(list), "'@'만 쳐도 목록 (그 학급 학생)");
  await page.keyboard.press('Escape');
  r.check(await waitFor(async () => !(await list.isVisible())), 'Esc = 목록만 닫는다');
  r.check(await panel.isVisible(), '쓰는 칸은 그대로');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(`발표 #${yy}050203`);
  await page.locator(sel('note-save')).click();
  const items = async () =>
    (await getDocs(collection(em.db, 'spaces', sid, 'items'))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((d) => !d.deletedAt && String(d.text).includes('점검학생'));
  let saved = await serverUntil(items, (list) => list.length === 1 && (list[0].studentIds?.length ?? 0) === 2);
  r.check(saved.length === 1, '저장 = 문서 하나');
  r.check(JSON.stringify(saved[0]?.studentIds) === JSON.stringify([`${CLASS_ID}/p1`, `${CLASS_ID}/p3`]), `studentIds = 고른 학생 + 글의 '#${yy}050203' (${JSON.stringify(saved[0]?.studentIds)})`);
  r.check(String(saved[0]?.text).includes(`#${yy}050203`) && String(saved[0]?.text).includes('김하나'), '글은 그대로 (태그도 남는다)');
  const card = page.locator(sel('entry-card', saved[0]?.id));
  r.check(await waitFor(card.locator('[data-entry-students="2"]')), '카드에 🧑‍🎓 학생 칩 둘');

  await page.locator(sel('note-student-pick-open')).click();
  await page.locator(sel('note-student-option', `${CLASS_ID}/p2`)).click();
  await page.locator(sel('note-student-remove', `${CLASS_ID}/p1`)).click();
  await page.keyboard.press('Control+s');
  saved = await serverUntil(items, (list) => JSON.stringify(list[0]?.studentIds) === JSON.stringify([`${CLASS_ID}/p3`, `${CLASS_ID}/p2`]));
  r.check(JSON.stringify(saved[0]?.studentIds) === JSON.stringify([`${CLASS_ID}/p3`, `${CLASS_ID}/p2`]), `'+ 학생 고르기'로 더하고 칩 ✕로 빼기 = 그 칸만 (${JSON.stringify(saved[0]?.studentIds)})`);
  const snap = await getDoc(ref('items', saved[0].id));
  r.check(!JSON.stringify(snap.data()?.studentIds).includes('p1'), '태그(#)는 글에 남아도 뺀 학생은 다시 붙지 않는다 (원래 있던 태그는 다시 읽지 않는다)');
  r.check(errors.length === 0, '화면 오류 없음', errors.join(' | '));

  r.section('로그아웃');
  const dbs = () => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  r.check((await dbs()).includes('sp5-student-photos'), '사진은 이 기기에 담아 둔다 (sp5-student-photos)');
  await page.locator(sel('account')).click();
  await page.locator(sel('logout')).click();
  r.check(await waitFor(async () => !(await dbs()).includes('sp5-student-photos'), 8000), '로그아웃 = 사진 담아 두기를 지운다');
  r.check(errors.length === 0, '화면 오류 없음', errors.join(' | '));
} finally {
  await undo.run();
  await browser.close();
  r.done();
  // 에뮬레이터에 붙은 Firebase가 노드를 붙잡아 둔다
  process.exit();
}
