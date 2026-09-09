const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function requestApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg =
      data?.message ||
      (Array.isArray(data?.message) ? data.message.join(', ') : null) ||
      data?.error ||
      `Request failed with status ${res.status}`;
    const error: any = new Error(errorMsg);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export const api = {
  getAssets: (kind?: string, status?: string) => {
    const params = new URLSearchParams();
    if (kind && kind !== 'ALL') params.append('kind', kind);
    if (status && status !== 'ALL') params.append('status', status);
    const qs = params.toString();
    return requestApi<any[]>(`/assets${qs ? `?${qs}` : ''}`);
  },

  getAsset: (id: string) => requestApi<any>(`/assets/${id}`),

  getAssetHistory: (id: string, asOf?: string) => {
    const qs = asOf ? `?asOf=${encodeURIComponent(asOf)}` : '';
    return requestApi<any>(`/assets/${id}/history${qs}`);
  },

  getWorkers: () => requestApi<any[]>('/workers'),

  getReservations: (assetId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (assetId) params.append('assetId', assetId);
    if (status) params.append('status', status);
    const qs = params.toString();
    return requestApi<any[]>(`/reservations${qs ? `?${qs}` : ''}`);
  },

  reconstructStore: (asOf?: string) => {
    const qs = asOf ? `?asOf=${encodeURIComponent(asOf)}` : '';
    return requestApi<any>(`/reconstruct${qs}`);
  },

  issueAsset: (id: string, data: any) =>
    requestApi<any>(`/assets/${id}/issue`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  returnAsset: (id: string, data: any) =>
    requestApi<any>(`/assets/${id}/return`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reserveAsset: (id: string, data: any) =>
    requestApi<any>(`/assets/${id}/reserve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  outOfService: (id: string, data: any) =>
    requestApi<any>(`/assets/${id}/out-of-service`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  backInService: (id: string, data: any) =>
    requestApi<any>(`/assets/${id}/back-in-service`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  correctMovement: (id: string, data: any) =>
    requestApi<any>(`/movements/${id}/correct`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelReservation: (id: string, data: any) =>
    requestApi<any>(`/reservations/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
