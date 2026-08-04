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

[data-rgm-rich],
[data-rgm-stub] {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--borderColor-default, #d0d7de);
  border-top: none;
  border-radius: 0 0 6px 6px;
  background: #ffffff;
  min-height: 160px;
  overflow: hidden;
  --rgm-bp-800: #353c42;
  --rgm-bp-700: #5a656f;
  --rgm-bp-500: #74818e;
  --rgm-bp-400: #99a5b0;
  --rgm-bp-300: #c4cbd1;
  --rgm-bp-200: #e0e7ed;
  --rgm-bp-25: #f7f8f9;
  --rgm-ocean-700: #124c5f;
  --rgm-ocean-25: #f0f5fa;
  --rgm-diff-del-surface: #fef6f6;
  --rgm-diff-add-surface: #f4fbf8;
  --rgm-diff-del-inline: #fbd8d8;
  --rgm-diff-add-inline: #c8f0e0;
}

[data-rgm-rich] .rgm-rich-header {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--rgm-bp-200);
  background: var(--rgm-bp-25);
}

[data-rgm-rich] .rgm-rich-header-side {
  padding: 8px 12px 8px 46px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rgm-ocean-700);
  background: var(--rgm-ocean-25);
}

[data-rgm-rich] .rgm-rich-header-side + .rgm-rich-header-side {
  border-left: 1px solid var(--rgm-bp-200);
}

[data-rgm-rich] .rgm-rich-body {
  display: flex;
  flex-direction: column;
}

[data-rgm-rich] .rgm-rich-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--rgm-bp-200);
}

[data-rgm-rich] .rgm-rich-row:last-child {
  border-bottom: none;
}

[data-rgm-rich] .rgm-rich-cell {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 0;
  min-width: 0;
  padding: 10px 12px 10px 0;
  background: #ffffff;
  color: var(--rgm-bp-800);
  font-size: 14px;
  line-height: 1.6;
}

[data-rgm-rich] .rgm-rich-cell + .rgm-rich-cell {
  border-left: 1px solid var(--rgm-bp-200);
}

[data-rgm-rich] .rgm-rich-cell-del {
  background: var(--rgm-diff-del-surface);
}

[data-rgm-rich] .rgm-rich-cell-add {
  background: var(--rgm-diff-add-surface);
}

[data-rgm-rich] .rgm-rich-cell-missing {
  grid-template-columns: 1fr;
  padding: 10px 12px;
  background: var(--rgm-bp-25);
}

[data-rgm-rich] .rgm-rich-missing {
  margin: 0;
  font-size: 13px;
  font-style: italic;
  color: var(--rgm-bp-400);
}

[data-rgm-rich] .rgm-rich-gutter {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  padding: 2px 6px 0 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  line-height: 1.2;
  color: var(--rgm-bp-400);
  user-select: none;
}

[data-rgm-rich] .rgm-rich-gutter-rule {
  width: 1px;
  flex: 1;
  min-height: 8px;
  margin-right: 8px;
  background: var(--rgm-bp-300);
}

[data-rgm-rich] .rgm-rich-content {
  min-width: 0;
}

[data-rgm-rich] .rgm-rich-content > * {
  margin: 0;
}

[data-rgm-rich] .rgm-rich-content h1 {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.25;
  color: #0e151c;
}

[data-rgm-rich] .rgm-rich-content h2 {
  font-size: 19px;
  font-weight: 700;
  line-height: 1.3;
  color: #0e151c;
}

[data-rgm-rich] .rgm-rich-content h3,
[data-rgm-rich] .rgm-rich-content h4,
[data-rgm-rich] .rgm-rich-content h5,
[data-rgm-rich] .rgm-rich-content h6 {
  font-size: 15.5px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--rgm-bp-700);
}

[data-rgm-rich] .rgm-rich-content a {
  color: var(--rgm-ocean-700);
  text-decoration: underline;
}

[data-rgm-rich] .rgm-rich-content code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--rgm-ocean-25);
  color: var(--rgm-ocean-700);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
}

[data-rgm-rich] .rgm-rich-content pre {
  position: relative;
  margin: 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--rgm-bp-25);
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre;
}

[data-rgm-rich] .rgm-rich-code-lang {
  display: inline-block;
  margin-bottom: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--rgm-ocean-25);
  color: var(--rgm-ocean-700);
  font-size: 10px;
  font-weight: 600;
  text-transform: lowercase;
}

[data-rgm-rich] .rgm-rich-content table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

[data-rgm-rich] .rgm-rich-content th,
[data-rgm-rich] .rgm-rich-content td {
  padding: 6px 8px;
  border: 1px solid var(--rgm-bp-200);
  text-align: left;
  vertical-align: top;
}

[data-rgm-rich] .rgm-rich-content th {
  background: var(--rgm-bp-25);
  font-weight: 600;
}

[data-rgm-rich] .rgm-rich-content blockquote {
  margin: 0;
  padding-left: 12px;
  border-left: 3px solid var(--rgm-bp-300);
  color: var(--rgm-bp-700);
}

[data-rgm-rich] .rgm-rich-content ul,
[data-rgm-rich] .rgm-rich-content ol {
  margin: 0;
  padding-left: 1.25em;
}

[data-rgm-rich] .rgm-rich-list-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

[data-rgm-rich] .rgm-rich-bullet {
  color: var(--rgm-bp-500);
  line-height: 1.6;
}

[data-rgm-rich] .rgm-rich-front-matter {
  border: 1px solid var(--rgm-bp-200);
  border-radius: 6px;
  background: var(--rgm-bp-25);
  overflow: hidden;
}

[data-rgm-rich] .rgm-rich-front-matter-label {
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rgm-bp-500);
  border-bottom: 1px solid var(--rgm-bp-200);
}

[data-rgm-rich] .rgm-rich-front-matter-body {
  margin: 0;
  padding: 10px 12px;
  background: transparent;
  font-size: 12px;
}

[data-rgm-rich] .rgm-rich-ins {
  background: var(--rgm-diff-add-inline);
  color: var(--rgm-bp-800);
}

[data-rgm-rich] .rgm-rich-del {
  background: var(--rgm-diff-del-inline);
  color: var(--rgm-bp-800);
  text-decoration: line-through;
  text-decoration-color: #b24a4a;
}

[data-rgm-rich] .rgm-rich-status {
  margin: 0;
  padding: 24px 16px;
  text-align: center;
  font-size: 14px;
  color: var(--rgm-bp-500);
}

[data-rgm-rich] .rgm-rich-status-error {
  color: #dc2626;
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
