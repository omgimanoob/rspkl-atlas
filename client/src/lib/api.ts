const baseURL = import.meta.env.DEV
  ? '' // use Vite proxy if configured
  : window.location.origin

async function http<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(baseURL + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    credentials: 'include',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || res.statusText)
  }
  return res.json() as Promise<T>
}

export const api = {
  login(email: string, password: string) {
    return http<{ email: string; roles: string[] }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },
  logout() {
    return http<{ ok: boolean }>('/auth/logout', { method: 'POST' })
  },
  me() {
    return http<{ id: number; email: string; roles: string[] }>('/me')
  },
  projects() {
    return http<any[]>('/projects')
  },
  updateProjectStatus(id: number, status: string) {
    return http<{ message: string }>('/overrides/status', {
      method: 'PUT',
      body: JSON.stringify({ kimai_project_id: id, status }),
    })
  },
}

