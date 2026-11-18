// tools/ci-chrome.mjs - CI에서 크롬 점검을 하나씩 차례로 (P36-1).
//
//   npx firebase emulators:exec --only auth,firestore --project schoolplannerv3 "node tools/ci-chrome.mjs"
//
// 에뮬레이터 안에서: seed → 개발 서버(vite --mode emu, 5175)를 뒤에서 → 첫 화면을 한 번 열어 묶어 두기 → 점검을 하나씩.
// 틀린 점검이 하나라도 있으면 종료 코드 1 = CI 실패 = 배포 멈춤(firebase-hosting-merge는 CI 전체 통과만 배포).
// 결과는 ci-out/ (점검마다 출력 · 틀린 순간 그림 shots/ - probe SHOTS_DIR)과 GitHub 일 요약 표.
//
// 점검 목록은 여기 한 곳 - 메모 요청(claude-request.yml)은 PR의 CI를 기다리므로 따로 적지 않는다.
// 고른 까닭·뺀 점검은 docs/PLAN.md 5장 'P36-1'. 여럿을 한꺼번에 돌리지 않는다(CLAUDE.md 2장 - hover·기다림이 틀린다).
//   PROBES=shell,memo node tools/ci-chrome.mjs  - 몇 개만 (에뮬레이터·seed는 이미 있어야 한다: SKIP_SEED=1이면 seed도 건너뜀)
// ⚠️ 에뮬레이터만 건드린다. 운영 자료와는 아무 상관이 없다.
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// 여덟(P36-1) + 달력 화면 다섯(P40-1 - P36-4가 모든 달력 화면에 구글 일정 줄을 넣었다: 월간·년간·한눈에·겹쳐 보기(흉내 응답)·이월·인쇄)
// + 넷(P44-1 - 11-13~17에 바뀐 화면인데 CI 밖이라 옛 화면을 본 채 남을 수 있던 것: ↗ 새 창·분할 칸·검색·휴지통·메모 요청 카드·💬 대화).
const CI_PROBES = [
  ...['shell', 'memo', 'notes', 'progress', 'lessons', 'settings', 'events', 'week'],
  ...['month-year', 'board', 'gcal', 'forward', 'print'],
  ...['popout', 'search-trash', 'claude-request', 'chat'],
];

const OUT = 'ci-out';
const SITE = 'http://localhost:5175/';
const PROBE_TIMEOUT_MS = 6 * 60 * 1000; // 하나 2분 안쪽 - 멈춘 점검이 일 전체(시간 한도)를 잡아먹지 않게
const probes = process.env.PROBES ? process.env.PROBES.split(',').map((s) => s.trim()).filter(Boolean) : CI_PROBES;

mkdirSync(join(OUT, 'shots'), { recursive: true });

const sec = (ms) => `${Math.round(ms / 1000)}초`;

/** 자식 명령을 돌려 출력을 화면과 파일에 함께. 시간 한도를 넘기면 끈다. */
function run(label, args, { env = {}, timeout = PROBE_TIMEOUT_MS, file } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    const take = (chunk) => {
      const s = chunk.toString();
      text += s;
      process.stdout.write(s);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) text += `\n✘ ${label}: ${sec(timeout)} 안에 끝나지 않아 껐다\n`;
      if (file) writeFileSync(file, text);
      resolve({ code: timedOut ? 124 : code, text, ms: Date.now() - started });
    });
  });
}

async function waitHttp(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* 아직 */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// 1. seed (계정 + 개인 공간)
if (!process.env.SKIP_SEED) {
  console.log('▶ seed');
  const seed = spawnSync(process.execPath, ['tools/seed.mjs'], { stdio: 'inherit' });
  if (seed.status !== 0) {
    console.log('✘ seed 실패');
    process.exit(1);
  }
}

// 2. 개발 서버 - npx 없이 vite를 곧바로(CLAUDE.md 2장 - npx로 띄우면 끌 때 포트가 남는다)
let vite = null;
if (!(await waitHttp(SITE, 500))) {
  console.log('▶ 개발 서버 (vite --mode emu)');
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--mode', 'emu'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let viteLog = '';
  vite.stdout.on('data', (c) => (viteLog += c));
  vite.stderr.on('data', (c) => (viteLog += c));
  process.on('exit', () => {
    writeFileSync(join(OUT, 'vite.log'), viteLog);
    vite.kill();
  });
  if (!(await waitHttp(SITE, 60000))) {
    console.log('✘ 개발 서버가 60초 안에 뜨지 않았다');
    process.exit(1);
  }
}

// 3. 묶어 두기 - 개발 서버는 첫 화면을 열 때 모듈을 묶는다(P26-1 - 첫 점검의 결과 표가 15초를 넘겼다). 그 시간을 첫 점검에 넘기지 않는다.
{
  console.log('▶ 첫 화면 한 번 열기 (개발 서버 묶기)');
  const { launch, newPage, open } = await import('./lib/probe.mjs');
  const browser = await launch();
  const started = Date.now();
  try {
    const { page } = await newPage(browser);
    await page.goto(SITE);
    await page.locator('[data-session="signed-in"]').waitFor({ timeout: 120000 });
    await open(page, '#/week/2027-03-02'); // 다른 화면 조각도 한 번 받는다
    console.log(`  첫 화면 ${sec(Date.now() - started)}`);
  } catch (e) {
    console.log(`✘ 첫 화면을 열지 못했다: ${e.message}`);
    await browser.close();
    process.exit(1);
  }
  await browser.close();
}

// 4. 점검을 하나씩 (REPEAT=n이면 목록을 n바퀴 - 흔들림 찾기, CI 손 실행 '몇 번' · 바퀴마다 그림 이름이 이어진다)
const REPEAT = Math.max(1, Math.min(10, Number(process.env.REPEAT) || 1));
const results = [];
for (let round = 1; round <= REPEAT; round++) {
  for (const name of probes) {
    const label = REPEAT > 1 ? `${name}#${round}` : name;
    console.log(`\n▶ inspect-${label}`);
    const r = await run(label, [`tools/inspect-${name}.mjs`], {
      env: { SHOTS_DIR: join(OUT, 'shots') },
      file: join(OUT, `${label.replace('#', '-')}.log`),
    });
    const fails = r.text.split('\n').filter((l) => /✘/.test(l) && !/✘ \d+개 틀림/.test(l)).map((l) => l.trim());
    const passes = r.text.split('\n').filter((l) => /^\s*✔ /.test(l)).length;
    results.push({ name: label, ok: r.code === 0, ms: r.ms, passes, fails });
    console.log(`◀ inspect-${label}: ${r.code === 0 ? '통과' : `틀림 (종료 ${r.code})`} · ${sec(r.ms)}`);
  }
}

// 5. 요약 (GitHub 일 요약 · 메모 요청 결과 글이 읽는 ci-out/summary.md)
const failed = results.filter((r) => !r.ok);
const lines = [
  `### 크롬 점검 ${results.length - failed.length}/${results.length} 통과`,
  '',
  '| 점검 | 결과 | 시간 | ✔ | 틀린 줄 |',
  '| --- | --- | --- | --- | --- |',
  ...results.map((r) => `| ${r.name} | ${r.ok ? '통과' : '**틀림**'} | ${sec(r.ms)} | ${r.passes} | ${r.fails.slice(0, 3).join(' / ').replace(/\|/g, '\\|') || ''} |`),
  '',
];
writeFileSync(join(OUT, 'summary.md'), lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
console.log('\n' + lines.join('\n'));
process.exit(failed.length ? 1 : 0);
