// 사진 크게 보기 아래 '📷 사진 바꾸기 · ☁️ 드라이브에서 고르기' (V4 RosterModal)
import { useRef, type ChangeEvent } from 'react';

export default function PhotoReplaceButtons({ busy, onFile, onDrive }: { busy: boolean; onFile: (file: File) => Promise<void>; onDrive: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const btn = 'px-4 py-2 text-xs font-bold rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors cursor-pointer disabled:opacity-50';
  return (
    <>
      <button type="button" data-photo-replace onClick={() => input.current?.click()} disabled={busy} className={btn}>
        {busy ? '올리는 중...' : '📷 사진 바꾸기'}
      </button>
      <button type="button" data-photo-drive-replace onClick={() => void onDrive()} disabled={busy} className={btn}>
        ☁️ 드라이브에서 고르기
      </button>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        ref={input}
        className="hidden"
        data-photo-replace-input
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void onFile(file);
        }}
      />
    </>
  );
}
