// Minimal service worker so the app is installable. Online-only (ADR 0003):
// every request goes straight to the network and nothing is cached.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
