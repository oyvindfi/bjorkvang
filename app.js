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
    
    const getPrettyUrl = () => {
        let url = window.location.href;
        try {
            // First decode any percent-encoding (e.g. %C3%B8 -> ø)
            url = decodeURI(url);
        } catch (e) {
            console.warn('Could not decode URI:', e);
        }
        // Then explicitly replace the Punycode domain if present
        return url.replace('xn--bjrkvang-64a.no', 'bjørkvang.no');
    };

    copyButtons.forEach(btn => {
      const textSpan = btn.querySelector('span') || btn;
      const originalText = textSpan.textContent;

      btn.addEventListener('click', async () => {
        const prettyUrl = getPrettyUrl();
        
        try {
          await navigator.clipboard.writeText(prettyUrl);
          
          textSpan.textContent = 'Lenke kopiert!';
          btn.classList.add('success');
          
          setTimeout(() => {
            textSpan.textContent = originalText;
            btn.classList.remove('success');
          }, 2000);
        } catch (err) {
          console.error('Failed to copy link:', err);
          // Fallback for older browsers or if permission denied
          const textArea = document.createElement('textarea');
          textArea.value = prettyUrl; // Use the same pretty URL here!
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            textSpan.textContent = 'Lenke kopiert!';
            btn.classList.add('success');
            setTimeout(() => {
                textSpan.textContent = originalText;
                btn.classList.remove('success');
            }, 2000);
          } catch (e) {
            console.error('Fallback copy failed', e);
            textSpan.textContent = 'Kunne ikke kopiere';
          }
          document.body.removeChild(textArea);
        }
      });
    });
  };

  setupCopyLinkButtons();
});
