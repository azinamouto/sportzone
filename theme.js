// Restore the selected palette before styles paint. New visitors start in dark mode.
(() => {
  const key = 'sportszone_theme';
  const root = document.documentElement;
  let theme = 'dark';
  try {
    if (localStorage.getItem(key) === 'light') theme = 'light';
  } catch { /* Theme switching also works without browser storage. */ }
  root.dataset.theme = theme;

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('theme-toggle');
    function applyTheme(next) {
      root.dataset.theme = next;
      const label = `Switch to ${next === 'dark' ? 'light' : 'dark'} mode`;
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    }
    applyTheme(theme);
    toggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(key, next); } catch { /* Keep the current session theme. */ }
    });
    window.addEventListener('storage', event => {
      if (event.key === key || event.key === null) {
        applyTheme(event.newValue === 'light' ? 'light' : 'dark');
      }
    });
  });
})();
