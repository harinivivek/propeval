function normalizeBase(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * In `next dev`, browser requests use same-origin `/api` (see next.config rewrites) so
 * the host always matches the page (e.g. LAN IP). Server-side calls use BACKEND_PROXY_TARGET
 * or a local default. Exported for authenticated `fetch` outside `api.*` (e.g. PDF download).
 */
export function getApiBaseUrl(): string {
  const envRaw = process.env.NEXT_PUBLIC_API_URL;
  const envUrl =
    envRaw && String(envRaw).trim() !== ""
      ? normalizeBase(String(envRaw).trim())
      : "";

  if (typeof window === "undefined") {
    const internal = (
      process.env.BACKEND_PROXY_TARGET ||
      process.env.NEXT_INTERNAL_API_URL ||
      ""
    ).trim();
    if (internal) {
      return normalizeBase(internal);
    }
    if (envUrl) {
      return envUrl;
    }
    return normalizeBase(
      process.env.NODE_ENV === "development"
        ? "http://127.0.0.1:8020"
        : "http://localhost:8020",
    );
  }

  // Browser
  if (process.env.NODE_ENV === "development") {
    if (
      !envUrl ||
      envUrl.startsWith("http://localhost:") ||
      envUrl.startsWith("http://127.0.0.1:")
    ) {
      return "";
    }
    return envUrl;
  }

  const { hostname, protocol } = window.location;
  const loopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";
  if (loopback) {
    if (envUrl) return envUrl;
    return "http://localhost:8020";
  }
  if (envUrl) return envUrl;
  return `${protocol}//${hostname}:8020`;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

async function fetchApi<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const base = getApiBaseUrl();
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${base}${path}`;

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (e) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "(server)";
    const hint =
      "Check that the backend is running. In dev, /api is proxied (BACKEND_PROXY_TARGET " +
      "when Next runs in Docker). For a remote API set NEXT_PUBLIC_API_URL to that origin.";
    if (e instanceof TypeError) {
      throw new Error(`Network error calling ${url || path} (from ${origin}). ${hint}`);
    }
    throw e;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = formatErrorDetail(error);
    const authLike =
      response.status === 401 ||
      (response.status === 403 &&
        /not authenticated|invalid token|credentials were not provided/i.test(
          detail,
        ));
    if (authLike && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
      throw new Error(detail || "Session expired.");
    }
    throw new Error(detail || `API error: ${response.status}`);
  }

  return response.json();
}

function formatErrorDetail(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const d = (error as { detail?: unknown }).detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: unknown }).msg) : String(x)))
      .filter(Boolean)
      .join("; ");
  }
  return "";
}

export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint),
  post: <T>(endpoint: string, body: unknown) =>
    fetchApi<T>(endpoint, { method: "POST", body }),
  put: <T>(endpoint: string, body: unknown) =>
    fetchApi<T>(endpoint, { method: "PUT", body }),
  patch: <T>(endpoint: string, body: unknown) =>
    fetchApi<T>(endpoint, { method: "PATCH", body }),
  delete: <T>(endpoint: string) =>
    fetchApi<T>(endpoint, { method: "DELETE" }),
  upload: <T>(endpoint: string, formData: FormData) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;

    const base = getApiBaseUrl();
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${base}${path}`;

    return fetch(url, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const detail = formatErrorDetail(error);
        const authLike =
          response.status === 401 ||
          (response.status === 403 &&
            /not authenticated|invalid token|credentials were not provided/i.test(
              detail,
            ));
        if (authLike && typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          window.location.href = "/login";
          throw new Error(detail || "Session expired.");
        }
        throw new Error(detail || `API error: ${response.status}`);
      }
      return response.json() as Promise<T>;
    });
  },
};
