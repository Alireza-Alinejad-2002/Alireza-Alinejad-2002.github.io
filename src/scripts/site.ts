// Theme toggle + scroll reveal. Vanilla, ~1 KB.

const root = document.documentElement;

function setTheme(t: 'blueprint' | 'blueprint-dark') {
  root.setAttribute('data-theme', t);
  try {
    localStorage.setItem('theme', t);
  } catch {
    /* storage unavailable: theme still applies for this page */
  }
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((b) => {
    b.setAttribute('aria-pressed', String(t === 'blueprint-dark'));
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
  btn.setAttribute('aria-pressed', String(root.getAttribute('data-theme') === 'blueprint-dark'));
  btn.addEventListener('click', () => {
    setTheme(root.getAttribute('data-theme') === 'blueprint-dark' ? 'blueprint' : 'blueprint-dark');
  });
});

const reveal = document.querySelectorAll<HTMLElement>('[data-reveal]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  reveal.forEach((el) => io.observe(el));
} else {
  reveal.forEach((el) => el.classList.add('is-in'));
}
