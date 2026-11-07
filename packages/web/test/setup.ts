import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Integration tests run the real server app in-process, which needs the runtime's own HTTP primitives, not the DOM's.
const { fetch, Request, Response, Headers, URL, URLSearchParams, ReadableStream, TextDecoder, TextEncoder } =
  globalThis;
GlobalRegistrator.register({ url: "http://127.0.0.1:4747/" });
Object.assign(globalThis, {
  fetch,
  Request,
  Response,
  Headers,
  URL,
  URLSearchParams,
  ReadableStream,
  TextDecoder,
  TextEncoder,
});

const { act, cleanup } = await import("@testing-library/react");
const { notifyManager } = await import("@tanstack/react-query");

// The query library delivers results outside React's own batching, so they have to be routed through act in tests.
notifyManager.setNotifyFunction((notify) => {
  act(notify);
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});
