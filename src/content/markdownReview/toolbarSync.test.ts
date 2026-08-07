import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  copyToolbarText,
  findFilesToolbar,
  syncFilesToolbar,
} from './toolbarSync'

/**
 * Build the Files toolbar the way GitHub renders it: a counter on the Submit
 * review button, a second one on the comments panel button, and the React
 * comment markers that sit between the text nodes.
 * @param count - The number both counters show.
 * @param viewed - The viewed-files numerator.
 * @returns The toolbar markup.
 */
function toolbarHtml(count: number, viewed = 0): string {
  return `
    <div data-component="Stack" class="prc-Stack-Stack-UQ9k6">
      <div class="d-flex PullRequestFilesToolbar-module__file-controls__Tgb8F">
        <span class="ViewedFileProgress-module__ProgressContainer___3P2j"
          ><span class="ViewedFileProgress-module__FilesCountText__NwSKr">${viewed}</span> /<!-- -->
          <span class="ViewedFileProgress-module__FilesCountText__NwSKr">6</span>
          <span class="ViewedFileProgress-module__ViewedText__s4QAn">viewed</span></span>
        <span class="sr-only">${viewed} of 6 files viewed</span>
      </div>
      <div class="PullRequestFilesToolbar-module__file-controls-divider__zkpAr"
        data-testid="file-controls-divider"></div>
      <button data-component="Button" class="prc-Button-ButtonBase-9n-Xk" data-has-count="true">
        <span data-component="buttonContent" class="prc-Button-ButtonContent-Iohp5">
          <span data-component="text" class="prc-Button-Label-FWkx3">Submit <!-- -->review</span>
          <span data-component="trailingVisual" class="prc-Button-VisualWrap-E4cnq">
            <span data-component="ButtonCounter"
              class="prc-Button-CounterLabel-5hAs4">${count}</span>
            <span class="prc-VisuallyHidden-VisuallyHidden-Q0qSB">&nbsp;(<!-- -->${count}<!-- -->)</span>
          </span>
        </span>
      </button>
      <button data-component="Button" class="prc-Button-ButtonBase-9n-Xk" data-icon-only-counter="true">
        <span data-component="buttonContent" class="prc-Button-ButtonContent-Iohp5">
          <span data-component="trailingVisual" class="prc-Button-VisualWrap-E4cnq">
            <span data-component="ButtonCounter"
              class="prc-Button-CounterLabel-5hAs4">${count}</span>
          </span>
        </span>
      </button>
    </div>`
}

/** Read both counter values from a root element. */
function counters(root: ParentNode): string[] {
  return [...root.querySelectorAll('[data-component="ButtonCounter"]')].map(
    (el) => el.textContent?.trim() ?? '',
  )
}

describe('findFilesToolbar', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('finds the toolbar from its divider test id', () => {
    document.body.innerHTML = toolbarHtml(6)
    const toolbar = findFilesToolbar(document)

    expect(toolbar).not.toBeNull()
    expect(toolbar?.getAttribute('data-component')).toBe('Stack')
  })

  it('still finds it when the test id is gone', () => {
    document.body.innerHTML = toolbarHtml(6).replace(
      ' data-testid="file-controls-divider"',
      '',
    )

    expect(findFilesToolbar(document)).not.toBeNull()
  })

  it('returns null when the toolbar is absent', () => {
    document.body.innerHTML = '<div>no toolbar here</div>'

    expect(findFilesToolbar(document)).toBeNull()
  })
})

describe('copyToolbarText', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  /** Parse standalone toolbar markup into a detached element. */
  function parse(html: string): Element {
    return new DOMParser().parseFromString(html, 'text/html').body
      .firstElementChild!
  }

  it('copies both counters across', () => {
    document.body.innerHTML = toolbarHtml(6)
    const live = findFilesToolbar(document)!

    expect(copyToolbarText(live, parse(toolbarHtml(7)))).toBeGreaterThan(0)
    expect(counters(live)).toEqual(['7', '7'])
  })

  it('updates the screen-reader count alongside the visible one', () => {
    document.body.innerHTML = toolbarHtml(6)
    const live = findFilesToolbar(document)!
    copyToolbarText(live, parse(toolbarHtml(7)))

    const hidden = live.querySelector('.prc-VisuallyHidden-VisuallyHidden-Q0qSB')
    expect(hidden?.textContent).toContain('7')
    expect(hidden?.textContent).not.toContain('6')
  })

  it('never replaces an element, so React keeps its references', () => {
    document.body.innerHTML = toolbarHtml(6)
    const live = findFilesToolbar(document)!
    const before = [...live.querySelectorAll('*')]

    copyToolbarText(live, parse(toolbarHtml(7)))

    const after = [...live.querySelectorAll('*')]
    expect(after).toHaveLength(before.length)
    after.forEach((el, i) => expect(el).toBe(before[i]))
  })

  it('writes nothing when the toolbars already agree', () => {
    document.body.innerHTML = toolbarHtml(6)
    const live = findFilesToolbar(document)!

    expect(copyToolbarText(live, parse(toolbarHtml(6)))).toBe(0)
  })

  it('leaves unrelated counts alone', () => {
    document.body.innerHTML = toolbarHtml(6, 2)
    const live = findFilesToolbar(document)!
    copyToolbarText(live, parse(toolbarHtml(7, 2)))

    expect(live.querySelector('.sr-only')?.textContent).toBe(
      '2 of 6 files viewed',
    )
  })
})

describe('syncFilesToolbar', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('patches the live toolbar from the served page', async () => {
    document.body.innerHTML = toolbarHtml(6)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => toolbarHtml(7) }),
    )

    expect(await syncFilesToolbar()).toBe(true)
    expect(counters(document)).toEqual(['7', '7'])
  })

  it('reports no change when the server agrees', async () => {
    document.body.innerHTML = toolbarHtml(6)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => toolbarHtml(6) }),
    )

    expect(await syncFilesToolbar()).toBe(false)
  })

  it('gives up quietly when the fetch fails', async () => {
    document.body.innerHTML = toolbarHtml(6)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    expect(await syncFilesToolbar()).toBe(false)
    expect(counters(document)).toEqual(['6', '6'])
  })

  it('does not fetch at all when there is no toolbar', async () => {
    document.body.innerHTML = '<div>not a files page</div>'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await syncFilesToolbar()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
