// Thin API client. Cookies carry the server session automatically
// (same-origin). Errors follow the server contract { error: { code, message } }.

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      credentials: 'same-origin',
      ...options,
    });
  } catch (err) {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and retry.');
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = body?.error || {};
    throw new ApiError(res.status, err.code || 'INTERNAL', err.message || 'Something went wrong.');
  }
  return body;
}

export function newRequestKey() {
  return crypto.randomUUID();
}

export const api = {
  getSession: () => request('/api/session'),
  savePlate: (plate) => request('/api/session/plate', { method: 'PUT', body: JSON.stringify({ plate }) }),
  getLots: () => request('/api/lots'),
  getSpots: (lotId) => request(`/api/lots/${lotId}/spots`),
  createReservation: (spotId, requestKey) =>
    request('/api/reservations', {
      method: 'POST',
      headers: { 'Idempotency-Key': requestKey },
      body: JSON.stringify({ spotId, safelyParked: true }),
    }),
  getCurrentReservation: () => request('/api/reservations/current'),
  releaseReservation: (id) => request(`/api/reservations/${id}/release`, { method: 'POST' }),
};
