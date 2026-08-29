import test from "node:test";
import assert from "node:assert/strict";

import { createSession, getSessionPublicView, startNewRound, updateStory } from "./sessionService";

test("startNewRound stores story name and link for the session", () => {
  const sessions = new Map();
  const created = createSession(sessions, "Sessao inicial");

  startNewRound(sessions, {
    sessionId: created.sessionId,
    ownerToken: created.ownerToken,
    storyName: "US-101",
    storyLink: "https://example.com/us-101"
  });

  const session = getSessionPublicView(sessions, created.sessionId);

  assert.equal(session.storyName, "US-101");
  assert.equal(session.storyLink, "https://example.com/us-101");
});

test("updateStory edits current story without clearing the current round", () => {
  const sessions = new Map();
  const created = createSession(sessions, "Sessao inicial");

  startNewRound(sessions, {
    sessionId: created.sessionId,
    ownerToken: created.ownerToken,
    storyName: "US-101",
    storyLink: "https://example.com/us-101"
  });

  updateStory(sessions, {
    sessionId: created.sessionId,
    ownerToken: created.ownerToken,
    storyName: "US-102",
    storyLink: "https://example.com/us-102"
  });

  const session = getSessionPublicView(sessions, created.sessionId);

  assert.equal(session.storyName, "US-102");
  assert.equal(session.storyLink, "https://example.com/us-102");
});
