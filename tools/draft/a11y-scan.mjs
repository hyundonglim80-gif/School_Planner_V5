// 초안 (P61 11-27 클라우드 - 스크래치에서 쓴 접근성 측정). P62가 tools/inspect-a11y.mjs로 다듬어 들인다 - 이 파일은 그때 지운다.
// 실행: 연습용 서버 + seed + 개발 서버(5175) → node tools/draft/a11y-scan.mjs (SETS=pc1400,ph390,pc1400-dark,ph390-dark · SHOTS=1 · NOWIN=1)
// 접근성·편의 측정 (점검용 - 저장소 밖). 연습용 서버 + 개발 서버(5175)가 떠 있어야 한다.
// 상황마다: 읽어 주는 이름 없는 누를 것(크롬 접근성 트리) · 글씨 대비(WCAG 4.5:1 / 큰 글 3:1) · 11px 아래 글씨 · 콘솔 오류·경고 · 키보드 초점 표시(PC)
import { writeFileSync, mkdirSync } from 'node:fs';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, restorer, sel, waitFor } from '../lib/probe.mjs';

const OUTDIR = process.env.OUTDIR || '/home/user/School_Planner_V5/tools/report/a11y';
mkdirSync(OUTDIR, { recursive: true });
const em = emulator('ax');
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const undo = restorer();
const DAY = '2026-10-14';
const MONDAY = '2026-10-12';
const now = new Date();
const YEAR = now.getMonth() + 1 >= 3 ? now.getFullYear() : now.getFullYear() - 1;
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
  timetables: { insp_ax_tt: { name: '2학기 시간표', from: `${YEAR - 1}-03-01`, to: `${YEAR + 1}-02-28`, grid: { 1: WEEK, 2: WEEK, 3: WEEK, 4: WEEK, 5: WEEK } } },
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
  ['search', ['search']],
  ['labels-note', ['labels', { tab: 'note' }]],
  ['timetable', ['timetable']],
  ['attendance', ['attendance', { date: DAY, classId: CLASS_ID }]],
  ['notices', ['notices', { sid, date: DAY }]],
  ['seating', ['seating', { classId: CLASS_ID }]],
  ['help', ['help']],
  ['backup', ['backup']],
  ['trash', ['trash']],
  ['links', ['links', { sid, id: 'insp_ax_n1' }]],
  ['linker', ['linker', { sid, id: 'insp_ax_n1' }]],
  ['dayNotes', ['dayNotes', { sid, date: DAY }]],
  ['note-new', ['note', { sid, date: DAY }]],
  ['settings-app', ['settings', { tab: 'app' }]],
  ['settings-notify', ['settings', { tab: 'notify' }]],
  ['settings-school', ['settings', { tab: 'school' }]],
  ['settings-shortcuts', ['settings', { tab: 'shortcuts' }]],
  ['labels-event', ['labels', { tab: 'event' }]],
  ['progress', ['progress']],
  ['evaluation', ['evaluation', { sid, date: DAY, at: 1 }]],
  ['evalOverview', ['evalOverview']],
  ['studentRecord', ['studentRecord', { classId: CLASS_ID, sid: 'ax1', at: 1 }]],
  ['chat', ['chat']],
  ['clipboard', ['clipboard']],
  ['print', ['print', { date: DAY, scope: 'day' }]],
  ['newYear', ['newYear', { year: YEAR + 1 }]],
  ['group', ['group']],
  ['dday', ['dday']],
  ['weeklyGuide', ['weeklyGuide', { date: MONDAY }]],
  ['drafts', ['drafts']],
];

// ── 화면 안에서 재기 ──
function scanText() {
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
  const bodyBg = rgba(getComputedStyle(document.body).backgroundColor);
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/url\(/.test(cs.backgroundImage) === false) return null;
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
  const tag = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const d = [...e.attributes].find((a) => a.name.startsWith('data-') && !['data-glyph', 'data-icon'].includes(a.name));
      if (d) return `[${d.name}${d.value ? `="${d.value.slice(0, 24)}"` : ''}]`;
    }
    return el.tagName.toLowerCase();
  };
  const lowContrast = [];
  const tiny = [];
  const seen = new Set();
  const all = document.body.querySelectorAll('*');
  for (const el of all) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (!own) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1 || rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.display === 'none') continue;
    let op = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
    if (op < 0.99) continue; // 흐린 것(꺼진 단추·꾸미기)은 뺀다
    if (el.closest('[disabled],[aria-disabled="true"],[aria-hidden="true"],[data-build-id]')) continue;
    if (el.closest('svg')) continue;
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const key = `${tag(el)}|${own.slice(0, 20)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (size < 10.95) tiny.push({ at: tag(el), text: own.slice(0, 24), size: Math.round(size * 10) / 10 });
    const bg = bgOf(el);
    if (!bg) continue;
    const fg0 = rgba(cs.color);
    const fg = over(fg0, bg);
    const L1 = lum(fg);
    const L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) lowContrast.push({ at: tag(el), text: own.slice(0, 24), ratio: Math.round(ratio * 100) / 100, need, size: Math.round(size * 10) / 10, color: cs.color });
  }
  const doc = document.documentElement;
  return { lowContrast, tiny, wide: doc.scrollWidth > innerWidth + 1 ? doc.scrollWidth : 0, nodes: all.length };
}

const ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'combobox', 'textbox', 'searchbox', 'menuitem', 'tab', 'switch', 'slider', 'spinbutton']);
async function namelessControls(page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const out = [];
    for (const n of nodes) {
      if (n.ignored) continue;
      const role = n.role?.value;
      if (!ROLES.has(role)) continue;
      const name = (n.name?.value ?? '').trim();
      if (name) continue;
      let desc = role;
      if (n.backendDOMNodeId) {
        try {
          const { node } = await cdp.send('DOM.describeNode', { backendNodeId: n.backendDOMNodeId, depth: 1 });
          const attrs = node.attributes ?? [];
          const pairs = [];
          for (let i = 0; i < attrs.length; i += 2) if (attrs[i].startsWith('data-') || attrs[i] === 'type' || attrs[i] === 'placeholder') pairs.push(`${attrs[i]}${attrs[i + 1] ? `="${attrs[i + 1].slice(0, 20)}"` : ''}`);
          desc = `${role} <${node.nodeName.toLowerCase()} ${pairs.join(' ')}>`;
        } catch {
          /* 없어진 노드 */
        }
      }
      out.push(desc);
    }
    return out;
  } finally {
    await cdp.detach().catch(() => {});
  }
}

async function focusWalk(page, n = 30) {
  await page.mouse.click(2, 300).catch(() => {});
  await page.evaluate(() => document.activeElement?.blur?.());
  const bad = [];
  let visited = 0;
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const ring = cs.boxShadow && cs.boxShadow !== 'none';
      const r = el.getBoundingClientRect();
      const d = [...el.attributes].find((a) => a.name.startsWith('data-'));
      return { visible: outline || ring, onScreen: r.width > 0 && r.bottom > 0 && r.top < innerHeight, at: `${el.tagName.toLowerCase()}${d ? `[${d.name}]` : ''}`, text: (el.getAttribute('aria-label') || el.title || el.textContent || '').trim().slice(0, 16) };
    });
    if (!info) continue;
    visited++;
    if (!info.visible || !info.onScreen) bad.push(`${info.at} "${info.text}"${info.onScreen ? '' : ' (화면 밖)'}`);
  }
  return { visited, bad };
}

const results = [];
async function measure(page, name, dev, consoleMsgs) {
  await page.waitForTimeout(400);
  const t = await page.evaluate(scanText);
  const nameless = await namelessControls(page);
  const focus = dev.mobile || !/^(pc1400\/(day|memo|board)|pc1400\/win:(note-edit|settings-view|event-new))$/.test(name) ? null : await focusWalk(page);
  const msgs = consoleMsgs.splice(0);
  results.push({ name, ...t, nameless, focus, console: msgs });
  console.log(`${name}: 대비 ${t.lowContrast.length} · 작은 글씨 ${t.tiny.length} · 이름 없음 ${nameless.length} · 콘솔 ${msgs.length}${t.wide ? ` · 가로 넘침 ${t.wide}` : ''}${focus ? ` · 초점 안 보임 ${focus.bad.length}/${focus.visited}` : ''} · 요소 ${t.nodes}`);
  if (process.env.SHOTS) await page.screenshot({ path: `${OUTDIR}/${name.replace(/[/:]/g, '_')}.png` }).catch(() => {});
}

async function go(page, hash) {
  for (let i = 0; i < 3; i++) {
    await page.goto(page.url().replace(/#.*$/, hash));
    if (await waitFor(async () => new URL(page.url()).hash === hash, 3000)) return;
  }
}
const windowCount = (page) => page.locator('[data-window-key]').count();

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
    const ALLSETS = [
      ['pc1400', { width: 1400, height: 900 }, 'light'],
      ['ph390', { width: 390, height: 844, mobile: true }, 'light'],
      ['pc1400-dark', { width: 1400, height: 900 }, 'dark'],
      ['ph390-dark', { width: 390, height: 844, mobile: true }, 'dark'],
    ];
    const want = process.env.SETS ? process.env.SETS.split(',') : ALLSETS.map((x) => x[0]);
    for (const [setName, dev, theme] of ALLSETS.filter((x) => want.includes(x[0]))) {
      const { page, errors, dialogs } = await newPage(browser, { width: dev.width, height: dev.height, ...(dev.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
      dialogs.answer = true;
      const consoleMsgs = [];
      page.on('console', (m) => {
        if (['error', 'warning'].includes(m.type())) consoleMsgs.push(`${m.type()}: ${m.text().slice(0, 160)}`);
      });
      await page.addInitScript((t) => {
        try {
          localStorage.setItem('sp5_theme', t);
        } catch {
          /* */
        }
      }, theme);
      await open(page, `#/day/${DAY}`);
      await waitFor(page.locator(sel('day-journal', DAY)), 10000);
      for (const [screen, hash] of SCREENS) {
        await go(page, hash);
        await waitFor(page.locator(sel('screen', screen)), 8000);
        await page.waitForTimeout(1000);
        await measure(page, `${setName}/${screen}`, dev, consoleMsgs);
      }
      if (!process.env.NOWIN) {
        await go(page, `#/day/${DAY}`);
        await waitFor(page.locator(sel('screen', 'day')), 8000);
        for (const [w, args] of WINDOWS) {
          await page.evaluate((a) => void window.sp5.openWindow(...a), args);
          if (!(await waitFor(async () => (await windowCount(page)) > 0, 6000))) {
            console.log(`${setName}/win:${w}: 창이 뜨지 않음`);
            continue;
          }
          await page.waitForTimeout(1200);
          await measure(page, `${setName}/win:${w}`, dev, consoleMsgs);
          await page.evaluate(() => window.sp5.closeAllWindows());
          await waitFor(async () => (await windowCount(page)) === 0 && !(await page.evaluate(() => history.state?.sp5Sign)), 5000);
        }
      }
      if (errors.length) console.log(`${setName} 화면 오류: ${errors.slice(0, 5).join(' / ')}`);
      results.push({ name: `${setName}/pageerrors`, errors });
      await page.context().close();
    }
  } finally {
    await browser.close();
  }
} catch (e) {
  console.log(`멈춤: ${e?.stack ?? e}`);
} finally {
  writeFileSync(`${OUTDIR}/result.json`, JSON.stringify(results, null, 1));
  await undo.run();
  process.exit();
}
