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

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: body ?? null,
      cache: "no-store"
    });
  } catch (error) {
    throw new Error("The server connection failed while processing the request.", { cause: error });
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    const fallback = response.status >= 500
      ? `Server error (${response.status}). Check the Laravel log for the exact failure.`
      : `The request could not be completed (${response.status}).`;

    throw new Error(errorBody?.message ?? fallback);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function assetUrl(url?: string | null, version?: string | number | null) {
  if (!url) {
    return "";
  }

  let resolved = url;

  if (!url.startsWith("http") && !url.startsWith("data:")) {
    const normalized = url.startsWith("/") ? url : `/${url}`;
    resolved = typeof window !== "undefined" ? new URL(normalized, window.location.origin).toString() : normalized;
  }

  if (version === undefined || version === null || version === "") {
    return resolved;
  }

  const separator = resolved.includes("?") ? "&" : "?";
  return `${resolved}${separator}v=${encodeURIComponent(String(version))}`;
}
