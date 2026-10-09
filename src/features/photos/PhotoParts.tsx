// 학생 사진 부품 - '사진 여러 장 업로드' 📁 기기 ☁️ 구글 드라이브 · 올리는 중 막대 · 결과 띠 · 상태 한 줄(로그인·오류·불러오는 중·진단 띠).
import { useRef } from 'react';
import PhotoStatusBar from './PhotoStatusBar';
import type { PhotoTools } from './usePhotoTools';

/** '사진 여러 장 업로드' 📁 기기 · ☁️ 구글 드라이브 - 파일 이름으로 학생을 짝지어 올린다 */
export function PhotoBulkGroup({ panel }: { panel: PhotoTools }) {
  const input = useRef<HTMLInputElement>(null);
  const busy = !!panel.photos.bulk || !!panel.driveFetching;
  const btn = 'px-2 py-0.5 bg-white text-amber-800 border border-amber-300 rounded text-xs font-bold hover:bg-amber-100 shadow-2xs cursor-pointer disabled:opacity-60';
  return (
    <div data-photo-bulk-group className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-1.5 py-1" title="사진 여러 장을 한꺼번에 고르면 파일 이름으로 학생을 짝지어 올립니다">
      <span className="text-xs font-bold text-amber-800 px-0.5">
        📷{' '}
        {panel.photos.bulk
          ? `올리는 중 ${panel.photos.bulk.done}/${panel.photos.bulk.total}`
          : panel.driveFetching
            ? `드라이브에서 받는 중 ${panel.driveFetching.done}/${panel.driveFetching.total}`
            : '사진 여러 장 업로드'}
      </span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        ref={input}
        className="hidden"
        data-photo-bulk-input
        onChange={(e) => {
          // 먼저 배열로 옮겨 담고 입력칸을 비운다 (files는 입력칸에 붙어 있는 목록 - V4)
          const picked = Array.from(e.target.files || []);
          e.target.value = '';
          void panel.bulkUpload(picked);
        }}
      />
      <button type="button" data-photo-bulk-device onClick={() => input.current?.click()} disabled={busy} className={btn} title="이 기기(컴퓨터·휴대폰)에 있는 사진을 여러 장 골라 올립니다">
        📁 기기
      </button>
      <button type="button" data-photo-drive-many onClick={() => void panel.bulkFromDrive()} disabled={busy} className={btn} title="구글 드라이브에 이미 있는 사진을 여러 장 골라 올립니다">
        ☁️ 구글 드라이브
      </button>
    </div>
  );
}

/** 여러 장 올리는 중 막대 */
export function PhotoBulkProgress({ panel }: { panel: PhotoTools }) {
  const bulk = panel.photos.bulk;
  if (!bulk) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 border border-blue-200 bg-blue-50" data-photo-bulk-progress>
      <span className="text-2xs font-bold text-primary whitespace-nowrap">
        사진 올리는 중 {bulk.done} / {bulk.total}
      </span>
      <span className="flex-1 h-1.5 rounded-full bg-blue-200 overflow-hidden">
        <span className="block h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${bulk.total > 0 ? Math.round((bulk.done / bulk.total) * 100) : 0}%` }} />
      </span>
    </div>
  );
}

/** 여러 장 올린 뒤의 결과 - 한 장도 못 올렸을 때야말로 보여야 하므로 늘 낸다(V4) */
export function PhotoBulkReportBand({ panel }: { panel: PhotoTools }) {
  const r = panel.report;
  if (!r) return null;
  const none = r.uploaded === 0;
  const more = (list: string[], n: number) => `${list.slice(0, n).join(', ')}${list.length > n ? ' …' : ''}`;
  return (
    <div data-photo-bulk-report={r.uploaded} className={`flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 border ${none ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={`text-2xs font-bold ${none ? 'text-red-700' : 'text-amber-800'}`}>
          고른 파일 {r.picked}개 중 {r.uploaded}장을 올렸습니다.
          {r.saved && ` 용량 ${r.saved}`}
          {r.unmatched.length > 0 && ` 짝을 못 찾은 파일 ${r.unmatched.length}개: ${more(r.unmatched, 5)}`}
        </span>
        {r.weak.length > 0 && (
          <span className="text-2xs text-slate-600 font-semibold">
            번호 없이 이름만 보고 짝지은 것 {r.weak.length}건 — 맞는지 봐 주세요: {r.weak.slice(0, 5).join(' · ')}
            {r.weak.length > 5 ? ' …' : ''}
          </span>
        )}
        {r.notPhotos.length > 0 && <span className="text-2xs text-slate-500 font-semibold">사진이 아닌 파일 {r.notPhotos.length}개는 건너뛰었습니다.</span>}
        {r.duplicates.length > 0 && <span className="text-2xs text-slate-500 font-semibold">같은 학생에게 두 장이 걸려 {r.duplicates.length}개는 건너뛰었습니다.</span>}
        {r.failed.length > 0 && <span className="text-2xs text-red-700 font-semibold">올리다 실패한 파일 {r.failed.length}개: {more(r.failed, 3)}</span>}
        {r.unmatched.length > 0 && <span className="text-2xs text-slate-500 font-semibold">파일 이름에 학생 이름이나 번호가 들어 있어야 찾습니다. 빈 칸을 눌러 하나씩 올리셔도 됩니다.</span>}
      </div>
      <button type="button" onClick={panel.clearReport} className="text-amber-700 hover:text-amber-900 font-black text-xs shrink-0 cursor-pointer" title="닫기" aria-label="닫기">
        ✕
      </button>
    </div>
  );
}

/** 사진 상태 한 줄 - 구글 연결이 끊김 / 폴더 오류 / 불러오는 중 / 어디서 끊겼는지(photoDiagnosis) */
export function PhotoStateLine({ panel, count }: { panel: PhotoTools; count: number }) {
  const p = panel.photos;
  if (p.status === 'needs-auth') {
    return (
      <div className="flex items-center justify-between gap-2 text-2xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 flex-wrap" data-photo-needs-auth>
        <span>구글 연결이 끊겨 사진을 불러오지 못했습니다. 명단은 그대로 쓰실 수 있습니다.</span>
        <button type="button" data-photo-auth onClick={panel.authorize} className="px-2.5 py-1 bg-primary hover:bg-primary/90 rounded text-2xs font-bold text-white cursor-pointer shrink-0">
          구글 연결하고 사진 불러오기
        </button>
      </div>
    );
  }
  if (p.status === 'error') {
    return (
      <div className="flex items-center justify-between gap-2 text-2xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2 flex-wrap" data-photo-error>
        <span>{p.error}</span>
        <button type="button" onClick={() => void panel.pickClassFolder()} className="px-2.5 py-1 bg-white border border-red-300 rounded text-2xs font-bold text-red-700 hover:bg-red-100 cursor-pointer">
          이 학급 폴더 고르기
        </button>
      </div>
    );
  }
  if (p.status === 'checking' || p.status === 'loading' || p.resolving) {
    return (
      <div className="text-2xs text-slate-400 font-semibold px-0.5" data-photo-loading>
        사진을 불러오는 중... ({count - p.missing.length}/{count})
      </div>
    );
  }
  if (p.status !== 'ready' || !panel.diagnosis) return null;
  return (
    <PhotoStatusBar
      diagnosis={panel.diagnosis}
      where={panel.where}
      onOpenFolder={panel.openPickedFolder}
      onForgetPicked={() => void panel.forgetClassFolder()}
      onPickClassFolder={() => void panel.pickClassFolder()}
    />
  );
}
