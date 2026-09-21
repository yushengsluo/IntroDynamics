// Apply before styles load so a saved appearance does not flash the other theme.
(() => {
  const key = 'dynamics-theme';
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  const valid = value => value === 'light' || value === 'dark';
  let preference;
  try { preference = localStorage.getItem(key); } catch {}
  let current;

  function updateControls() {
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const next = current === 'dark' ? 'Light' : 'Dark';
      button.setAttribute('aria-label', `Switch to ${next.toLowerCase()} mode`);
      button.title = `Switch to ${next.toLowerCase()} mode`;
      button.querySelector('[data-theme-icon]').textContent = current === 'dark' ? '☀' : '☾';
    });
    document.querySelectorAll('[data-light-src]').forEach(image => {
      image.setAttribute('src', image.getAttribute(current === 'light' ? 'data-light-src' : 'data-dark-src'));
    });
  }

  function apply(theme) {
    current = theme;
    document.documentElement.dataset.theme = theme;
    updateControls();
    window.dispatchEvent(new CustomEvent('themechange', {detail: {theme}}));
  }

  window.AppTheme = Object.freeze({isLight: () => current === 'light'});
  apply(valid(preference) ? preference : system?.matches ? 'dark' : 'light');
  document.addEventListener('DOMContentLoaded', () => {
    updateControls();
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        preference = current === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(key, preference); } catch {}
        apply(preference);
      });
    });
  });
  system?.addEventListener('change', event => {
    if (!valid(preference)) apply(event.matches ? 'dark' : 'light');
  });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = event.newValue;
    apply(valid(preference) ? preference : system?.matches ? 'dark' : 'light');
  });
})();
