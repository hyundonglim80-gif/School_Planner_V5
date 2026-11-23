// tools/lib/uiOverlap.mjs - 단추 겹침·불편 재기 (P57-1). inspect-ui-overlap이 상황마다 부른다.
//
// 보이는 누를 것(button·a·role=button/tab…·입력 칸·cursor:pointer 뿌리)마다:
//   cover  가림 - 가운데 점을 다른 것이 받는다(elementFromPoint) = 눌러도 그것이 눌린다
//   overlap 겹침 - 서로 품지 않는 둘이 작은 쪽 넓이의 15% 넘게 겹친다
//   small  작은 누를 곳 - 휴대폰에서 폭·높이 24px 아래 (WCAG 2.5.8 - 글 속 링크는 뺀다)
//   spill  단추 글이 단추 밖으로 나간다(넘침이 보임)
//   cut    말줄임(…) 없이 잘린 글 - 제 칸(overflow hidden)이나 둘레 칸이 자른다
//   wide   본문이 화면 폭보다 넓다(가로 넘침)
// 빼는 것: 투명(올렸을 때만 보이는 것 - 올린 상황에서 따로 잰다) · 반 넘게 스크롤 밖 · 창이 덮은 뒤 화면(화면 40% 넘는 고정 층) ·
//   붙은 머리줄·탭바 밑으로 스크롤된 것(스크롤하면 드러난다 - 더 내리거나 올릴 자리가 없을 때만 셈) · IGNORE(일부러 그런 것, 까닭과 함께).
// 큰 스크롤 칸(문서·창 본문)은 한 화면씩 내려 가며 잰다(맨 아래까지 - 탭바 밑에 남는 것을 본다).

/** 일부러 그런 것 - [종류, 이 이름(정규식), 상대 이름(정규식 - 없으면 아무거나), 까닭] */
export const IGNORE = [
  ['overlap', /^(month-day|period-)/, /(^|@)period-/, '월간 기간 막대는 날 칸 위에 겹쳐 그린다(막대·칩을 누르면 일정·완료, 빈 곳은 날)'],
  ['cover', /^(month-day|period-)/, /(^|@)period-/, '월간 기간 막대는 날 칸 위에 겹쳐 그린다'],
  ['overlap', /^filter-chip/, /^filter-caret/, '라벨로 보기 상위 칩의 펴기 꺾쇠는 칩 안쪽 왼끝에 겹쳐 둔 단추(꺾쇠 = 펴기, 나머지 = 고르기)'],
  ['overlap', /^(note-text-input|note-table|table-)/, /(^|@)table-/, '표 띠는 칸을 고른 동안 표 제목 줄 자리에 겹쳐 뜬다(P49-2 - 흐름 밖에 띄워 표가 밀리지 않게, 본문을 누르면 접힘)'],
  ['cover', /^(note-text-input|note-table|table-)/, /(^|@)table-/, '표 띠는 칸을 고른 동안 표 제목 줄 자리에 겹쳐 뜬다(P49-2)'],
  ['overlap', /^check-(up|down|toggle|line)/, /^note-text-input/, '체크 줄 ▲▼·☐는 글 칸 위 덧그림(P10-5 CheckLinesOverlay - 글 칸 하나 + 덧그림)'],
  ['overlap', /^note-text-input/, /^check-(up|down|toggle|line)/, '체크 줄 ▲▼·☐는 글 칸 위 덧그림(P10-5 CheckLinesOverlay)'],
  ['spill', /^week-event-delete/, /^week-event/, '주간 일정 ✕는 카드 모서리에 걸친 배지(올렸을 때만 - 휴대폰은 일정 칸에서 지운다)'],
  ['overlap', /^year-/, /^year-/, '년간 학사력 기간 줄은 날 칸 위에 겹쳐 그린다'],
  ['cover', /^year-/, /^year-/, '년간 학사력 기간 줄은 날 칸 위에 겹쳐 그린다'],
];

/** 화면 안에서 돈다 - page.evaluate(scanInPage, opts) */
export function scanInPage({ width, height, mobile, minTarget = 24 }) {
  const CLICK =
    'button, a[href], [role=button], [role=tab], [role=checkbox], [role=radio], [role=switch], [role=menuitem], [role=option], input:not([type=hidden]), select, textarea, summary, [contenteditable=""], [contenteditable=true]';
  const STATE_ATTR = /^data-(on|open|active|selected|state|theme|tone|variant|size|glyph|icon|done|pick-on|dark|dense|hover|tip|testid|edge|side|kind|mode|count|n)$/;
  const styles = new Map();
  const st = (el) => {
    let s = styles.get(el);
    if (!s) styles.set(el, (s = getComputedStyle(el)));
    return s;
  };
  const clean = (v) =>
    v
      .replace(/insp_[a-z0-9_]+/gi, 'id')
      .replace(/\b[A-Za-z0-9]{16,}\b/g, 'id')
      .replace(/\|/g, '/')
      .slice(0, 28);
  const dataName = (el) => {
    const a = [...el.attributes].find((x) => x.name.startsWith('data-') && !STATE_ATTR.test(x.name));
    if (!a) return '';
    const v = clean(a.value);
    return `${a.name.slice(5)}${v && v !== 'true' && v.length <= 24 ? `=${v}` : ''}`;
  };
  const glyphOf = (el) => [...el.querySelectorAll('[data-glyph]')].map((g) => g.getAttribute('data-glyph')).join('');
  const textOf = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim().replace(/\s+/g, ' ');
  const nameOf = (el) => {
    const own = dataName(el);
    if (own) return own;
    let up = '';
    for (let e = el.parentElement; e && !up; e = e.parentElement) up = dataName(e);
    const raw = `${glyphOf(el)}${textOf(el)}`;
    const t = raw.length > 24 && el.children.length > 2 ? '' : clean(raw).slice(0, 14);
    return `${el.tagName.toLowerCase()}${t ? `「${t}」` : ''}${up ? `@${up}` : ''}`;
  };

  // ── 누를 것 모으기 ──
  const cands = new Set(document.querySelectorAll(CLICK));
  for (const el of document.body.querySelectorAll('*')) {
    if (st(el).cursor === 'pointer' && (!el.parentElement || st(el.parentElement).cursor !== 'pointer')) cands.add(el);
  }
  const opacityOf = (el) => {
    let o = 1;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) o *= Number(st(e).opacity);
    return o;
  };
  const fixedOf = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) if (st(e).position === 'fixed') return e;
    return null;
  };
  const isOverlay = (f) => {
    if (!f) return false;
    const b = f.getBoundingClientRect();
    return Math.max(0, Math.min(b.right, width) - Math.max(b.left, 0)) * Math.max(0, Math.min(b.bottom, height) - Math.max(b.top, 0)) >= 0.4 * width * height;
  };
  /** 보이는 몫(둘레 스크롤·숨김 칸과 화면으로 자름) + 숨김 칸이 자른 폭 */
  const clipOf = (el) => {
    const r = el.getBoundingClientRect();
    let box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    let cutX = 0;
    let cutY = 0;
    let cutBy = null;
    for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const cs = st(e);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const p = e.getBoundingClientRect();
        const inner = { l: p.left + e.clientLeft, t: p.top + e.clientTop, r: p.left + e.clientLeft + e.clientWidth, b: p.top + e.clientTop + e.clientHeight };
        // 세로 스크롤 칸은 CSS가 가로도 auto로 바꾼다 - 가로 밀기를 뜻한 칸(overflow-x만 auto)이 아니면 가로로 자른 것은 잘림
        const scrollX = /auto|scroll/.test(cs.overflowX) && !/auto|scroll/.test(cs.overflowY);
        const scrollY = /auto|scroll/.test(cs.overflowY);
        const nb = {
          l: cs.overflowX === 'visible' ? box.l : Math.max(box.l, inner.l),
          r: cs.overflowX === 'visible' ? box.r : Math.min(box.r, inner.r),
          t: cs.overflowY === 'visible' ? box.t : Math.max(box.t, inner.t),
          b: cs.overflowY === 'visible' ? box.b : Math.min(box.b, inner.b),
        };
        if (!scrollX && cs.overflowX !== 'visible' && box.r - box.l - Math.max(0, nb.r - nb.l) > cutX) {
          cutX = box.r - box.l - Math.max(0, nb.r - nb.l);
          cutBy = e;
        }
        if (!scrollY && cs.overflowY !== 'visible' && box.b - box.t - Math.max(0, nb.b - nb.t) > cutY) {
          cutY = box.b - box.t - Math.max(0, nb.b - nb.t);
          cutBy = cutBy ?? e;
        }
        box = nb;
      }
      if (cs.position === 'fixed') break;
    }
    box = { l: Math.max(box.l, 0), t: Math.max(box.t, 0), r: Math.min(box.r, width), b: Math.min(box.b, height) };
    const area = Math.max(0, box.r - box.l) * Math.max(0, box.b - box.t);
    return { r, box, area, full: r.width * r.height, cutX, cutY, cutBy };
  };

  const items = [];
  for (const el of cands) {
    if (!el.isConnected || !el.getClientRects().length) continue;
    const cs = st(el);
    if (cs.visibility !== 'visible' || cs.pointerEvents === 'none') continue;
    if (el.disabled || el.getAttribute('aria-hidden') === 'true') continue;
    if (el.closest('[aria-hidden="true"], [inert]')) continue;
    if (opacityOf(el) < 0.15) continue; // 올렸을 때만 보이는 것
    const c = clipOf(el);
    if (c.full < 4 || c.area < 0.5 * c.full) continue; // 반 넘게 스크롤 밖
    items.push({ el, ...c, name: nameOf(el) });
  }

  const out = [];
  const add = (kind, it, other, detail) => out.push({ kind, name: it.name, other: other ? nameOf(other) : '', detail });

  // ── 가림 ──
  const scrollerOf = (el) => {
    for (let e = el.parentElement; e; e = e.parentElement) {
      if (e === document.body || e === document.documentElement) return document.scrollingElement;
      const cs = st(e);
      if (/auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1) return e;
    }
    return document.scrollingElement;
  };
  /** 고정·붙은 것(머리줄·탭바·둥근 ＋·가장자리 탭) 밑에 든 것이 스크롤하면 드러나나 - 더 내릴 자리·올릴 자리로 그 밑을 벗어나면 */
  const revealable = (bar, el) => {
    const fb = bar.getBoundingClientRect();
    const eb = el.getBoundingClientRect();
    const sc = scrollerOf(el);
    const down = sc.scrollHeight - sc.scrollTop - sc.clientHeight; // 더 내리면 el이 위로 간다
    return down > eb.bottom - fb.top + 1 || sc.scrollTop > fb.bottom - eb.top + 1;
  };
  /** el 위로 가장 가까운 고정·붙은 층 가운데 other를 품지 않는 것 - other를 덮는 층(창 칸 안의 붙은 탭 줄이면 그 줄) */
  const barOver = (el, other) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const p = st(e).position;
      if ((p === 'fixed' || p === 'sticky') && !e.contains(other)) return e;
      if (e.contains(other)) return null;
    }
    return null;
  };
  /** 보이는 글의 상자 - 글 조각마다, 그 사이 숨김 칸이 자른 만큼 걷고(안쪽 칸이 이미 자른 글은 그 칸의 잘림), 투명한 것은 뺀다 */
  const textBox = (el) => {
    let l = Infinity;
    let t = Infinity;
    let r = -Infinity;
    let b = -Infinity;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const box = range.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const bx = { l: box.left, t: box.top, r: box.right, b: box.bottom };
      let hide = false;
      for (let e = n.parentElement; e && e !== el; e = e.parentElement) {
        const cs = st(e);
        // 일부러 띄운 것(개수 배지 등 absolute)은 제 칸 밖이 뜻 - 이름이 있으면 따로 잰다
        if (cs.visibility !== 'visible' || Number(cs.opacity) < 0.15 || cs.position === 'absolute' || cs.position === 'fixed') {
          hide = true;
          break;
        }
        const p = e.getBoundingClientRect();
        if (cs.overflowX !== 'visible') {
          bx.l = Math.max(bx.l, p.left);
          bx.r = Math.min(bx.r, p.right);
        }
        if (cs.overflowY !== 'visible') {
          bx.t = Math.max(bx.t, p.top);
          bx.b = Math.min(bx.b, p.bottom);
        }
      }
      if (hide || bx.r <= bx.l || bx.b <= bx.t) continue;
      l = Math.min(l, bx.l);
      t = Math.min(t, bx.t);
      r = Math.max(r, bx.r);
      b = Math.max(b, bx.b);
    }
    return l === Infinity ? null : { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  };
  const okItems = [];
  for (const it of items) {
    let { l, t, r: rr, b } = it.box;
    const rects = it.el.getClientRects();
    if (rects.length > 1) {
      const big = [...rects].sort((x, y) => y.width * y.height - x.width * x.height)[0];
      l = Math.max(l, big.left);
      rr = Math.min(rr, big.right);
      t = Math.max(t, big.top);
      b = Math.min(b, big.bottom);
    }
    const cx = (l + rr) / 2;
    const cy = (t + b) / 2;
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || hit === it.el || it.el.contains(hit)) {
      okItems.push(it);
      continue;
    }
    // 바닥 글(label 안 input 등) - 누르면 그것이 그것을 누른다
    if (hit.tagName === 'LABEL' && hit.control === it.el) {
      okItems.push(it);
      continue;
    }
    const f = barOver(hit, it.el);
    if (f) {
      if (isOverlay(f)) continue; // 창이 덮은 뒤 화면
      if (revealable(f, it.el)) continue;
    }
    add('cover', it, hit, `${Math.round(cx)},${Math.round(cy)}`);
    okItems.push(it); // 겹침도 본다
  }

  // ── 겹침 ──
  for (let i = 0; i < okItems.length; i++) {
    const a = okItems[i];
    for (let j = i + 1; j < okItems.length; j++) {
      const b = okItems[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.box.r, b.box.r) - Math.max(a.box.l, b.box.l);
      const h = Math.min(a.box.b, b.box.b) - Math.max(a.box.t, b.box.t);
      if (w <= 1 || h <= 1) continue;
      const small = Math.min(a.area, b.area);
      if (w * h <= 0.15 * small) continue;
      const fa = fixedOf(a.el);
      const fb = fixedOf(b.el);
      if (fa !== fb && (isOverlay(fa) || isOverlay(fb))) continue; // 창 층 ⨯ 뒤 화면
      // 붙은 줄 밑으로 스크롤된 것 - 스크롤하면 드러난다
      const ba = barOver(a.el, b.el);
      const bb = barOver(b.el, a.el);
      if ((ba && revealable(ba, b.el)) || (bb && revealable(bb, a.el))) continue;
      // label과 그 입력 칸
      if ((a.el.tagName === 'LABEL' && a.el.control === b.el) || (b.el.tagName === 'LABEL' && b.el.control === a.el)) continue;
      out.push({ kind: 'overlap', name: a.name, other: b.name, detail: `${Math.round(w)}×${Math.round(h)}` });
    }
  }

  // ── 작은 누를 곳 (휴대폰) ──
  if (mobile) {
    for (const it of okItems) {
      const { width: w, height: h } = it.r;
      if (w >= minTarget && h >= minTarget) continue;
      const cs = st(it.el);
      // 글 속 링크(줄 안)는 WCAG도 뺀다
      if (it.el.tagName === 'A' && cs.display === 'inline') continue;
      add('small', it, null, `${Math.round(w)}×${Math.round(h)}`);
    }
  }

  // ── 글 넘침·잘림 - 잎 단추 + 이름(data-*) 붙은 잎 글(누르지 않는 칩·칸 이름) ──
  const candEls = new Set(items.map((x) => x.el));
  const textItems = okItems.filter((it) => it.r.height <= 80 && ![...it.el.querySelectorAll('*')].some((c) => candEls.has(c) || cands.has(c)));
  const named = (e) => !!dataName(e) && !!(e.textContent || '').trim();
  for (const el of document.body.querySelectorAll('*')) {
    if (cands.has(el) || !named(el) || [...el.querySelectorAll('*')].some(named)) continue;
    if (!el.getClientRects().length || st(el).visibility !== 'visible' || opacityOf(el) < 0.15) continue;
    if (el.closest('[aria-hidden="true"], [inert]')) continue;
    const c = clipOf(el);
    if (c.r.height > 80 || c.full < 4 || c.area < 0.5 * c.full) continue;
    // 창이 덮은 뒤 화면은 빼고
    const hit = document.elementFromPoint((c.box.l + c.box.r) / 2, (c.box.t + c.box.b) / 2);
    const f = hit && !el.contains(hit) ? fixedOf(hit) : null;
    if (f && !f.contains(el) && isOverlay(f)) continue;
    textItems.push({ el, ...c, name: nameOf(el) });
  }
  for (const it of textItems) {
    const el = it.el;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) continue;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const tr = textBox(el);
    if (!tr) continue;
    const cs = st(el);
    // 말줄임(…)을 그리는 칸 - 제 칸이나 둘레 칸(줄 안 글을 품은 truncate)
    let ellipsisAt = null;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const c2 = st(e);
      if (c2.textOverflow === 'ellipsis' && c2.overflowX !== 'visible') {
        ellipsisAt = e;
        break;
      }
      if (c2.display !== 'inline') break; // 줄 안 글만 둘레의 말줄임을 받는다
    }
    const overX = Math.max(tr.right - it.r.right, it.r.left - tr.left);
    const overY = Math.max(tr.bottom - it.r.bottom, it.r.top - tr.top);
    if (overX > 1.5 || overY > 2) {
      const hidden = cs.overflowX !== 'visible';
      // 제 칸이 말줄임이면 괜찮다 - 그 안의 글 묶음이 말줄임이어도
      const ellipsis = !!ellipsisAt || [...el.querySelectorAll('*')].some((c) => st(c).textOverflow === 'ellipsis' && c.scrollWidth > c.clientWidth);
      if (ellipsis && overY <= 2) continue;
      if (!hidden) add('spill', it, null, `글 ${Math.round(tr.width)}×${Math.round(tr.height)} > 칸 ${Math.round(it.r.width)}×${Math.round(it.r.height)}`);
      else add('cut', it, null, `제 칸이 ${Math.round(Math.max(overX, overY))}px 자름`);
    }
    if (ellipsisAt && ellipsisAt !== el) continue; // 둘레가 말줄임으로 자른다 - 보이는 끝에 …
    // 테·바탕이 있는 둘레 칸(카드·칩 줄) 밖으로 삐져나옴 - 넘친 몫은 옆 칸 위에 그려지거나 바깥 칸이 자른다
    for (let e = el.parentElement, n = 0; e && n < 6 && e !== document.body; e = e.parentElement, n++) {
      const cs2 = st(e);
      const boxed = parseFloat(cs2.borderLeftWidth) > 0 || parseFloat(cs2.borderRightWidth) > 0 || (cs2.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs2.backgroundColor !== 'transparent');
      if (!boxed) continue;
      const pb = e.getBoundingClientRect();
      const out = Math.max(it.r.right - pb.right, pb.left - it.r.left);
      if (out > 2) add('spill', it, e, `둘레 칸 밖으로 ${Math.round(out)}px`);
      break;
    }
    // 둘레(숨김 칸)가 자름 - 스크롤 칸은 아니다
    if (it.cutX > 2 && t) add('cut', it, it.cutBy, `둘레가 가로 ${Math.round(it.cutX)}px 자름`);
    else if (it.cutY > 4 && t) add('cut', it, it.cutBy, `둘레가 세로 ${Math.round(it.cutY)}px 자름`);
  }

  // ── 가로 넘침 ──
  const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (sw > width + 1) {
    const wide = [];
    for (const el of document.querySelectorAll('body *')) {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.right > width + 1 && ![...el.children].some((c) => c.getBoundingClientRect().right > width + 1)) {
        if (fixedOf(el)) continue;
        wide.push(nameOf(el));
        if (wide.length >= 3) break;
      }
    }
    out.push({ kind: 'wide', name: wide[0] ?? 'body', other: '', detail: `${sw - width}px (${wide.join(' · ')})` });
  }
  return { count: items.length, found: out };
}

/** 큰 스크롤 칸들(문서 + 화면 20% 넘는 스크롤 칸)의 자리 - 화면 안에서 */
export function scrollersInPage({ width, height }) {
  const list = [];
  const doc = document.scrollingElement;
  if (doc.scrollHeight > doc.clientHeight + 4) list.push({ key: 'doc', max: doc.scrollHeight - doc.clientHeight, step: Math.round(doc.clientHeight * 0.8) });
  let n = 0;
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (!/auto|scroll/.test(cs.overflowY) || el.scrollHeight <= el.clientHeight + 4) continue;
    const b = el.getBoundingClientRect();
    const vis = Math.max(0, Math.min(b.right, width) - Math.max(b.left, 0)) * Math.max(0, Math.min(b.bottom, height) - Math.max(b.top, 0));
    if (vis < 0.2 * width * height || el.clientHeight < 200) continue;
    el.setAttribute('data-ov-scroller', String(++n));
    list.push({ key: String(n), max: el.scrollHeight - el.clientHeight, step: Math.round(el.clientHeight * 0.8) });
  }
  return list;
}

/** 스크롤 칸 하나를 그 자리로 (key = 'doc' 또는 번호) */
export function scrollToInPage([key, top]) {
  const el = key === 'doc' ? document.scrollingElement : document.querySelector(`[data-ov-scroller="${key}"]`);
  if (el) el.scrollTop = top;
  return el ? el.scrollTop : -1;
}

/** 페이지 하나를 잰다 - 스크롤 칸마다 한 화면씩 내려 가며(맨 아래까지, 칸마다 8번까지). 결과는 이름으로 겹침을 걷는다 */
export async function scanPage(page, { width, height, mobile }) {
  const size = { width, height, mobile };
  const seen = new Map();
  let count = 0;
  const take = (res) => {
    count = Math.max(count, res.count);
    for (const f of res.found) {
      const k = `${f.kind}|${f.name}|${f.other}`;
      if (!seen.has(k)) seen.set(k, f);
    }
  };
  take(await page.evaluate(scanInPage, size));
  const scrollers = await page.evaluate(scrollersInPage, size);
  for (const s of scrollers) {
    let top = 0;
    for (let i = 0; i < 8 && top < s.max; i++) {
      top = Math.min(s.max, top + s.step);
      await page.evaluate(scrollToInPage, [s.key, top]);
      await page.waitForTimeout(120);
      take(await page.evaluate(scanInPage, size));
    }
    await page.evaluate(scrollToInPage, [s.key, 0]);
  }
  await page.evaluate(() => document.querySelectorAll('[data-ov-scroller]').forEach((e) => e.removeAttribute('data-ov-scroller')));
  const found = [...seen.values()].filter((f) => !IGNORE.some(([kind, a, b]) => kind === f.kind && a.test(f.name) && (!b || b.test(f.other))));
  return { count, found, scrollers: scrollers.length };
}
