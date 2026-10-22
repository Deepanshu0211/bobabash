import test from 'node:test';
import assert from 'node:assert/strict';
import {shortlistOutcome, ballotProblem, votingOpen, errorStatus, zonedToISO, isoToZoned, artFor} from '../src/lib/rules.mjs';

test('majority outcome treats missing reviews as pending, not rejection', () => {
  assert.equal(shortlistOutcome({assigned: 3, completed: 2, shortlist: 2, flag: 0}), 'pending');
  assert.equal(shortlistOutcome({assigned: 3, completed: 3, shortlist: 2, flag: 0}), 'pass');
  assert.equal(shortlistOutcome({assigned: 3, completed: 3, shortlist: 1, flag: 0}), 'fail');
  assert.equal(shortlistOutcome({assigned: 3, completed: 3, shortlist: 2, flag: 1}), 'flagged');
  assert.equal(shortlistOutcome({assigned: 10, completed: 10, shortlist: 5, flag: 0}), 'fail', '5–5 is not a strict majority');
  assert.equal(shortlistOutcome({assigned: 10, completed: 10, shortlist: 6, flag: 0}), 'pass');
});

test('ballot shape', () => {
  assert.match(ballotProblem(['a', 'b']), /exactly 3/);
  assert.match(ballotProblem(['a', 'a', 'b']), /only once/);
  assert.match(ballotProblem(['a', 'b', 'c'], {ownId: 'c'}), /own project/);
  assert.match(ballotProblem(['a', 'b', 'z'], {allowed: ['a', 'b', 'c']}), /shortlisted/);
  assert.equal(ballotProblem(['a', 'b', 'c'], {allowed: ['a', 'b', 'c']}), null);
});

test('voting follows the phase, never the clock', () => {
  const event = {phase: 'voting', voting_open_at: '2026-01-01T00:00:00Z', voting_close_at: '2026-01-02T00:00:00Z'};
  assert.equal(votingOpen(event), true);
  assert.equal(votingOpen({...event, voting_close_at: '2000-01-01T00:00:00Z'}), true, 'a passed planned close does not shut voting');
  assert.equal(votingOpen({...event, phase: 'closed'}), false);
  assert.equal(votingOpen(null), false);
});

test('error codes map to the API contract', () => {
  assert.deepEqual(['BB400', 'BB401', 'BB403', 'BB409', 'BB422', 'XX000'].map(errorStatus), [400, 401, 403, 409, 422, 500]);
});

test('event-timezone conversion round-trips', () => {
  assert.equal(zonedToISO('2026-11-01T13:00', 'Asia/Kolkata'), '2026-11-01T07:30:00.000Z');
  assert.equal(isoToZoned('2026-11-01T07:30:00.000Z', 'Asia/Kolkata'), '2026-11-01T13:00');
  assert.equal(zonedToISO('2026-03-08T12:00', 'America/New_York'), '2026-03-08T16:00:00.000Z', 'after DST starts');
  assert.equal(zonedToISO('', 'Asia/Kolkata'), '');
});

test('fallback art is stable', () => {
  assert.equal(artFor('abc', ['x', 'y', 'z']), artFor('abc', ['x', 'y', 'z']));
});
