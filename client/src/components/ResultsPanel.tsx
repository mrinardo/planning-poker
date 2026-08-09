type VoteResult = {
  name: string;
  value: string;
};

type VoteStats = {
  average: number;
  min: number;
  max: number;
};

type ResultsPanelProps = {
  revealed: boolean;
  votes: VoteResult[];
  stats: VoteStats | null;
};

export function ResultsPanel({ revealed, votes, stats }: ResultsPanelProps): JSX.Element {
  if (!revealed) {
    return <p>Os resultados aparecem apos a revelacao do host.</p>;
  }

  return (
    <section className="results-panel">
      <h2>Resultados</h2>
      {votes.length === 0 ? <p>Nenhum voto registrado nesta rodada.</p> : null}
      <table>
        <thead>
          <tr>
            <th>Participante</th>
            <th>Voto</th>
          </tr>
        </thead>
        <tbody>
          {votes.map((vote) => (
            <tr key={`${vote.name}-${vote.value}`}>
              <td>{vote.name}</td>
              <td>{vote.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {stats !== null ? (
        <div className="results-stats">
          <span>Media: {stats.average.toFixed(1)}</span>
          <span>Min: {stats.min}</span>
          <span>Max: {stats.max}</span>
        </div>
      ) : (
        <p>Sem estatisticas disponiveis.</p>
      )}
    </section>
  );
}
