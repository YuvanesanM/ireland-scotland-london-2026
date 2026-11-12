// Unit tests for atlas/engine.js — run with `npm test` (Node 18+, no dependencies).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../atlas/engine.js');

// Fictional fixture shaped like an atlas.* trip (names, dates and references are made up).
function sample(overrides) {
  const trip = { id: 'sample', name: 'Sample Trip', start: '2029-01-03', end: '2029-01-18', status: 'upcoming', adults: 2, children: 2, passportMonths: 6,
    tabs: { itinerary: 'jit', bookings: 'jbk', hotels: 'jht', flights: 'jfl' },
    stops: [
      { seq: 1, name: 'Port City', arrive: '2029-01-03', depart: '2029-01-07', tz: 'Asia/Seoul', hotel: 'Harbour Hotel' },
      { seq: 2, name: 'Old Town', arrive: '2029-01-07', depart: '2029-01-10', tz: 'Asia/Seoul', hotel: 'Garden Inn' },
      { seq: 3, name: 'Capital', arrive: '2029-01-10', depart: '2029-01-18', tz: 'Asia/Seoul', hotel: 'Central Hotel' }] };
  const items = [
    { id: 'f:outbound', kind: 'flight', title: 'Home → Port City', event_date: '2029-01-03', done: true, adults: 2, children: 2, reference: 'REF' },
    { id: 'f:return', kind: 'flight', title: 'Capital → Home', event_date: '2029-01-18', done: true, adults: 2, children: 2, reference: 'REF' },
    { id: 'h:port', kind: 'hotel', title: 'Harbour Hotel', stop_seq: 1, event_date: '2029-01-03', done: true, adults: 2, children: 2, reference: 'REF' },
    { id: 'h:oldtown', kind: 'hotel', title: 'Garden Inn', stop_seq: 2, event_date: '2029-01-07', done: true, adults: 2, children: 2, cancel_by: '2028-07-25', reference: 'REF' },
    { id: 'h:capital', kind: 'hotel', title: 'Central Hotel', stop_seq: 3, event_date: '2029-01-10', done: true, needs_review: true, adults: 2, children: 0, cancel_by: '2029-01-09', reference: 'REF' },
    { id: 'w:evening-show-tickets', kind: 'ticket', title: 'Evening show tickets', stop_seq: 2, event_date: '2029-01-08', opens_on: '2028-10-08', opens_before: '3 mons', rule: 'fixed', url: 'https://example.org/show', done: false },
    { id: 'w:theme-park-dated-ticket', kind: 'ticket', title: 'Theme park dated ticket', stop_seq: 3, event_date: '2029-01-17', opens_on: '2028-11-19', opens_before: '60 days', opens_time: '14:00:00', rule: 'fixed', url: 'https://example.org/tdr', done: false },
    { id: 'w:sky-deck', kind: 'ticket', title: 'Sky deck', stop_seq: 3, event_date: '2029-01-15', opens_on: '2029-01-01', opens_before: '14 days', opens_time: '00:00:00', rule: 'fixed', done: false },
    { id: 'w:kids-costume-rental', kind: 'ticket', title: 'Kids costume rental', stop_seq: 2, event_date: '2029-01-08', opens_on: '2028-12-18', opens_before: '21 days', rule: 'reco', done: false },
    { id: 'misc:visa', kind: 'document', title: 'Visa — all 4 passports', due_on: '2028-11-28', done: false },
    { id: 'doc:passport-validity', kind: 'document', title: 'Passport validity check', auto: true, done: true, detail: 'All 4 passports are valid.' }];
  const days = []; for (let n = E.dayNum(trip.start); n <= E.dayNum(trip.end); n++) days.push({ n: 'D' + (days.length + 1), date: E.isoOf(n) });
  return Object.assign({ todayIso: '2028-10-23', localTz: 'Asia/Kolkata', synced: true, trip, items, travellers: [{}], days, deps: { 'misc:visa': ['doc:passport-validity'] } }, overrides || {});
}
const byId = (list, id) => list.find(i => i.id === id);

test('intervals subtract with Postgres semantics', () => {
  assert.equal(E.subtractInterval('2029-01-17', '60 days'), '2028-11-18');
  assert.equal(E.subtractInterval('2029-01-08', '3 mons'), '2028-10-08');
  assert.equal(E.subtractInterval('2029-01-04', '1 mon'), '2028-12-04');
  assert.equal(E.subtractInterval('2031-03-31', '1 mon'), '2031-02-28');   // clamped to month end
  assert.equal(E.subtractInterval('2029-01-15', '14 days'), '2029-01-01');
});

test('destination wall-clock times convert to the right instant', () => {
  const ts = E.zonedToUtc('2028-11-18', '14:00', 'Asia/Seoul');
  assert.equal(new Date(ts).toISOString(), '2028-11-18T05:00:00.000Z');
  assert.equal(E.fmtInstant(ts, 'Asia/Kolkata'), 'Sat 18 Nov 10:30');
  // A midnight JST release is still the previous evening in India.
  const sky = E.zonedToUtc('2029-01-01', '00:00', 'Asia/Seoul');
  assert.equal(E.fmtInstant(sky, 'Asia/Kolkata'), 'Sun 31 Dec 20:30');
  // DST-observing zone: 1 Jun London is BST (UTC+1)
  assert.equal(new Date(E.zonedToUtc('2028-05-29', '12:40', 'Europe/London')).toISOString(), '2028-05-29T11:40:00.000Z');
});

test('Hotel occupancy mismatch is urgent, dated by free cancellation', () => {
  const ins = E.buildInsights(sample());
  const occ = byId(ins, 'occ:h:capital');
  assert.ok(occ, 'occupancy insight exists');
  assert.equal(occ.priority, 'urgent');
  assert.match(occ.title, /2 adults, 0 children/);
  assert.equal(occ.date.date, '2029-01-09');
  assert.ok(!byId(ins, 'rev:h:capital'), 'review flag merged into the occupancy insight');
  assert.ok(!byId(ins, 'occ:h:port') && !byId(ins, 'occ:h:oldtown'), 'matching hotels are not flagged');
});

test('a release date that disagrees with its own rule is flagged, never changed', () => {
  const m = sample();
  const ins = E.buildInsights(m);
  const r = byId(ins, 'rule:w:theme-park-dated-ticket');
  assert.ok(r);
  assert.equal(r.date.date, '2028-11-18');                    // earlier of the two dates
  assert.equal(new Date(r.date.ts).toISOString(), '2028-11-18T05:00:00.000Z');
  assert.equal(byId(m.items, 'w:theme-park-dated-ticket').opens_on, '2028-11-19'); // data untouched
});

test('open windows are urgent; estimates are labelled as estimates', () => {
  const ins = E.buildInsights(sample());
  assert.equal(byId(ins, 'open:w:evening-show-tickets').priority, 'urgent');
  const costume = byId(ins, 'win:w:kids-costume-rental');
  assert.equal(costume.provenance, 'estimate');
  assert.equal(costume.priority, 'upcoming');
  assert.equal(byId(ins, 'win:w:sky-deck').provenance, 'vendor_rule');
});

test('hotel coverage, itinerary coverage and passports are confirmed', () => {
  const ins = E.buildInsights(sample());
  assert.equal(byId(ins, 'nights').priority, 'confirmed');
  assert.match(byId(ins, 'nights').title, /All 15 nights/);
  assert.equal(byId(ins, 'gaps').priority, 'confirmed');
  assert.equal(byId(ins, 'pp:doc:passport-validity').priority, 'confirmed');
});

test('validation catches uncovered nights, day gaps and activities outside the stay', () => {
  const m = sample();
  m.items = m.items.filter(i => i.id !== 'h:oldtown');
  m.days = m.days.filter(d => d.date !== '2029-01-12');
  m.items.push({ id: 'w:x', kind: 'ticket', title: 'City tour', stop_seq: 2, event_date: '2029-01-13', opens_on: '2028-11-28', rule: 'reco', done: false });
  const ins = E.buildInsights(m);
  assert.match(byId(ins, 'nights').title, /^3 nights without a hotel/);
  assert.match(byId(ins, 'gaps').title, /^1 day with no plan/);
  assert.equal(byId(ins, 'loc:w:x').priority, 'urgent');
});

test('insights are ordered urgent → upcoming → confirmed', () => {
  const ins = E.buildInsights(sample());
  const rank = { urgent: 0, upcoming: 1, confirmed: 2 };
  for (let i = 1; i < ins.length; i++) assert.ok(rank[ins[i - 1].priority] <= rank[ins[i].priority]);
});

test('answers are grounded and say what is missing', () => {
  const unsynced = sample({ synced: false });
  const a = E.answer('ready', unsynced);
  assert.match(a.headline, /^Not yet/);
  assert.ok(a.missing.some(x => /isn’t synced/.test(x)));
  const next = E.answer('next', sample());
  assert.match(next.headline, /Evening show/);
  assert.equal(E.detectIntent('what should I book next?'), 'next');
  assert.equal(E.detectIntent('which deadlines are coming'), 'deadlines');
  assert.equal(E.detectIntent('tell me a joke'), null);
});

test('completed trips produce no nagging insights', () => {
  const m = sample(); m.trip.status = 'completed';
  const ins = E.buildInsights(m);
  assert.ok(ins.every(i => i.priority === 'confirmed'));
});

test('reminder presets use the exact release instant when known', () => {
  const p = E.reminderPresets({ kind: 'booking_window', date: '2028-11-18', ts: E.zonedToUtc('2028-11-18', '14:00', 'Asia/Seoul') }, 'Asia/Kolkata');
  assert.equal(new Date(p[0].at).toISOString(), '2028-11-18T05:00:00.000Z');
  assert.equal(new Date(p[1].at).toISOString(), '2028-11-18T04:00:00.000Z');
});

test('a problem with an existing booking outranks booking windows', () => {
  const ins = E.buildInsights(sample());
  assert.equal(ins[0].id, 'occ:h:capital');
});

test('unsynced devices are not nagged about data they cannot load', () => {
  const m = sample({ synced: false });
  m.items.forEach(i => { if (i.kind === 'hotel') { i.adults = null; i.children = null; } });
  assert.ok(!E.buildInsights(m).some(i => i.id.startsWith('pty:')));
});
