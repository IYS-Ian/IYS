/**
 * 注册 / 登录页面共用的表单逻辑。
 * 会话保存在 HttpOnly Cookie 里，前端不需要也不应该把 token 存到 localStorage。
 */
(() => {
  const form = document.querySelector('form[data-account-form]');
  if (!form) return;

  const mode = form.dataset.accountForm; // "signup" | "signin"
  const button = form.querySelector('button[type="submit"]');
  const feedback = form.querySelector('.account-feedback');
  const defaultLabel = button ? button.textContent : '';

  const ERROR_MESSAGES = {
    email_taken: 'An account with this email already exists. Try signing in instead.',
    invalid_credentials: 'Email or password is incorrect.',
    invalid_email: 'Please enter a valid email address.',
    invalid_password: 'Password must be at least 8 characters.',
    invalid_display_name: 'Please use a shorter name (50 characters or fewer).',
    too_many_requests: 'Too many attempts. Please wait a few minutes and try again.',
  };

  function showMessage(message, type = 'error') {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.toggle('is-success', type === 'success');
    feedback.hidden = false;
  }

  function clearMessage() {
    if (!feedback) return;
    feedback.hidden = true;
    feedback.textContent = '';
    feedback.classList.remove('is-success');
  }

  function setBusy(busy) {
    if (!button) return;
    button.disabled = busy;
    button.textContent = busy
      ? mode === 'signup'
        ? 'Creating account…'
        : 'Signing in…'
      : defaultLabel;
  }

  async function postJson(path, payload) {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      // 204 或非 JSON 响应
    }

    if (!response.ok) {
      const error = new Error(data?.error?.message || `Request failed (${response.status}).`);
      error.code = data?.error?.code;
      error.status = response.status;
      throw error;
    }
    return data;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const values = Object.fromEntries(new FormData(form));
    const email = String(values.email ?? '').trim();
    const password = String(values.password ?? '');

    if (mode === 'signup') {
      const confirmation = String(values['password-confirmation'] ?? '');
      if (password !== confirmation) {
        showMessage('Passwords do not match.');
        form.querySelector('input[name="password-confirmation"]')?.focus();
        return;
      }
    }

    const endpoint = mode === 'signup' ? '/api/auth/register' : '/api/auth/login';
    const payload =
      mode === 'signup'
        ? {
            email,
            password,
            displayName: String(values.name ?? '').trim() || undefined,
          }
        : { email, password };

    setBusy(true);
    try {
      await postJson(endpoint, payload);
      showMessage(
        mode === 'signup'
          ? 'Account created. Taking you to the homepage…'
          : 'Signed in. Taking you to the homepage…',
        'success',
      );
      window.setTimeout(() => {
        window.location.assign('index.html');
      }, 700);
    } catch (error) {
      if (error instanceof TypeError) {
        showMessage('Could not reach the server. Check your connection and try again.');
      } else {
        showMessage(
          ERROR_MESSAGES[error.code] || error.message || 'Something went wrong. Please try again.',
        );
      }
      setBusy(false);
    }
  });
})();
