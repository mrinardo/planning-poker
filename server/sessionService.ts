import { randomUUID } from "node:crypto";
import type { Participant, Session, VoteValue } from "./types";

const MAX_NAME_LENGTH = 30;
const ALLOWED_VOTES: ReadonlySet<string> = new Set(["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕"]);

export type SessionPublicView = {
  id: string;
  name: string;
  revealed: boolean;
  storyName: string;
  storyLink: string;
  participants: Array<{ id: string; name: string }>;
};

export type SessionStats = {
  average: number;
  min: number;
  max: number;
};

export type SessionServiceErrorCode = "INVALID_INPUT" | "NOT_FOUND" | "FORBIDDEN";

export class SessionServiceError extends Error {
  public readonly code: SessionServiceErrorCode;

  public constructor(code: SessionServiceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function normalizeName(name: string, fieldName: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");

  if (trimmed.length === 0) {
    throw new SessionServiceError("INVALID_INPUT", `Campo '${fieldName}' e obrigatorio.`);
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new SessionServiceError("INVALID_INPUT", `Campo '${fieldName}' deve ter no maximo 30 caracteres.`);
  }

  return trimmed;
}

function normalizeStoryName(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");

  if (trimmed.length === 0) {
    throw new SessionServiceError("INVALID_INPUT", "Campo 'storyName' e obrigatorio.");
  }

  return trimmed;
}

function normalizeStoryLink(value: string): string {
  const trimmed = value.trim();
  return trimmed;
}

function getSessionOrThrow(sessions: Map<string, Session>, sessionId: string): Session {
  const session = sessions.get(sessionId);
  if (session === undefined) {
    throw new SessionServiceError("NOT_FOUND", "Sessao nao encontrada.");
  }

  return session;
}

export function toPublicSession(session: Session): SessionPublicView {
  return {
    id: session.id,
    name: session.name,
    revealed: session.revealed,
    storyName: session.storyName,
    storyLink: session.storyLink,
    participants: Array.from(session.participants.values()).map((participant) => ({
      id: participant.id,
      name: participant.name
    }))
  };
}

export function createSession(sessions: Map<string, Session>, rawName: string): { sessionId: string; ownerToken: string; url: string } {
  const name = normalizeName(rawName, "name");
  const now = Date.now();
  const sessionId = randomUUID();
  const ownerToken = randomUUID();

  const session: Session = {
    id: sessionId,
    name,
    ownerToken,
    createdAt: now,
    lastActivityAt: now,
    revealed: false,
    storyName: "",
    storyLink: "",
    participants: new Map(),
    votes: new Map()
  };

  sessions.set(sessionId, session);

  return {
    sessionId,
    ownerToken,
    url: `/s/${sessionId}`
  };
}

export function getSessionPublicView(sessions: Map<string, Session>, sessionId: string): SessionPublicView {
  const session = getSessionOrThrow(sessions, sessionId);
  return toPublicSession(session);
}

export function joinSession(
  sessions: Map<string, Session>,
  input: { sessionId: string; name: string; socketId: string }
): { participantId: string; session: SessionPublicView } {
  const session = getSessionOrThrow(sessions, input.sessionId);
  const normalizedName = normalizeName(input.name, "name");
  const now = Date.now();
  const participantId = randomUUID();

  const participant: Participant = {
    id: participantId,
    name: normalizedName,
    socketId: input.socketId,
    joinedAt: now,
    lastSeenAt: now
  };

  session.participants.set(participantId, participant);
  session.lastActivityAt = now;

  return {
    participantId,
    session: toPublicSession(session)
  };
}

export function castVote(
  sessions: Map<string, Session>,
  input: { sessionId: string; participantId: string; socketId: string; value: string }
): void {
  const session = getSessionOrThrow(sessions, input.sessionId);

  if (!ALLOWED_VOTES.has(input.value)) {
    throw new SessionServiceError("INVALID_INPUT", "Campo 'value' invalido.");
  }

  const participant = session.participants.get(input.participantId);
  if (participant === undefined || participant.socketId !== input.socketId) {
    throw new SessionServiceError("FORBIDDEN", "Participante invalido para esta conexao.");
  }

  if (session.revealed) {
    throw new SessionServiceError("FORBIDDEN", "A rodada ja foi revelada.");
  }

  const now = Date.now();
  session.votes.set(input.participantId, {
    participantId: input.participantId,
    value: input.value as VoteValue,
    votedAt: now
  });
  session.lastActivityAt = now;
}

export function revealVotes(
  sessions: Map<string, Session>,
  input: { sessionId: string; ownerToken: string }
): { votes: Array<{ name: string; value: string }>; stats: SessionStats } {
  const session = getSessionOrThrow(sessions, input.sessionId);

  if (session.ownerToken !== input.ownerToken) {
    throw new SessionServiceError("FORBIDDEN", "Apenas o host pode revelar votos.");
  }

  session.revealed = true;
  session.lastActivityAt = Date.now();

  const votes: Array<{ name: string; value: string }> = [];
  for (const vote of session.votes.values()) {
    const owner = session.participants.get(vote.participantId);
    if (owner !== undefined) {
      votes.push({
        name: owner.name,
        value: vote.value
      });
    }
  }

  const numericVotes: number[] = [];
  for (const vote of session.votes.values()) {
    const parsed = Number(vote.value);
    if (Number.isFinite(parsed)) {
      numericVotes.push(parsed);
    }
  }

  const sum = numericVotes.reduce((accumulator, current) => accumulator + current, 0);
  const stats: SessionStats = {
    average: numericVotes.length > 0 ? sum / numericVotes.length : 0,
    min: numericVotes.length > 0 ? Math.min(...numericVotes) : 0,
    max: numericVotes.length > 0 ? Math.max(...numericVotes) : 0
  };

  return { votes, stats };
}

export function startNewRound(
  sessions: Map<string, Session>,
  input: { sessionId: string; ownerToken: string; storyName: string; storyLink?: string }
): void {
  const session = getSessionOrThrow(sessions, input.sessionId);

  if (session.ownerToken !== input.ownerToken) {
    throw new SessionServiceError("FORBIDDEN", "Apenas o host pode iniciar nova rodada.");
  }

  session.storyName = normalizeStoryName(input.storyName);
  session.storyLink = input.storyLink === undefined ? "" : normalizeStoryLink(input.storyLink);
  session.votes.clear();
  session.revealed = false;
  session.lastActivityAt = Date.now();
}

export function updateStory(
  sessions: Map<string, Session>,
  input: { sessionId: string; ownerToken: string; storyName: string; storyLink?: string }
): void {
  const session = getSessionOrThrow(sessions, input.sessionId);

  if (session.ownerToken !== input.ownerToken) {
    throw new SessionServiceError("FORBIDDEN", "Apenas o host pode editar a historia.");
  }

  session.storyName = normalizeStoryName(input.storyName);
  session.storyLink = input.storyLink === undefined ? "" : normalizeStoryLink(input.storyLink);
  session.lastActivityAt = Date.now();
}

export function closeSession(
  sessions: Map<string, Session>,
  input: { sessionId: string; ownerToken: string }
): { sessionId: string; socketIds: string[] } {
  const session = getSessionOrThrow(sessions, input.sessionId);

  if (session.ownerToken !== input.ownerToken) {
    throw new SessionServiceError("FORBIDDEN", "Apenas o host pode encerrar a sessao.");
  }

  const socketIds = Array.from(session.participants.values()).map((participant) => participant.socketId);
  sessions.delete(session.id);

  return {
    sessionId: session.id,
    socketIds
  };
}

export function applyHeartbeat(sessions: Map<string, Session>, input: { sessionId: string; participantId: string }): void {
  const session = getSessionOrThrow(sessions, input.sessionId);
  const participant = session.participants.get(input.participantId);

  if (participant === undefined) {
    throw new SessionServiceError("NOT_FOUND", "Participante nao encontrado.");
  }

  const now = Date.now();
  participant.lastSeenAt = now;
  session.lastActivityAt = now;
}

export function removeParticipantOnDisconnect(
  sessions: Map<string, Session>,
  input: { sessionId: string; participantId: string; socketId: string }
): SessionPublicView | null {
  const session = sessions.get(input.sessionId);
  if (session === undefined) {
    return null;
  }

  const participant = session.participants.get(input.participantId);
  if (participant === undefined || participant.socketId !== input.socketId) {
    return null;
  }

  session.participants.delete(input.participantId);
  session.votes.delete(input.participantId);
  session.lastActivityAt = Date.now();

  return toPublicSession(session);
}
