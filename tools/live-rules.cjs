// tools/live-rules.cjs
//
// 운영 Firestore에 지금 걸린 보안 규칙이 이 저장소 firestore.rules와 같은지 본다(읽기만 한다).
// 배포하기 전에 '운영에 파일에 없는 것이 있나'(콘솔에서 고친 것 등)를 확인하려고 쓴다.
//
//   node tools/live-rules.cjs            → 같으면 '같다', 다르면 다른 줄을 보이고 끝 코드 1
//   node tools/live-rules.cjs --print    → 운영 규칙을 그대로 찍는다
//
// firebase CLI 로그인(npx firebase login)을 그대로 쓴다. firebase-tools 내부 모듈이라 판이 바뀌면 깨질 수 있다.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { getGlobalDefaultAccount } = require('firebase-tools/lib/auth');
const { Client } = require('firebase-tools/lib/apiv2');

const PROJECT = 'schoolplannerv3';

async function main() {
  const acct = getGlobalDefaultAccount();
  if (!acct) throw new Error('firebase CLI에 로그인되어 있지 않습니다 - npx firebase login');
  await requireAuth({ user: acct.user, tokens: acct.tokens });

  const api = new Client({ urlPrefix: 'https://firebaserules.googleapis.com', apiVersion: 'v1' });
  const release = (await api.get(`/projects/${PROJECT}/releases/cloud.firestore`)).body;
  const ruleset = (await api.get(`/${release.rulesetName}`)).body;
  const live = ruleset.source.files.map((f) => f.content).join('\n');

  if (process.argv.includes('--print')) {
    process.stdout.write(live);
    return;
  }

  const norm = (s) => s.replace(/\r/g, '').trimEnd().split('\n');
  const a = norm(live);
  const b = norm(readFileSync(join(__dirname, '..', 'firestore.rules'), 'utf8'));
  console.log(`운영 규칙: ${release.rulesetName} (${release.updateTime})`);
  if (a.join('\n') === b.join('\n')) {
    console.log('이 저장소 firestore.rules와 같다');
    return;
  }
  const n = Math.max(a.length, b.length);
  let shown = 0;
  for (let i = 0; i < n && shown < 30; i++) {
    if (a[i] === b[i]) continue;
    console.log(`  ${i + 1}줄  운영: ${a[i] ?? '(없음)'}\n        파일: ${b[i] ?? '(없음)'}`);
    shown++;
  }
  console.log('다르다 - 위는 앞에서부터 30줄까지');
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
