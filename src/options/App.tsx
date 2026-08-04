import { useCallback, useEffect, useState } from 'react'
import type {
  AuthEnsureResponse,
  AuthSetPatResponse,
  AuthStatusResponse,
  ExtensionEvent,
} from '../shared/messages'
import {
  AUTH_OAUTH_HINT,
  AUTH_PAT_FINE_GRAINED_NOTE,
  AUTH_PAT_HOW_STEPS,
  AUTH_PAT_WHY,
  GITHUB_APPLICATIONS_URL,
  GITHUB_PAT_CREATE_URL,
  GITHUB_PAT_LIST_URL,
  REVOKE_STEPS,
  TOKEN_STORAGE_FACTS,
} from '../shared/authCopy'

type UiState =
  | { kind: 'loading' }
  | { kind: 'connected'; login: string; method?: 'oauth' | 'pat' }
  | {
      kind: 'connect'
      userCode: string
      verificationUri: string
      login?: string
      method?: 'oauth' | 'pat'
    }
  | { kind: 'disconnected' }
  | { kind: 'error'; message: string }

export default function App() {
  const [state, setState] = useState<UiState>({ kind: 'loading' })
  const [oauthBusy, setOauthBusy] = useState(false)
  const [pat, setPat] = useState('')
  const [patBusy, setPatBusy] = useState(false)
  const [patError, setPatError] = useState<string | null>(null)

  const refreshStatus = useCallback(async () => {
    try {
      const status = (await chrome.runtime.sendMessage({
        type: 'AUTH_STATUS',
      })) as AuthStatusResponse
      if (status.authenticated && status.login) {
        setState({
          kind: 'connected',
          login: status.login,
          method: status.method,
        })
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
        setOauthBusy(false)
        setState({
          kind: 'connected',
          login: message.login,
          method: message.method,
        })
        setPat('')
        setPatError(null)
      }
      if (message.type === 'AUTH_ERROR') {
        setOauthBusy(false)
        setState({ kind: 'error', message: message.message })
      }
    }

    chrome.runtime.onMessage.addListener(onMessage)
    return () => {
      chrome.runtime.onMessage.removeListener(onMessage)
    }
  }, [refreshStatus])

  const connect = async () => {
    setOauthBusy(true)
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'AUTH_ENSURE',
      })) as AuthEnsureResponse

      if (response.status === 'ok') {
        setState({ kind: 'connected', login: response.login, method: 'oauth' })
        setOauthBusy(false)
        return
      }

      if (response.status === 'needs_auth') {
        setState({
          kind: 'connect',
          userCode: response.user_code,
          verificationUri: response.verification_uri,
        })
        setOauthBusy(false)
        return
      }

      setState({ kind: 'error', message: response.message })
      setOauthBusy(false)
    } catch (error) {
      setOauthBusy(false)
      setState({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Markdup could not start the GitHub connection.',
      })
    }
  }

  const savePat = async () => {
    setPatBusy(true)
    setPatError(null)
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'AUTH_SET_PAT',
        token: pat,
      })) as AuthSetPatResponse

      if (response.status === 'ok') {
        setState({ kind: 'connected', login: response.login, method: 'pat' })
        setPat('')
        return
      }
      setPatError(response.message)
    } catch (error) {
      setPatError(
        error instanceof Error
          ? error.message
          : 'Markdup could not save the token.',
      )
    } finally {
      setPatBusy(false)
    }
  }

  const removeLocalAccess = async () => {
    await chrome.runtime.sendMessage({ type: 'AUTH_DISCONNECT' })
    setState({ kind: 'disconnected' })
  }

  const cancel = async () => {
    await chrome.runtime.sendMessage({ type: 'AUTH_CANCEL' })
    setOauthBusy(false)
    void refreshStatus()
  }

  const connectedLogin =
    state.kind === 'connected' ? state.login : undefined
  const connectedMethod =
    state.kind === 'connected' ? state.method : undefined

  return (
    <div className="mx-auto max-w-xl px-6 py-10 font-sans text-slate-900">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Markdup Settings</h1>
        <p className="mt-2 text-sm leading-snug text-slate-600">
          Try Option 1 (OAuth) first. If your organization blocks the Markdup
          OAuth App, use Option 2 (personal access token) as a fallback.
        </p>
      </header>

      {state.kind === 'loading' && (
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Markdup reads the GitHub connection status…
          </p>
        </section>
      )}

      {state.kind === 'connected' && (
        <section className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Connected</h2>
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-slate-700">
              Signed in as{' '}
              <span className="font-semibold">@{state.login}</span>
              <span className="text-slate-500">
                {state.method === 'pat'
                  ? ' · personal access token'
                  : ' · OAuth'}
              </span>
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
        </section>
      )}

      {/* Both options stay visible so users can try OAuth first, then PAT. */}
      {state.kind !== 'loading' && (
        <>
          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Option 1 · Connect with GitHub (OAuth) — try this first
            </h2>
            <p className="mt-2 text-sm leading-snug text-slate-600">
              {AUTH_OAUTH_HINT}
            </p>

            {connectedMethod === 'oauth' && connectedLogin && (
              <p className="mt-3 text-sm text-emerald-800">
                Active via OAuth as @{connectedLogin}.
              </p>
            )}

            {state.kind !== 'connect' && (
              <button
                type="button"
                className="mt-3 w-fit rounded-md bg-[#124C5F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0e3d4c] disabled:opacity-60"
                disabled={oauthBusy}
                onClick={() => void connect()}
              >
                {oauthBusy
                  ? 'Starting…'
                  : connectedMethod === 'oauth'
                    ? 'Reconnect with GitHub'
                    : 'Connect with GitHub'}
              </button>
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
                <p className="text-sm text-slate-600">
                  If OAuth fails because your organization blocks the app, use
                  Option 2 below.
                </p>
                <button
                  type="button"
                  className="w-fit rounded-md bg-[#124C5F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0e3d4c]"
                  onClick={() => void connect()}
                >
                  Try OAuth again
                </button>
              </div>
            )}
          </section>

          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Option 2 · Personal access token — fallback
            </h2>
            <p className="mt-2 text-sm leading-snug text-slate-600">
              Use this when Option 1 does not work (for example when an
              organization blocks the Markdup OAuth App).
            </p>

            {connectedMethod === 'pat' && connectedLogin && (
              <p className="mt-3 text-sm text-emerald-800">
                Active via personal access token as @{connectedLogin}.
              </p>
            )}

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Why use a token?
            </h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-snug text-slate-600">
              {AUTH_PAT_WHY.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              How to create a classic token
            </h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-snug text-slate-600">
              {AUTH_PAT_HOW_STEPS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <a
                className="text-sm font-medium text-[#0969da] hover:underline"
                href={GITHUB_PAT_CREATE_URL}
                target="_blank"
                rel="noreferrer"
              >
                Open “Generate new token (classic)”
              </a>
              <a
                className="text-sm font-medium text-[#0969da] hover:underline"
                href={GITHUB_PAT_LIST_URL}
                target="_blank"
                rel="noreferrer"
              >
                Open your token list
              </a>
            </div>

            <p className="mt-4 text-sm leading-snug text-slate-600">
              {AUTH_PAT_FINE_GRAINED_NOTE}
            </p>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-800">
                Paste your token
              </span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900"
                placeholder="ghp_… or github_pat_…"
                value={pat}
                onChange={(event) => setPat(event.target.value)}
              />
            </label>
            {patError && (
              <p className="mt-2 text-sm text-red-600">{patError}</p>
            )}
            <button
              type="button"
              className="mt-3 w-fit rounded-md bg-[#124C5F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0e3d4c] disabled:opacity-60"
              disabled={patBusy || !pat.trim()}
              onClick={() => void savePat()}
            >
              {patBusy
                ? 'Saving…'
                : connectedMethod === 'pat'
                  ? 'Replace token'
                  : 'Save token'}
            </button>
          </section>
        </>
      )}

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
