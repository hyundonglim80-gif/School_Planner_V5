import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './dark.css'
import App from './app/App.tsx'
import { applyTheme, watchSystemTheme } from './app/theme'
import { flushPendingToast } from './app/toast'
import { auth } from './data/firebase'
import { autoSignIn } from './data/emulator'
import { watchSession } from './data/session'
import { finishRedirectLogin } from './features/auth/login'

// 로그인 상태 구독은 앱 전체에 하나.
watchSession()
// 팝업이 막혀 리디렉션으로 돌아온 로그인을 마무리한다(구글 토큰을 챙긴다).
finishRedirectLogin()
// 점검용 에뮬레이터에서만 seed 계정으로 들어간다(운영 빌드에서는 통째로 빠진다).
autoSignIn(auth)
// 화면 밝기 (index.html이 먼저 붙인 것을 이어받고, '시스템 따라'면 기기 설정을 따라간다)
applyTheme()
watchSystemTheme()
// 새로고침 앞에서 맡겨 둔 안내 (백업 복원 등)
flushPendingToast()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
