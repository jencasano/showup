// feed-debounce.js -- Debounce manager for feed events
// Log writes use a 10-second quiet window; diary fires immediately.

const LOG_QUIET_MS = 10_000;

export function createDebouncer(onEvent) {
  const pending = new Map(); // uid -> timerId

  function logChanged(uid) {
    if (pending.has(uid)) clearTimeout(pending.get(uid));
    pending.set(uid, setTimeout(() => {
      pending.delete(uid);
      onEvent("log", uid);
    }, LOG_QUIET_MS));
  }

  function diaryChanged(uid, dateStr) {
    onEvent("diary", uid, dateStr);
  }

  function destroy() {
    for (const id of pending.values()) clearTimeout(id);
    pending.clear();
  }

  return { logChanged, diaryChanged, destroy };
}
