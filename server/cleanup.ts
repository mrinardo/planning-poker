import type { Session } from "./types";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function startSessionCleanup(sessions: Map<string, Session>): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();

    for (const session of sessions.values()) {
      if (now - session.lastActivityAt > SESSION_TTL_MS) {
        sessions.delete(session.id);
      }
    }
  }, FIVE_MINUTES_MS);
}
