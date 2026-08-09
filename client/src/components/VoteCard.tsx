type VoteCardProps = {
  value: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
  selected?: boolean;
};

export function VoteCard({ value, onSelect, disabled = false, selected = false }: VoteCardProps): JSX.Element {
  return (
    <button
      type="button"
      className={`vote-card ${selected ? "is-selected" : ""}`.trim()}
      onClick={() => onSelect(value)}
      disabled={disabled}
    >
      {value}
    </button>
  );
}
