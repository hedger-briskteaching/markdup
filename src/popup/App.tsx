import { useCallback, useEffect, useState } from 'react'
import type { AuthStatusResponse, ExtensionEvent } from '../shared/messages'

type UiState =
  | { kind: 'loading' }
  | { kind: 'connected'; login: string }
  | { kind: 'disconnected' }
  | { kind: 'error'; message: string }

const LOGO_URL = chrome.runtime.getURL('icons/logo.svg')

const TAGLINE = 'A better way to review Markdown files.'

export default function App() {
  const [state, setState] = useState<UiState>({ kind: 'loading' })

  const refreshStatus = useCallback(async () => {
    try {
      const status = (await chrome.runtime.sendMessage({
        type: 'AUTH_STATUS',
      })) as AuthStatusResponse
      if (status.authenticated && status.login) {
        setState({ kind: 'connected', login: status.login })
      } else {
        setState({ kind: 'disconnected' })
      }
    } catch (error) {
      setState({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Markdup could not read the connection status.',
      })
    }
  }, [])

  useEffect(() => {
    void refreshStatus()

    const onMessage = (message: ExtensionEvent) => {
      if (message.type === 'AUTH_COMPLETE') {
        setState({ kind: 'connected', login: message.login })
      }
      if (message.type === 'AUTH_ERROR') {
        setState({ kind: 'error', message: message.message })
      }
    }

    chrome.runtime.onMessage.addListener(onMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(onMessage)
    }
  }, [refreshStatus])

  const openSettings = () => {
    void chrome.runtime.openOptionsPage()
  }

  return (
    <main className="flex w-[320px] flex-col gap-5 p-5 font-sans text-slate-900">
      <header className="flex items-start gap-3">
        <img
          src={LOGO_URL}
          alt=""
          width={96}
          height={96}
          className="size-24 shrink-0 rounded-[20px]"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold tracking-tight">Markdup</h1>
          <p className="mt-1.5 text-sm leading-snug text-slate-600">
            {TAGLINE}
          </p>
        </div>
      </header>

      {state.kind === 'loading' && (
        <p className="text-sm text-slate-500">Checking GitHub connection…</p>
      )}

      {state.kind === 'connected' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-700">
            Connected as{' '}
            <span className="font-semibold">@{state.login}</span>
          </p>
          <button
            type="button"
            className="rgm-btn rgm-btn-block"
            onClick={openSettings}
          >
            Open Settings
          </button>
        </div>
      )}

      {state.kind === 'disconnected' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-snug text-slate-600">
            Markdup is not connected to GitHub on this browser.
          </p>
          <button
            type="button"
            className="rgm-btn rgm-btn-block"
            onClick={openSettings}
          >
            Open Settings
          </button>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-snug text-red-600">{state.message}</p>
          <button
            type="button"
            className="rgm-btn rgm-btn-block"
            onClick={openSettings}
          >
            Open Settings
          </button>
        </div>
      )}
    </main>
  )
}
