/**
 * TeX-to-React via KaTeX, replicating the rehype-katex pipeline this renderer
 * replaced: the same three-arm error chain (strict render, `strict: 'ignore'`
 * retry, error span) and a DOM-identical element tree, so settled math keeps
 * its exact markup. KaTeX emits an HTML string; the browser's own HTML parser
 * (`DOMParser`, applying the spec's SVG/MathML foreign-content attribute
 * adjustments KaTeX output relies on) turns it into a tree this module maps
 * onto React elements — KaTeX output is a static span/MathML/SVG vocabulary
 * with no raw user HTML, the same trust shiki's tree gets in CodeBlock.
 *
 * React 18 has no MathML support, so the `.katex-mathml` subtree's elements
 * land in the HTML namespace — exactly as they did under the replaced
 * hast-util-to-jsx-runtime pipeline. The visual arm is the `.katex-html`
 * span tree; the MathML arm serves assistive technology, which reads it by
 * tag name regardless of namespace.
 *
 * KaTeX loads on demand. Streaming never parses math (`parseGfm` carries no
 * math grammar, so `$...$` stays literal until the settle swap), so KaTeX is
 * never on the streaming hot path; a session without math never downloads it.
 * The first settled math node triggers a dynamic import of the KaTeX module
 * and its stylesheet; `renderTexToReact` renders a literal-TeX placeholder
 * until the module resolves, then {@link subscribeKatexLoaded} notifies
 * subscribers to re-render with the full DOM. The post-load DOM is
 * byte-identical to the previous static-import pipeline (same
 * `renderToString` + `DOMParser` mapping), so the DOM-parity fixtures hold
 * once the load completes.
 */

import { createElement } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type katexType from 'katex'

/**
 * Convert one inline `style` attribute string into React's style object.
 * KaTeX emits only plain kebab-case declarations (no custom properties and no
 * nameless declarations), so camel-casing the property is the whole mapping.
 */
function styleObject(css: string): CSSProperties {
  const style: Record<string, string> = {}
  for (const declaration of css.split(';')) {
    const colon = declaration.indexOf(':')
    if (colon === -1) continue
    const name = declaration.slice(0, colon).trim()
    const key = name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
    style[key] = declaration.slice(colon + 1).trim()
  }
  return style
}

/** Map one parsed DOM node onto a React element (text nodes pass through). */
function domToReact(node: ChildNode, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  /* v8 ignore next 2 -- KaTeX output holds only elements and text; other
     node kinds cannot appear in its serialized vocabulary. */
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const element = node as Element
  const props: Record<string, unknown> = { key }
  for (const attribute of element.attributes) {
    if (attribute.name === 'class') props['className'] = attribute.value
    else if (attribute.name === 'style') props['style'] = styleObject(attribute.value)
    else props[attribute.name] = attribute.value
  }
  const children = [...element.childNodes].map(domToReact)
  return children.length === 0
    ? createElement(element.localName, props)
    : createElement(element.localName, props, ...children)
}

/** The lazily-loaded KaTeX default export; undefined until the import resolves. */
let katexModule: typeof katexType | undefined
/** In-flight or settled load promise, so the module and stylesheet are requested once. */
let loadPromise: Promise<void> | undefined
/** Subscribers re-rendered after KaTeX finishes loading (React callers). */
const listeners = new Set<() => void>()
/** Bumped on each load completion; the `useSyncExternalStore` snapshot. */
let loadCount = 0

/**
 * Subscribe to KaTeX load completion; `listener` fires after the module and
 * stylesheet resolve, so a caller that rendered the literal-TeX placeholder
 * can re-render the full DOM. Uses the `useSyncExternalStore` subscribe
 * signature; pair it with {@link katexLoadCount} as the snapshot. Returns an
 * unsubscribe function.
 * @param listener - invoked (no args) on load completion.
 * @returns a disposer that removes the listener.
 */
export function subscribeKatexLoaded(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * The KaTeX load counter — a value that changes on load completion, so a
 * `useSyncExternalStore` snapshot re-renders the subscriber when KaTeX
 * becomes ready. Opaque: only its identity across renders matters.
 * @returns the current load count.
 */
export function katexLoadCount(): number {
  return loadCount
}

/**
 * Ensure KaTeX is loaded. Resolves once the module and stylesheet are ready;
 * idempotent — the first caller starts the import, later callers await the
 * same promise. Tests call this in `beforeAll` to make synchronous renders
 * produce the full KaTeX DOM immediately; production calls it implicitly on
 * the first settled math node via {@link renderTexToReact}.
 * @returns resolves when KaTeX is ready (or already was).
 */
export function ensureKatexLoaded(): Promise<void> {
  if (katexModule !== undefined) return Promise.resolve()
  loadPromise ??= (async () => {
    // The module and stylesheet load together: the DOM KaTeX emits carries
    // class names the stylesheet must style, so a loaded module without its
    // CSS would flash unstyled math. Both ride one dynamic import so Vite
    // emits one KaTeX chunk pair (JS + CSS) fetched on first math.
    const [mod] = await Promise.all([
      import('katex'),
      import('katex/dist/katex.min.css'),
    ])
    katexModule = mod.default
    loadCount += 1
    for (const listener of listeners) listener()
  })()
  return loadPromise
}

/**
 * Render TeX source to React elements through KaTeX.
 * @param value - The TeX source (math node value; fenced `math` blocks append
 * their trailing newline to match the replaced pipeline's text extraction).
 * @param displayMode - Display (block) versus inline rendering.
 * @returns KaTeX's element tree, the literal-TeX placeholder before KaTeX
 * loads, or the error span when the source does not parse (colored with
 * KaTeX's stock `errorColor`, matching rehype-katex).
 */
export function renderTexToReact(value: string, displayMode: boolean): ReactNode {
  const katex = katexModule
  if (katex === undefined) {
    // Trigger the load once; render the literal TeX as a visible placeholder
    // until subscribers re-render with the real DOM. Unreachable after load
    // (and after the test-suite `beforeAll` preload).
    void ensureKatexLoaded()
    return <span className="katex-pending">{value}</span>
  }
  let html: string
  try {
    html = katex.renderToString(value, { displayMode, throwOnError: true })
  } catch (error) {
    try {
      html = katex.renderToString(value, { displayMode, strict: 'ignore', throwOnError: false })
    } catch {
      // KaTeX renders ParseErrors itself under throwOnError: false; only its
      // internal errors reach here, so mirror rehype-katex's manual span.
      /* v8 ignore next 8 */
      return (
        <span
          className="katex-error"
          style={{ color: '#cc0000' }}
          title={String(error)}
        >
          {value}
        </span>
      )
    }
  }
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  return [...parsed.body.childNodes].map(domToReact)
}
