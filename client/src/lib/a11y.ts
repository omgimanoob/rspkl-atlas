export type AnnounceHandler = (message: string) => void

let statusAnnouncer: AnnounceHandler | null = null
let alertAnnouncer: AnnounceHandler | null = null

export function setStatusAnnouncer(handler: AnnounceHandler | null) {
  statusAnnouncer = handler
}

export function setAlertAnnouncer(handler: AnnounceHandler | null) {
  alertAnnouncer = handler
}

export function announceStatus(message: string) {
  try { statusAnnouncer && statusAnnouncer(message) } catch {}
}

export function announceAlert(message: string) {
  try { alertAnnouncer && alertAnnouncer(message) } catch {}
}

