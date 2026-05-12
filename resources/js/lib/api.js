const defaultHeaders = {
  Accept: 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
};

export function setCsrfToken(token) {
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) {
    meta.setAttribute('content', token || '');
  }
}

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
    const fallbackMessage = response.status === 419
      ? 'Your session expired. Refresh the page and sign in again.'
      : response.status === 403
        ? 'You do not have permission to perform this action.'
        : response.status === 404
          ? 'The requested resource was not found.'
          : response.status === 422
            ? 'Please review the form and correct any invalid fields.'
            : response.status
              ? `Request failed (${response.status})`
              : 'Request failed';
    const error = new Error(payload?.message || response.statusText || fallbackMessage);
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
