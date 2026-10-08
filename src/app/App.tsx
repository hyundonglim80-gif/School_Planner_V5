// 앱 껍데기. P1-3에서 화면 탭·주소·창 목록·오른쪽 칸을 여기에 세운다(DESIGN 7장).
export default function App() {
  return (
    <div className="min-h-screen bg-bg-body p-6 text-slate-800">
      <h1 className="text-2xl font-black text-primary">SP5</h1>
      {/* 어느 빌드가 돌고 있는지 화면에서 본다(V4 규칙). */}
      <p data-build-id className="mt-2 text-xs text-slate-500">빌드 {__BUILD_ID__}</p>
    </div>
  )
}
