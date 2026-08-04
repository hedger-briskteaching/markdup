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
  border: 1.5px solid var(--borderColor-default, #a8b3e0);
  background: var(--controlTrack-bgColor-rest, #e8eaf6);
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
  background: var(--controlKnob-bgColor-rest, #ffffff);
  box-shadow: 0 1px 3px rgba(31, 35, 40, 0.28);
  transition: transform 120ms ease;
}

[data-rgm-toggle][data-rgm-mode="rich"] .rgm-switch-track {
  background: var(--bgColor-success-emphasis, #2da44e);
  border-color: var(--borderColor-default, #a8b3e0);
}

[data-rgm-toggle][data-rgm-mode="rich"] .rgm-switch-thumb {
  transform: translateX(18px);
}

[data-rgm-toggle] .rgm-switch:focus-visible .rgm-switch-track {
  outline: 2px solid var(--focus-outlineColor, #0969da);
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
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--borderColor-default, #d0d7de);
  border-top: none;
  border-radius: 0 0 6px 6px;
  background: var(--bgColor-default, #ffffff);
  min-height: 160px;
  overflow: visible;
  /* Map internal tokens to GitHub Primer variables so the view follows the
     user's active GitHub theme (light / dark / auto). Hex fallbacks are the
     original light palette for non-GitHub contexts (jsdom tests). */
  --rgm-bp-800: var(--fgColor-default, #353c42);
  --rgm-bp-700: var(--fgColor-default, #5a656f);
  --rgm-bp-500: var(--fgColor-muted, #74818e);
  --rgm-bp-400: var(--fgColor-muted, #99a5b0);
  --rgm-bp-300: var(--borderColor-default, #c4cbd1);
  --rgm-bp-200: var(--borderColor-muted, #e0e7ed);
  --rgm-bp-25: var(--bgColor-muted, #f7f8f9);
  --rgm-ocean-700: var(--fgColor-accent, #124c5f);
  --rgm-ocean-25: var(--bgColor-accent-muted, #f0f5fa);
  --rgm-diff-del-surface: var(
    --diffBlob-deletion-bgColor-line,
    var(--bgColor-danger-muted, #fef6f6)
  );
  --rgm-diff-add-surface: var(
    --diffBlob-addition-bgColor-line,
    var(--bgColor-success-muted, #f4fbf8)
  );
  --rgm-diff-del-inline: var(
    --diffBlob-deletion-bgColor-word,
    var(--bgColor-danger-muted, #fbd8d8)
  );
  --rgm-diff-add-inline: var(
    --diffBlob-addition-bgColor-word,
    var(--bgColor-success-muted, #c8f0e0)
  );
}

.rgm-comment-editor {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 0 0 10px;
  border: 1px solid var(--rgm-bp-300, var(--borderColor-default, #c4cbd1));
  border-radius: 6px;
  background: var(--bgColor-default, #ffffff);
  overflow: hidden;
}

.rgm-comment-editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--rgm-bp-200, var(--borderColor-muted, #e0e7ed));
  background: var(--rgm-bp-25, var(--bgColor-muted, #f7f8f9));
}

.rgm-comment-editor-btn {
  margin: 0;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--fgColor-default, #1f2328);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  line-height: 1.2;
}

.rgm-comment-editor-btn:hover {
  background: var(--control-transparent-bgColor-hover, rgba(208, 215, 222, 0.32));
}

.rgm-comment-editor-surface {
  min-height: 72px;
}

.rgm-comment-editor-content {
  min-height: 72px;
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--fgColor-default, #1f2328);
  outline: none;
}

.rgm-comment-editor-content.rgm-comment-editor-empty::before {
  content: attr(data-placeholder);
  color: var(--fgColor-muted, #656d76);
  pointer-events: none;
  float: left;
  height: 0;
}

.rgm-comment-editor-content p {
  margin: 0 0 0.5em;
}

.rgm-comment-editor-content p:last-child {
  margin-bottom: 0;
}

.rgm-comment-editor-content pre {
  margin: 0.5em 0;
  padding: 8px;
  border-radius: 4px;
  background: var(--bgColor-muted, #f6f8fa);
  overflow: auto;
  font-size: 12px;
}

.rgm-md-body {
  font-size: 13px;
  line-height: 1.45;
  color: var(--rgm-bp-800, var(--fgColor-default, #1f2328));
}

.rgm-md-body > *:first-child {
  margin-top: 0;
}

.rgm-md-body > *:last-child {
  margin-bottom: 0;
}

.rgm-md-body p {
  margin: 0 0 0.6em;
}

.rgm-md-body ul,
.rgm-md-body ol {
  margin: 0 0 0.6em;
  padding-left: 1.25em;
}

.rgm-md-body code {
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--bgColor-muted, #f6f8fa);
  font-size: 0.92em;
}

.rgm-md-body pre {
  margin: 0.5em 0;
  padding: 8px;
  border-radius: 4px;
  background: var(--bgColor-muted, #f6f8fa);
  overflow: auto;
  font-size: 12px;
}

.rgm-md-body a {
  color: var(--fgColor-accent, #0969da);
}

.rgm-thread-comment {
  padding: 10px 12px 0;
}

.rgm-thread-comment + .rgm-thread-comment {
  border-top: 1px solid var(--rgm-bp-200, var(--borderColor-muted, #e0e7ed));
  margin-top: 10px;
  padding-top: 10px;
}

.rgm-thread-comment-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 0;
}

.rgm-thread-action {
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: var(--fgColor-accent, #0969da);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.rgm-thread-action:hover {
  text-decoration: underline;
}

.rgm-thread-action-danger {
  color: var(--fgColor-danger, #cf222e);
}

.rgm-thread-reply,
.rgm-thread-edit {
  margin: 10px 12px;
  padding: 10px;
  border: 1px solid var(--rgm-bp-200, var(--borderColor-muted, #e0e7ed));
  border-radius: 6px;
  background: var(--bgColor-default, #ffffff);
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

[data-rgm-rich] .rgm-rich-fold {
  border-bottom: 1px solid var(--rgm-bp-200);
  background: var(--rgm-bp-25);
}

[data-rgm-rich] .rgm-rich-fold-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--rgm-ocean-700);
  text-align: left;
}

[data-rgm-rich] .rgm-rich-fold-btn:hover {
  background: var(--rgm-ocean-25);
}

[data-rgm-rich] .rgm-rich-fold-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid var(--rgm-bp-300);
  border-radius: 4px;
  background: var(--bgColor-default, #ffffff);
  font-weight: 700;
  line-height: 1;
  flex: none;
}

[data-rgm-rich] .rgm-rich-fold-label {
  font-weight: 600;
}

[data-rgm-rich] .rgm-rich-fold-lines {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: var(--rgm-bp-400);
}

[data-rgm-rich] .rgm-rich-cell {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 0;
  min-width: 0;
  padding: 10px 12px 10px 0;
  background: var(--bgColor-default, #ffffff);
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
  color: var(--fgColor-default, #0e151c);
}

[data-rgm-rich] .rgm-rich-content h2 {
  font-size: 19px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--fgColor-default, #0e151c);
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
  text-decoration-color: var(--fgColor-danger, #b24a4a);
}

[data-rgm-rich] .rgm-rich-status {
  margin: 0;
  padding: 24px 16px;
  text-align: center;
  font-size: 14px;
  color: var(--rgm-bp-500);
}

[data-rgm-rich] .rgm-rich-status-error {
  color: var(--fgColor-danger, #dc2626);
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
  background: var(--button-primary-bgColor-rest, #124c5f);
  border-color: var(--button-primary-borderColor-rest, #124c5f);
  color: var(--button-primary-fgColor-rest, #ffffff);
}

[data-rgm-auth-panel] .rgm-auth-btn-primary:hover {
  background: var(--button-primary-bgColor-hover, #0e3d4c);
  border-color: var(--button-primary-borderColor-hover, #0e3d4c);
}

[data-rgm-auth-panel] .rgm-auth-error {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--fgColor-danger, #cf222e);
}

[data-rgm-composer] {
  position: absolute;
  z-index: 25;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--rgm-bp-200);
  border-radius: 8px;
  background: var(--overlay-bgColor, var(--bgColor-default, #ffffff));
  box-shadow: 0 8px 28px rgba(14, 21, 28, 0.14);
  box-sizing: border-box;
  max-width: calc(100% - 16px);
}

[data-rgm-comment-bubble] {
  position: absolute;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: 0;
  padding: 2px;
  border-radius: 999px;
  background: var(--bgColor-emphasis, #0e151c);
  color: var(--fgColor-onEmphasis, #ffffff);
  box-shadow: 0 6px 20px rgba(14, 21, 28, 0.28);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

[data-rgm-comment-bubble] .rgm-comment-bubble-btn {
  margin: 0;
  padding: 7px 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--fgColor-onEmphasis, #ffffff);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

[data-rgm-comment-bubble] .rgm-comment-bubble-btn + .rgm-comment-bubble-btn,
[data-rgm-comment-bubble] .rgm-comment-bubble-btn + .rgm-comment-bubble-ref {
  border-left: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 0;
}

[data-rgm-comment-bubble] .rgm-comment-bubble-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
}

[data-rgm-comment-bubble] .rgm-comment-bubble-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

[data-rgm-comment-bubble] .rgm-comment-bubble-icon {
  margin-right: 4px;
  font-size: 11px;
}

[data-rgm-comment-bubble] .rgm-comment-bubble-ref {
  padding: 7px 12px;
  color: rgba(255, 255, 255, 0.55);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 500;
}

[data-rgm-rich] .rgm-composer-anchor {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--rgm-bp-500);
}

[data-rgm-rich] .rgm-composer-anchor-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--rgm-bp-400);
}

[data-rgm-rich] .rgm-composer-anchor-pill {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--rgm-ocean-25);
  color: var(--rgm-ocean-700);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
}

[data-rgm-rich] .rgm-composer-anchor-side {
  color: var(--rgm-bp-500);
}

[data-rgm-rich] .rgm-sel-highlight-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

[data-rgm-rich] .rgm-sel-highlight {
  position: absolute;
  border-radius: 2px;
  background: rgba(56, 139, 253, 0.28);
  box-shadow: inset 0 0 0 1px rgba(56, 139, 253, 0.45);
}

[data-rgm-rich] .rgm-sel-highlight-cell .rgm-rich-content {
  border-radius: 4px;
  background: rgba(56, 139, 253, 0.16);
  box-shadow: inset 0 0 0 1px rgba(56, 139, 253, 0.35);
}

[data-rgm-rich] .rgm-commented-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

[data-rgm-rich] .rgm-commented-box {
  position: absolute;
  border-radius: 2px;
  background: var(--bgColor-attention-muted, rgba(255, 235, 130, 0.45));
  opacity: 0.5;
  border-bottom: 2px solid var(--fgColor-attention, #9a6700);
}

[data-rgm-rich] .rgm-commented-cell .rgm-rich-content {
  border-radius: 4px;
  background: var(--bgColor-attention-muted, rgba(255, 235, 130, 0.35));
  cursor: pointer;
}

[data-rgm-rich] .rgm-thread-hover-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}

[data-rgm-rich] .rgm-thread-hover-box {
  position: absolute;
  border-radius: 2px;
  background: var(--bgColor-attention-muted, rgba(255, 223, 93, 0.55));
  opacity: 0.85;
  box-shadow: inset 0 0 0 1px var(--fgColor-attention, #9a6700);
}

[data-rgm-rich] .rgm-thread-hover-cell .rgm-rich-content {
  border-radius: 4px;
  background: var(--bgColor-attention-muted, rgba(255, 223, 93, 0.4));
  box-shadow: inset 0 0 0 1px var(--fgColor-attention, #9a6700);
}

[data-rgm-rich] .rgm-composer-input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 0 0 10px;
  padding: 8px 10px;
  border: 1px solid var(--rgm-bp-300);
  border-radius: 6px;
  background: var(--bgColor-default, #ffffff);
  color: var(--fgColor-default, #1f2328);
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
  resize: vertical;
  min-height: 72px;
}

[data-rgm-rich] .rgm-composer-input:focus {
  outline: 2px solid var(--focus-outlineColor, #0969da);
  outline-offset: 1px;
}

[data-rgm-rich] .rgm-composer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

[data-rgm-rich] .rgm-composer-status {
  margin-left: auto;
  font-size: 12px;
  color: var(--rgm-bp-500);
}

[data-rgm-rich] .rgm-composer-status-error {
  color: var(--fgColor-danger, #dc2626);
}

[data-rgm-rich] .rgm-composer-btn {
  margin: 0;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--rgm-bp-300);
  background: var(--bgColor-default, #ffffff);
  color: var(--rgm-bp-800);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

[data-rgm-rich] .rgm-composer-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

[data-rgm-rich] .rgm-composer-btn-primary {
  background: var(--bgColor-emphasis, #0e151c);
  border-color: var(--bgColor-emphasis, #0e151c);
  color: var(--fgColor-onEmphasis, #ffffff);
}

[data-rgm-rich] .rgm-composer-btn-primary:hover:not(:disabled) {
  background: var(--bgColor-emphasis, #1a2430);
  border-color: var(--bgColor-emphasis, #1a2430);
  opacity: 0.9;
}

[data-rgm-thread-card] {
  grid-column: 1 / -1;
  margin: 10px 12px 0;
  border: 1px solid var(--rgm-bp-200);
  border-radius: 8px;
  background: var(--bgColor-muted, #fafbfc);
  width: auto;
  box-sizing: border-box;
  transition: outline-color 200ms ease, box-shadow 200ms ease;
}

[data-rgm-thread-card].rgm-thread-card-flash {
  outline: 2px solid var(--fgColor-attention, #9a6700);
  outline-offset: 2px;
}

[data-rgm-thread-card] .rgm-thread-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 8px 12px;
}

[data-rgm-thread-card] .rgm-thread-identity {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

[data-rgm-thread-card] .rgm-thread-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: var(--bgColor-accent-emphasis, #124c5f);
  color: var(--fgColor-onEmphasis, #ffffff);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

[data-rgm-thread-card] .rgm-thread-meta {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

[data-rgm-thread-card] .rgm-thread-login {
  font-size: 12px;
  font-weight: 600;
  color: var(--rgm-bp-800);
}

[data-rgm-thread-card] .rgm-thread-when {
  font-size: 12px;
  color: var(--rgm-bp-500);
}

[data-rgm-thread-card] .rgm-thread-locus {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

[data-rgm-thread-card] .rgm-thread-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--rgm-bp-700);
}

[data-rgm-thread-card] .rgm-thread-chip {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

[data-rgm-thread-card] .rgm-thread-chip-open {
  background: var(--rgm-ocean-25);
  color: var(--rgm-ocean-700);
}

[data-rgm-thread-card] .rgm-thread-chip-pending {
  background: var(--bgColor-attention-muted, #fff8e1);
  color: var(--fgColor-attention, #8a6d00);
}

[data-rgm-thread-card] .rgm-thread-chip-reanchored {
  background: var(--bgColor-severe-muted, #fff4e5);
  color: var(--fgColor-severe, #9a5b00);
}

[data-rgm-thread-card] .rgm-thread-show {
  margin-left: auto;
  padding: 4px 10px;
  border: 1px solid var(--rgm-bp-300);
  border-radius: 6px;
  background: var(--bgColor-default, #ffffff);
  color: var(--rgm-bp-800);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

[data-rgm-thread-card] .rgm-thread-detail {
  padding: 0 12px 10px;
  border-top: 1px solid var(--rgm-bp-200);
}

[data-rgm-thread-card] .rgm-thread-body {
  margin: 10px 0 8px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--rgm-bp-800);
  white-space: pre-wrap;
}

[data-rgm-thread-card] .rgm-thread-link {
  font-size: 12px;
  font-weight: 600;
  color: var(--rgm-ocean-700);
}

[data-rgm-thread-card] .rgm-thread-more {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--rgm-bp-500);
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
