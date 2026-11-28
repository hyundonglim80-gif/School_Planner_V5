// 접근성 점검 (P62 11-28 - P61 클라우드 측정 초안을 들임). 연습용 서버 + seed + 개발 서버(5175)가 떠 있어야 한다.
// 실행: node tools/inspect-a11y.mjs
//   SUITE=ci  자동 검사 짧은 묶음(PC 밝은·어두운 + 휴대폰 어두운, 창 셋) · SET_RE=<정규식> 묶음 거르기 · ONLY=<정규식> 상황 거르기
//   OUT=<파일> 상황마다 잰 것 전부(JSON) · SHOTS=<폴더> 상황마다 그림
// 틀림으로 보는 것 (지킬 것만 - 일부러 옅게 한 디자인은 셈하지 않는다):
//   ① 읽어 주는 이름 없는 누를 것 0 (크롬 접근성 트리 - 단추·링크·입력 칸·탭 …)
//   ② 화면 오류·콘솔 오류 0
//   ③ 어두운 화면 글씨 대비 WCAG 4.5:1 (큰 글 3:1) - P61 강조 글자(text-primary)·흰 글씨 단추를 지킨다
//   ④ 흰 글씨(꽉 찬 단추·칩) 대비 4.5:1 - 밝은·어두운 모두 (P61 '흰 글씨를 얹는 꽉 찬 노랑·초록은 700')
//   ⑤ ☆ 즐겨찾기 꺼진 단추 3:1 (P62 - 누르는 그림 단추 비문자 기준)
//   ⑥ PC 하루·메모 화면 Tab 초점이 보인다
// 셈에서 빼는 것: '꺼진 것·옅은 나눔'(text-slate-300 - CLAUDE.md 5장 사용자 규칙) · 흐린 것(opacity) · 꺼진 단추 · 완료 ✓(data-event-check 작은 표시) ·
//   글자색이 투명한 것(덧그림 아래 글 칸) · 그라데이션·그림 바탕.
// 밝은 화면의 그 밖 대비(주말 빨강·파랑 날짜, 옅은 바탕 위 회색 …)는 디자인이라 개수만 적는다(틀림 아님).
import { mkdirSync, writeFileSync } from 'node:fs';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, pinToday, report, restorer, sel, waitFor } from './lib/probe.mjs';

pinToday('2026-11-20'); // 심는 자료가 2026학년도에 묶였다 (PROBES.md - 날마다 도는 자동 검사)
const SUITE = process.env.SUITE || '';
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const SET_RE = process.env.SET_RE ? new RegExp(process.env.SET_RE) : null;
const SHOTS = process.env.SHOTS || '';
const OUT = process.env.OUT || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const r = report();
const em = emulator('a11y');
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const DAY = '2026-10-14';
const MONDAY = '2026-10-12';
const YEAR = 2026;
const CLASS_ID = `${YEAR}-5-2`;
const stamp = () => ({ deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid });
const ref = (coll, id) => doc(em.db, 'spaces', sid, coll, id);
const WEEK = { 1: '국어', 2: '수학', 3: '사회', 4: '과학', 5: '체육', 6: '창의적 체험활동' };
const NAMES = '김하나 이두리 박세나 최네모 정다섯 강여섯 조일곱 윤여덟 장아홉 임열 한열하나 오열둘'.split(' ');
const SEED = {
  labels: {
    insp_ax_l1: { kind: 'event', name: '학교 행사', color: 'blue', parentId: null, order: 'Zz1' },
    insp_ax_l2: { kind: 'event', name: '업무', color: 'green', parentId: null, order: 'Zz2' },
    insp_ax_n: { kind: 'note', name: '수업 준비', color: 'purple', parentId: null, order: 'Zz1' },
    insp_ax_nc: { kind: 'note', name: '과학', color: 'orange', parentId: 'insp_ax_n', order: 'Zz2' },
  },
  timetables: { insp_ax_tt: { name: '2학기 시간표', from: `${YEAR}-03-01`, to: `${YEAR + 1}-02-28`, grid: { 1: WEEK, 2: WEEK, 3: WEEK, 4: WEEK, 5: WEEK } } },
  items: {
    insp_ax_e1: { kind: 'event', date: DAY, text: '학부모 상담 준비', labelIds: ['insp_ax_l1'], order: 'Zz1', time: '14:00' },
    insp_ax_e2: { kind: 'event', date: DAY, text: '교육청 공문 회신 (나이스 결재 올리기)', labelIds: ['insp_ax_l2'], order: 'Zz2' },
    insp_ax_e3: { kind: 'event', date: DAY, text: '끝낸 일', labelIds: ['insp_ax_l1'], done: true, order: 'Zz3' },
    insp_ax_e4: { kind: 'event', date: '2026-10-13', endDate: '2026-10-16', text: '현장 체험 학습 주간', labelIds: ['insp_ax_l2'], order: 'Zz4' },
    insp_ax_n1: { kind: 'note', date: DAY, text: '과학 실험 준비물\n비커 6개\n알코올램프', labelIds: ['insp_ax_nc'], order: 'Zz1' },
    insp_ax_n2: { kind: 'note', date: DAY, text: '할 일\n☐ 출결 마감\n☐ 알림장 쓰기\n☑ 상담 일지', labelIds: ['insp_ax_n'], order: 'Zz2' },
    insp_ax_m1: { kind: 'note', date: null, text: '날짜 없는 메모 하나', labelIds: [], order: 'Zz1' },
  },
};
const students = NAMES.map((name, i) => ({ sid: `ax${i + 1}`, num: i + 1, name, status: 'active' }));
const SCREENS = [
  ['board', `#/board/${DAY}`],
  ['day', `#/day/${DAY}`],
  ['week', `#/week/${MONDAY}`],
  ['month', '#/month/2026-10'],
  ['year', '#/year/2026'],
  ['memo', '#/memo'],
  ['class', '#/class'],
];
const WINDOWS = [
  ['event-new', ['event', { sid, date: DAY }]],
  ['event-edit', ['event', { sid, date: DAY, id: 'insp_ax_e2' }]],
  ['note-view', ['note', { sid, date: DAY, id: 'insp_ax_n2' }]],
  ['note-edit', ['note', { sid, date: DAY, id: 'insp_ax_n2', edit: true }]],
  ['lesson', ['lesson', { sid, date: DAY, n: 2 }]],
  ['settings-view', ['settings', { tab: 'view' }]],
  ['settings-layout', ['settings', { tab: 'layout' }]],
  ['settings-shortcuts', ['settings', { tab: 'shortcuts' }]],
  ['search', ['search']],
  ['labels-note', ['labels', { tab: 'note' }]],
  ['timetable', ['timetable']],
  ['attendance', ['attendance', { date: DAY, classId: CLASS_ID }]],
  ['notices', ['notices', { sid, date: DAY }]],
  ['seating', ['seating', { classId: CLASS_ID }]],
  ['help', ['help']],
  ['backup', ['backup']],
  ['trash', ['trash']],
  ['linker', ['linker', { sid, id: 'insp_ax_n1' }]],
  ['progress', ['progress']],
  ['studentRecord', ['studentRecord', { classId: CLASS_ID, sid: 'ax1', at: 1 }]],
  ['print', ['print', { date: DAY, scope: 'day' }]],
];
const PC = { width: 1400, height: 900 };
const PH = { width: 390, height: 844, mobile: true };
const SETS = [
  { name: 'pc1400', dev: PC, theme: 'light', windows: 'all' },
  { name: 'pc1400-dark', dev: PC, theme: 'dark', windows: 'all' },
  { name: 'ph390', dev: PH, theme: 'light', windows: 'all' },
  { name: 'ph390-dark', dev: PH, theme: 'dark', windows: 'all' },
];
const CI_WINDOWS = ['note-edit', 'event-new', 'settings-view'];
const CI_SETS = [
  { name: 'pc1400', dev: PC, theme: 'light', windows: CI_WINDOWS },
  { name: 'pc1400-dark', dev: PC, theme: 'dark', windows: CI_WINDOWS },
  { name: 'ph390-dark', dev: PH, theme: 'dark', windows: CI_WINDOWS },
];
const RUN_SETS = SUITE === 'ci' ? CI_SETS : SETS;
const FAVORITE = '[data-entry-favorite-toggle],[data-note-flag="favorite"]:not([class*="border"]),[data-memo-row-favorite]';

// ── 화면 안에서 재기 (page.evaluate - 밖 이름을 쓰지 않는다) ──
function scanText(favSel) {
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = 1;
  const cx = cvs.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#000';
    cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (top, bottom) => {
    const a = top[3];
    return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratioOf = (a, b) => {
    const L1 = lum(a);
    const L2 = lum(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  };
  const bodyBg = rgba(getComputedStyle(document.body).backgroundColor);
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; // 그라데이션·그림 - 셈하지 않음
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) {
        layers.push(c);
        if (c[3] >= 0.999) break;
      }
    }
    let base = layers.length && layers[layers.length - 1][3] >= 0.999 ? layers.pop() : bodyBg[3] > 0 ? bodyBg : [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  // '꺼진 것·옅은 나눔' 색 (text-slate-300 - 테마마다 값이 다르다)
  const probe = document.createElement('span');
  probe.className = 'text-slate-300';
  document.body.appendChild(probe);
  const faint = getComputedStyle(probe).color;
  probe.remove();
  const tag = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const d = [...e.attributes].find((a) => a.name.startsWith('data-') && !['data-glyph', 'data-icon'].includes(a.name));
      if (d) return `[${d.name}${d.value ? `="${d.value.slice(0, 24)}"` : ''}]`;
    }
    return el.tagName.toLowerCase();
  };
  const shown = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1 || rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.display === 'none') return false;
    let op = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
    return op >= 0.99;
  };
  const low = [];
  const seen = new Set();
  for (const el of document.body.querySelectorAll('*')) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (!own || !shown(el)) continue;
    if (el.closest('[disabled],[aria-disabled="true"],[aria-hidden="true"],[data-build-id],[data-event-check],svg')) continue;
    const cs = getComputedStyle(el);
    if (cs.color === faint) continue;
    const fg0 = rgba(cs.color);
    if (fg0[3] < 0.05) continue; // 투명 글자 (덧그림 아래 글 칸)
    const key = `${tag(el)}|${own.slice(0, 20)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bg = bgOf(el);
    if (!bg) continue;
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const ratio = ratioOf(over(fg0, bg), bg);
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    if (ratio < need) low.push({ at: tag(el), text: own.slice(0, 24), ratio: Math.round(ratio * 100) / 100, need, white: fg0[0] > 250 && fg0[1] > 250 && fg0[2] > 250 });
  }
  // ⑤ ☆ 꺼진 즐겨찾기 - 비문자 3:1
  const fav = [];
  for (const el of document.querySelectorAll(favSel)) {
    if (el.getAttribute('aria-pressed') === 'true' || !shown(el)) continue;
    const bg = bgOf(el);
    if (!bg) continue;
    const ratio = ratioOf(over(rgba(getComputedStyle(el).color), bg), bg);
    if (ratio < 3) fav.push(`${tag(el)} ${Math.round(ratio * 100) / 100}:1`);
  }
  return { low, fav, favCount: document.querySelectorAll(favSel).length };
}

const ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'combobox', 'textbox', 'searchbox', 'menuitem', 'tab', 'switch', 'slider', 'spinbutton']);
async function namelessControls(page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const out = [];
    for (const n of nodes) {
      if (n.ignored || !ROLES.has(n.role?.value) || (n.name?.value ?? '').trim()) continue;
      let desc = n.role.value;
      if (n.backendDOMNodeId) {
        try {
          const { node } = await cdp.send('DOM.describeNode', { backendNodeId: n.backendDOMNodeId, depth: 1 });
          const attrs = node.attributes ?? [];
          const pairs = [];
          for (let i = 0; i < attrs.length; i += 2) if (attrs[i].startsWith('data-') || attrs[i] === 'type') pairs.push(`${attrs[i]}${attrs[i + 1] ? `="${attrs[i + 1].slice(0, 20)}"` : ''}`);
          desc = `${n.role.value} <${node.nodeName.toLowerCase()} ${pairs.join(' ')}>`;
        } catch {
          /* 그새 없어진 노드 */
        }
      }
      out.push(desc);
    }
    return out;
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/** ⑥ Tab으로 30번 - 초점 테(outline·box-shadow)가 보이고 화면 안인가 */
async function focusWalk(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  const bad = [];
  let visited = 0;
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const ring = cs.boxShadow && cs.boxShadow !== 'none';
      const r = el.getBoundingClientRect();
      const d = [...el.attributes].find((a) => a.name.startsWith('data-'));
      return { visible: outline || ring, onScreen: r.width > 0 && r.bottom > 0 && r.top < innerHeight, at: `${el.tagName.toLowerCase()}${d ? `[${d.name}]` : ''}` };
    });
    if (!info) continue;
    visited++;
    if (!info.visible || !info.onScreen) bad.push(`${info.at}${info.onScreen ? '' : ' (화면 밖)'}`);
  }
  return { visited, bad };
}

const results = [];
let designLow = 0;
async function measure(page, set, name, consoleErrors) {
  await page.waitForTimeout(400);
  const t = await page.evaluate(scanText, FAVORITE);
  const nameless = await namelessControls(page);
  const dark = set.theme === 'dark';
  const must = t.low.filter((x) => dark || x.white);
  designLow += t.low.length - must.length;
  const errs = consoleErrors.splice(0);
  const problems = [];
  if (nameless.length) problems.push(`이름 없는 누를 것 ${nameless.length}: ${nameless.slice(0, 4).join(' · ')}`);
  if (errs.length) problems.push(`콘솔 오류 ${errs.length}: ${errs.slice(0, 2).join(' · ')}`);
  if (must.length) problems.push(`글씨 대비 ${must.length}: ${must.slice(0, 4).map((x) => `${x.at} '${x.text}' ${x.ratio}/${x.need}`).join(' · ')}`);
  if (t.fav.length) problems.push(`☆ 꺼진 즐겨찾기 3:1 미달 ${t.fav.length}: ${t.fav.slice(0, 3).join(' · ')}`);
  let focus = null;
  if (!set.dev.mobile && !dark && /\/(day|memo)$/.test(name)) {
    focus = await focusWalk(page);
    if (focus.bad.length) problems.push(`초점 테가 안 보임 ${focus.bad.length}/${focus.visited}: ${focus.bad.slice(0, 4).join(' · ')}`);
    else if (focus.visited < 10) problems.push(`Tab으로 간 곳이 ${focus.visited}곳뿐`);
  }
  results.push({ name, ...t, nameless, errs, focus });
  r.check(!problems.length, `${name}: 지킬 것 통과 (옅은 디자인 대비 ${t.low.length - must.length}${t.favCount ? ` · ☆ ${t.favCount}` : ''}${focus ? ` · Tab ${focus.visited}곳` : ''})`, `${name}: ${problems.join(' / ')}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/a11y-${name.replace(/[/:]/g, '_')}.png` }).catch(() => {});
}

async function go(page, hash) {
  for (let i = 0; i < 3; i++) {
    await page.goto(page.url().replace(/#.*$/, hash));
    if (await waitFor(async () => new URL(page.url()).hash === hash, 3000)) return;
  }
}
const windowCount = (page) => page.locator('[data-window-key]').count();
const want = (name) => !ONLY || ONLY.test(name);

async function runSet(browser, set) {
  const { page, errors, dialogs } = await newPage(browser, {
    width: set.dev.width,
    height: set.dev.height,
    ...(set.dev.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  dialogs.answer = true;
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160));
  });
  await page.addInitScript((theme) => {
    try {
      localStorage.setItem('sp5_theme', theme);
    } catch {
      /* about:blank */
    }
  }, set.theme);
  await open(page, `#/day/${DAY}`);
  await waitFor(page.locator(sel('day-journal', DAY)), 10000);
  for (const [screen, hash] of SCREENS) {
    const name = `${set.name}/${screen}`;
    if (!want(name)) continue;
    await go(page, hash);
    await waitFor(page.locator(sel('screen', screen)), 8000);
    await page.waitForTimeout(1000);
    await measure(page, set, name, consoleErrors);
  }
  const wins = set.windows === 'all' ? WINDOWS : WINDOWS.filter(([w]) => set.windows.includes(w));
  if (wins.some(([w]) => want(`${set.name}/win:${w}`))) {
    await go(page, `#/day/${DAY}`);
    await waitFor(page.locator(sel('screen', 'day')), 8000);
    for (const [w, args] of wins) {
      const name = `${set.name}/win:${w}`;
      if (!want(name)) continue;
      await page.evaluate((a) => void window.sp5.openWindow(...a), args);
      if (!(await waitFor(async () => (await windowCount(page)) > 0, 6000))) {
        r.bad(`${name}: 창이 뜨지 않음`);
        continue;
      }
      await page.waitForTimeout(1200);
      await measure(page, set, name, consoleErrors);
      await page.evaluate(() => window.sp5.closeAllWindows());
      if (!(await waitFor(async () => (await windowCount(page)) === 0 && !(await page.evaluate(() => history.state?.sp5Sign)), 5000))) r.bad(`${name}: 창이 닫히지 않음`);
    }
  }
  r.check(!errors.length, `${set.name}: 화면 오류 없음`, `${set.name}: 화면 오류 ${errors.slice(0, 3).join(' / ')}`);
  await page.context().close();
}

try {
  for (const [coll, docs] of Object.entries(SEED)) {
    for (const [id, data] of Object.entries(docs)) {
      await setDoc(ref(coll, id), { ...data, ...stamp() });
      undo.add(() => deleteDoc(ref(coll, id)));
    }
  }
  undo.add(async () => {
    for (const c of ['items', 'labels', 'timetables']) for (const d of (await getDocs(collection(em.db, 'spaces', sid, c))).docs) if (d.id.startsWith('insp_ax_')) await deleteDoc(d.ref);
  });
  const beforeClasses = (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs.map((d) => [d.id, d.data()]);
  undo.add(async () => {
    for (const d of (await getDocs(collection(em.db, 'spaces', sid, 'classes'))).docs) await deleteDoc(d.ref);
    for (const [id, data] of beforeClasses) await setDoc(ref('classes', id), data);
  });
  await setDoc(ref('classes', CLASS_ID), { year: YEAR, grade: 5, num: 2, students, ...stamp() });

  const browser = await launch();
  try {
    for (const set of RUN_SETS) {
      if (SET_RE && !SET_RE.test(set.name)) continue;
      r.section(set.name);
      try {
        await runSet(browser, set);
      } catch (e) {
        r.bad(`${set.name}: 묶음이 멈췄다 ${e?.stack ?? e}`);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`\n(밝은 화면 디자인 대비 - 틀림 아님: ${designLow}곳)`);
  if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 1));
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await undo.run();
  r.done();
  process.exit();
}
