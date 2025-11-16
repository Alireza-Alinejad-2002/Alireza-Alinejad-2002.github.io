/* script.js
   Handles:
   - dark mode toggle with persistent preference (localStorage)
   - responsive nav toggle
   - smooth-scroll enhancement for in-page links
   - small runtime UI behavior
*/

(() => {
  const root = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const navToggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  const yearEl = document.getElementById('year');

  // --- Initialize year ---
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // --- Dark mode: read saved preference or system preference ---
  const saved = localStorage.getItem('theme'); // 'light' | 'dark' | null
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  function applyTheme(theme) {
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      themeToggle.textContent = '☀️';
    } else {
      root.removeAttribute('data-theme');
      themeToggle.textContent = '🌙';
    }
  }

  // Decide initial theme
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));

  // Toggle handler
  themeToggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
  });

  // --- Mobile nav toggle ---
  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', (!expanded).toString());
    // On small screens we toggle a simple open attribute on nav that CSS reads
    if (!expanded) {
      nav.setAttribute('open', 'true');
    } else {
      nav.removeAttribute('open');
    }
  });

  // Close mobile nav when a nav link is clicked (improves UX)
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      if (nav.hasAttribute('open')) nav.removeAttribute('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Smooth scrolling fallback: browsers mostly support CSS smooth scrolling via style,
  // but we keep a small JS enhancement to offset sticky header if needed.
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href.length === 1) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const headerOffset = document.querySelector('.site-header')?.offsetHeight || 72;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset - 8;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    });
  });

})();
