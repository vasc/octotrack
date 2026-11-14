// Octotrack's service worker: shows the notifications the server pushes, and opens the question on a tap.
// A notification carries only a title, a body and where to go; everything else is read in the app.

// A new worker takes over at once, and controls pages already open, so a tap never lands on an old one.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Octotrack", {
      body: data.body || "",
      data: { url: data.url || "/" },
      tag: data.url || "octotrack",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      if (open) {
        // A window this worker does not control cannot be navigated; a new one opens instead.
        const moved = await open.navigate(url).catch(() => null);
        if (moved) return moved.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

// The push service replaced the subscription: subscribe again with the same key, and tell the server the new one.
self.addEventListener("pushsubscriptionchange", (event) => {
  const key = event.oldSubscription?.options?.applicationServerKey;
  event.waitUntil(
    (key
      ? self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
      : Promise.resolve(event.newSubscription)
    ).then((subscription) =>
      subscription
        ? fetch("/api/ops/push.subscribe", {
            method: "POST",
            headers: { "content-type": "application/json", "x-octo-channel": "dashboard" },
            body: JSON.stringify({ input: subscription.toJSON() }),
          })
        : undefined,
    ),
  );
});
