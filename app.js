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
    // Normalize current path: remove trailing slash, ensure root is '/'
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    const currentHash = window.location.hash;

    let bestMatch = null;
    let maxScore = -1;

    links.forEach((link) => {
      // Reset status
      link.removeAttribute('aria-current');

      // Normalize link path using the anchor's pathname property
      const linkPath = link.pathname.replace(/\/$/, '') || '/';
      const linkHash = link.hash;

      // Check if paths match (ignoring trailing slashes)
      if (linkPath !== currentPath) {
        return;
      }

      let score = 0;

      if (linkHash === currentHash) {
        // Exact match (path + hash)
        // Give higher score to non-empty hash match to prefer specific sections
        score = linkHash ? 3 : 2;
      } else if (linkHash === '' && currentHash !== '') {
        // Link is to page root, but current url has hash.
        // This is a fallback match (Score 1).
        score = 1;
      } else {
        // Link has hash, but current url doesn't, or hashes differ.
        // No match.
        return;
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

  // Copy Link Functionality
  const setupCopyLinkButtons = () => {
    const copyButtons = document.querySelectorAll('.copy-link-btn');
    
    copyButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          // Always copy the pretty version of the current URL
          // decodeURI ensures we get 'bjørkvang.no' instead of 'xn--...'
          const prettyUrl = decodeURI(window.location.href);
          await navigator.clipboard.writeText(prettyUrl);
          
          const originalText = btn.textContent;
          btn.textContent = 'Lenke kopiert!';
          btn.classList.add('success');
          
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('success');
          }, 2000);
        } catch (err) {
          console.error('Failed to copy link:', err);
          // Fallback for older browsers or if permission denied
          const textArea = document.createElement('textarea');
          textArea.value = decodeURI(window.location.href);
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            btn.textContent = 'Lenke kopiert!';
            setTimeout(() => btn.textContent = 'Kopier lenke', 2000);
          } catch (e) {
            console.error('Fallback copy failed', e);
            btn.textContent = 'Kunne ikke kopiere';
          }
          document.body.removeChild(textArea);
        }
      });
    });
  };

  setupCopyLinkButtons();
});
