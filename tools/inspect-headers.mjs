// tools/inspect-headers.mjs - 보안 헤더(P22-6)를 실제 응답에서 본다.
//   값의 정본은 firebase.json이다. 미리 보기는 vite.config가 그 값을 읽어 같은 헤더를 낸다(`firebase serve`는 내지 않는다).
//   빌드 파일 + 크롬:  npm run build:emu → node node_modules/vite/bin/vite.js preview --port 4177 → SITE=http://localhost:4177/ node tools/inspect-headers.mjs
//   운영(배포 뒤 헤더 + 첫 화면): SITE=https://schoolplanner-v5.web.app/ node tools/inspect-headers.mjs
//
//   CSP는 Report-Only라 틀려도 앱은 돈다 - 그래서 위반을 세어 본다. 외부 주소를 쓰는 자료(드라이브 그림·유튜브·사이트 그림·지도)를 심고 화면을 돈다.
//   일부러 막힐 것을 넣어 그것이 잡히는지도 본다 - 수집이 돌지 않아 0건인 것을 통과로 세지 않으려고.
//   ⚠️ 볼 수 없는 것: 구글 로그인 창·사진 고르기(Picker)·드라이브 올리기 - 에뮬레이터 빌드는 진짜 구글에 가지 않는다. 운영의 그 위반은 오류 보고 '[CSP] …'로 모인다.
import { readFileSync } from 'node:fs';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, SITE, waitFor } from './lib/probe.mjs';

const r = report();
const hosting = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')).hosting;
const WANT = hosting.headers.find((h) => h.source === '**').headers;
const IS_LOCAL = /localhost|127\.0\.0\.1/.test(SITE);
const DAY = '2026-10-08';
const ITEM = 'insp_csp_note';
const DRIVE_ID = 'inspCspDriveFile';
const TEXT = ['점검보안', 'https://youtu.be/abc123', 'https://example.com/page', 'https://www.google.com/maps/place/%EC%84%9C%EC%9A%B8%EC%8B%9C%EC%B2%AD/@37.5662952,126.9779451,17z'].join('\n');
/** 에뮬레이터 빌드만 쓰는 주소 - 운영 빌드에는 없다 */
const emulatorTraffic = (v) => /(?:https?|wss?):\/\/(?:127\.0\.0\.1|localhost):(?:8080|9099)/.test(v);

/** 이 파일들 모두에 붙어야 한다 - 앱 첫 화면·서비스 워커·매니페스트·조각 파일 */
async function paths() {
  const list = ['', 'sw.js', 'manifest.json'];
  const manifest = await (await fetch(`${SITE}asset-manifest.json`)).json();
  const js = Object.values(manifest).find((v) => v.isEntry)?.file;
  if (js) list.push(js);
  return list;
}

async function checkHeaders() {
  r.section('헤더');
  for (const path of await paths()) {
    const res = await fetch(`${SITE}${path}`);
    for (const { key, value } of WANT) r.check(res.headers.get(key) === value, `/${path} ${key}`, `/${path} ${key} = ${res.headers.get(key)}`);
    // nosniff면 종류가 틀린 스크립트는 돌지 않는다
    if (/\.js$/.test(path)) r.check(/javascript/.test(res.headers.get('content-type') ?? ''), `/${path} 종류가 자바스크립트`, `/${path} 종류 = ${res.headers.get('content-type')}`);
  }
}

/** 화면이 그려지기 전에 심는다 - 머리의 인라인 스크립트 위반까지 받으려고 */
const collectViolations = () => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.effectiveDirective} ${e.blockedURI}`));
};

/** 운영 첫 화면 - CI(리눅스)가 만든 진짜 HTML의 인라인 해시는 로컬 빌드로 알 수 없다. 로그인 없이 볼 수 있는 데까지만 */
async function checkLivePage() {
  r.section('운영 첫 화면');
  const browser = await launch();
  try {
    const { ctx, page, errors } = await newPage(browser);
    await ctx.addInitScript(collectViolations);
    await page.goto(SITE);
    r.check(await waitFor(page.locator(sel('login-google')), 15000), '로그인 화면이 떴다');
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    r.check(await page.evaluate(() => document.documentElement.classList.contains('dark')), '인라인 스크립트가 돌았다');
    const seen = await page.evaluate(() => window.__csp);
    r.check(seen.length === 0, '위반 0건', `위반 ${seen.length}건:\n      ${[...new Set(seen)].join('\n      ')}`);
    r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' / ')}`);
  } finally {
    await browser.close();
  }
}

async function checkViolations() {
  const em = emulator();
  const uid = await em.signIn('teacher@example.com');
  const ref = doc(em.db, 'spaces', `u_${uid}`, 'items', ITEM);
  const undo = restorer();
  undo.add(() => deleteDoc(ref));
  await setDoc(ref, {
    kind: 'note',
    date: DAY,
    text: TEXT,
    labelIds: [],
    order: 'zz',
    attachments: [{ name: '점검.png', mimeType: 'image/png', driveId: DRIVE_ID, url: `https://drive.google.com/thumbnail?id=${DRIVE_ID}&sz=w1000` }],
    createdAt: Date.now(),
    authorId: uid,
    deletedAt: null,
    v: 1,
    updatedAt: serverTimestamp(),
  });

  const browser = await launch();
  try {
    const { ctx, page, errors } = await newPage(browser);
    // 밖으로 나가지 않게 흉내 낸다. 어디로 요청이 나갔는지 적는다 - 그림은 loading=lazy라 화면 밖이면 요청이 없어 CSP도 보지 않는다(그것을 0건으로 세지 않게)
    const asked = new Set();
    const answer = (type, body) => (route) => {
      asked.add(new URL(route.request().url()).hostname);
      return route.fulfill({ status: 200, headers: { 'Content-Type': type }, body });
    };
    await ctx.route(/drive\.google\.com\/thumbnail|img\.youtube\.com|google\.com\/s2\/favicons/, answer('image/gif', Buffer.from('R0lGODlhAQABAAAAACw=', 'base64')));
    await ctx.route(/maps\.google\.com\/maps/, answer('text/html', '<!doctype html><title>지도</title>'));
    await ctx.addInitScript(collectViolations);
    const seen = () => page.evaluate(() => window.__csp);

    r.section('자료가 그려진다');
    await open(page, `#/day/${DAY}`);
    const card = page.locator(sel('entry-card', ITEM));
    r.check(await waitFor(card, 10000), '심은 메모 카드');
    r.check(await page.evaluate(() => document.documentElement.classList.contains('dark')), '인라인 스크립트가 돌았다 (처음 화면 어둡게)');
    // 접힌 카드라 글 요소가 없다 - 칩에 걸리지 않게 왼쪽 위 끝을 누른다
    await card.click({ position: { x: 10, y: 10 } });
    // 카드 누르기 = 메모 보기 칸 (11-09)
    const panel = page.locator(sel('note-view-body'));
    r.check(await waitFor(panel), '메모 칸이 열렸다');
    r.check(await waitFor(page.locator(sel('link-preview', 'youtube')).first()), '유튜브 미리보기');
    r.check(await waitFor(page.locator(sel('link-preview', 'site')).first()), '사이트 미리보기');
    await page.locator(sel('link-preview-map')).first().click();
    r.check(await waitFor(page.locator('iframe').first()), '지도 칸');
    for (const host of ['drive.google.com', 'img.youtube.com', 'www.google.com', 'maps.google.com']) {
      r.check(await waitFor(async () => asked.has(host), 5000), `요청이 나갔다: ${host}`, `요청이 나가지 않았다: ${host} (CSP를 거치지 않아 0건이 뜻이 없다) - 나간 곳: ${[...asked].join(' ')}`);
    }

    r.section('화면을 돈다');
    await page.keyboard.press('Escape');
    for (const [hash, screen] of [['#/week/2026-10-12', 'week'], ['#/month/2026-10', 'month'], ['#/year/2026', 'year'], ['#/memo', 'memo'], ['#/class', 'class']]) {
      await page.evaluate((h) => (location.hash = h), hash);
      r.check(await waitFor(page.locator(sel('screen', screen)).first(), 8000), `${screen} 화면`);
    }

    r.section('위반');
    const real = (await seen()).filter((v) => !emulatorTraffic(v));
    r.check(real.length === 0, '위반 0건', `위반 ${real.length}건:\n      ${[...new Set(real)].join('\n      ')}`);
    r.check(errors.length === 0, '화면 오류 없음', `화면 오류: ${errors.join(' / ')}`);

    r.section('일부러 넣은 것이 잡히나');
    await page.evaluate(() => {
      new Image().src = 'https://blocked.invalid/x.png';
      const s = document.createElement('script');
      s.textContent = 'window.__inlineRan = 1';
      document.head.append(s);
    });
    const caught = (want) => waitFor(async () => (await seen()).some((v) => v.startsWith(want)), 3000);
    r.check(await caught('img-src https://blocked.invalid'), '허락하지 않은 그림 = 위반');
    r.check(await caught('script-src-elem inline'), '해시가 다른 인라인 스크립트 = 위반 (아무 스크립트나 통과시키지 않는다)');
    r.check(await page.evaluate(() => window.__inlineRan === 1), 'Report-Only라 막지는 않는다');
  } finally {
    await browser.close();
    await undo.run();
  }
}

try {
  await checkHeaders();
  await (IS_LOCAL ? checkViolations() : checkLivePage());
} catch (e) {
  r.bad(`점검이 끝까지 돌지 못했다: ${e}`);
} finally {
  r.done();
  process.exit();
}
