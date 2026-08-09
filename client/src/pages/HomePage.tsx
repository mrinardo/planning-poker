import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

type CreateSessionResponse = {
  sessionId: string;
  ownerToken: string;
  url: string;
};

type HostJoinSeed = {
  sessionId: string;
  hostName: string;
};

export function HomePage(): JSX.Element {
  const [sessionName, setSessionName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleCreateSession(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: sessionName })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setErrorMessage(payload.error ?? "Nao foi possivel criar a sessao.");
        return;
      }

      const payload = (await response.json()) as CreateSessionResponse;

      localStorage.setItem(`host-token:${payload.sessionId}`, payload.ownerToken);
      const hostJoinSeed: HostJoinSeed = {
        sessionId: payload.sessionId,
        hostName: sessionName.trim()
      };
      sessionStorage.setItem(`host-join-seed:${payload.sessionId}`, JSON.stringify(hostJoinSeed));
      navigate(`${payload.url}?host=1`);
    } catch {
      setErrorMessage("Falha de conexao ao criar sessao.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>Planning Poker</h1>
        <p>Crie uma sessao e compartilhe o link com o time.</p>
        <form className="stack" onSubmit={handleCreateSession}>
          <label htmlFor="session-name">Nome da sessao</label>
          <input
            id="session-name"
            value={sessionName}
            onChange={(event) => setSessionName(event.target.value)}
            placeholder="Sprint 42"
            maxLength={30}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Criando..." : "Criar sessao"}
          </button>
        </form>
        {errorMessage !== null ? <p className="error-text">{errorMessage}</p> : null}
      </section>
    </main>
  );
}
