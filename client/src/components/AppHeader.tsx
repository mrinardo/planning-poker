export function AppHeader(): JSX.Element {
  return (
    <header className="app-header">
      <div className="brand-header" aria-label="Flash Planning Poker">
        <span className="brand-mark" aria-hidden="true">
          ⚡
        </span>
        <span className="brand-text">
          <span className="brand-flash">Flash</span> Planning Poker
        </span>
      </div>
    </header>
  );
}
