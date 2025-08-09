(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Theme: initialize from storage or system
  const themeToggleButton = document.getElementById('themeToggle');
  const root = document.documentElement;
  const storedTheme = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = storedTheme || (systemDark ? 'dark' : 'light');
  root.setAttribute('data-theme', initialTheme);
  if (themeToggleButton) {
    themeToggleButton.setAttribute('aria-pressed', String(initialTheme === 'dark'));
    themeToggleButton.textContent = initialTheme === 'dark' ? '☀️' : '🌙';
    themeToggleButton.addEventListener('click', () => {
      const isDark = root.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      themeToggleButton.setAttribute('aria-pressed', String(next === 'dark'));
      themeToggleButton.textContent = next === 'dark' ? '☀️' : '🌙';
    });
  }

  // Secure external links
  document.querySelectorAll('a[href^="http"]').forEach(anchor => {
    try {
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
      }
    } catch (_) {
      /* ignore invalid URLs */
    }
  });

  // Smooth scroll to projects
  const scrollToProjectsBtn = document.getElementById('scrollToProjects');
  if (scrollToProjectsBtn) {
    scrollToProjectsBtn.addEventListener('click', () => {
      const section = document.getElementById('projects');
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Hero intro animation
  if (!prefersReducedMotion) {
    const heroTitle = document.querySelector('.hero h1');
    if (heroTitle) {
      heroTitle.style.opacity = 0;
      setTimeout(() => {
        heroTitle.style.transition = 'opacity 1.2s cubic-bezier(.4,2,.6,1)';
        heroTitle.style.opacity = 1;
      }, 300);
    }
  }

  // Parallax effect for hero background
  const hero = document.querySelector('.hero');
  if (hero && !prefersReducedMotion) {
    document.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 10;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      hero.style.backgroundPosition = `${50 + x}% ${50 + y}%`;
    }, { passive: true });
  }

  // Interactive About image hover
  const aboutImg = document.querySelector('.about-image img');
  if (aboutImg && !prefersReducedMotion) {
    aboutImg.addEventListener('mouseenter', () => {
      aboutImg.style.transform = 'scale(1.08) rotate(-2deg)';
      aboutImg.style.boxShadow = '0 8px 32px rgba(37,117,252,0.18)';
    });
    aboutImg.addEventListener('mouseleave', () => {
      aboutImg.style.transform = 'scale(1) rotate(0)';
      aboutImg.style.boxShadow = '0 2px 12px rgba(37,117,252,0.15)';
    });
  }

  // Project details modal with real content
  const projectData = {
    qm_fft: {
      title: 'QM FFT Feature Package',
      description: 'High-performance NUFFT-based 3D analysis: k-space masking, gradient mapping, spectral metrics, batch HDF5 IO, and interactive 3D visualizations.',
      link: 'projects/qm_fft_feature_package.html'
    },
    feature_container: {
      title: 'Feature Extraction Container',
      description: 'Dockerized, Snakemake-managed pipeline for ALFF/fALFF, ReHo, Hurst, fractal dimension, QM-FFT, and RSN analysis with robust docs.',
      link: 'projects/feature_extraction_container.html'
    },
    fmri_pipeline: {
      title: 'fMRI Processing Pipeline for Epilepsy',
      description: 'Automated end-to-end pipeline: DICOM→BIDS (optional), fMRIPrep preprocessing, and advanced feature extraction for epilepsy research.',
      link: 'projects/fmri_processing_pipeline_epilepsy.html'
    }
  };

  const modal = document.getElementById('projectDetails');
  const modalContent = document.getElementById('projectDetailsContent');
  const closeModalBtn = document.getElementById('closeModal');
  let lastFocused = null;

  function openModal(projectKey) {
    if (!modal || !modalContent) return;
    const data = projectData[projectKey];
    if (!data) return;
    modalContent.innerHTML = `
      <h3 id="projectDetailsTitle">${data.title}</h3>
      <p>${data.description}</p>
      <p><a class="project-link" href="${data.link}">View project</a></p>
    `;
    lastFocused = document.activeElement;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    modal.focus();
    if (closeModalBtn) closeModalBtn.focus();
    trapFocus(modal);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  // Attach card click listeners (ignore clicks on links inside)
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return; // let links navigate
      const key = card.getAttribute('data-project');
      if (key) openModal(key);
    });
    // Mobile touch hover feel
    card.addEventListener('touchstart', () => {
      card.style.transform = 'scale(1.04)';
      card.style.boxShadow = '0 8px 32px rgba(37,117,252,0.18)';
    }, { passive: true });
    card.addEventListener('touchend', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
    });
  });

  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });
  }

  // Focus trap for modal accessibility
  function trapFocus(container) {
    const focusableSelectors = 'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = Array.from(container.querySelectorAll(focusableSelectors));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    function handle(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    container.addEventListener('keydown', handle);
  }

  // Contact form logic (demo)
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const messageEl = document.getElementById('formMessage');
      if (messageEl) messageEl.textContent = 'Thank you for your message! (Demo only)';
      contactForm.reset();
    });
  }
})();


