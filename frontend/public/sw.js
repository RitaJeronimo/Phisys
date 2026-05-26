// Service Worker desativado
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => clients.claim());