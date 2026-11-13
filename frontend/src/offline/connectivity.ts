// `navigator.onLine` only says whether the device has a network link - it stays
// true when the server is down or the signal is useless, which is exactly the
// plant-room case. So the API client reports every success/failure here and
// the rest of the app asks "can I actually reach the server?" instead.
import axios from "axios";

type Listener = (reachable: boolean) => void;

let reachable = true;
const listeners = new Set<Listener>();

export function reportReachable(value: boolean) {
  if (value === reachable) return;
  reachable = value;
  listeners.forEach((listener) => listener(value));
}

export function isReachable() {
  return reachable;
}

export function subscribeReachable(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// No response at all (offline, DNS, refused connection), or a gateway saying
// the app behind it isn't answering - 502/503/504 is exactly what a sleeping
// or restarting free-tier host returns. A plain 500 is NOT here: that's our
// own code failing and the user needs to see it, not have it silently queued.
export function isUnreachable(error: unknown) {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status === 502 || status === 503 || status === 504;
}
