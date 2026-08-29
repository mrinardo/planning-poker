export type Session = {
  id: string;
  name: string;
  ownerToken: string;
  createdAt: number;
  lastActivityAt: number;
  revealed: boolean;
  storyName: string;
  storyLink: string;
  participants: Map<string, Participant>;
  votes: Map<string, Vote>;
};

export type Participant = {
  id: string;
  name: string;
  socketId: string;
  joinedAt: number;
  lastSeenAt: number;
};

export type VoteValue = "0" | "1" | "2" | "3" | "5" | "8" | "13" | "21" | "34" | "55" | "89" | "?" | "☕";

export type Vote = {
  participantId: string;
  value: VoteValue;
  votedAt: number;
};
