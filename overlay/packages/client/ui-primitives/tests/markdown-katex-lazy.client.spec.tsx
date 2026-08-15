// @vitest-environment jsdom
// The lazy-KaTeX contract: a settled math node renders a literal-TeX
// placeholder until the on-demand KaTeX import resolves, then a
// useSyncExternalStore subscription re-renders the full byte-identical DOM.
// This spec deliberately does NOT preload KaTeX (unlike the sibling markdown
// specs), so it reaches the pre-load placeholder branch the coverage gate
// requires; vitest's per-file process isolation keeps the module unloaded
// here regardless of what the preloading specs do in their own processes.
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { ensureKatexLoaded } from '../src/markdown/katex.tsx'

afterEach(cleanup)

describe('MarkdownText lazy KaTeX', () => {
  it('renders the literal-TeX placeholder before KaTeX loads, then the full DOM after', async () => {
    const { container } = render(<MarkdownText text={'Einstein wrote $E = mc^2$ inline.'} />)
    // Pre-load: KaTeX is not yet in the module cache, so the math node
    // renders the placeholder and triggers the dynamic import.
    expect(container.querySelector('.katex')).toBeNull()
    expect(container.querySelector('.katex-pending')?.textContent).toBe('E = mc^2')

    await ensureKatexLoaded()
    // The useSyncExternalStore subscription re-rendered the settled blocks;
    // the post-load DOM matches the static-import pipeline byte-for-byte.
    await waitFor(() => {
      expect(container.querySelector('.katex')).not.toBeNull()
    })
    expect(container.querySelector('.katex-pending')).toBeNull()
    expect(container.querySelector('.katex annotation')?.textContent).toBe('E = mc^2')
  })
})
