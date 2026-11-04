// tools/inspect-theme.mjs - P20-1 ■3: 색 테마 여덟 × 밝게/어둡게를 크롬으로 본다.
//   1) 화면 넷(하루·주간·월간·메모) + 창 둘(환경설정 보기 탭·새 일정 칸)에서 글자 대비가 기본 테마보다 떨어지지 않는다
//      (기본이 4.5 넘게 읽히던 글은 4.5 이상, 그 아래이던 글은 기본만큼 - 0.3까지 봐준다). 글자색 ↔ 칠한 바탕(inspect-mobile 본뜸).
//   2) 흰 글자 단추(고른 칩 bg-primary)가 4.5:1 · 토요일 파랑(cobalt)·이월(amber)은 테마가 바꾸지 않는다.
//   3) 인쇄 쪽([data-print-paper])은 어느 테마·밝기에서도 기본 밝은 색.
//   4) 고대비(P20-2 - html.hc): 16벌 모두 글자 7:1 (HC_MIN).
//   테마는 html data-palette를 손으로 바꿔 본다(계정 값은 건드리지 않는다 - 고르기·저장은 inspect-settings '색 테마').
//   SHOTS=<폴더>면 테마·밝기마다 하루·월간·환경설정 그림을 남긴다(눈으로 본다).
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-theme.mjs   (MATCH=forest 처럼 테마 하나만)
import { mkdirSync, readFileSync } from 'node:fs';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, waitFor } from './lib/probe.mjs';
import { deltaE, hexLch, simulateCvd } from '../src/domain/themeCss.ts';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const sid = `u_${uid}`;
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const ALL = JSON.parse(readFileSync('src/domain/palettes.json', 'utf8')).palettes.map((p) => p.id);
const PALETTES = ALL.filter((id) => id === 'default' || !process.env.MATCH || id === process.env.MATCH);

const DAY = '2026-10-08';
const HC_MIN = 7;
const VIEWS = [
  ['day', `#/day/${DAY}`],
  ['week', '#/week/2026-10-05'],
  ['month', '#/month/2026-10'],
  ['memo', '#/memo'],
  ['win:settings', ['settings']],
  ['win:event', ['event', { sid, date: DAY }]],
];

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
        if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
        const b = rgb(cs.backgroundColor);
        if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && b.a > 0.6) return b;
      }
      // 밝게 기본은 body 바탕이 투명(= 브라우저 흰 바탕) - 검정으로 셈하지 않게
      const body = rgb(getComputedStyle(document.body).backgroundColor);
      return body.a > 0.6 ? body : rgb('#fff');
    };
    const out = {};
    for (const el of document.querySelectorAll('body *')) {
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
      if (!text || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.5) continue;
      const bg = bgOf(el);
      if (!bg) continue;
      const [hi, lo] = [lum(rgb(cs.color)), lum(bg)].sort((a, b) => b - a);
      let tag = '';
      for (let e = el; e && !tag; e = e.parentElement) {
        const a = [...e.attributes].find((x) => x.name.startsWith('data-') && x.name !== 'data-palette');
        if (a) tag = `${a.name}=${a.value}`;
      }
      out[`${tag}|${text.slice(0, 24)}`] = Math.round(((hi + 0.05) / (lo + 0.05)) * 10) / 10;
    }
    return out;
  });

/** 테마가 바꾸지 않는 색 - 토요일 파랑(cobalt)·이월 노랑(amber)·인쇄 쪽 */
const fixedColors = (page) =>
  page.evaluate(() => {
    const probe = document.createElement('div');
    probe.innerHTML =
      '<i class="text-cobalt-500"></i><i class="text-amber-700 bg-amber-50"></i>' +
      '<div data-print-paper><i class="text-blue-600 bg-slate-100"></i><i class="text-slate-800 bg-white"></i></div>';
    document.body.append(probe);
    const out = [...probe.querySelectorAll('i')].map((e) => {
      const cs = getComputedStyle(e);
      return `${cs.color}/${cs.backgroundColor}`;
    });
    probe.remove();
    // 어둡게의 옅은 바탕은 테마 바탕과 섞는다(일부러 - theme.css --sp5-dark-surface) → 이월은 글자색만 견준다
    return { sat: out[0], amber: out[1].split('/')[0], paper: out.slice(2).join(' ') };
  });

/** 토스트·여러 개 고르기 띠(투명도가 붙은 진한 바탕) 위 글자 대비 - 어둡게에서 흰 바탕 + 흰 글자였다 (P20-2 ■1) */
const stripContrast = (page) =>
  page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const lumOf = (color) => {
      c.clearRect(0, 0, 1, 1);
      c.fillStyle = '#000';
      c.fillStyle = color;
      c.fillRect(0, 0, 1, 1);
      const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const box = document.createElement('div');
    box.innerHTML =
      '<div class="bg-slate-900/95 text-white"><span>띠</span><b class="text-slate-200">완료</b><b class="text-slate-400">끝</b><b class="text-amber-300">라벨</b></div>' +
      '<div class="bg-slate-900/90 text-white"><span>토스트</span></div><div class="bg-red-600/95 text-white"><span>오류</span></div>';
    document.body.append(box);
    const out = [...box.querySelectorAll('span,b')].map((e) => {
      const [hi, lo] = [lumOf(getComputedStyle(e).color), lumOf(getComputedStyle(e.parentElement).backgroundColor)].sort((a, b) => b - a);
      return [e.textContent, Math.round(((hi + 0.05) / (lo + 0.05)) * 10) / 10];
    });
    box.remove();
    return out;
  });

/** 화면에 칠해지는 뜻 색 (글자 600·옅은 바탕 100 - 색약 흉내로 견준다) */
const meaningColors = (page) =>
  page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const hex = (color) => {
      c.clearRect(0, 0, 1, 1);
      c.fillStyle = '#000';
      c.fillStyle = color;
      c.fillRect(0, 0, 1, 1);
      return `#${[...c.getImageData(0, 0, 1, 1).data.slice(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    };
    const box = document.createElement('div');
    box.innerHTML = ['emerald', 'red', 'amber'].map((h) => `<i data-h="${h}" class="text-${h}-600 bg-${h}-100"></i>`).join('');
    document.body.append(box);
    const out = Object.fromEntries(
      [...box.children].map((e) => {
        const cs = getComputedStyle(e);
        return [e.dataset.h, { text: hex(cs.color), bg: hex(cs.backgroundColor) }];
      }),
    );
    box.remove();
    return out;
  });

const CVD_KINDS = ['protan', 'deutan', 'tritan'];
const cvdWorst = (a, b) => Math.min(...CVD_KINDS.map((k) => deltaE(simulateCvd(hexLch(a), k), simulateCvd(hexLch(b), k))));
/** 뜻 색 셋 사이 가장 가까운 거리 (세 색약 중) */
const meaningGap = (m, part) => Math.min(cvdWorst(m.emerald[part], m.red[part]), cvdWorst(m.emerald[part], m.amber[part]));

/** 색으로만 나누던 곳의 모양 - 실제 자리는 inspect-space-overlay, 여기서는 켜고 끌 때 규칙이 맞는지 */
const cvdMarks = (page) =>
  page.evaluate(() => {
    const box = document.createElement('div');
    box.innerHTML = '<div data-event-space="u_x" class="block"></div><div data-event-space="g_x" class="block"></div><div data-event-card="a" data-event-space="g_x"></div><div data-conflict="true"></div>';
    document.body.append(box);
    const out = [...box.children].map((e) => getComputedStyle(e, '::before').content);
    box.remove();
    return out;
  });

const setClass = (page, cls, on) => page.evaluate(([c, v]) => document.documentElement.classList.toggle(c, v), [cls, on]);

const setPalette = (page, id) =>
  page.evaluate((p) => (p === 'default' ? document.documentElement.removeAttribute('data-palette') : document.documentElement.setAttribute('data-palette', p)), id);

async function go(page, hash) {
  await page.goto(page.url().replace(/#.*$/, hash));
  await waitFor(async () => new URL(page.url()).hash === hash, 5000);
}

const stamp = () => ({ deletedAt: null, updatedAt: serverTimestamp(), v: 1, createdAt: Date.now(), authorId: uid });
const PLANTED = [
  ['th_plain', { text: '테마점검 일정' }],
  ['th_label', { text: '테마점검 라벨', labelIds: ['th_label'] }],
  ['th_done', { text: '테마점검 완료', labelIds: ['th_label'], done: true }],
  ['th_soon', { text: '테마점검 기한', due: '2026-10-10' }],
  ['th_over', { text: '테마점검 지남', due: '2026-10-01' }],
];
const itemRef = (id) => doc(em.db, 'spaces', sid, 'items', id);
const labelRef = doc(em.db, 'spaces', sid, 'labels', 'th_label');

const browser = await launch();
try {
  // 라벨 칩은 라벨 색이 칠해져야 대비를 잰다
  await setDoc(labelRef, { kind: 'event', name: '테마라벨', color: 'purple', parentId: null, order: 'Zz9', ...stamp() });
  for (const [id, data] of PLANTED) await setDoc(itemRef(id), { kind: 'event', date: DAY, labelIds: [], ...data, ...stamp() });
  for (const dark of [false, true]) {
    const mode = dark ? '어둡게' : '밝게';
    const { page, errors } = await newPage(browser);
    await page.addInitScript((d) => localStorage.setItem('sp5_theme', d ? 'dark' : 'light'), dark);
    await open(page, `#/day/${DAY}`);
    // 색이 바뀌는 중간(transition)을 재지 않게
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
    /** 테마 → 보는 곳 → 대비 표 */
    const maps = {};
    const hcMaps = {};
    const cvd = {};
    const fixed = {};
    const accentOk = {};
    for (const [where, target] of VIEWS) {
      if (typeof target === 'string') {
        await go(page, target);
        await page.waitForTimeout(1500); // 사본·계산이 그려질 때까지
      } else {
        await page.evaluate((a) => window.sp5.openWindow(...a), target);
        await page.waitForTimeout(1200);
      }
      for (const id of PALETTES) {
        await setPalette(page, id);
        await page.waitForTimeout(150);
        (maps[id] ||= {})[where] = await contrastMap(page);
        if (where === 'month') {
          fixed[id] = await fixedColors(page);
          const plain = await meaningColors(page);
          await setClass(page, 'cvd', true);
          cvd[id] = { plain, on: await meaningColors(page), marks: await cvdMarks(page) };
          await setClass(page, 'cvd', false);
          cvd[id].off = await cvdMarks(page);
        }
        await setClass(page, 'hc', true);
        await page.waitForTimeout(100);
        (hcMaps[id] ||= {})[where] = await contrastMap(page);
        if (SHOTS && ['day', 'month', 'win:settings'].includes(where)) {
          await page.screenshot({ path: `${SHOTS}/${id}-${dark ? 'dark' : 'light'}-${where.replace('win:', '')}-hc.png` });
        }
        await setClass(page, 'hc', false);
        if (where === 'win:settings') {
          // 고른 칩(흰 글자 on bg-primary)
          accentOk[id] = await page.locator('[data-choice][aria-pressed="true"]').first().evaluate((el) => {
            const c = document.createElement('canvas').getContext('2d');
            const lumOf = (color) => {
              c.fillStyle = '#000';
              c.fillStyle = color;
              c.fillRect(0, 0, 1, 1);
              const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
              const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
              return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
            };
            const cs = getComputedStyle(el);
            const [hi, lo] = [lumOf(cs.color), lumOf(cs.backgroundColor)].sort((a, b) => b - a);
            return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
          });
        }
        if (SHOTS && ['day', 'month', 'win:settings'].includes(where)) {
          await page.screenshot({ path: `${SHOTS}/${id}-${dark ? 'dark' : 'light'}-${where.replace('win:', '')}.png` });
        }
      }
      if (typeof target !== 'string') {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    }
    await setPalette(page, 'default');

    r.section(`진한 띠 · ${mode}`);
    const strips = await stripContrast(page);
    const dim = strips.filter(([, v]) => v < 4.5);
    r.check(dim.length === 0, `토스트·여러 개 고르기 띠 글자 4.5:1 (${strips.map(([k, v]) => `${k} ${v}`).join(' · ')})`, `띠 글자가 안 읽힌다 - ${dim.map(([k, v]) => `${k} ${v}`).join(' · ')}`);

    for (const id of PALETTES.filter((p) => p !== 'default')) {
      r.section(`${id} · ${mode}`);
      for (const [where] of VIEWS) {
        const base = maps.default[where];
        const map = maps[id][where];
        const bad = Object.entries(map).filter(([k, v]) => base[k] !== undefined && v < Math.min(4.5, base[k]) - 0.3);
        r.check(
          bad.length === 0,
          `${where}: 글자 대비가 기본보다 떨어지지 않는다 (${Object.keys(map).length}곳)`,
          `${where}: 기본보다 안 읽히는 글 ${bad.length} - ${bad.slice(0, 5).map(([k, v]) => `${k} ${v} (기본 ${base[k]})`).join(' · ')}`,
        );
      }
      r.check(accentOk[id] >= 4.5, `흰 글자 on 강조(고른 칩) ${accentOk[id]}:1`);
      r.check(fixed[id].sat === fixed.default.sat, `토요일 파랑(cobalt)은 그대로 (${fixed[id].sat})`);
      r.check(fixed[id].amber === fixed.default.amber, `이월 노랑(amber) 글자는 그대로 (${fixed[id].amber})`);
      r.check(fixed[id].paper === fixed.default.paper, '인쇄 쪽은 기본 색');
    }
    for (const id of PALETTES) {
      r.section(`색약 배려 · ${id} · ${mode}`);
      const { plain, on, marks, off } = cvd[id];
      for (const part of ['text', 'bg']) {
        const was = meaningGap(plain, part);
        const now = meaningGap(on, part);
        r.check(now > was, `뜻 색(${part})이 더 잘 갈린다 ${was.toFixed(1)} → ${now.toFixed(1)}`, `뜻 색(${part}) ${was.toFixed(1)} → ${now.toFixed(1)}`);
      }
      r.check(on.amber.text === plain.amber.text, '이월 노랑은 그대로');
      r.check(marks.join() === '"🔒","👥",none,"⚠"', `겹친 일정·단축키 겹침에 모양 (${marks.join(' ')})`);
      r.check(off.every((c) => c === 'none'), '끄면 모양 없음');
    }
    for (const id of PALETTES) {
      r.section(`고대비 · ${id} · ${mode}`);
      for (const [where] of VIEWS) {
        const map = hcMaps[id][where];
        const bad = Object.entries(map).filter(([, v]) => v < HC_MIN);
        r.check(
          bad.length === 0,
          `${where}: 글자 ${HC_MIN}:1 (${Object.keys(map).length}곳)`,
          `${where}: ${HC_MIN}:1 아래 ${bad.length} - ${bad.slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' · ')}`,
        );
      }
    }
    if (!dark) {
      // 인쇄 쪽 = 밝게 기본 (어둡게에서도 같은 값이어야 한다 - 아래 어둡게 묶음이 밝게 기본과 견준다)
      globalThis.lightPaper = fixed.default.paper;
    } else {
      r.section('어둡게 · 인쇄 쪽');
      r.check(fixed.default.paper === globalThis.lightPaper, '어둡게에서도 인쇄 쪽은 밝게 기본 색');
    }
    r.check(errors.length === 0, `${mode}: 화면 오류 없음`, `${mode}: 화면 오류 ${errors.join(' | ')}`);
    await page.context().close();
  }
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  for (const [id] of PLANTED) await deleteDoc(itemRef(id)).catch(() => {});
  await deleteDoc(labelRef).catch(() => {});
  await browser.close();
  r.done();
  process.exit();
}
