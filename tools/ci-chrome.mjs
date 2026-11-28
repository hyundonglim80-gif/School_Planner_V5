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
// + 넷(P44-1 - 11-13~17에 바뀐 화면인데 CI 밖이라 옛 화면을 본 채 남을 수 있던 것: ↗ 새 창·분할 칸·검색·휴지통·메모 요청 카드·💬 대화)
// + 메모 표(P48-5 - P48 다섯 세션의 빈 표·서식·식·Σ·채우기·정렬·엑셀과 오가기, 날짜에 기대지 않는다)
// + 넷(P49-1 - 11-18~20에 바뀐 화면인데 CI 밖이던 것, 짧은 것부터: 클립보드 팝업창·첨부(표 붙여넣기·클립보드 탭)·조사표(기타·점수 기준)·창 왼쪽 칸
//   · 조사표만 오늘로 학년도를 센다 - probe FAKE_TODAY로 2월 말·3월 1일·월말·다음 해까지 통과, 나머지 셋은 정한 날).
// + 설명서(P51-1 - 설명서가 기능 명세인데 손으로만 돌렸다: 75주제 366줄 1분 · 주제마다 혼자 돌려도 통과 ·
//   FAKE_TODAY 2026-11-30·2027-02-28·2027-03-01·2028-03-02 통과 - 시간표는 보는 날의 학년도부터 심는다).
// 날짜(P52-1 11-21): 앞 열여덟도 FAKE_TODAY 2027-02-28·03-01·03-02로 한 바퀴씩 - lessons만 3월 1일부터 틀렸다(자료는 2026학년도, 학기 탭·적용된 줄은
//   오늘의 학년도) → probe pinToday로 그 점검의 오늘을 2026-11-20에 묶음. chat은 미래 날로 볼 수 없다(서버 시각이 진짜라 대화 글 expireAt이 규칙에 막힘).
//   새로 더할 점검도 2월 말·3월 1일·두 해 뒤로 한 바퀴씩(CLAUDE.md 2장).
// + 단추 겹침 측정 짧은 묶음(P57-3 - P57-1~3에 고친 겹침·잘린 글·가로 넘침·휴대폰 작은 누를 곳이 다시 생기지 않게: PC 1400·휴대폰 360 44상황 90초 쯤 ·
//   SUITE=ci가 오늘을 2026-11-20에 묶어 FAKE_TODAY 2027-03-01·2028-03-02도 같다 · 일부러 옛 카드 단추 자리로 되돌리면 두 상황이 틀린다).
// + 접근성 짧은 묶음(P62 - 읽어 주는 이름 없는 누를 것·콘솔 오류·어두운 화면과 흰 글씨 대비·☆ 꺼진 단추 3:1·Tab 초점: PC 밝은·어두운 + 휴대폰 어두운 34상황 70초 쯤 ·
//   오늘을 2026-11-20에 묶음 · ☆를 옛 옅은 색으로 되돌리면 넷이 틀린다).
const CI_PROBES = [
  ...['shell', 'memo', 'notes', 'progress', 'lessons', 'settings', 'events', 'week'],
  ...['month-year', 'board', 'gcal', 'forward', 'print'],
  ...['popout', 'search-trash', 'claude-request', 'chat'],
  'table',
  ...['clipboard-popup', 'attach', 'evaluations', 'side-left'],
  'manual',
  'ui-overlap',
  'a11y',
];
/** 점검마다 더 줄 값 - 겹침 측정은 짧은 묶음으로(넓은 상황 표는 손으로) */
const PROBE_ENV = { 'ui-overlap': { SUITE: 'ci' }, a11y: { SUITE: 'ci' } };

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
      env: { SHOTS_DIR: join(OUT, 'shots'), ...PROBE_ENV[name] },
      file: join(OUT, `${label.replace('#', '-')}.log`),
    });
    const fails = r.text.split('\n').filter((l) => /✘/.test(l) && !/✘ \d+개 틀림/.test(l)).map((l) => l.trim());
    const passes = r.text.split('\n').filter((l) => /^\s*✔ /.test(l)).length;
    results.push({ name: label, ok: r.code === 0, ms: r.ms, passes, fails, tail: r.code === 0 ? '' : r.text.split('\n').slice(-60).join('\n') });
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
// 틀린 점검의 끝 줄을 맨 끝에 한 번 더 - 일 기록의 끝만 읽어도(클라우드 대화는 결과 묶음 주소에 닿지 못한다) 무엇을 기다리다 멈췄나 보인다(P49-1)
for (const r of failed) console.log(`\n── ${r.name} 끝 60줄 ──\n${r.tail}`);
process.exit(failed.length ? 1 : 0);
