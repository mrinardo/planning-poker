import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  applyHeartbeat,
  castVote,
  closeSession,
  joinSession,
  removeParticipantOnDisconnect,
  revealVotes,
  SessionServiceError,
  startNewRound
} from "./sessionService";
import type { Session } from "./types";

type SessionSummary = {
  id: string;
  name: string;
  revealed: boolean;
  participants: Array<{ id: string; name: string }>;
};

type JoinSessionPayload = {
  sessionId: string;
  name: string;
};

type VotePayload = {
  sessionId: string;
  participantId: string;
  value: string;
};

type OwnerActionPayload = {
  sessionId: string;
  ownerToken: string;
};

type HeartbeatPayload = {
  type: "heartbeat";
};

type JoinSessionResponse = {
  participantId: string;
  session: SessionSummary;
};

type ParticipantsUpdatedEvent = {
  type: "participants-updated";
  participants: Array<{ id: string; name: string }>;
};

type VoteStatusEvent = {
  type: "vote-status";
  participantId: string;
  hasVoted: boolean;
};

type VotesRevealedEvent = {
  type: "votes-revealed";
  votes: Array<{ name: string; value: string }>;
  stats: {
    average: number;
    min: number;
    max: number;
  };
};

type NewRoundEvent = {
  type: "new-round";
};

type SessionClosedEvent = {
  type: "session-closed";
};

type ServerErrorEvent = {
  message: string;
};

type ClientToServerEvents = {
  "join-session": (payload: JoinSessionPayload) => void;
  vote: (payload: VotePayload) => void;
  "reveal-votes": (payload: OwnerActionPayload) => void;
  "new-round": (payload: OwnerActionPayload) => void;
  "close-session": (payload: OwnerActionPayload) => void;
  heartbeat: (payload: HeartbeatPayload) => void;
};

type ServerToClientEvents = {
  "join-session": (payload: JoinSessionResponse) => void;
  "participants-updated": (payload: ParticipantsUpdatedEvent) => void;
  "vote-status": (payload: VoteStatusEvent) => void;
  "votes-revealed": (payload: VotesRevealedEvent) => void;
  "new-round": (payload: NewRoundEvent) => void;
  "session-closed": (payload: SessionClosedEvent) => void;
  "session-error": (payload: ServerErrorEvent) => void;
};

type SocketData = {
  sessionId?: string;
  participantId?: string;
};

type PokerServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function emitParticipantsUpdated(io: PokerServer, session: SessionSummary): void {
  io.to(session.id).emit("participants-updated", {
    type: "participants-updated",
    participants: session.participants
  });
}

export function createSocketServer(httpServer: HttpServer): PokerServer {
  return new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
}

export function registerSocketHandlers(io: PokerServer, sessions: Map<string, Session>): void {
  function emitError(socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>, message: string): void {
    socket.emit("session-error", { message });
  }

  function handleServiceError(socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>, error: unknown): void {
    if (error instanceof SessionServiceError) {
      emitError(socket, error.message);
      return;
    }

    emitError(socket, "Erro interno ao processar evento.");
  }

  io.on("connection", (socket) => {
    socket.on("join-session", (payload) => {
      if (!isRecord(payload)) {
        emitError(socket, "Payload invalido para join-session.");
        return;
      }

      const { sessionId, name } = payload;
      if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
        emitError(socket, "Campo 'sessionId' invalido.");
        return;
      }

      if (typeof name !== "string") {
        emitError(socket, "Campo 'name' deve ser uma string.");
        return;
      }

      try {
        const result = joinSession(sessions, {
          sessionId,
          name,
          socketId: socket.id
        });

        socket.data.sessionId = result.session.id;
        socket.data.participantId = result.participantId;
        void socket.join(result.session.id);

        socket.emit("join-session", {
          participantId: result.participantId,
          session: result.session
        });

        emitParticipantsUpdated(io, result.session);
      } catch (error: unknown) {
        handleServiceError(socket, error);
      }
    });

    socket.on("vote", (payload) => {
      if (!isRecord(payload)) {
        emitError(socket, "Payload invalido para vote.");
        return;
      }

      const { sessionId, participantId, value } = payload;
      if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
        emitError(socket, "Campo 'sessionId' invalido.");
        return;
      }

      if (typeof participantId !== "string" || participantId.trim().length === 0) {
        emitError(socket, "Campo 'participantId' invalido.");
        return;
      }

      if (typeof value !== "string") {
        emitError(socket, "Campo 'value' invalido.");
        return;
      }

      try {
        castVote(sessions, {
          sessionId,
          participantId,
          socketId: socket.id,
          value
        });

        io.to(sessionId).emit("vote-status", {
          type: "vote-status",
          participantId,
          hasVoted: true
        });
      } catch (error: unknown) {
        handleServiceError(socket, error);
      }
    });

    socket.on("reveal-votes", (payload) => {
      if (!isRecord(payload)) {
        emitError(socket, "Payload invalido para reveal-votes.");
        return;
      }

      const { sessionId, ownerToken } = payload;
      if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
        emitError(socket, "Campo 'sessionId' invalido.");
        return;
      }

      if (typeof ownerToken !== "string" || ownerToken.trim().length === 0) {
        emitError(socket, "Campo 'ownerToken' invalido.");
        return;
      }

      try {
        const result = revealVotes(sessions, { sessionId, ownerToken });
        io.to(sessionId).emit("votes-revealed", {
          type: "votes-revealed",
          votes: result.votes,
          stats: result.stats
        });
      } catch (error: unknown) {
        handleServiceError(socket, error);
      }
    });

    socket.on("new-round", (payload) => {
      if (!isRecord(payload)) {
        emitError(socket, "Payload invalido para new-round.");
        return;
      }

      const { sessionId, ownerToken } = payload;
      if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
        emitError(socket, "Campo 'sessionId' invalido.");
        return;
      }

      if (typeof ownerToken !== "string" || ownerToken.trim().length === 0) {
        emitError(socket, "Campo 'ownerToken' invalido.");
        return;
      }

      try {
        startNewRound(sessions, { sessionId, ownerToken });
        io.to(sessionId).emit("new-round", {
          type: "new-round"
        });
      } catch (error: unknown) {
        handleServiceError(socket, error);
      }
    });

    socket.on("close-session", (payload) => {
      if (!isRecord(payload)) {
        emitError(socket, "Payload invalido para close-session.");
        return;
      }

      const { sessionId, ownerToken } = payload;
      if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
        emitError(socket, "Campo 'sessionId' invalido.");
        return;
      }

      if (typeof ownerToken !== "string" || ownerToken.trim().length === 0) {
        emitError(socket, "Campo 'ownerToken' invalido.");
        return;
      }

      try {
        const result = closeSession(sessions, { sessionId, ownerToken });
        io.to(result.sessionId).emit("session-closed", {
          type: "session-closed"
        });

        for (const participantSocketId of result.socketIds) {
          const participantSocket = io.sockets.sockets.get(participantSocketId);
          if (participantSocket !== undefined) {
            participantSocket.disconnect(true);
          }
        }
      } catch (error: unknown) {
        handleServiceError(socket, error);
      }
    });

    socket.on("heartbeat", (payload) => {
      if (!isRecord(payload) || payload.type !== "heartbeat") {
        emitError(socket, "Payload invalido para heartbeat.");
        return;
      }

      const sessionId = socket.data.sessionId;
      const participantId = socket.data.participantId;

      if (sessionId === undefined || participantId === undefined) {
        emitError(socket, "Socket nao associado a uma sessao.");
        return;
      }

      try {
        applyHeartbeat(sessions, {
          sessionId,
          participantId
        });
      } catch (error: unknown) {
        handleServiceError(socket, error);
      }
    });

    socket.on("disconnect", () => {
      const sessionId = socket.data.sessionId;
      const participantId = socket.data.participantId;

      if (sessionId === undefined || participantId === undefined) {
        return;
      }

      const result = removeParticipantOnDisconnect(sessions, {
        sessionId,
        participantId,
        socketId: socket.id
      });

      if (result !== null) {
        emitParticipantsUpdated(io, result);
      }
    });
  });
}
