// tools/lib/probe.mjs - 크롬 점검 스크립트(tools/inspect-*.mjs)가 함께 쓰는 도우미 (V5 P1-3).
//
// 규칙 (CLAUDE.md 2장 - V4에서 배운 것):
//   - 크롬 하나, PC 1400px 하나. 다른 브라우저·폭은 따로 부탁받을 때만.
//   - 화면 글자가 아니라 data-* 로 찾는다 (V4는 title을 바꿔 4항목이 며칠 깨진 채 남았다). → sel()
//   - 정한 시간만 기다리지 않고 보려는 것이 뜰 때까지 기다린다 → waitFor(). 서버 확인은 기다려 읽는다 → serverUntil().
//   - 심은 자료는 끝에 되돌린다 → restorer(). 점검이 이상하게 깨지면 앱보다 먼저 자료(라벨·설정 문서)를 본다.
//   - 보던 화면이 기억되므로 묶음 시작에서 화면을 정한다 → open(page, '#/day/…').
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-<무엇>.mjs   (SITE=… 로 다른 주소)
// ⚠️ 에뮬레이터만 건드린다. 운영 자료와는 아무 상관이 없다.
import { chromium } from 'playwright';
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';

export const SITE = process.env.SITE || 'http://localhost:5175/';

/** 결과 적기: ok / bad / check(조건, 맞을 때 글, 틀릴 때 글). 끝에 done()이 틀린 수만큼 종료 코드를 남긴다. */
export function report() {
  let fail = 0;
  const ok = (what) => console.log(`  ✔ ${what}`);
  const bad = (what) => {
    console.log(`  ✘ ${what}`);
    fail++;
  };
  return {
    ok,
    bad,
    check: (good, yes, no = yes) => (good ? ok(yes) : bad(no)),
    section: (title) => console.log(`\n[${title}]`),
    get fail() {
      return fail;
    },
    done() {
      console.log(fail ? `\n✘ ${fail}개 틀림` : '\n✔ 모두 통과');
      process.exitCode = fail ? 1 : 0;
    },
  };
}

/** data-* 고르개: sel('screen', 'day') → [data-screen="day"], sel('date-next') → [data-date-next] */
export const sel = (name, value) => (value === undefined ? `[data-${name}]` : `[data-${name}="${String(value).replace(/"/g, '\\"')}"]`);

export async function launch() {
  return chromium.launch({ channel: 'chrome' });
}

/**
 * 새 창(빈 기기 저장소). 화면 오류(pageerror)와 묻는 창(confirm)을 모은다.
 * dialogs.answer = true/false 로 다음 confirm의 답을 정한다(기본 아니오 - 지우지 않는 쪽).
 */
export async function newPage(browser, { width = 1400, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const dialogs = { seen: [], answer: false };
  page.on('dialog', async (d) => {
    dialogs.seen.push(d.message());
    if (dialogs.answer) await d.accept();
    else await d.dismiss();
  });
  return { ctx, page, errors, dialogs };
}

/** 주소(#/day/… 와 ?as=2 등)로 열고, 로그인한 껍데기가 뜰 때까지 기다린다 */
export async function open(page, path = '', { as = '' } = {}) {
  await page.goto(SITE + (as ? `?as=${as}` : '') + path);
  await page.locator(sel('session', 'signed-in')).waitFor({ timeout: 20000 });
}

/** 보려는 것이 뜰 때까지 (locator 또는 () => 참거짓). 못 보면 false */
export async function waitFor(target, ms = 5000) {
  if (typeof target !== 'function') {
    try {
      await target.waitFor({ timeout: ms });
      return true;
    } catch {
      return false;
    }
  }
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await target()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/** 서버 확인은 기다려 읽는다(화면이 먼저 바뀌고 서버 쓰기는 뒤에 온다). 마지막에 읽은 것을 돌려준다. */
export async function serverUntil(read, test, ms = 10000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await read();
    if (test(last)) return last;
    await new Promise((r) => setTimeout(r, 300));
  }
  return last;
}

/** 에뮬레이터에 붙은 Firebase (점검 스크립트가 서버를 직접 읽고 심는다). seed 계정 비밀번호는 test1234. */
export function emulator(name = 'inspect') {
  const app = initializeApp({ projectId: 'schoolplannerv3', apiKey: 'fake-api-key' }, name);
  const db = getFirestore(app);
  const auth = getAuth(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  return { app, db, auth, signIn: async (email) => (await signInWithEmailAndPassword(auth, email, 'test1234')).user.uid };
}

/** 심은 자료 되돌리기: add(되돌리는 함수)로 모으고, finally에서 run() (나중에 심은 것부터) */
export function restorer() {
  const undo = [];
  return {
    add: (fn) => undo.push(fn),
    async run() {
      for (const fn of undo.reverse()) {
        try {
          await fn();
        } catch (e) {
          console.log(`  ⚠ 되돌리기 실패: ${e}`);
        }
      }
    },
  };
}

/** 주소의 # 뒤 */
export const hashOf = (page) => new URL(page.url()).hash;
