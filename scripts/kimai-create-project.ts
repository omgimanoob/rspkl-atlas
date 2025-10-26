import 'dotenv/config'

// Minimal standalone script to create a Kimai project via HTTP API
// Usage: npx tsx scripts/kimai-create-project.ts

type KimaiProject = { id: number; name: string }
type KimaiCustomer = { id: number; name: string }

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(`Missing required env: ${name}`)
  }
  return v
}

function buildHeaders() {
  const user = process.env.KIMAI_API_USER
  const token = process.env.KIMAI_API_TOKEN
  const basicUser = process.env.KIMAI_API_BASIC_USER
  const basicPass = process.env.KIMAI_API_BASIC_PASS
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (user && token) {
    h['X-AUTH-USER'] = user
    h['X-AUTH-TOKEN'] = token
  } else if (basicUser && basicPass) {
    const enc = Buffer.from(`${basicUser}:${basicPass}`).toString('base64')
    h['Authorization'] = `Basic ${enc}`
  } else {
    throw new Error('Provide either KIMAI_API_USER + KIMAI_API_TOKEN or KIMAI_API_BASIC_USER + KIMAI_API_BASIC_PASS')
  }
  return h
}

async function kimaiFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const base = requireEnv('KIMAI_API_HOST').replace(/\/$/, '')
  const res = await fetch(base + path, {
    ...opts,
    headers: {
      ...buildHeaders(),
      ...(opts.headers || {} as any),
    },
  } as RequestInit)
  if (!res.ok) {
    let text = ''
    try { text = await res.text() } catch {}
    throw new Error(`Kimai ${opts.method || 'GET'} ${path} failed: ${res.status} ${res.statusText}${text ? `\n${text}` : ''}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json() as Promise<T>
  return (await res.text()) as unknown as T
}

async function ensureReachable() {
  try {
    // Version endpoint exists on Kimai
    await kimaiFetch('/api/version')
  } catch (e: any) {
    throw new Error(`Failed to reach Kimai at ${process.env.KIMAI_API_HOST}: ${e?.message || e}`)
  }
}

async function findCustomerByName(name: string): Promise<KimaiCustomer | null> {
  // Kimai supports filtering by term in many list endpoints
  try {
    const rows = await kimaiFetch<any[]>(`/api/customers?term=${encodeURIComponent(name)}&visible=1&size=50`)
    const hit = (rows || []).find((r: any) => String(r.name).toLowerCase() === name.toLowerCase())
    return hit ? { id: Number(hit.id), name: String(hit.name) } : null
  } catch {
    // Fallback: fetch first page and scan
    const rows = await kimaiFetch<any[]>(`/api/customers?visible=1&size=50`)
    const hit = (rows || []).find((r: any) => String(r.name).toLowerCase() === name.toLowerCase())
    return hit ? { id: Number(hit.id), name: String(hit.name) } : null
  }
}

async function createCustomer(name: string): Promise<KimaiCustomer> {
  const payload = { name, country: null, currency: null, timezone: 'UTC', visible: true }
  const res = await kimaiFetch<any>('/api/customers', { method: 'POST', body: JSON.stringify(payload) })
  return { id: Number(res.id), name: String(res.name || name) }
}

async function createProject(name: string, customerId: number): Promise<KimaiProject> {
  // Minimal required fields: name, customer
  const payload: any = { name, customer: customerId, visible: true }
  const res = await kimaiFetch<any>('/api/projects', { method: 'POST', body: JSON.stringify(payload) })
  return { id: Number(res.id), name: String(res.name || name) }
}

async function main() {
  await ensureReachable()
  const projectName = process.env.KIMAI_PROJECT_NAME || 'Atlas Demo Project'
  const customerName = process.env.KIMAI_CUSTOMER_NAME || 'Atlas Demo Customer'
  console.log(`[kimai:create-project] Host=${process.env.KIMAI_API_HOST}`)
  console.log(`[kimai:create-project] Desired customer='${customerName}', project='${projectName}'`)

  let customer = await findCustomerByName(customerName)
  if (!customer) {
    console.log(`[kimai:create-project] Customer not found. Creating '${customerName}' ...`)
    customer = await createCustomer(customerName)
    console.log(`[kimai:create-project] Created customer id=${customer.id}`)
  } else {
    console.log(`[kimai:create-project] Found customer id=${customer.id}`)
  }

  const project = await createProject(projectName, customer.id)
  console.log(`[kimai:create-project] Created project id=${project.id} name='${project.name}' (customer=${customer.id})`)
}

main().catch((e) => {
  console.error('[kimai:create-project] Failed:', e?.message || e)
  process.exit(1)
})

