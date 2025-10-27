// Load Firebase compat SDKs for compatibility with schedule.js
// This script must run BEFORE schedule.js
(function() {
  // Create script loader
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Load all Firebase compat scripts in sequence
  Promise.all([
    loadScript('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js'),
    loadScript('https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js'),
    loadScript('https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js')
  ]).then(() => {
    console.log('[Firebase] All compat SDKs loaded successfully');
    // Dispatch custom event so schedule.js knows Firebase is ready
    window.firebaseReady = true;
    window.dispatchEvent(new CustomEvent('firebase-compat-ready'));
    // Also try to call initFirebase immediately if it exists
    if (typeof window.initFirebase === 'function') {
      console.log('[Firebase] Calling initFirebase immediately after SDK load');
      window.initFirebase();
    }
  }).catch((error) => {
    console.error('[Firebase] Failed to load compat SDKs:', error);
  });
})();
