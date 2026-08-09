type ParticipantView = {
  id: string;
  name: string;
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
            ? participant.voteValue ?? (participant.hasVoted ? "votou" : "sem voto")
            : participant.hasVoted
              ? "votou"
              : "aguardando";

          return (
            <li key={participant.id} className="participant-row">
              <strong>{participant.name}</strong>
              <span className={`participant-status ${participant.hasVoted ? "is-voted" : "is-waiting"}`}>{status}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
