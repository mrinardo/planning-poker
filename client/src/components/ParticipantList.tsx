type ParticipantView = {
  id: string;
  name: string;
  isHost: boolean;
  hasVoted: boolean;
  voteValue?: string;
};

type ParticipantListProps = {
  participants: ParticipantView[];
  revealed: boolean;
};

export function ParticipantList({ participants, revealed }: ParticipantListProps): JSX.Element {
  return (
    <section className="participants-panel">
      <h2>Participantes</h2>
      {participants.length === 0 ? <p>Nenhum participante conectado.</p> : null}
      <ul className="participants-list">
        {participants.map((participant) => {
          const status = revealed
            ? participant.voteValue !== undefined
              ? `votou (${participant.voteValue})`
              : "sem voto"
            : participant.hasVoted
              ? "votou"
              : "aguardando";

          return (
            <li key={participant.id} className="participant-row">
              <span className="participant-name-row">
                <strong>{participant.name}</strong>
                {participant.isHost ? <span className="host-badge">host</span> : null}
              </span>
              <span className={`participant-status ${participant.hasVoted ? "is-voted" : "is-waiting"}`}>{status}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
