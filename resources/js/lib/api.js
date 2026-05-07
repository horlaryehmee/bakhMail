const defaultHeaders = {
  Accept: 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
};

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

async function request(url, options = {}) {
  const { body, headers = {}, method = 'GET' } = options;
  const config = {
    method,
    credentials: 'same-origin',
    headers: {
      ...defaultHeaders,
      'X-CSRF-TOKEN': csrfToken(),
      ...headers,
    },
  };

  if (body instanceof FormData) {
    config.body = body;
  } else if (body !== undefined) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      const looksLikeHtml = contentType.includes('text/html') || /^\s*</.test(text);
      const message = looksLikeHtml
        ? response.redirected
          ? 'Your session expired. Sign in again and retry the mailbox action.'
          : `Unexpected server response for ${method} ${url}.`
        : text;

      payload = { message };
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.message || response.statusText || 'Request failed');
    error.payload = payload;
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const api = {
  get: (url) => request(url),
  post: (url, body, options = {}) => request(url, { ...options, method: 'POST', body }),
  put: (url, body, options = {}) => request(url, { ...options, method: 'PUT', body }),
  patch: (url, body, options = {}) => request(url, { ...options, method: 'PATCH', body }),
  delete: (url, body, options = {}) => request(url, { ...options, method: 'DELETE', body }),
};
