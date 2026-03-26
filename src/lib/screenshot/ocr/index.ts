export interface ParseResult {
  score?: number;
  scoreRank?: string; // its C B A S or so i dont remember, so just make this a string
  highScore?: number;
  maxCombo?: number;

  perfect?: number;
  great?: number;
  good: number;
  bad?: number;
  miss?: number;

  detail: {
    late?: number;
    early?: number; // in jp this say "fast"
    wrongWay?: number; // in jp this say "flick: ${number}"
  };

  song: {
    name?: string;
    difficulty?: "easy" | "normal" | "hard" | "master" | "append";
    level?: number;
  };
}
