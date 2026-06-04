self.addEventListener('install', (e) => {
  console.log('Cukrzyca PWA: Service Worker Zainstalowany');
});

self.addEventListener('fetch', (e) => {
  // Puste repozytorium fetch pozwala na poprawne przejście walidacji instalacji
});