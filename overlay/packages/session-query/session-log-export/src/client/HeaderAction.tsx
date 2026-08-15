import type { ReactNode } from 'react'
import { IconDownloadOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { SessionLogDownloadDialog, type SessionLogDownloadDialogProps } from './Dialog.tsx'
import css from './HeaderAction.module.css'

/**
 * Render the Session Header export capsule and its shared result dialog.
 * @param props - Session runtime, download controller, and localized dialog copy.
 * @returns the persistent Header action and Session-scoped dialog.
 */
export function SessionLogDownloadHeaderAction(props: SessionLogDownloadDialogProps): ReactNode {
  const { sessionId, useSessionLogDownload, request } = props
  const entry = useSessionLogDownload(state => state.bySession[String(sessionId)])
  const busy = entry?.status === 'downloading'

  return (
    <>
      <button
        type="button"
        className={css.sessionLogButton}
        disabled={busy}
        aria-busy={busy}
        // The capsule label lives in the DOM for wide viewports; on mobile the
        // CSS hides it and the button collapses to the glyph. Keep the name
        // reachable at every width (screen readers and the accessible tree).
        aria-label="Session log"
        title="Session log"
        onClick={() => { void request(sessionId) }}
      >
        <span className={css.sessionLogLabel}>Session log</span>
        <IconDownloadOutline16 size={12} />
      </button>
      <SessionLogDownloadDialog {...props} />
    </>
  )
}
