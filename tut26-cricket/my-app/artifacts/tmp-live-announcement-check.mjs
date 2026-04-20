import { buildSpectatorScoreAnnouncement, createScoreLiveEvent } from '../src/app/lib/live-announcements.js';
const before = {
  _id: '1', teamA: [], teamB: [], teamAName: 'Falcons', teamBName: 'Titans', overs: 2,
  innings: 'second', score: 7, outs: 1, innings1: { team: 'Falcons', score: 10, history: [] }, innings2: { team: 'Titans', score: 7, history: [] },
};
const after = {
  ...before,
  score: 8,
  innings2: { team: 'Titans', score: 8, history: [{ overNumber: 1, balls: [{ runs: 1, isOut: false, extraType: null }] }] },
};
const event = createScoreLiveEvent(before, after, { runs: 1, isOut: false, extraType: null });
console.log('scoreLine', buildSpectatorScoreAnnouncement(event, after));
