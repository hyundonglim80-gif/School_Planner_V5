// tools/inspect-mobile.mjs - P9-3 ■2: 휴대폰 390px 한 번 + 다크 모드 (V4 09-28 사용자 결정 - 390px는 이때만 본다).
//   1) 휴대폰 390px: 여섯 화면과 큰 창마다 가로로 넘치지 않는다(본문 scrollWidth) · 화면 오류 없음 ·
//      휴대폰 틀(아래 탭바·둥근 ＋·월간 그날 목록에 수업 칩·년간 자세히는 이번 달만 펼침·창은 화면을 덮는다).
//   2) 다크 모드(휴대폰·PC): html.dark · 밝을 때 읽히던 글(대비 3 이상)이 어두울 때 2 아래로 떨어지지 않는다(글자색 ↔ 칠한 바탕).
//      라벨 칩·기간 막대는 V4처럼 다크에서도 제 빛깔(정해 둔 hex)이라 뺀다.
//   SHOTS=<폴더>면 화면마다 그림을 남긴다(눈으로 본다). 심은 자료(시간표·일정·기록·메모)는 끝에 걷는다.
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-mobile.mjs
import { mkdirSync } from 'node:fs';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, restorer, sel, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const DAY = '2026-10-14';
const stamp = { deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid };
const ref = (coll, id) => doc(em.db, 'spaces', sid, coll, id);
const WEEK = { '1': '국어', '2': '수학', '3': '사회', '4': '과학', '5': '체육', '6': '음악' };
const SEED = {
  labels: { insp_mob_l: { kind: 'event', name: '점검폰', color: 'blue', parentId: null, order: 'Zz1' } },
  timetables: { insp_mob_tt: { name: '점검폰 시간표', from: '2026-10-01', to: '2026-10-31', grid: { '1': WEEK, '2': WEEK, '3': WEEK, '4': WEEK, '5': WEEK } } },
  items: {
    insp_mob_e1: { kind: 'event', date: DAY, text: '점검폰 학부모 상담 준비', labelIds: ['insp_mob_l'], order: 'Zz1' },
    insp_mob_e2: { kind: 'event', date: DAY, text: '점검폰 아주 긴 일정 제목이 한 줄을 넘어가도 칸 밖으로 나가지 않는지 보는 글', labelIds: [], order: 'Zz2' },
    insp_mob_e3: { kind: 'event', date: DAY, text: '점검폰 끝낸 일', labelIds: ['insp_mob_l'], done: true, order: 'Zz3' },
    insp_mob_p: { kind: 'event', date: '2026-10-13', endDate: '2026-10-16', text: '점검폰 기간 일정', labelIds: [], order: 'Zz4' },
    insp_mob_n1: { kind: 'note', date: DAY, text: '점검폰 기록\n둘째 줄\nhttps://www.youtube.com/watch?v=abc123', labelIds: [], order: 'Zz1' },
    insp_mob_n2: { kind: 'note', date: DAY, text: '점검폰 체크\n☐ 하나\n☑ 둘', labelIds: [], order: 'Zz2' },
    insp_mob_m1: { kind: 'note', date: null, text: '점검폰 메모 하나', labelIds: [], order: 'Zz1' },
    insp_mob_m2: { kind: 'note', date: null, text: '점검폰 메모 둘\n여러 줄', labelIds: [], order: 'Zz2' },
  },
};

/**
 * 본문이 가로로 넘치나 (넘친 만큼 px - 0이면 괜찮다). 정한 폭(390)과 견준다 - 휴대폰 흉내(isMobile)는 넘치는 글이 있으면
 * 화면 폭(innerWidth)째 넓혀 버려 innerWidth와 견주면 늘 0이다(P9-3 - 수업 머리줄이 넘쳤는데 통과했다).
 */
const overflowOf = (page, width) => page.evaluate((w) => Math.max(0, document.documentElement.scrollWidth - w, document.body.scrollWidth - w), width);

/** 넘치게 만든 요소 몇 개 (고칠 자리 찾기) - 가장 안쪽 것부터 */
const wideOnes = (page, width) =>
  page.evaluate((w) => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const box = el.getBoundingClientRect();
      if (box.width > 0 && box.right > w + 1) {
        const tag = [...el.attributes].find((a) => a.name.startsWith('data-'));
        if (![...el.children].some((c) => c.getBoundingClientRect().right > w + 1))
          out.push(`${el.tagName.toLowerCase()}${tag ? `[${tag.name}=${tag.value}]` : ''}「${(el.textContent ?? '').trim().slice(0, 12)}」→${Math.round(box.right)}`);
      }
      if (out.length >= 6) break;
    }
    return out;
  }, width);

/** 글자가 든 요소마다 글자색 ↔ 칠한 바탕 대비 (캔버스로 색을 rgb로 - Tailwind v4는 oklch) */
const contrastMap = (page) =>
  page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgb = (color) => {
      c.clearRect(0, 0, 1, 1);
      c.fillStyle = '#000';
      c.fillStyle = color;
      c.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = c.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; // 그림·그라데이션 위 글은 셈하지 않는다
        const b = rgb(cs.backgroundColor);
        if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && b.a > 0.6) return b;
      }
      return rgb(getComputedStyle(document.body).backgroundColor);
    };
    const out = {};
    for (const el of document.querySelectorAll('body *')) {
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
      if (!text || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.5) continue;
      const bg = bgOf(el);
      if (!bg) continue;
      const fg = rgb(cs.color);
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      let tag = '';
      for (let e = el; e && !tag; e = e.parentElement) {
        const a = [...e.attributes].find((x) => x.name.startsWith('data-') && x.name !== 'data-theme');
        if (a) tag = `${a.name}=${a.value}`;
      }
      // 글자색도 적는다 - 밝을 때와 같은 색(라벨 빛깔처럼 정해 둔 색)은 바탕도 제 것이라 견주지 않는다
      out[`${tag}|${text.slice(0, 24)}`] = [Math.round(ratio * 10) / 10, cs.color];
    }
    return out;
  });

const SCREENS = [
  ['day', `#/day/${DAY}`],
  ['week', `#/week/2026-10-12`],
  ['month', '#/month/2026-10'],
  ['year', '#/year/2026'],
  ['memo', '#/memo'],
  ['class', '#/class'],
];

async function shot(page, name, full = true) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full });
}

async function go(page, hash) {
  await page.goto(page.url().replace(/#.*$/, hash));
  await waitFor(async () => new URL(page.url()).hash === hash, 5000);
}

/** 한 벌(폭·밝기)을 돈다 - 화면마다 대비 표를 돌려준다 */
async function runSet(browser, { name, width, height, mobile, dark }) {
  r.section(`${name} (${width}px${dark ? ' · 다크' : ''})`);
  const { page, errors } = await newPage(browser, {
    width,
    height,
    ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  await page.addInitScript((d) => localStorage.setItem('sp5_theme', d ? 'dark' : 'light'), dark);
  await open(page, `#/day/${DAY}`);
  r.check((await page.evaluate(() => document.documentElement.classList.contains('dark'))) === dark, dark ? 'html.dark (어두운 모드)' : '밝은 모드');
  const contrast = {};
  for (const [screen, hash] of SCREENS) {
    await go(page, hash);
    await waitFor(page.locator(sel('screen', screen)), 8000);
    await page.waitForTimeout(1200); // 사본·계산이 그려질 때까지
    const over = await overflowOf(page, width);
    r.check(over === 0, `${screen}: 가로로 넘치지 않는다`, `${screen}: 가로로 ${over}px 넘친다 (${(await wideOnes(page, width)).join(' · ')})`);
    contrast[screen] = await contrastMap(page);
    await shot(page, `${name}-${screen}`);
  }

  if (mobile) {
    r.check(await waitFor(page.locator(sel('mobile-tabbar'))), '아래 탭바');
    r.check(await waitFor(page.locator(sel('new-fab'))), '둥근 ＋');
    // 머리줄(backdrop-blur) 안에 두면 fixed가 머리줄에 붙어 화면 맨 위에 반쯤 걸렸다 (P9-3) - 탭바 위 오른쪽인가
    const fab = await page.locator(sel('new-fab')).boundingBox();
    const bar = await page.locator(sel('mobile-tabbar')).boundingBox();
    r.check(!!fab && !!bar && fab.y > height / 2 && fab.y + fab.height <= bar.y && fab.x + fab.width <= width, `둥근 ＋ = 탭바 위 오른쪽 (${fab && Math.round(fab.y)} / 탭바 ${bar && Math.round(bar.y)})`);
    await page.locator(sel('new-fab')).click();
    const list = await page.locator(sel('new-list')).boundingBox().catch(() => null);
    r.check(!!list && !!fab && list.y + list.height <= fab.y && list.y > 0, '누르면 그 위에 새로 만들기 목록');
    await page.locator(sel('new', 'newEvent')).click();
    r.check(await waitFor(page.locator(sel('event-panel', 'new'))), '목록의 새 일정 = 새 일정 칸');
    await page.keyboard.press('Escape');
    // 월간: 칸에 교시 둘씩 한 줄 수업 칩(10-16 사용 의견) + 날짜를 누르면 아래에 그날 목록
    await go(page, '#/month/2026-10');
    await waitFor(page.locator(sel('month-day', DAY)), 8000);
    const cellLessons = page.locator(sel('month-lessons', DAY));
    r.check(await waitFor(cellLessons, 6000), '월간 칸에도 수업 칩 (휴대폰 - 교시 둘씩)');
    const chipBoxes = await cellLessons.locator(sel('month-lesson')).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
    r.check(chipBoxes.length === 6 && chipBoxes.every((w) => w >= 18), `교시 여섯, 칩 폭 18px 넘게 (${chipBoxes.map((w) => Math.round(w)).join(',')})`);
    const firstText = ((await cellLessons.locator(sel('month-lesson', 1)).textContent()) ?? '').trim();
    r.check(firstText.length > 0 && (await cellLessons.locator(sel('month-lesson', 1)).evaluate((e) => e.scrollWidth <= e.clientWidth + 1)), `첫 교시 과목이 칩 안에 보인다 ('${firstText}')`);
    await page.locator(sel('month-day', DAY)).click({ position: { x: 10, y: 10 } });
    const sheet = page.locator(sel('month-day-sheet', DAY));
    r.check(await waitFor(sheet), '날짜를 누르면 그날 목록');
    r.check((await sheet.locator(sel('sheet-lesson')).count()) === 6, `그날 목록에 수업 칩 (${await sheet.locator(sel('sheet-lesson')).count()})`);
    r.check(await waitFor(sheet.locator(sel('sheet-event', 'insp_mob_e1'))), '그날 목록에 일정');
    r.check((await overflowOf(page, width)) === 0, '그날 목록이 넘치지 않는다');
    await shot(page, `${name}-month-sheet`, false);
    await sheet.locator(sel('sheet-close')).click();
    // 년간 자세히: 이번 달만 펼친다
    await go(page, '#/year/2026');
    await page.locator(sel('year-view', 'detail')).click();
    const thisMonth = new Date().toISOString().slice(0, 7);
    r.check(await waitFor(page.locator(`${sel('year-month', thisMonth)}[data-year-month-open="1"]`), 8000), `년간 자세히: 이번 달(${thisMonth})만 펼친다`);
    r.check((await page.locator('[data-year-month-open="1"]').count()) === 1, '나머지 달은 머리글만');
    if (thisMonth === '2026-10') r.check(await waitFor(page.locator(`${sel('year-lessons', DAY)} ${sel('year-lesson')}`).first()), '년간 자세히 휴대폰 = 번호와 수업 칩');
    r.check((await overflowOf(page, width)) === 0, '년간 자세히가 넘치지 않는다');
    await shot(page, `${name}-year-detail`);
    await page.locator(sel('year-view', 'sheet')).click();
  }

  // 큰 창 (쓰는 칸·창) - 휴대폰은 화면을 덮는다
  const WINDOWS = [
    ['event', ['event', { sid, date: DAY }]],
    ['note', ['note', { sid, date: DAY, id: 'insp_mob_n2' }]],
    ['settings', ['settings']],
    ['search', ['search']],
    ['labels', ['labels', { tab: 'event' }]],
    ['timetable', ['timetable']],
    ['help', ['help']],
    ['backup', ['backup']],
  ];
  await go(page, `#/day/${DAY}`);
  for (const [w, args] of WINDOWS) {
    await page.evaluate((a) => window.sp5.openWindow(...a), args);
    await page.waitForTimeout(900);
    const over = await overflowOf(page, width);
    r.check(over === 0, `창 ${w}: 넘치지 않는다`, `창 ${w}: 가로로 ${over}px 넘친다 (${(await wideOnes(page, width)).join(' · ')})`);
    contrast[`win:${w}`] = await contrastMap(page);
    await shot(page, `${name}-win-${w}`, false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
  r.check(errors.length === 0, `화면 오류 없음 ${errors.join(' | ')}`);
  await page.context().close();
  return contrast;
}

try {
  for (const [coll, docs] of Object.entries(SEED)) {
    for (const [id, data] of Object.entries(docs)) {
      await setDoc(ref(coll, id), { ...data, ...stamp });
      undo.add(() => deleteDoc(ref(coll, id)));
    }
  }
  const browser = await launch();
  try {
    const sets = {};
    for (const set of [
      { name: 'phone', width: 390, height: 844, mobile: true, dark: false },
      { name: 'phone-dark', width: 390, height: 844, mobile: true, dark: true },
      { name: 'pc', width: 1400, height: 900, mobile: false, dark: false },
      { name: 'pc-dark', width: 1400, height: 900, mobile: false, dark: true },
    ]) {
      sets[set.name] = await runSet(browser, set);
    }

    // 다크 모드 대비: 밝을 때 읽히던 글(3 이상)이 어두울 때 2 아래면 고칠 곳
    for (const [light, dark] of [
      ['phone', 'phone-dark'],
      ['pc', 'pc-dark'],
    ]) {
      r.section(`다크 대비 (${dark})`);
      for (const [where, map] of Object.entries(sets[dark])) {
        const lightMap = sets[light][where] ?? {};
        // 라벨 칩·기간 막대는 V4처럼 다크에서도 제 빛깔(정해 둔 색)이라 글자색이 같으면 뺀다
        const bad = Object.entries(map).filter(([k, [v, fg]]) => v < 2 && (lightMap[k]?.[0] ?? 0) >= 3 && lightMap[k]?.[1] !== fg);
        r.check(bad.length === 0, `${where}: 어두울 때도 읽힌다 (${Object.keys(map).length}곳)`, `${where}: 어두울 때 안 읽히는 글 ${bad.length} - ${bad.slice(0, 6).map(([k, [v]]) => `${k} ${v} (밝을 때 ${lightMap[k][0]})`).join(' · ')}`);
      }
    }
  } finally {
    await browser.close();
  }
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  r.done();
  process.exit();
}
