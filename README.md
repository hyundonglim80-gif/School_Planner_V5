# School Planner V5

초·중등 선생님용 플래너(일정·기록·메모·시간표·진도·학급)의 다섯째 판이다. 화면과 기능은 V4를 그대로 따르고, 자료 모양과 뼈대를 새로 짠다
(항목 하나 = 문서 하나, 기기 사본 + 바뀐 것만 받기). V4 자료는 앱 안에서 한 방향으로 가져온다. 서버는 V4와 같은 Firebase 프로젝트 `schoolplannerv3`를 쓰되
V3·V4 자료와 섞지 않는다. 작업 순서는 [`docs/PLAN.md`](docs/PLAN.md), 설계는 [`docs/DESIGN.md`](docs/DESIGN.md), 작업 규칙은 [`CLAUDE.md`](CLAUDE.md).
개발: `npm ci` → `npm run dev`(http://localhost:5175) · 테스트 `npm test` · 검사 `npm run lint` · 빌드 `npm run build`.
