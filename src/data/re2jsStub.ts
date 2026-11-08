// re2js 대신 (P25-1 첫 화면 JS - vite.config `resolve.alias`).
// Firestore(12.x 브라우저 판)는 re2js(구글 RE2 정규식 엔진, 유니코드 표째)를 늘 묶어 온다 - 첫 화면 firebase 묶음 gzip 154 → 110KB.
// 쓰는 곳은 Firestore '파이프라인' 식 like·regex_contains·regex_match를 기기에서 셈할 때뿐이고(각각 try 안 - 던지면 '오류 값'),
// 이 앱은 파이프라인(firebase/firestore/pipelines)을 쓰지 않는다. 보통 쿼리(where·orderBy)는 re2js를 지나지 않는다.
// re2jsStub.test.ts가 지킨다 - Firebase를 올려 쓰는 곳이 바뀌면 그 시험이 깨진다(그때 다시 본다).
export const RE2JS = {
  compile(): never {
    throw new Error('re2js는 이 앱에 묶지 않았습니다 (Firestore 파이프라인 정규식은 쓰지 않는다 - src/data/re2jsStub.ts)');
  },
};
