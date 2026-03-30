export const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

type RequestOptions = {
  token?: string | null;
  method?: string;
  body?: BodyInit | Record<string, unknown> | null;
  headers?: HeadersInit;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  let body = options.body as BodyInit | null | undefined;

  headers.set("Accept", "application/json");

  if (options.body && !(options.body instanceof FormData) && typeof options.body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: body ?? null,
    cache: "no-store"
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errorBody?.message ?? "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function assetUrl(url?: string | null) {
  if (!url) {
    return "";
  }

  if (url.startsWith("http")) {
    return url;
  }

  return url;
}
