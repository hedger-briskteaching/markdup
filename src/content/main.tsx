import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import cssText from './index.css?inline'

const HOST_ID = 'rgm-extension-root'

function mount() {
  if (document.getElementById(HOST_ID)) {
    return
  }

  const host = document.createElement('div')
  host.id = HOST_ID
  document.documentElement.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = cssText
  shadow.appendChild(style)

  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)

  createRoot(mountPoint).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

mount()
