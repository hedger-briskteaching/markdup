import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from './App'
import cssText from './index.css?inline'
import { isPrFilesPage } from './markdownReview/detect'
import {
  initMarkdownReview,
  onReviewLocationChange,
} from './markdownReview/init'

const HOST_ID = 'rgm-extension-root'

let reactRoot: Root | null = null

function mount(): void {
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

  reactRoot = createRoot(mountPoint)
  reactRoot.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

function unmount(): void {
  const host = document.getElementById(HOST_ID)
  if (!host) {
    reactRoot = null
    return
  }
  reactRoot?.unmount()
  reactRoot = null
  host.remove()
}

function syncForLocation(): void {
  if (isPrFilesPage()) {
    mount()
  } else {
    unmount()
  }
}

onReviewLocationChange(syncForLocation)
initMarkdownReview()
