const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export function getApiBaseUrl(): string {
  return rawBase;
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return rawBase ? `${rawBase}${normalized}` : normalized;
}
