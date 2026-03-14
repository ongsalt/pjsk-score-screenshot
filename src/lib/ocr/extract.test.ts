// import { describe, expect, it } from 'vitest';

// import { extractResultFromImage } from './extract';
// import { terminateRecognizer } from './recognizer';

// describe('extractResultFromImage', () => {
//   it('processes the real example screenshot end-to-end', { timeout: 120000 }, async () => {
//     const examplePath = 'example/Screenshot_20260309_021208.png';

//     const output = await extractResultFromImage(examplePath, {
//       languages: 'eng+jpn',
//       includeRawText: true
//     });

//     expect(output.rawText.length).toBeGreaterThan(0);

//     expect(output.result).toMatchObject({
//       score: expect.any(Number),
//       scoreRank: expect.any(String),
//       highScore: expect.any(Number),
//       perfect: expect.any(Number),
//       great: expect.any(Number),
//       good: expect.any(Number),
//       bad: expect.any(Number),
//       miss: expect.any(Number),
//       maxCombo: expect.any(Number),
//       song: {
//         name: expect.any(String),
//         difficulty: expect.any(String),
//         level: expect.any(Number)
//       }
//     });

//     expect(output.result.score).toBeGreaterThanOrEqual(0);
//     expect(output.result.highScore).toBeGreaterThanOrEqual(0);

//     await terminateRecognizer();
//   });
// });
