// tools/inspect-headers.mjs - 보안 헤더(P22-6)를 실제 응답에서 본다.
//   값의 정본은 firebase.json이다. 개발 서버·미리 보기는 vite.config가 그 값을 읽어 같은 헤더를 낸다(`firebase serve`는 내지 않는다).
//   빌드 파일:   npm run build:emu → npx vite preview --port 4177 → SITE=http://localhost:4177/ node tools/inspect-headers.mjs
//   운영(배포 뒤): SITE=https://schoolplanner-v5.web.app/ node tools/inspect-headers.mjs
import { readFileSync } from 'node:fs';
import { report, SITE } from './lib/probe.mjs';

const r = report();
const hosting = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')).hosting;
const WANT = hosting.headers.find((h) => h.source === '**').headers;

/** 이 파일들 모두에 붙어야 한다 - 앱 첫 화면·서비스 워커·매니페스트·조각 파일 */
async function paths() {
  const list = ['', 'sw.js', 'manifest.json'];
  const manifest = await (await fetch(`${SITE}asset-manifest.json`)).json();
  const js = Object.values(manifest).find((v) => v.isEntry)?.file;
  if (js) list.push(js);
  return list;
}

try {
  r.section('헤더');
  for (const path of await paths()) {
    const res = await fetch(`${SITE}${path}`);
    for (const { key, value } of WANT) r.check(res.headers.get(key) === value, `/${path} ${key}`, `/${path} ${key} = ${res.headers.get(key)}`);
    // nosniff면 종류가 틀린 스크립트는 돌지 않는다
    if (/\.js$/.test(path)) r.check(/javascript/.test(res.headers.get('content-type') ?? ''), `/${path} 종류가 자바스크립트`, `/${path} 종류 = ${res.headers.get('content-type')}`);
  }
} catch (e) {
  r.bad(`점검이 끝까지 돌지 못했다: ${e}`);
} finally {
  r.done();
  process.exit();
}
