import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './dark.css'
import App from './app/App.tsx'
import { applyTheme, watchSystemTheme } from './app/theme'
import { startInstall } from './app/install'
import { flushPendingToast } from './app/toast'
import { auth } from './data/firebase'
import { autoSignIn } from './data/emulator'
import { watchSession } from './data/session'
import { setMyHolidays, startHolidays } from './data/holidays'
import { undoLast, watchUndoOwner } from './data/undo'
import { setShortcutAction } from './app/keys'
import { useCommonSettings } from './app/prefs'
import { finishRedirectLogin } from './features/auth/login'

// 로그인 상태 구독은 앱 전체에 하나.
watchSession()
// 주말 빼기 기간·달력 색이 공휴일 표를 쓴다 (data/holidays)
startHolidays()
// 개인 공휴일(계정 설정)도 공휴일 표에
setMyHolidays(useCommonSettings.getState().myHolidays)
useCommonSettings.subscribe((s) => setMyHolidays(s.myHolidays))
// 팝업이 막혀 리디렉션으로 돌아온 로그인을 마무리한다(구글 토큰을 챙긴다).
finishRedirectLogin()
// 점검용 에뮬레이터에서만 seed 계정으로 들어간다(운영 빌드에서는 통째로 빠진다).
autoSignIn(auth)
// 화면 밝기 (index.html이 먼저 붙인 것을 이어받고, '시스템 따라'면 기기 설정을 따라간다)
applyTheme()
watchSystemTheme()
// 새로고침 앞에서 맡겨 둔 안내 (백업 복원 등)
flushPendingToast()
// 되돌리기 Ctrl+Z(글 칸 밖에서) - 지금 공간의 마지막 쓰기. 로그인한 사람이 바뀌면 더미를 비운다
setShortcutAction('undo', () => void undoLast())
watchUndoOwner()
// 앱으로 설치 - 서비스 워커 등록, 크롬의 설치 이벤트는 화면보다 먼저 올 수 있어 여기서 듣는다
startInstall()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
