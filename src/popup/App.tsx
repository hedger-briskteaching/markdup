import { useCallback, useEffect, useState } from 'react'
import type { AuthStatusResponse, ExtensionEvent } from '../shared/messages'

type UiState =
  | { kind: 'loading' }
  | { kind: 'connected'; login: string }
  | { kind: 'disconnected' }
  | { kind: 'error'; message: string }

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
    <main className="flex w-[300px] flex-col gap-3 p-4 font-sans text-slate-900">
      <div>
        <h1 className="text-base font-semibold tracking-tight">Markdup</h1>
        <p className="mt-1 text-sm leading-snug text-slate-600">
          Rich Markdown review for pull requests.
        </p>
      </div>

      {state.kind === 'loading' && (
        <p className="text-sm text-slate-500">
          Markdup reads the GitHub connection status…
        </p>
      )}

      {state.kind === 'connected' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-700">
            Connected as{' '}
            <span className="font-semibold">@{state.login}</span>
          </p>
          <p className="text-xs leading-snug text-slate-500">
            The access token stays only in this browser. Open Settings to remove
            it or read how access works.
          </p>
          <button
            type="button"
            className="rounded-md bg-[#124C5F] px-3 py-1.5 text-left text-sm font-medium text-white hover:bg-[#0e3d4c]"
            onClick={openSettings}
          >
            Open Settings
          </button>
        </div>
      )}

      {state.kind === 'disconnected' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600">
            Markdup is not connected to GitHub on this browser.
          </p>
          <p className="text-xs leading-snug text-slate-500">
            Connect in Settings. Markdup stores the token only on this computer.
          </p>
          <button
            type="button"
            className="rounded-md bg-[#124C5F] px-3 py-1.5 text-left text-sm font-medium text-white hover:bg-[#0e3d4c]"
            onClick={openSettings}
          >
            Open Settings
          </button>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-red-600">{state.message}</p>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={openSettings}
          >
            Open Settings
          </button>
        </div>
      )}
    </main>
  )
}
