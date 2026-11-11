# School Planner V5

초·중등 선생님용 플래너(일정·기록·메모·시간표·진도·학급)의 다섯째 판이다. 화면과 기능은 V4를 그대로 따르고, 자료 모양과 뼈대를 새로 짠다
(항목 하나 = 문서 하나, 기기 사본 + 바뀐 것만 받기). 서버는 Firebase 프로젝트 `schoolplannerv3`.
**V4와는 끊었다**(2026-11-11 - V4 가져오기를 뗐고, 규칙에서 V3·V4 자리를 지웠고, V4 사이트는 V5로 넘긴다). 작업 순서는 [`docs/PLAN.md`](docs/PLAN.md), 설계는 [`docs/DESIGN.md`](docs/DESIGN.md), 작업 규칙은 [`CLAUDE.md`](CLAUDE.md).
개발: `npm ci` → `npm run dev`(http://localhost:5175) · 테스트 `npm test` · 검사 `npm run lint` · 빌드 `npm run build`.

**에뮬레이터**(**이 저장소에서 켠다**: 규칙 `firestore.rules`를 읽게). JDK 21이 필요하다.
1. `npm run emu` - Firestore 8080·Auth 9099·UI 4000. 끄지 않고 계속 쓴다.
2. `npm run seed` - 점검 계정(teacher·teacher2·teacher3 …)과 V5 자료.
3. `npm run dev:emu` - http://localhost:5175 가 에뮬레이터에 붙고 teacher로 저절로 들어간다(`?as=2`·`?as=3`은 다른 계정). 빌드는 `npm run build:emu`.

규칙 검사 `npm run check:rules`(V3·V4 자리가 막혔는지 + V5), 로그인 점검 `node tools/inspect-login.mjs`(크롬).
