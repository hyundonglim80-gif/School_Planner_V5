// tools/restore-count.cjs
//
// 복원 연습(docs/OPS.md)에서 임시 데이터베이스에 문서가 되살아났는지 수만 센다. 글 내용은 받지 않는다(모으기 쿼리 - 숫자만 돌아온다).
// 복원이 끝나기를 기다린 뒤 맨 위 컬렉션과 그 아래 항목(items)을 센다.
//
//   node tools/restore-count.cjs            → restore-drill
//   node tools/restore-count.cjs <이름> [하위 컬렉션 이름 …]   (예 restore-drill mailIn mailSent)
//
// (default)는 세지 않는다 - 실제 자료는 이 도구의 일이 아니다.
// firebase CLI 로그인을 그대로 쓴다(tools/live-rules.cjs와 같은 길 - firebase-tools 내부 모듈이라 판이 바뀌면 깨질 수 있다).
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { getGlobalDefaultAccount } = require('firebase-tools/lib/auth');
const { Client } = require('firebase-tools/lib/apiv2');

const PROJECT = 'schoolplannerv3';
const DB = process.argv[2] || 'restore-drill';
const WAIT_MS = 15 * 60_000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (DB === '(default)' || DB === 'default') throw new Error('(default)는 세지 않는다 - 임시 데이터베이스 이름을 준다');
  const acct = getGlobalDefaultAccount();
  if (!acct) throw new Error('firebase CLI에 로그인되어 있지 않습니다 - npx firebase login');
  await requireAuth({ user: acct.user, tokens: acct.tokens });
  const api = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' });
  const base = `/projects/${PROJECT}/databases/${DB}`;

  // 복원이 끝나기 전의 수는 뜻이 없다. 작업 목록의 done은 믿지 않는다 - 끝났다고 나온 뒤에도 서버가
  // 'undergoing a restore'로 거절했다(11-06). 서버가 실제로 대답할 때까지 물어본다.
  const end = Date.now() + WAIT_MS;
  let roots;
  for (;;) {
    const failed = ((await api.get(`${base}/operations`)).body.operations ?? []).find((o) => o.error);
    if (failed) throw new Error(`복원 실패: ${failed.error.message}`);
    try {
      roots = (await api.post(`${base}/documents:listCollectionIds`, { pageSize: 100 })).body.collectionIds ?? [];
      break;
    } catch (e) {
      if (!/undergoing a restore/.test(String(e.message))) throw e;
    }
    if (Date.now() > end) throw new Error('15분 안에 복원이 끝나지 않았다');
    await wait(15_000);
  }

  const count = async (from) => {
    const res = await api.post(`${base}/documents:runAggregationQuery`, {
      structuredAggregationQuery: { structuredQuery: { from: [from] }, aggregations: [{ alias: 'n', count: {} }] },
    });
    return Number(res.body[0]?.result?.aggregateFields?.n?.integerValue ?? 0);
  };

  console.log(`맨 위 컬렉션 ${roots.length}개`);
  for (const id of roots) console.log(`  ${id}: ${await count({ collectionId: id })}`);
  console.log(`모든 공간의 items: ${await count({ collectionId: 'items', allDescendants: true })}`);
  // 부모 문서 없이 하위 컬렉션만 있으면 맨 위 수가 0이다(users·v5Mail) - 0이 '빠졌다'가 아닌지 그 아래를 센다
  for (const id of process.argv.slice(3)) console.log(`모든 ${id}: ${await count({ collectionId: id, allDescendants: true })}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(String(e.message ?? e));
    process.exit(1);
  },
);
