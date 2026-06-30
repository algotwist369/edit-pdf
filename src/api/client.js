const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const apiRequest = async (
  path,
  { token, method = 'GET', body, headers = {}, responseType = 'auto' } = {}
) => {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(`Backend is not reachable at ${API_BASE_URL}. Start the backend server and MongoDB.`, 0);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.error?.message || 'Request failed', response.status);
  }

  if (responseType === 'blob') return response.blob();
  if (responseType === 'text') return response.text();

  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.blob();
};

export const apiBaseUrl = API_BASE_URL;
