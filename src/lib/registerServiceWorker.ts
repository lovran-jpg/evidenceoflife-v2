export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    }).then(registration => {
      // Check on every fresh app load. The worker activates immediately, while
      // the current screen stays untouched; the next open/reload uses it.
      void registration.update();
    }).catch(error => {
      console.warn('Registracija aplikacije za izvanmrežni rad nije uspjela:', error);
    });
  });
}
