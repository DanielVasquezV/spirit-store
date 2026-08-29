const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API error ${response.status} on GET ${path}`);
  }

  return (await response.json()) as T;
}

export { API_URL };