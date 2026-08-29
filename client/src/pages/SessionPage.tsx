import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useParams, useSearchParams } from "react-router-dom";
import { ParticipantList } from "../components/ParticipantList";
import { VoteCard } from "../components/VoteCard";

const voteValues = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕"] as const;

type VoteValue = (typeof voteValues)[number];

type SessionSnapshot = {
  id: string;
  name: string;
  revealed: boolean;
  storyName: string;
  storyLink: string;
  participants: Array<{ id: string; name: string; isHost: boolean }>;
};

type ParticipantState = {
  id: string;
  name: string;
  isHost: boolean;
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
  participants: Array<{ id: string; name: string; isHost: boolean }>;
};

type VoteStatusEvent = {
  type: "vote-status";
  participantId: string;
  hasVoted: boolean;
};

type VotesRevealedEvent = {
  type: "votes-revealed";
  votes: Array<{ participantId: string; name: string; value: string }>;
  stats: RevealStats;
};

type SessionClosedEvent = {
  type: "session-closed";
};

type SessionErrorEvent = {
  message: string;
};

type NewRoundEvent = {
  type: "new-round";
  storyName: string;
  storyLink: string;
};

type StoryUpdatedEvent = {
  type: "story-updated";
  storyName: string;
  storyLink: string;
};

type ServerToClientEvents = {
  "join-session": (payload: JoinSessionEvent) => void;
  "participants-updated": (payload: ParticipantsUpdatedEvent) => void;
  "vote-status": (payload: VoteStatusEvent) => void;
  "votes-revealed": (payload: VotesRevealedEvent) => void;
  "new-round": (payload: NewRoundEvent) => void;
  "story-updated": (payload: StoryUpdatedEvent) => void;
  "session-closed": (payload: SessionClosedEvent) => void;
  "session-error": (payload: SessionErrorEvent) => void;
};

type ClientToServerEvents = {
  "join-session": (payload: { sessionId: string; name: string; ownerToken?: string }) => void;
  vote: (payload: { sessionId: string; participantId: string; value: VoteValue }) => void;
  "reveal-votes": (payload: { sessionId: string; ownerToken: string }) => void;
  "new-round": (payload: { sessionId: string; ownerToken: string; storyName: string; storyLink?: string }) => void;
  "update-story": (payload: { sessionId: string; ownerToken: string; storyName: string; storyLink?: string }) => void;
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
  const [storyName, setStoryName] = useState("");
  const [storyLink, setStoryLink] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [selectedVote, setSelectedVote] = useState<VoteValue | null>(null);
  const [stats, setStats] = useState<RevealStats | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [draftStoryName, setDraftStoryName] = useState("");
  const [draftStoryLink, setDraftStoryLink] = useState("");
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
        setStoryName(payload.storyName ?? "");
        setStoryLink(payload.storyLink ?? "");
        setIsRevealed(payload.revealed);
        setParticipants(payload.participants.map((participant) => ({ ...participant, hasVoted: false, voteValue: undefined })));
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
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ autoConnect: true });
    socketRef.current = socket;

    socket.on("join-session", (payload) => {
      setParticipantId(payload.participantId);
      setSessionName(payload.session.name);
      setStoryName(payload.session.storyName ?? "");
      setStoryLink(payload.session.storyLink ?? "");
      setIsRevealed(payload.session.revealed);
      setParticipants(
        payload.session.participants.map((participant) => ({
          id: participant.id,
          name: participant.name,
          isHost: participant.isHost,
          hasVoted: false,
          voteValue: undefined
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
          isHost: participant.isHost,
          hasVoted: votedMap.get(participant.id) ?? false,
          voteValue: current.find((currentParticipant) => currentParticipant.id === participant.id)?.voteValue
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
      setStats(payload.stats);
      setIsRevealed(true);
      const voteMap = new Map(payload.votes.map((vote) => [vote.participantId, vote.value]));
      setParticipants((current) =>
        current.map((participant) => ({
          ...participant,
          hasVoted: voteMap.has(participant.id),
          voteValue: voteMap.get(participant.id)
        }))
      );
    });

    socket.on("new-round", (payload) => {
      setSelectedVote(null);
      setStats(null);
      setStoryName(payload.storyName);
      setStoryLink(payload.storyLink);
      setIsRevealed(false);
      setParticipants((current) => current.map((participant) => ({ ...participant, hasVoted: false, voteValue: undefined })));
    });

    socket.on("story-updated", (payload) => {
      setStoryName(payload.storyName);
      setStoryLink(payload.storyLink);
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
      name: parsedSeed.hostName,
      ownerToken
    });
    sessionStorage.removeItem(`host-join-seed:${sessionId}`);
  }, [isHost, ownerToken, participantId, sessionId]);

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

  function handleVote(value: string): void {
    if (participantId === null || isClosed || isRevealed) {
      return;
    }

    const voteValue = value as VoteValue;
    setSelectedVote(voteValue);
    socketRef.current?.emit("vote", {
      sessionId,
      participantId,
      value: voteValue
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

  function openNewRoundModal(): void {
    if (!isHost || ownerToken.length === 0 || isClosed) {
      return;
    }

    setIsEditingStory(false);
    setDraftStoryName("");
    setDraftStoryLink("");
    setShowStoryModal(true);
    setErrorMessage(null);
  }

  function openEditStoryModal(): void {
    if (!isHost || ownerToken.length === 0 || isClosed) {
      return;
    }

    setIsEditingStory(true);
    setDraftStoryName(storyName);
    setDraftStoryLink(storyLink);
    setShowStoryModal(true);
    setErrorMessage(null);
  }

  function handleStorySubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!isHost || ownerToken.length === 0 || isClosed) {
      return;
    }

    const nextStoryName = draftStoryName.trim();
    if (nextStoryName.length === 0) {
      setErrorMessage("Campo 'nome da historia' e obrigatorio.");
      return;
    }

    const nextStoryLink = draftStoryLink.trim();
    if (isEditingStory) {
      socketRef.current?.emit("update-story", {
        sessionId,
        ownerToken,
        storyName: nextStoryName,
        storyLink: nextStoryLink
      });
    } else {
      socketRef.current?.emit("new-round", {
        sessionId,
        ownerToken,
        storyName: nextStoryName,
        storyLink: nextStoryLink
      });
    }

    setShowStoryModal(false);
    setErrorMessage(null);
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

        <section className="story-panel">
          <div className="story-panel-header">
            <h2>Historia</h2>
            {isHost ? (
              <button type="button" className="inline-button" onClick={openEditStoryModal} disabled={isClosed || ownerToken.length === 0}>
                Editar
              </button>
            ) : null}
          </div>
          {storyName.length > 0 ? (
            <>
              <p className="story-name">{storyName}</p>
              {storyLink.length > 0 ? (
                <a href={storyLink} target="_blank" rel="noreferrer" className="story-link">
                  Abrir link da historia
                </a>
              ) : null}
            </>
          ) : (
            <p className="muted-text">Nenhuma historia definida para esta rodada.</p>
          )}
        </section>

        <ParticipantList participants={participants} revealed={isRevealed} />
        {isRevealed ? (
          stats !== null ? (
            <div className="participant-stats">
              <span>Media: {stats.average.toFixed(1)}</span>
              <span>Min: {stats.min}</span>
              <span>Max: {stats.max}</span>
            </div>
          ) : (
            <p>Sem estatisticas disponiveis.</p>
          )
        ) : null}

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
          <button type="button" onClick={openNewRoundModal} disabled={!isHost || isClosed || ownerToken.length === 0}>
            Nova rodada
          </button>
          <button type="button" onClick={handleCloseSession} disabled={!isHost || isClosed || ownerToken.length === 0}>
            Encerrar sessao
          </button>
        </div>

        {errorMessage !== null ? <p className="error-text">{errorMessage}</p> : null}
      </section>

      {showStoryModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2>{isEditingStory ? "Editar historia" : "Nova rodada"}</h2>
            <form className="stack" onSubmit={handleStorySubmit}>
              <label htmlFor="story-name">Nome da historia</label>
              <input
                id="story-name"
                value={draftStoryName}
                onChange={(event) => setDraftStoryName(event.target.value)}
                placeholder="US-101 - Login"
                maxLength={120}
                autoFocus
              />

              <label htmlFor="story-link">Link da historia (opcional)</label>
              <input
                id="story-link"
                value={draftStoryLink}
                onChange={(event) => setDraftStoryLink(event.target.value)}
                placeholder="https://exemplo.com/issue/101"
              />

              <div className="modal-actions">
                <button type="button" onClick={() => setShowStoryModal(false)}>
                  Cancelar
                </button>
                <button type="submit" disabled={draftStoryName.trim().length === 0}>
                  {isEditingStory ? "Salvar" : "Iniciar rodada"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
