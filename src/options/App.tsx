/**
 * Options (settings) page App component module.
 * Lets the user connect to GitHub via OAuth or a personal access token (PAT).
 */
import { useCallback, useEffect, useState } from "react";
import type {
  AuthEnsureResponse,
  AuthSetPatResponse,
  AuthStatusResponse,
  ExtensionEvent,
} from "../shared/messages";
import {
  AUTH_OAUTH_HINT,
  AUTH_PAT_FINE_GRAINED_NOTE,
  AUTH_PAT_HOW_STEPS,
  AUTH_PAT_WHY,
  GITHUB_APPLICATIONS_URL,
  GITHUB_PAT_CREATE_URL,
  GITHUB_PAT_LIST_URL,
  MARKDUP_ISSUES_URL,
  MARKDUP_REPO_URL,
  REVOKE_STEPS,
  TOKEN_STORAGE_FACTS,
} from "../shared/authCopy";

/** Discriminated union that represents every possible options-page UI state. */
type UiState =
  | { kind: "loading" }
  | {
      kind: "connected";
      login: string;
      method?: "oauth" | "pat";
      accessWarning?: AuthStatusResponse["accessWarning"];
    }
  | {
      kind: "connect";
      userCode: string;
      verificationUri: string;
      login?: string;
      method?: "oauth" | "pat";
    }
  | { kind: "disconnected" }
  | { kind: "error"; message: string };

const LOGO_URL = chrome.runtime.getURL("icons/logo.svg");
const TAGLINE = "A better way to review Markdown files.";
const PAT_SECTION_ID = "rgm-pat-fallback";

/**
 * Options page root component. Shows OAuth and PAT connection forms for GitHub.
 * @returns JSX for the full-page settings view.
 */
export default function App() {
  const [state, setState] = useState<UiState>({ kind: "loading" });
  const [oauthBusy, setOauthBusy] = useState(false);
  const [pat, setPat] = useState("");
  const [patBusy, setPatBusy] = useState(false);
  const [patError, setPatError] = useState<string | null>(null);
  const [accessWarning, setAccessWarning] = useState<AuthStatusResponse["accessWarning"]>(null);

  /**
   * Queries the background service worker for the current auth status and updates UI state.
   * Sends a probe request so the worker also checks token validity.
   * @returns A promise that resolves when the status check finishes.
   */
  const refreshStatus = useCallback(async () => {
    try {
      const status = (await chrome.runtime.sendMessage({
        type: "AUTH_STATUS",
        probe: true,
      })) as AuthStatusResponse;
      setAccessWarning(status.accessWarning ?? null);
      if (status.authenticated && status.login) {
        setState({
          kind: "connected",
          login: status.login,
          method: status.method,
          accessWarning: status.accessWarning,
        });
      } else {
        setState({ kind: "disconnected" });
      }
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Markdup could not read the connection status.",
      });
    }
  }, []);

  useEffect(() => {
    void refreshStatus();

    /**
     * Handles incoming extension messages for auth-complete and auth-error events.
     * On success, resets PAT fields and scrolls to the PAT section when OAuth is org-restricted.
     * @param message - The extension event from the background service worker.
     */
    const onMessage = (message: ExtensionEvent) => {
      if (message.type === "AUTH_COMPLETE") {
        setOauthBusy(false);
        setAccessWarning(message.accessWarning ?? null);
        setState({
          kind: "connected",
          login: message.login,
          method: message.method,
          accessWarning: message.accessWarning,
        });
        setPat("");
        setPatError(null);
        if (message.accessWarning?.kind === "oauth_org_restricted") {
          window.requestAnimationFrame(() => {
            document
              .getElementById(PAT_SECTION_ID)
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }
      }
      if (message.type === "AUTH_ERROR") {
        setOauthBusy(false);
        setState({ kind: "error", message: message.message });
      }
    };

    chrome.runtime.onMessage.addListener(onMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, [refreshStatus]);

  /**
   * Starts the OAuth device-code flow by sending AUTH_ENSURE to the background service worker.
   * @returns A promise that resolves when the flow starts or an error is set.
   */
  const connect = async () => {
    setOauthBusy(true);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: "AUTH_ENSURE",
      })) as AuthEnsureResponse;

      if (response.status === "ok") {
        setOauthBusy(false);
        await refreshStatus();
        return;
      }

      if (response.status === "needs_auth") {
        setState({
          kind: "connect",
          userCode: response.user_code,
          verificationUri: response.verification_uri,
        });
        setOauthBusy(false);
        return;
      }

      setState({ kind: "error", message: response.message });
      setOauthBusy(false);
    } catch (error) {
      setOauthBusy(false);
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Markdup could not start the GitHub connection.",
      });
    }
  };

  /**
   * Sends the PAT to the background service worker for validation and storage.
   * @returns A promise that resolves after the token is saved or an error is shown.
   */
  const savePat = async () => {
    setPatBusy(true);
    setPatError(null);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: "AUTH_SET_PAT",
        token: pat,
      })) as AuthSetPatResponse;

      if (response.status === "ok") {
        setAccessWarning(null);
        setState({ kind: "connected", login: response.login, method: "pat" });
        setPat("");
        return;
      }
      setPatError(response.message);
    } catch (error) {
      setPatError(error instanceof Error ? error.message : "Markdup could not save the token.");
    } finally {
      setPatBusy(false);
    }
  };

  /**
   * Removes the stored token and disconnects the extension from GitHub on this browser.
   * @returns A promise that resolves after the token is removed.
   */
  const removeLocalAccess = async () => {
    await chrome.runtime.sendMessage({ type: "AUTH_DISCONNECT" });
    setAccessWarning(null);
    setState({ kind: "disconnected" });
  };

  /**
   * Cancels an in-progress OAuth device-code flow and refreshes the UI state.
   * @returns A promise that resolves after cancellation.
   */
  const cancel = async () => {
    await chrome.runtime.sendMessage({ type: "AUTH_CANCEL" });
    setOauthBusy(false);
    void refreshStatus();
  };

  const connectedLogin = state.kind === "connected" ? state.login : undefined;
  const connectedMethod = state.kind === "connected" ? state.method : undefined;
  const showOauthBlocked =
    accessWarning?.kind === "oauth_org_restricted" ||
    (state.kind === "connected" && state.accessWarning?.kind === "oauth_org_restricted");
  const oauthBlockedMessage =
    accessWarning?.message ??
    (state.kind === "connected" ? state.accessWarning?.message : undefined);

  return (
    <div className="mx-auto max-w-xl px-6 py-12 font-sans text-neutral-950">
      <header className="mb-10 flex items-start gap-5">
        <img
          alt=""
          className="size-24 shrink-0 rounded-[20px]"
          height={96}
          src={LOGO_URL}
          width={96}
        />
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-2xl font-semibold tracking-tight">Markdup</h1>
          <p className="mt-2 text-base leading-snug text-neutral-600">{TAGLINE}</p>
          <p className="mt-3 text-sm leading-snug text-neutral-500">
            Try Option 1 (OAuth) first. If your organization blocks the Markdup OAuth App, use
            Option 2 (personal access token).
          </p>
        </div>
      </header>

      {showOauthBlocked && oauthBlockedMessage && (
        <aside
          className="mb-10 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4"
          role="alert"
        >
          <p className="text-sm font-semibold text-amber-950">
            OAuth is connected, but it cannot access organization repos
          </p>
          <p className="mt-2 text-sm leading-snug text-amber-900">{oauthBlockedMessage}</p>
          <button
            className="rgm-btn mt-4 w-fit"
            onClick={() => {
              document
                .getElementById(PAT_SECTION_ID)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            type="button"
          >
            Go to Option 2
          </button>
        </aside>
      )}

      {state.kind === "loading" && (
        <p className="mb-8 text-sm text-neutral-500">Checking GitHub connection…</p>
      )}

      {state.kind === "connected" && (
        <section className="mb-10 flex flex-col gap-4 border-b border-neutral-200 pb-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</p>
            <p className="mt-2 text-sm text-neutral-800">
              Connected as <span className="font-semibold">@{state.login}</span>
              <span className="text-neutral-500">
                {state.method === "pat" ? " · personal access token" : " · OAuth"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rgm-btn rgm-btn-secondary"
              onClick={() => void removeLocalAccess()}
              type="button"
            >
              Remove from this browser
            </button>
            <a
              className="rgm-settings-link"
              href={GITHUB_APPLICATIONS_URL}
              rel="noreferrer"
              target="_blank"
            >
              Open GitHub application settings
            </a>
          </div>
        </section>
      )}

      {state.kind !== "loading" && (
        <>
          <section className="mb-10 flex flex-col gap-4 border-b border-neutral-200 pb-10">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Option 1 · Connect with GitHub
              </h2>
              <p className="mt-2 text-sm leading-snug text-neutral-600">{AUTH_OAUTH_HINT}</p>
            </div>

            {connectedMethod === "oauth" && connectedLogin && (
              <p className="text-sm text-neutral-700">Active via OAuth as @{connectedLogin}.</p>
            )}

            {state.kind !== "connect" && (
              <button
                className="rgm-btn w-fit"
                disabled={oauthBusy}
                onClick={() => void connect()}
                type="button"
              >
                {oauthBusy
                  ? "Starting…"
                  : connectedMethod === "oauth"
                    ? "Reconnect with GitHub"
                    : "Connect with GitHub"}
              </button>
            )}

            {state.kind === "connect" && (
              <div className="flex flex-col gap-4">
                <p className="text-sm leading-snug text-neutral-600">
                  Enter this one-time code on GitHub. Then authorize Markdup.
                </p>
                <p className="font-mono text-3xl font-bold tracking-wider text-neutral-950">
                  {state.userCode}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    className="rgm-btn w-fit no-underline"
                    href={state.verificationUri}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open github.com/login/device
                  </a>
                  <button
                    className="rgm-btn rgm-btn-secondary"
                    onClick={() => void cancel()}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {state.kind === "error" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-snug text-red-600">{state.message}</p>
                <p className="text-sm leading-snug text-neutral-600">
                  If OAuth fails because your organization blocks the app, use Option 2 below.
                </p>
                <button className="rgm-btn w-fit" onClick={() => void connect()} type="button">
                  Try OAuth again
                </button>
              </div>
            )}
          </section>

          <section
            className={`mb-10 flex flex-col gap-4 border-b border-neutral-200 pb-10 ${
              showOauthBlocked ? "rounded-2xl border border-amber-300 bg-amber-50/40 px-5 py-6" : ""
            }`}
            id={PAT_SECTION_ID}
          >
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Option 2 · Personal access token
                {showOauthBlocked ? " — use this now" : ""}
              </h2>
              <p className="mt-2 text-sm leading-snug text-neutral-600">
                Use this when Option 1 does not work — for example when an organization blocks the
                Markdup OAuth App.
              </p>
            </div>

            {connectedMethod === "pat" && connectedLogin && (
              <p className="text-sm text-neutral-700">
                Active via personal access token as @{connectedLogin}.
              </p>
            )}

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Why use a token?
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-snug text-neutral-600">
                {AUTH_PAT_WHY.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                How to create a classic token
              </h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-snug text-neutral-600">
                {AUTH_PAT_HOW_STEPS.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <a
                className="rgm-settings-link"
                href={GITHUB_PAT_CREATE_URL}
                rel="noreferrer"
                target="_blank"
              >
                Generate new token (classic)
              </a>
              <a
                className="rgm-settings-link"
                href={GITHUB_PAT_LIST_URL}
                rel="noreferrer"
                target="_blank"
              >
                Your token list
              </a>
            </div>

            <p className="text-sm leading-snug text-neutral-600">{AUTH_PAT_FINE_GRAINED_NOTE}</p>

            <label className="block">
              <span className="text-sm font-medium text-neutral-800">Paste your token</span>
              <input
                autoComplete="off"
                className="rgm-settings-input"
                onChange={(event) => setPat(event.target.value)}
                placeholder="ghp_… or github_pat_…"
                spellCheck={false}
                type="password"
                value={pat}
              />
            </label>
            {patError && <p className="text-sm leading-snug text-red-600">{patError}</p>}
            <button
              className="rgm-btn w-fit"
              disabled={patBusy || !pat.trim()}
              onClick={() => void savePat()}
              type="button"
            >
              {patBusy ? "Saving…" : connectedMethod === "pat" ? "Replace token" : "Save token"}
            </button>
          </section>
        </>
      )}

      <section className="mb-10 flex flex-col gap-3 border-b border-neutral-200 pb-10">
        <h2 className="text-lg font-semibold tracking-tight">Where the token is stored</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-snug text-neutral-600">
          {TOKEN_STORAGE_FACTS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="mb-10 flex flex-col gap-3 border-b border-neutral-200 pb-10">
        <h2 className="text-lg font-semibold tracking-tight">How to revoke access</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-snug text-neutral-600">
          {REVOKE_STEPS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Support</h2>
        <p className="text-sm leading-snug text-neutral-600">
          Docs, releases, and help live on the Markdup GitHub repository. Open an issue if something
          does not work.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <a className="rgm-settings-link" href={MARKDUP_REPO_URL} rel="noreferrer" target="_blank">
            github.com/hedger-briskteaching/markdup
          </a>
          <a
            className="rgm-settings-link"
            href={MARKDUP_ISSUES_URL}
            rel="noreferrer"
            target="_blank"
          >
            Open an issue
          </a>
        </div>
      </section>
    </div>
  );
}
