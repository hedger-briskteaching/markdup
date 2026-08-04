const STYLE_ID = 'rgm-markdown-review-styles'

const CSS = `
[data-rgm-toggle] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--fgColor-muted, #656d76);
  cursor: pointer;
  vertical-align: middle;
}

[data-rgm-toggle]:hover {
  background: var(--control-transparent-bgColor-hover, rgba(208, 215, 222, 0.32));
  color: var(--fgColor-default, #1f2328);
}

[data-rgm-toggle][aria-pressed="true"] {
  background: var(--control-transparent-bgColor-selected, rgba(208, 215, 222, 0.48));
  color: var(--fgColor-default, #1f2328);
  border-color: var(--borderColor-default, #d0d7de);
}

[data-rgm-toggle] svg {
  display: block;
  width: 16px;
  height: 16px;
  fill: currentColor;
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
