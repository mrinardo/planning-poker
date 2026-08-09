import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useParams, useSearchParams } from "react-router-dom";
import { ParticipantList } from "../components/ParticipantList";
import { ResultsPanel } from "../components/ResultsPanel";
import { VoteCard } from "../components/VoteCard";

const voteValues = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕"] as const;

type VoteValue = (typeof voteValues)[number];

type SessionSnapshot = {
  id: string;
  name: string;
  revealed: boolean;
  participants: Array<{ id: string; name: string }>;
};

type ParticipantState = {
  id: string;
  name: string;
  hasVoted: boolean;
  voteValue?: string;
};

type RevealStats = {
  average: number;
  min: number;
  max: number;
};

type JoinSessionEvent = {
  participantId: string;
  session: SessionSnapshot;
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
  stats: RevealStats;
};

type SessionClosedEvent = {
  type: "session-closed";
};

type SessionErrorEvent = {
  message: string;
};

type ServerToClientEvents = {
  "join-session": (payload: JoinSessionEvent) => void;
  "participants-updated": (payload: ParticipantsUpdatedEvent) => void;
  "vote-status": (payload: VoteStatusEvent) => void;
  "votes-revealed": (payload: VotesRevealedEvent) => void;
  "new-round": () => void;
  "session-closed": (payload: SessionClosedEvent) => void;
  "session-error": (payload: SessionErrorEvent) => void;
};

type ClientToServerEvents = {
  "join-session": (payload: { sessionId: string; name: string }) => void;
  vote: (payload: { sessionId: string; participantId: string; value: VoteValue }) => void;
  "reveal-votes": (payload: { sessionId: string; ownerToken: string }) => void;
  "new-round": (payload: { sessionId: string; ownerToken: string }) => void;
  "close-session": (payload: { sessionId: string; ownerToken: string }) => void;
  heartbeat: (payload: { type: "heartbeat" }) => void;
};

export function SessionPage(): JSX.Element {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = params.sessionId ?? "";
  const isHost = searchParams.get("host") === "1";
  const ownerToken = useMemo(() => {
    if (sessionId.length === 0) {
      return "";
    }
    return localStorage.getItem(`host-token:${sessionId}`) ?? "";
  }, [sessionId]);

  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [sessionName, setSessionName] = useState("Sessao");
  const [participantName, setParticipantName] = useState("");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [selectedVote, setSelectedVote] = useState<VoteValue | null>(null);
  const [votes, setVotes] = useState<Array<{ name: string; value: string }>>([]);
  const [stats, setStats] = useState<RevealStats | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shareableUrl = useMemo(() => {
    if (sessionId.length === 0) {
      return "";
    }

    return `${window.location.origin}/s/${sessionId}`;
  }, [sessionId]);

  useEffect(() => {
    if (sessionId.length === 0) {
      return;
    }

    let isMounted = true;

    async function loadSession(): Promise<void> {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        if (!response.ok) {
          if (isMounted) {
            setErrorMessage("Sessao nao encontrada.");
          }
          return;
        }

        const payload = (await response.json()) as SessionSnapshot;
        if (!isMounted) {
          return;
        }

        setSessionName(payload.name);
        setIsRevealed(payload.revealed);
        setParticipants(payload.participants.map((participant) => ({ ...participant, hasVoted: false })));
      } catch {
        if (isMounted) {
          setErrorMessage("Falha ao carregar sessao.");
        }
      }
    }

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  useEffect(() => {
    const socket = io({ autoConnect: true });
    socketRef.current = socket;

    socket.on("join-session", (payload) => {
      setParticipantId(payload.participantId);
      setSessionName(payload.session.name);
      setIsRevealed(payload.session.revealed);
      setParticipants(
        payload.session.participants.map((participant) => ({
          id: participant.id,
          name: participant.name,
          hasVoted: false
        }))
      );
      setErrorMessage(null);
    });

    socket.on("participants-updated", (payload) => {
      setParticipants((current) => {
        const votedMap = new Map(current.map((participant) => [participant.id, participant.hasVoted]));

        return payload.participants.map((participant) => ({
          id: participant.id,
          name: participant.name,
          hasVoted: votedMap.get(participant.id) ?? false
        }));
      });
    });

    socket.on("vote-status", (payload) => {
      setParticipants((current) =>
        current.map((participant) =>
          participant.id === payload.participantId ? { ...participant, hasVoted: payload.hasVoted } : participant
        )
      );
    });

    socket.on("votes-revealed", (payload) => {
      setVotes(payload.votes);
      setStats(payload.stats);
      setIsRevealed(true);
    });

    socket.on("new-round", () => {
      setSelectedVote(null);
      setVotes([]);
      setStats(null);
      setIsRevealed(false);
      setParticipants((current) => current.map((participant) => ({ ...participant, hasVoted: false, voteValue: undefined })));
    });

    socket.on("session-closed", () => {
      setIsClosed(true);
      setErrorMessage("Sessao encerrada.");
    });

    socket.on("session-error", (payload) => {
      setErrorMessage(payload.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isHost || participantId !== null || sessionId.length === 0) {
      return;
    }

    const rawSeed = sessionStorage.getItem(`host-join-seed:${sessionId}`);
    if (rawSeed === null) {
      return;
    }

    let parsedSeed: { sessionId?: string; hostName?: string } | null = null;
    try {
      parsedSeed = JSON.parse(rawSeed) as { sessionId?: string; hostName?: string };
    } catch {
      sessionStorage.removeItem(`host-join-seed:${sessionId}`);
      return;
    }

    if (parsedSeed?.sessionId !== sessionId || typeof parsedSeed.hostName !== "string" || parsedSeed.hostName.trim().length === 0) {
      sessionStorage.removeItem(`host-join-seed:${sessionId}`);
      return;
    }

    setParticipantName(parsedSeed.hostName);
    socketRef.current?.emit("join-session", {
      sessionId,
      name: parsedSeed.hostName
    });
    sessionStorage.removeItem(`host-join-seed:${sessionId}`);
  }, [isHost, participantId, sessionId]);

  useEffect(() => {
    if (participantId === null || isClosed) {
      return;
    }

    const interval = window.setInterval(() => {
      socketRef.current?.emit("heartbeat", { type: "heartbeat" });
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [participantId, isClosed]);

  function handleJoin(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (sessionId.length === 0 || participantName.trim().length === 0 || isClosed) {
      return;
    }

    setErrorMessage(null);
    socketRef.current?.emit("join-session", {
      sessionId,
      name: participantName
    });
  }

  function handleVote(value: VoteValue): void {
    if (participantId === null || isClosed || isRevealed) {
      return;
    }

    setSelectedVote(value);
    socketRef.current?.emit("vote", {
      sessionId,
      participantId,
      value
    });
  }

  function handleRevealVotes(): void {
    if (!isHost || ownerToken.length === 0 || isClosed) {
      return;
    }

    socketRef.current?.emit("reveal-votes", {
      sessionId,
      ownerToken
    });
  }

  function handleNewRound(): void {
    if (!isHost || ownerToken.length === 0 || isClosed) {
      return;
    }

    socketRef.current?.emit("new-round", {
      sessionId,
      ownerToken
    });
  }

  function handleCloseSession(): void {
    if (!isHost || ownerToken.length === 0 || isClosed) {
      return;
    }

    socketRef.current?.emit("close-session", {
      sessionId,
      ownerToken
    });
  }

  function copyLink(): void {
    if (shareableUrl.length === 0) {
      return;
    }

    void navigator.clipboard.writeText(shareableUrl);
  }

  return (
    <main className="page">
      <section className="panel">
        <header className="session-header">
          <div>
            <h1>{sessionName}</h1>
            <p>ID: {sessionId || "sem id"}</p>
          </div>
          <div className="session-link-row">
            <input value={shareableUrl} readOnly />
            <button type="button" onClick={copyLink} disabled={shareableUrl.length === 0}>
              Copiar link
            </button>
          </div>
        </header>

        {participantId === null ? (
          <form className="stack" onSubmit={handleJoin}>
            <label htmlFor="participant-name">Seu nome</label>
            <input
              id="participant-name"
              value={participantName}
              onChange={(event) => setParticipantName(event.target.value)}
              placeholder="Ana"
              maxLength={30}
              disabled={isClosed}
            />
            <button type="submit" disabled={participantName.trim().length === 0 || isClosed}>
              Entrar na sessao
            </button>
          </form>
        ) : null}

        <ParticipantList participants={participants} revealed={isRevealed} />

        <div className="votes-grid">
          {voteValues.map((value) => (
            <VoteCard
              key={value}
              value={value}
              onSelect={handleVote}
              selected={selectedVote === value}
              disabled={participantId === null || isClosed || isRevealed}
            />
          ))}
        </div>

        <div className="host-actions">
          <button type="button" onClick={handleRevealVotes} disabled={!isHost || isClosed || ownerToken.length === 0}>
            Revelar votos
          </button>
          <button type="button" onClick={handleNewRound} disabled={!isHost || isClosed || ownerToken.length === 0}>
            Nova rodada
          </button>
          <button type="button" onClick={handleCloseSession} disabled={!isHost || isClosed || ownerToken.length === 0}>
            Encerrar sessao
          </button>
        </div>

        {!isHost ? <p className="muted-text">Somente o host pode revelar, iniciar nova rodada e encerrar a sessao.</p> : null}
        {errorMessage !== null ? <p className="error-text">{errorMessage}</p> : null}
        <ResultsPanel revealed={isRevealed} votes={votes} stats={stats} />
      </section>
    </main>
  );
}
