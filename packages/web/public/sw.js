// Octotrack's service worker: shows the notifications the server pushes, and opens the question on a tap.
// A notification carries only a title, a body and where to go; everything else is read in the app.

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
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((client) => client?.focus());
      return self.clients.openWindow(url);
    }),
  );
});
