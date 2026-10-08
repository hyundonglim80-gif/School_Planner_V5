import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
