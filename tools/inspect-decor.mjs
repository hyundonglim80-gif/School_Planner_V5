// tools/inspect-decor.mjs - P20-3 ■3: 꾸미기(머리줄 뒤 띠·빈 화면 그림)를 크롬으로 본다.
//   1) 띠가 머리줄 아래에 붙고, 머리줄 높이·가로 넘침이 그대로이고, 단추 누르기를 막지 않는다.
//   2) 띠 밑의 맨 글자(자기 바탕이 없는 글)는 띠의 가장 진한 빛깔을 띠 불투명도로 섞어 재도 읽힌다 -
//      4.5(큰 글자 3) 넘던 글은 그만큼, 그 아래이던 글은 띠 없을 때만큼(0.3까지 봐준다). 그림 5 × 색 테마 8 × 밝게/어둡게.
//   3) 빈 화면 그림: 일정·메모(하루)·메모 화면·찾기 넷 · 끄면 그 자리 원래 모습 · 동물은 자리마다 다른 그림.
//   4) 고대비면 띠만 쉰다 · 인쇄에는 그림이 없다 · 휴대폰 390px.
//   고르기·저장(계정)은 inspect-settings '꾸미기'. SHOTS=<폴더>면 그림 × 밝기 × PC·휴대폰 그림을 남긴다(눈으로 본다).
//
//   npm run emu · npm run dev:emu (켜 둔다) → node tools/inspect-decor.mjs   (MATCH=winter 처럼 그림 하나만)
import { mkdirSync, readFileSync } from 'node:fs';
import { doc, getDoc } from 'firebase/firestore';
import { emulator, launch, newPage, open, report, sel, serverUntil, waitFor } from './lib/probe.mjs';

const r = report();
const em = emulator();
const uid = await em.signIn('teacher@example.com');
const commonRef = doc(em.db, 'spaces', `u_${uid}`, 'settings', 'common');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const PALETTES = JSON.parse(readFileSync('src/domain/palettes.json', 'utf8')).palettes.map((p) => p.id);
const KINDS = ['spring', 'summer', 'autumn', 'winter', 'animal'].filter((k) => !process.env.MATCH || k === process.env.MATCH);

// 아무것도 심지 않은 날 - 일정·메모 칸이 비어 있다
const EMPTY_DAY = '2031-02-03';
const NO_HIT = '꾸미기점검없는글';
// 띠는 머리줄 테두리(border-b) 안쪽에 붙는다
const BORDER = 1;

const prefs = (page, fn, arg) =>
  page.evaluate(
    async ([body, a]) => {
      const m = await import(window.__appModule('/src/app/prefs.ts'));
      return new Function('m', 'a', `return (${body})(m, a)`)(m, a);
    },
    [fn.toString(), arg],
  );
const setDecor = async (page, kind) => {
  await prefs(page, (m, k) => m.setCommonSetting('decor', k), kind);
  if (kind === 'off') await waitFor(async () => (await page.locator(sel('decor-band')).count()) === 0, 3000);
  else await page.locator(sel('decor-band', kind)).waitFor({ state: 'attached', timeout: 5000 });
};
const commonLoaded = (page) => waitFor(async () => prefs(page, (m) => m.useCommonLoaded.getState().loaded), 10000);

const setPalette = (page, id) =>
  page.evaluate((p) => (p === 'default' ? document.documentElement.removeAttribute('data-palette') : document.documentElement.setAttribute('data-palette', p)), id);

async function go(page, hash) {
  await page.goto(page.url().replace(/#.*$/, hash));
  await waitFor(async () => new URL(page.url()).hash === hash, 5000);
}

/** 띠 밑 맨 글자: 띠 없을 때 대비 ↔ 가장 나쁜 띠 빛깔을 섞은 대비 (캔버스로 색을 rgb로 - Tailwind v4는 oklch) */
const bareText = (page) =>
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
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };
    const mix = (top, under, a) => ({ r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a) });

    const header = document.querySelector('header');
    const band = header.querySelector('[data-decor-band]');
    const bandStyle = getComputedStyle(band);
    const alpha = Number(bandStyle.opacity);
    // 띠가 쓰는 빛깔 모두 (animal은 여덟) - 아무 빛깔이나 글자 밑에 올 수 있다
    const tones = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => bandStyle.getPropertyValue(`--decor-${n}`).trim()).filter(Boolean).map(rgb);
    const under = rgb(getComputedStyle(header).backgroundColor);
    const out = [];
    for (const el of header.querySelectorAll('*')) {
      if (band.contains(el) || !el.getClientRects().length) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      // 머리줄까지 올라가며 자기 바탕이 있으면 띠는 그 뒤에 숨는다
      let covered = false;
      for (let e = el; e && e !== header; e = e.parentElement) if (rgb(getComputedStyle(e).backgroundColor).a > 0.6) covered = true;
      if (covered) continue;
      const text = rgb(cs.color);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      out.push({
        name: el.textContent.trim().slice(0, 14),
        large,
        plain: ratio(text, under),
        worst: Math.min(...tones.map((t) => ratio(text, mix(t, under, alpha)))),
      });
    }
    return out;
  });

const unreadable = (list) => list.filter((t) => t.worst < Math.min(t.large ? 3 : 4.5, t.plain) - 0.3);
const showBad = (bad) => bad.slice(0, 6).map((t) => `${t.name} ${t.plain} → ${t.worst}`).join(' · ');

const layout = (page) =>
  page.evaluate(() => {
    const header = document.querySelector('header').getBoundingClientRect();
    const band = document.querySelector('[data-decor-band]')?.getBoundingClientRect();
    return {
      height: Math.round(header.height),
      bandGap: band ? Math.round(Math.abs(band.bottom - header.bottom)) : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

/** 머리줄 단추 가운데를 눌렀을 때 그 단추가 받는가 */
const buttonsOnTop = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('header button')]
      .filter((b) => b.getClientRects().length)
      .filter((b) => {
        const box = b.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return !(hit && (b === hit || b.contains(hit)));
      })
      .map((b) => b.textContent.trim() || b.title),
  );

const browser = await launch();
try {
  for (const dark of [false, true]) {
    const mode = dark ? '어둡게' : '밝게';
    const { page, errors } = await newPage(browser);
    await page.addInitScript((d) => localStorage.setItem('sp5_theme', d ? 'dark' : 'light'), dark);
    await open(page, `#/day/${EMPTY_DAY}`);
    await commonLoaded(page);
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
    await setDecor(page, 'off');
    await page.locator(sel('event-empty')).waitFor({ timeout: 10000 });
    await page.locator(sel('journal-empty')).waitFor({ timeout: 10000 });

    r.section(`끄기 · ${mode}`);
    const before = await layout(page);
    r.check((await page.locator(sel('decor-spot')).count()) === 0, '그림이 없다');
    r.check((await page.locator(sel('event-empty')).textContent()).includes('📋'), '일정 칸은 원래 모습 (📋)');

    for (const kind of KINDS) {
      r.section(`${kind} · ${mode}`);
      await setDecor(page, kind);
      const now = await layout(page);
      r.check(now.height === before.height, `머리줄 높이 그대로 (${now.height})`, `머리줄 높이 ${before.height} → ${now.height}`);
      r.check(now.bandGap <= BORDER, '띠가 머리줄 아래에 붙는다', `띠 ↔ 머리줄 아래 ${now.bandGap}px`);
      r.check(now.overflow <= 0, '가로로 넘치지 않는다', `가로 넘침 ${now.overflow}px`);
      const blocked = await buttonsOnTop(page);
      r.check(blocked.length === 0, '머리줄 단추를 막지 않는다', `막힌 단추: ${blocked.join(' · ')}`);
      const events = page.locator(`${sel('event-empty')} ${sel('decor-spot', kind)}`);
      const journal = page.locator(`${sel('journal-empty')} ${sel('decor-spot', kind)}`);
      r.check((await events.count()) === 1 && (await journal.count()) === 1, '빈 일정·메모 칸에 그림');
      const size = await events.evaluate((e) => {
        const b = e.getBoundingClientRect();
        return [Math.round(b.width), Math.round(b.height), e.querySelectorAll('path, circle, ellipse').length];
      });
      r.check(size[0] === size[1] && size[0] >= 40 && size[2] > 0, `그림이 그려진다 (${size.join(' · ')})`);
      r.check(!(await page.locator(sel('event-empty')).textContent()).includes('📋'), '📋 대신 그림');
      r.check((await page.locator(sel('event-empty')).textContent()).includes('일정이 없습니다'), '안내 글은 그대로');
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${kind}-${dark ? 'dark' : 'light'}-pc.png`, clip: { x: 0, y: 0, width: 1400, height: 340 } });

      for (const [view, hash] of [
        ['하루', `#/day/${EMPTY_DAY}`],
        ['메모', '#/memo'],
      ]) {
        await go(page, hash);
        await page.locator(sel('decor-band', kind)).waitFor({ state: 'attached' });
        const bad = [];
        let count = 0;
        for (const id of PALETTES) {
          await setPalette(page, id);
          const list = await bareText(page);
          count = list.length;
          bad.push(...unreadable(list).map((t) => ({ ...t, name: `${id} ${t.name}` })));
        }
        await setPalette(page, 'default');
        // 메모 화면은 둘째 줄이 없고 SP5는 바탕이 있어 잴 글자가 없을 수 있다 - 하루 화면은 날짜 글자를 꼭 잰다
        r.check((count > 0 || view === '메모') && bad.length === 0, `${view}: 띠 밑 글자가 읽힌다 (${count}곳 × 테마 ${PALETTES.length})`, `${view}: 안 읽히는 글 ${bad.length} - ${showBad(bad)}`);
      }
      await go(page, `#/day/${EMPTY_DAY}`);
      await page.locator(sel('event-empty')).waitFor();
    }

    r.section(`고대비 · 인쇄 · ${mode}`);
    const kind = KINDS.at(-1);
    await setDecor(page, kind);
    await page.evaluate(() => document.documentElement.classList.add('hc'));
    r.check(!(await page.locator(sel('decor-band')).isVisible()), '고대비면 띠가 쉰다');
    r.check(await page.locator(sel('decor-spot')).first().isVisible(), '빈 화면 그림은 그대로');
    await page.evaluate(() => document.documentElement.classList.remove('hc'));
    await page.emulateMedia({ media: 'print' });
    r.check(!(await page.locator(sel('decor-spot')).first().isVisible()), '인쇄에는 빈 화면 그림이 없다');
    await page.emulateMedia({ media: 'screen' });

    r.section(`다른 빈 곳 · ${mode}`);
    await setDecor(page, 'animal');
    const drawing = (l) => l.evaluate((e) => e.innerHTML);
    const cat = await drawing(page.locator(`${sel('event-empty')} ${sel('decor-spot')}`));
    const dog = await drawing(page.locator(`${sel('journal-empty')} ${sel('decor-spot')}`));
    await go(page, '#/memo');
    await page.locator(sel('filter-chip', 'all')).or(page.locator(sel('memo-screen'))).first().waitFor();
    const memoSpot = page.locator(`${sel('memo-empty')} ${sel('decor-spot')}`);
    const rabbit = (await waitFor(memoSpot, 4000)) ? await drawing(memoSpot) : null;
    await page.evaluate(() => window.sp5.openWindow('search'));
    await page.locator(sel('search-input')).fill(NO_HIT);
    const searchSpot = page.locator(`${sel('search-empty')} ${sel('decor-spot')}`);
    r.check(await waitFor(searchSpot, 6000), '찾는 글이 없는 칸에 그림');
    const chick = await drawing(searchSpot);
    await page.keyboard.press('Escape');
    const faces = [cat, dog, chick, ...(rabbit ? [rabbit] : [])];
    r.check(new Set(faces).size === faces.length, `빈 곳마다 다른 동물 (${faces.length}곳${rabbit ? '' : ' - 즐겨찾기가 있어 메모 칸은 못 봄'})`);

    await setDecor(page, 'off');
    r.check(errors.length === 0, `${mode}: 화면 오류 없음`, `${mode}: 화면 오류 ${errors.join(' | ')}`);
    await page.waitForTimeout(1500);
    await page.context().close();
  }

  r.section('휴대폰 390px');
  const phone = await newPage(browser, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await phone.page.addInitScript(() => localStorage.setItem('sp5_theme', 'light'));
  await open(phone.page, `#/day/${EMPTY_DAY}`);
  await commonLoaded(phone.page);
  const plain = await layout(phone.page);
  for (const kind of KINDS) {
    await setDecor(phone.page, kind);
    const now = await layout(phone.page);
    r.check(now.height === plain.height && now.bandGap <= BORDER, `${kind}: 머리줄 높이 그대로·띠가 아래에 (${now.height})`, `${kind}: 높이 ${plain.height} → ${now.height}, 띠 ${now.bandGap}px`);
    const bad = unreadable(await bareText(phone.page));
    r.check(bad.length === 0, `${kind}: 띠 밑 글자가 읽힌다`, `${kind}: 안 읽히는 글 - ${showBad(bad)}`);
    if (SHOTS) {
      await phone.page.locator(sel('event-empty')).scrollIntoViewIfNeeded().catch(() => {});
      await phone.page.screenshot({ path: `${SHOTS}/${kind}-light-phone.png` });
      await phone.page.evaluate(() => window.scrollTo(0, 0));
    }
  }
  await setDecor(phone.page, 'off');
  const left = await serverUntil(async () => (await getDoc(commonRef)).data() ?? {}, (d) => d.decor === undefined);
  r.check(left.decor === undefined, '끝에 계정 값을 걷는다');
  await phone.page.context().close();
} catch (e) {
  r.bad(`점검이 멈췄다: ${e?.stack ?? e}`);
} finally {
  await browser.close();
  r.done();
  process.exit();
}
