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

  // UX Enhancements

  // Lazy load images with fade-in effect
  const lazyImages = document.querySelectorAll('img[loading="lazy"]');
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.addEventListener('load', () => {
            img.classList.add('loaded');
          });
          if (img.complete) {
            img.classList.add('loaded');
          }
          imageObserver.unobserve(img);
        }
      });
    });

    lazyImages.forEach(img => imageObserver.observe(img));
  } else {
    // Fallback for older browsers
    lazyImages.forEach(img => img.classList.add('loaded'));
  }

  // Add ripple effect to buttons
  const addRippleEffect = () => {
    const buttons = document.querySelectorAll('.button, button:not(.nav-toggle)');
    buttons.forEach(button => {
      button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple-effect');

        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
      });
    });
  };

  // Smooth scroll enhancement for anchor links
  const enhanceSmoothScroll = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#' || targetId === '') return;

        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          // Update URL without jumping
          history.pushState(null, '', targetId);
        }
      });
    });
  };

  // Add visual feedback for form interactions
  const enhanceFormInputs = () => {
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      // Add floating label effect
      if (input.value) {
        input.classList.add('has-value');
      }

      input.addEventListener('blur', () => {
        if (input.value) {
          input.classList.add('has-value');
        } else {
          input.classList.remove('has-value');
        }
      });

      input.addEventListener('input', () => {
        if (input.value) {
          input.classList.add('has-value');
        } else {
          input.classList.remove('has-value');
        }
      });
    });
  };

  // Detect link type and add appropriate aria labels
  const enhanceLinks = () => {
    document.querySelectorAll('a').forEach(link => {
      const href = link.getAttribute('href');

      // External links
      if (href && (href.startsWith('http') || href.startsWith('//'))) {
        if (!link.hostname || link.hostname !== window.location.hostname) {
          if (!link.getAttribute('aria-label')) {
            const text = link.textContent.trim();
            link.setAttribute('aria-label', text + ' (åpnes i nytt vindu)');
          }
          if (!link.getAttribute('target')) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
          }
        }
      }

      // Email links
      if (href && href.startsWith('mailto:')) {
        if (!link.getAttribute('aria-label')) {
          const email = href.substring(7);
          link.setAttribute('aria-label', 'Send e-post til ' + email);
        }
      }

      // Phone links
      if (href && href.startsWith('tel:')) {
        if (!link.getAttribute('aria-label')) {
          link.setAttribute('aria-label', 'Ring ' + link.textContent.trim());
        }
      }
    });
  };

  // Initialize enhancements
  setTimeout(() => {
    addRippleEffect();
    enhanceSmoothScroll();
    enhanceFormInputs();
    enhanceLinks();
  }, 100);

  // Add CSS for ripple effect dynamically
  const style = document.createElement('style');
  style.textContent = `
    .ripple-effect {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.5);
      transform: scale(0);
      animation: ripple-animation 0.6s ease-out;
      pointer-events: none;
    }

    @keyframes ripple-animation {
      to {
        transform: scale(2);
        opacity: 0;
      }
    }

    button, .button {
      position: relative;
      overflow: hidden;
    }
  `;
  document.head.appendChild(style);

  // Performance: Debounce resize events
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Recalculate any dynamic elements if needed
      highlightActiveLink();
    }, 250);
  });

  // Accessibility: Show focus outline on keyboard navigation
  let isUsingMouse = false;
  document.addEventListener('mousedown', () => {
    isUsingMouse = true;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      isUsingMouse = false;
    }
  });

  document.addEventListener('focus', () => {
    if (isUsingMouse) {
      document.body.classList.add('using-mouse');
    } else {
      document.body.classList.remove('using-mouse');
    }
  }, true);
});
