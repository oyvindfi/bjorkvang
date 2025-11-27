// app.js
// Håndterer navigasjonsmenyens mobile tilstand for alle sider.

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');
  if (!toggle || !nav) {
    return;
  }

  const closeNav = (skipFocus = false) => {
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
    document.body.classList.remove('nav-open');
    if (!skipFocus) {
      toggle.focus({ preventScroll: true });
    }
  };

  const openNav = () => {
    toggle.setAttribute('aria-expanded', 'true');
    nav.classList.add('is-open');
    document.body.classList.add('nav-open');
  };

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      closeNav(true);
    } else {
      openNav();
    }
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeNav(true));
  });

  const highlightActiveLink = () => {
    const links = nav.querySelectorAll('a');

    const normalizePath = (path) => {
      let p = path.replace(/\/$/, '');
      if (p === '' || p === '/index.html') return '/';
      return p;
    };

    const currentPath = normalizePath(window.location.pathname);
    const currentHash = window.location.hash;

    let bestMatch = null;
    let maxScore = -1;

    links.forEach((link) => {
      const linkUrl = new URL(link.href, window.location.origin);
      const linkPath = normalizePath(linkUrl.pathname);
      const linkHash = linkUrl.hash;

      // Reset status
      link.removeAttribute('aria-current');

      if (linkPath !== currentPath) {
        return;
      }

      let score = 0;
      if (linkHash === currentHash) {
        score = 3; // Exact match (path + hash)
      } else if (linkHash === '') {
        score = 1; // Page match (fallback)
      }

      if (score > maxScore) {
        maxScore = score;
        bestMatch = link;
      }
    });

    if (bestMatch) {
      bestMatch.setAttribute('aria-current', 'page');
    }
  };

  highlightActiveLink();
  window.addEventListener('hashchange', highlightActiveLink);
  window.addEventListener('popstate', highlightActiveLink);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      closeNav();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && toggle.getAttribute('aria-expanded') === 'true') {
      closeNav(true);
    }
  });
});
