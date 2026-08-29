import test from "node:test";
import assert from "node:assert/strict";

import {
  castVote,
  createSession,
  getSessionPublicView,
  joinSession,
  revealVotes,
  startNewRound,
  updateStory
} from "./sessionService";

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

test("joinSession marks host participant when ownerToken is provided", () => {
  const sessions = new Map();
  const created = createSession(sessions, "Sessao com host");

  const joined = joinSession(sessions, {
    sessionId: created.sessionId,
    name: "Ana",
    socketId: "socket-host",
    ownerToken: created.ownerToken
  });

  assert.equal(joined.session.participants.length, 1);
  assert.equal(joined.session.participants[0]?.isHost, true);
});

test("revealVotes returns participantId for each revealed vote", () => {
  const sessions = new Map();
  const created = createSession(sessions, "Sessao de votos");

  const host = joinSession(sessions, {
    sessionId: created.sessionId,
    name: "Host",
    socketId: "socket-host",
    ownerToken: created.ownerToken
  });

  const participant = joinSession(sessions, {
    sessionId: created.sessionId,
    name: "Dev",
    socketId: "socket-dev"
  });

  castVote(sessions, {
    sessionId: created.sessionId,
    participantId: participant.participantId,
    socketId: "socket-dev",
    value: "5"
  });

  const revealed = revealVotes(sessions, {
    sessionId: created.sessionId,
    ownerToken: created.ownerToken
  });

  assert.equal(revealed.votes.length, 1);
  assert.equal(revealed.votes[0]?.participantId, participant.participantId);
  assert.equal(revealed.votes[0]?.value, "5");
  assert.equal(host.session.participants[0]?.isHost, true);
});
