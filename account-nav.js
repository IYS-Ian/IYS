(() => {
  const signInLink = document.querySelector('.account-nav-link[href="IYS Account Sign In.html"]');
  const signUpLink = document.querySelector('.account-nav-link[href="IYS Account Sign Up.html"]');

  if (!signInLink || !signUpLink) return;

  async function updateAccountNavigation() {
    const response = await fetch('/api/auth/me', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (response.status === 401) return;
    if (!response.ok) {
      throw new Error(`Account session check failed (${response.status}).`);
    }

    const data = await response.json();
    const user = data?.user;
    const displayName = user?.displayName;
    const email = user?.email;
    const name = typeof displayName === 'string' && displayName.trim()
      ? displayName.trim()
      : email;
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('Account session response did not include a valid user name.');
    }

    const userLabel = document.createElement('span');
    userLabel.className = 'account-nav-link account-nav-user';
    userLabel.textContent = name;
    userLabel.title = `Signed in as ${name}`;
    userLabel.setAttribute('aria-label', `Signed in as ${name}`);

    signInLink.replaceWith(userLabel);
    signUpLink.remove();
  }

  updateAccountNavigation().catch((error) => {
    console.error('Unable to update IYS account navigation.', error);
  });
})();
