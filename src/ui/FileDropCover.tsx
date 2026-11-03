// 파일을 끌고 있는 동안 놓는 칸 위의 덮개 (P21-1 - ui/fileDrop). 칸 상자는 relative.
// 칸이 보이는 자리보다 길면(대화 방) 글은 보이는 자리 가운데에 붙는다(sticky).
export default function FileDropCover() {
  return (
    <div data-file-drop-over className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-blue-50/80">
      <span className="sticky top-1/2 bottom-1/2 text-sm font-extrabold text-primary">📎 여기에 놓으면 첨부</span>
    </div>
  );
}
