import { useCallback, useEffect, useState } from 'react'
import type {
  AuthEnsureResponse,
  AuthStatusResponse,
  ExtensionEvent,
} from '../shared/messages'
import {
  GITHUB_APPLICATIONS_URL,
  REVOKE_STEPS,
  TOKEN_STORAGE_FACTS,
} from '../shared/authCopy'

type UiState =
  | { kind: 'loading' }
  | { kind: 'connected'; login: string }
  | {
      kind: 'connect'
      userCode: string
      verificationUri: string
    }
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

  const connect = async () => {
    setState({ kind: 'loading' })
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'AUTH_ENSURE',
      })) as AuthEnsureResponse

      if (response.status === 'ok') {
        setState({ kind: 'connected', login: response.login })
        return
      }

      if (response.status === 'needs_auth') {
        setState({
          kind: 'connect',
          userCode: response.user_code,
          verificationUri: response.verification_uri,
        })
        return
      }

      setState({ kind: 'error', message: response.message })
    } catch (error) {
      setState({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Markdup could not start the GitHub connection.',
      })
    }
  }

  const removeLocalAccess = async () => {
    await chrome.runtime.sendMessage({ type: 'AUTH_DISCONNECT' })
    setState({ kind: 'disconnected' })
  }

  const cancel = async () => {
    await chrome.runtime.sendMessage({ type: 'AUTH_CANCEL' })
    setState({ kind: 'disconnected' })
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10 font-sans text-slate-900">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Markdup Settings</h1>
        <p className="mt-2 text-sm leading-snug text-slate-600">
          Manage GitHub access for Rich Markdown review.
        </p>
      </header>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">GitHub access</h2>

        {state.kind === 'loading' && (
          <p className="mt-3 text-sm text-slate-500">
            Markdup reads the GitHub connection status…
          </p>
        )}

        {state.kind === 'connected' && (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-slate-700">
              Connected as{' '}
              <span className="font-semibold">@{state.login}</span>
            </p>
            <button
              type="button"
              className="w-fit rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={() => void removeLocalAccess()}
            >
              Remove from this browser
            </button>
            <a
              className="w-fit text-sm font-medium text-[#0969da] hover:underline"
              href={GITHUB_APPLICATIONS_URL}
              target="_blank"
              rel="noreferrer"
            >
              Open GitHub application settings
            </a>
          </div>
        )}

        {state.kind === 'disconnected' && (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              Markdup is not connected to GitHub on this browser.
            </p>
            <button
              type="button"
              className="w-fit rounded-md bg-[#124C5F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0e3d4c]"
              onClick={() => void connect()}
            >
              Connect with GitHub
            </button>
          </div>
        )}

        {state.kind === 'connect' && (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              Enter this one-time code on GitHub. Then authorize Markdup.
            </p>
            <p className="font-mono text-2xl font-bold tracking-wider">
              {state.userCode}
            </p>
            <a
              className="w-fit text-sm font-medium text-[#0969da] hover:underline"
              href={state.verificationUri}
              target="_blank"
              rel="noreferrer"
            >
              Open github.com/login/device
            </a>
            <button
              type="button"
              className="w-fit rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={() => void cancel()}
            >
              Cancel
            </button>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm text-red-600">{state.message}</p>
            <button
              type="button"
              className="w-fit rounded-md bg-[#124C5F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0e3d4c]"
              onClick={() => void connect()}
            >
              Try again
            </button>
          </div>
        )}
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Where the token is stored
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-snug text-slate-600">
          {TOKEN_STORAGE_FACTS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          How to revoke access
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-snug text-slate-600">
          {REVOKE_STEPS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>
    </div>
  )
}
