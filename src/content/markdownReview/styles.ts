const STYLE_ID = 'rgm-markdown-review-styles'

const CSS = `
[data-rgm-native-hidden] {
  display: none !important;
}

[data-rgm-toggle] {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0 4px 0 0;
  vertical-align: middle;
  cursor: pointer;
  user-select: none;
}

[data-rgm-toggle] .rgm-switch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}

[data-rgm-toggle] .rgm-switch-track {
  position: relative;
  display: block;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  border: 1.5px solid #a8b3e0;
  background: #e8eaf6;
  transition:
    background-color 120ms ease,
    border-color 120ms ease;
  box-sizing: border-box;
}

[data-rgm-toggle] .rgm-switch-thumb {
  position: absolute;
  top: 1.5px;
  left: 1.5px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(31, 35, 40, 0.28);
  transition: transform 120ms ease;
}

[data-rgm-toggle][data-rgm-mode="rich"] .rgm-switch-track {
  background: #2da44e;
  border-color: #a8b3e0;
}

[data-rgm-toggle][data-rgm-mode="rich"] .rgm-switch-thumb {
  transform: translateX(18px);
}

[data-rgm-toggle] .rgm-switch:focus-visible .rgm-switch-track {
  outline: 2px solid #0969da;
  outline-offset: 2px;
}

[data-rgm-toggle] .rgm-switch-label {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--fgColor-muted, #656d76);
  white-space: nowrap;
}

[data-rgm-toggle][data-rgm-mode="rich"] .rgm-switch-label {
  color: var(--fgColor-default, #1f2328);
  font-weight: 600;
}

[data-rgm-stub] {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border: 1px solid var(--borderColor-default, #d0d7de);
  border-top: none;
  border-radius: 0 0 6px 6px;
  background: var(--bgColor-default, #ffffff);
  min-height: 160px;
  overflow: hidden;
}

[data-rgm-stub] .rgm-stub-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px 16px;
}

[data-rgm-stub] .rgm-stub-pane + .rgm-stub-pane {
  border-left: 1px solid var(--borderColor-default, #d0d7de);
}

[data-rgm-stub] .rgm-stub-label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fgColor-muted, #656d76);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

[data-rgm-stub] .rgm-stub-placeholder {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--fgColor-muted, #656d76);
}

[data-rgm-diff-hidden] {
  display: none !important;
}

[data-rgm-auth-panel] {
  margin: 0;
  padding: 16px 20px;
  border: 1px solid var(--borderColor-default, #d0d7de);
  border-top: none;
  border-radius: 0 0 6px 6px;
  background: var(--bgColor-muted, #f6f8fa);
}

[data-rgm-auth-panel] .rgm-auth-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--fgColor-default, #1f2328);
}

[data-rgm-auth-panel] .rgm-auth-hint {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--fgColor-muted, #656d76);
}

[data-rgm-auth-panel] .rgm-auth-code {
  margin: 0 0 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--fgColor-default, #1f2328);
}

[data-rgm-auth-panel] .rgm-auth-safety {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid var(--borderColor-default, #d0d7de);
  border-radius: 6px;
  background: var(--bgColor-default, #ffffff);
}

[data-rgm-auth-panel] .rgm-auth-safety-title {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fgColor-muted, #656d76);
}

[data-rgm-auth-panel] .rgm-auth-safety-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--fgColor-muted, #656d76);
}

[data-rgm-auth-panel] .rgm-auth-safety-list li + li {
  margin-top: 4px;
}

[data-rgm-auth-panel] .rgm-auth-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

[data-rgm-auth-panel] .rgm-auth-btn {
  margin: 0;
  padding: 5px 12px;
  border: 1px solid var(--borderColor-default, #d0d7de);
  border-radius: 6px;
  background: var(--bgColor-default, #ffffff);
  color: var(--fgColor-default, #1f2328);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
}

[data-rgm-auth-panel] .rgm-auth-btn:hover {
  background: var(--control-transparent-bgColor-hover, rgba(208, 215, 222, 0.32));
}

[data-rgm-auth-panel] .rgm-auth-btn-primary {
  background: #124c5f;
  border-color: #124c5f;
  color: #ffffff;
}

[data-rgm-auth-panel] .rgm-auth-btn-primary:hover {
  background: #0e3d4c;
  border-color: #0e3d4c;
}

[data-rgm-auth-panel] .rgm-auth-error {
  margin: 4px 0 0;
  font-size: 12px;
  color: #cf222e;
}
`

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return
  }

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
