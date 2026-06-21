import { useAuth } from '@/stores/auth'

export class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  noAuth?: boolean
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, noAuth, headers: extraHeaders, ...rest } = opts
  const headers = new Headers(extraHeaders)

  const { token, company } = useAuth.getState()
  if (!noAuth && token) headers.set('Authorization', `Bearer ${token}`)
  if (company) headers.set('X-Company-Id', String(company.id))

  let finalBody: BodyInit | undefined
  if (body instanceof FormData) {
    finalBody = body
  } else if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
    finalBody = JSON.stringify(body)
  }

  const r = await fetch(path, { ...rest, headers, body: finalBody })

  if (r.status === 401) {
    useAuth.getState().logout()
    // 라우터가 인증 가드로 알아서 /login으로 보냄
    throw new ApiError(401, '인증 만료')
  }
  if (!r.ok) {
    let detail = `HTTP ${r.status}`
    try {
      const j = await r.json()
      if (j.detail) detail = j.detail
    } catch {}
    throw new ApiError(r.status, detail)
  }
  if (r.status === 204) return null as T
  const ct = r.headers.get('content-type') || ''
  if (ct.includes('application/json')) return (await r.json()) as T
  return (await r.text()) as unknown as T
}
