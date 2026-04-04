// Clear browser cache utility for chunk loading errors
(function() {
  'use strict';
  
  // Function to clear service worker cache
  function clearServiceWorkerCache() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister();
        }
      });
    }
  }
  
  // Function to clear browser cache
  function clearBrowserCache() {
    if ('caches' in window) {
      caches.keys().then(function(names) {
        for (let name of names) {
          caches.delete(name);
        }
      });
    }
  }
  
  // Function to force reload with cache bypass
  function forceReload() {
    window.location.reload(true);
  }
  
  // Expose functions globally for manual use
  window.clearAppCache = function() {
    clearServiceWorkerCache();
    clearBrowserCache();
    setTimeout(forceReload, 1000);
  };
  
  // Auto-detect chunk loading errors and offer to clear cache
  window.addEventListener('error', function(event) {
    if (event.error && (
      event.error.name === 'ChunkLoadError' || 
      event.message.includes('Loading chunk') ||
      event.message.includes('ChunkLoadError')
    )) {
      console.warn('Chunk loading error detected. You may need to clear your browser cache.');
      
      // Show user-friendly notification
      if (confirm('A loading error occurred. Would you like to clear the cache and reload?')) {
        window.clearAppCache();
      }
    }
  });
  
  console.log('Cache clearing utility loaded. Use window.clearAppCache() to manually clear cache.');
})();