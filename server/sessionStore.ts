import type { Session } from "./types";

const sessions = new Map<string, Session>();

export function getSessionStore(): Map<string, Session> {
  return sessions;
}
