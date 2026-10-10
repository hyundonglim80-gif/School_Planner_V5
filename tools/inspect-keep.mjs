// tools/inspect-keep.mjs - P8-3 ■3: 백업 창 '가져오기' 탭의 구글 Keep 메모 가져오기를 실제 크롬에서 본다.
//   Takeout 파일(.json·사진·.html)을 고르면 메모 수·미리보기(새로/고쳐 씀/건너뜀) → 가져오기 = 메모(date null)·keepId·라벨·드라이브 첨부·체크 줄
//   다시 고르면 건너뜀 · 글을 고친 파일은 고쳐 씀 · 백업 탭에 Keep 파일을 넣으면 Keep 칸으로 넘어온다. 드라이브는 page.route 흉내.
//
//   npm run emu · npm run dev:emu (켜 둔다) → npm run seed → node tools/inspect-keep.mjs
import { collection, deleteDoc, getDocs } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const undo = restorer();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const browser = await launch();
const T1 = 1893456000000; // 2030-01-01 - 다른 자료와 겹치지 않는 '만든 때'
const LABEL = 'Keep점검라벨';

const keepItems = async () => (await getDocs(collection(em.db, 'spaces', sid, 'items'))).docs.filter((d) => String(d.data().keepId ?? '').startsWith('keep_18934'));
const keepLabel = async () => (await getDocs(collection(em.db, 'spaces', sid, 'labels'))).docs.filter((d) => d.data().name === LABEL);
undo.add(async () => {
  for (const d of await keepItems()) await deleteDoc(d.ref);
  for (const d of await keepLabel()) await deleteDoc(d.ref);
});

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': 'Location' };
const drive = { uploads: [] };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
async function mockDrive(ctx) {
  await ctx.route(/oauth2\.googleapis\.com\/tokeninfo/, (route) => route.fulfill({ status: 200, headers: CORS, json: { expires_in: 3000 } }));
  await ctx.route(/www\.googleapis\.com\/(upload\/)?drive\/v3\/files/, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = req.url();
    if (url.includes('/permissions')) return route.fulfill({ status: 200, headers: CORS, json: {} });
    if (url.includes('uploadType=resumable')) {
      drive.uploads.push(JSON.parse(req.postData() || '{}'));
      return route.fulfill({ status: 200, headers: { ...CORS, Location: `https://upload.mock.test/k/${drive.uploads.length}` }, body: '' });
    }
    return route.fulfill({ status: 200, headers: CORS, json: { files: [{ id: 'FOLDER_SP' }] } });
  });
  await ctx.route(/upload\.mock\.test\/k\/(\d+)/, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const n = route.request().url().split('/').pop();
    return route.fulfill({ status: 200, headers: CORS, json: { id: `KEEPUP${n}`, name: drive.uploads[Number(n) - 1]?.name } });
  });
  await ctx.route(/drive\.google\.com\/thumbnail/, (route) => route.fulfill({ status: 200, headers: { ...CORS, 'Content-Type': 'image/png' }, body: PNG }));
}

const json = (name, data) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data), 'utf8') });
const usec = (ms) => ms * 1000;
const files = (firstText = '3시 상담') => [
  json('상담.json', { title: 'Keep점검 상담', textContent: firstText, labels: [{ name: LABEL }], createdTimestampUsec: usec(T1), isTrashed: false, isArchived: false }),
  json('준비물.json', {
    title: 'Keep점검 준비물',
    listContent: [
      { text: '색종이', isChecked: true },
      { text: '풀', isChecked: false },
    ],
    attachments: [{ filePath: 'Pic_1.JPG', mimetype: 'image/jpeg' }],
    createdTimestampUsec: usec(T1 + 1000),
    isTrashed: false,
    isArchived: false,
  }),
  json('지운것.json', { title: 'Keep점검 휴지통', textContent: 'x', createdTimestampUsec: usec(T1 + 2000), isTrashed: true }),
  json('보관.json', { title: 'Keep점검 보관', textContent: 'y', createdTimestampUsec: usec(T1 + 3000), isArchived: true, isTrashed: false }),
  { name: 'pic_1.jpg', mimeType: 'image/jpeg', buffer: PNG },
  { name: '상담.html', mimeType: 'text/html', buffer: Buffer.from('<html></html>') },
];

try {
  const { ctx, page, errors } = await newPage(browser);
  await mockDrive(ctx);
  await ctx.addInitScript(() => sessionStorage.setItem('sp5-google-token', 'tok'));
  await open(page, '#/memo');
  await page.evaluate(() => window.sp5.openWindow('backup', { tab: 'import' }));
  await page.locator(sel('keep-import')).waitFor({ timeout: 10000 });

  r.section('파일 고르기 · 미리보기');
  await page.locator(sel('keep-file')).setInputFiles(files());
  r.check(await waitFor(page.locator(sel('keep-count', 4)), 8000), '.json 넷 = 메모 4건 (.html은 건너뜀)');
  r.check(((await page.locator(sel('keep-count')).textContent()) ?? '').includes('사진·파일 1개'), '사진 1개를 받아 둔다');
  r.check(((await page.locator(sel('keep-plan', 'add')).textContent()) ?? '').includes('새로 2건'), '휴지통·보관은 빼고 새로 2건');
  await page.locator(sel('keep-opt', 'archived')).check();
  r.check(((await page.locator(sel('keep-plan', 'add')).textContent()) ?? '').includes('새로 3건'), '보관도 고르면 3건');
  await page.locator(sel('keep-opt', 'archived')).uncheck();
  r.check(((await page.locator('[data-keep-opt="files"]').locator('xpath=..').textContent()) ?? '').includes('짝을 찾은 파일 1개'), '사진 짝 = 파일 이름 대소문자 무시');

  r.section('가져오기');
  await page.locator(sel('keep-run')).click();
  r.check(await waitFor(page.locator(sel('keep-result')), 20000), '결과 줄');
  const made = await serverUntil(keepItems, (d) => d.length === 2);
  const byTitle = (t) => made.map((d) => ({ id: d.id, ...d.data() })).find((d) => d.text.startsWith(t));
  const a = byTitle('Keep점검 상담');
  const b = byTitle('Keep점검 준비물');
  r.check(made.length === 2 && a && b, `메모 2건 (${made.length})`);
  r.check(a?.kind === 'note' && a?.date === null && a?.keepId === `keep_${T1}` && a?.text === 'Keep점검 상담\n3시 상담', '메모 = 날짜 없음 · keepId = 만든 때 · 제목+본문');
  const label = (await keepLabel())[0];
  r.check(!!label && label.data().kind === 'note' && a?.labelIds?.includes(label.id), 'Keep 라벨 = 메모·기록 라벨로 새로 · 메모에 붙는다');
  r.check(b?.text === 'Keep점검 준비물\n☑ 색종이\n☐ 풀', '목록 메모 = 체크 줄');
  r.check(b?.attachments?.length === 1 && b.attachments[0].driveId === 'KEEPUP1' && drive.uploads.length === 1, '딸린 사진 = 드라이브에 올려 첨부');
  r.check(((await page.locator(sel('keep-result')).textContent()) ?? '').includes('사진·파일 1개 함께'), '결과에 사진 수');

  r.section('다시 가져오기');
  await page.locator(sel('keep-file')).setInputFiles(files());
  r.check(await waitFor(page.locator(sel('keep-plan', 'skip')), 8000), '같은 파일 = 건너뛸 것');
  r.check(((await page.locator(sel('keep-plan', 'skip')).textContent()) ?? '').includes('2건') && (await page.locator(sel('keep-run')).isDisabled()), '2건 모두 건너뜀 · 가져오기 단추가 꺼진다');
  await page.locator(sel('keep-clear')).click();
  await page.locator(sel('keep-file')).setInputFiles(files('4시로 바뀜'));
  r.check(await waitFor(page.locator(sel('keep-plan', 'update')), 8000), 'Keep에서 고친 메모 = 고쳐 쓸 것');
  await page.locator(sel('keep-run')).click();
  const a2 = await serverUntil(async () => (await keepItems()).map((d) => ({ id: d.id, ...d.data() })).find((d) => d.id === a.id), (d) => d?.text?.includes('4시로 바뀜'));
  r.check(a2?.text === 'Keep점검 상담\n4시로 바뀜' && (await keepItems()).length === 2, '같은 메모를 고쳐 쓴다 (새로 만들지 않는다)');
  r.check(drive.uploads.length === 1, `사진이 없는 메모를 고쳐 쓸 때는 더 올리지 않는다 (${drive.uploads.length})`);

  r.section('백업 탭에 Keep 파일');
  await page.locator(sel('backup-tab-btn', 'backup')).click();
  await page.locator(sel('restore-file')).setInputFiles([files()[0]]);
  r.check(await waitFor(async () => (await page.locator(sel('backup-window')).getAttribute('data-backup-window')) === 'import', 8000), "Keep 파일을 넣으면 '가져오기' 탭으로");
  r.check(await waitFor(page.locator(sel('keep-count', 1)), 8000), 'Keep 칸이 그 파일을 받는다');
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  await browser.close();
  r.done();
  process.exit();
}
