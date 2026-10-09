// 파일로 내려주기 (V4 lib/csv.ts downloadCsv) - 진도 예시 CSV·내보내기
import { toCsv } from '../domain/csv';

export function downloadCsv(rows: unknown[][], filename: string) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 바로 걷으면 크롬이 받기 전에 파일이 사라져 이름이 'download'가 된다 - 조금 뒤에
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
