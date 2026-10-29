// 환경설정 '개발자' 탭 (P14-2 - 개발자 계정에만, domain/developers). 칸은 그 기능을 옮기는 조각이 채운다:
// 공휴일 받기 = P14-3(그때까지 V4 환경설정 → 개발자 설정) · 오류 기록 = P14-2 ■5.
import { Section } from './parts';

export default function DevTab() {
  return (
    <div data-dev-tab>
      <Section id="dev-holidays" title="공휴일" desc="설·추석·대체 공휴일 표는 해마다 한 번 받아 둡니다(모든 사용자가 같이 읽습니다).">
        <p className="text-xs text-slate-500">지금은 V4 환경설정 → 개발자 설정 → 공휴일에서 받습니다.</p>
      </Section>
      <Section id="dev-errors" title="오류 기록" desc="사용자 화면에서 난 오류가 글 내용 없이 여기에 모입니다.">
        <p className="text-xs text-slate-500">준비 중입니다.</p>
      </Section>
    </div>
  );
}
