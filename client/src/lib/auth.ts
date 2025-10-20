export type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

export function setOnUnauthorized(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler
}

export function notifyUnauthorized() {
  try { onUnauthorized && onUnauthorized() } catch {}
}

