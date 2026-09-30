const TOKEN_KEY = 'inv_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

function errorMessage(body, status) {
  if (!body) return `Request failed (${status})`
  const d = body.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) {
    return d
      .map((e) => {
        const field = (e.loc || []).filter((p) => p !== 'body').join(' › ')
        return field ? `${field}: ${e.msg}` : e.msg
      })
      .join('\n')
  }
  return `Request failed (${status})`
}

export async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const res = await fetch(`/api${path}`, { method, headers, body: payload })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (res.status === 401 && path !== '/auth/login') onUnauthorized()
  if (!res.ok) throw new Error(errorMessage(data, res.status))
  return data
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  upload: (p, file) => {
    const form = new FormData()
    form.append('file', file)
    return request(p, { method: 'POST', form })
  },
}

export function qs(params) {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.set(k, v)
  })
  const str = s.toString()
  return str ? `?${str}` : ''
}
