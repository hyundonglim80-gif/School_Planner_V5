// 새 판이 나가 옛 조각 파일이 없어진 것인가 (P55-1 첫 화면 JS - domain/errorReport에서 뗐다, 그쪽이 그대로 다시 내보낸다).
//   app/lazyWithReload(첫 화면)가 늘 쓴다 - 오류 알림 셈(domain/errorReport)은 처음 오류가 났을 때만 받는다(data/errorCatch).

/** 새 판이 나가 옛 조각 파일이 없어진 것 (app/lazyWithReload가 새로고침으로 푼다) */
export function looksLikeStaleChunk(message: string): boolean {
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('Importing a module script failed')
  );
}
