import { z } from "zod";

export const resultSchema = z.object({
  score: z.number(),
  scoreRank: z.string(), // its C B A S or so i dont remember, so just make this a string
  highScore: z.number(),
  perfect: z.number(),
  great: z.number(),
  good: z.number(),
  bad: z.number(),
  miss: z.number(),
  maxCombo: z.number(),

  late: z.number(),
  early: z.number(), // in jp this say "fast"
  wrongWay: z.number(), // in jp this say "flick: ${number}"

  song: z.object({
    name: z.string(),
    difficulty: z.enum(["easy", "normal", "hard", "master", "append", ""]),
    level: z.number(),
  }),
});

export type Result = z.infer<typeof resultSchema>;

export type Difficulty = Result["song"]["difficulty"];
