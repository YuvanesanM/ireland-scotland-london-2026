// Unit tests for atlas/engine.js — run with `npm test` (Node 18+, no dependencies).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../atlas/engine.js');

// Fixture mirroring the Japan trip as stored in atlas.* (references are placeholders).
function japan(overrides) {
  const trip = { id: 'japan', name: 'Japan', start: '2027-01-06', end: '2027-01-21', status: 'upcoming', adults: 2, children: 2, passportMonths: 6,
    tabs: { itinerary: 'jit', bookings: 'jbk', hotels: 'jht', flights: 'jfl' },
    stops: [
      { seq: 1, name: 'Osaka', arrive: '2027-01-06', depart: '2027-01-10', tz: 'Asia/Tokyo', hotel: 'Namba Oriental Hotel' },
      { seq: 2, name: 'Kyoto', arrive: '2027-01-10', depart: '2027-01-13', tz: 'Asia/Tokyo', hotel: 'Minn Gion Sanjo' },
      { seq: 3, name: 'Tokyo', arrive: '2027-01-13', depart: '2027-01-21', tz: 'Asia/Tokyo', hotel: 'Hotel Gracery Shinjuku' }] };
  const items = [
    { id: 'f:outbound', kind: 'flight', title: 'Chennai → Osaka (Kansai)', event_date: '2027-01-06', done: true, adults: 2, children: 2, reference: 'REF' },
    { id: 'f:return', kind: 'flight', title: 'Tokyo (Haneda) → Chennai', event_date: '2027-01-21', done: true, adults: 2, children: 2, reference: 'REF' },
    { id: 'h:osaka', kind: 'hotel', title: 'Namba Oriental Hotel', stop_seq: 1, event_date: '2027-01-06', done: true, adults: 2, children: 2, reference: 'REF' },
    { id: 'h:kyoto', kind: 'hotel', title: 'Minn Gion Sanjo', stop_seq: 2, event_date: '2027-01-10', done: true, adults: 2, children: 2, cancel_by: '2026-07-28', reference: 'REF' },
    { id: 'h:tokyo', kind: 'hotel', title: 'Hotel Gracery Shinjuku', stop_seq: 3, event_date: '2027-01-13', done: true, needs_review: true, adults: 2, children: 0, cancel_by: '2027-01-12', reference: 'REF' },
    { id: 'w:gion-corner-tickets', kind: 'ticket', title: 'Gion Corner tickets', stop_seq: 2, event_date: '2027-01-11', opens_on: '2026-10-11', opens_before: '3 mons', rule: 'fixed', url: 'https://example.org/gion', done: false },
    { id: 'w:tokyo-disneyland-dated-ticket', kind: 'ticket', title: 'Tokyo Disneyland dated ticket', stop_seq: 3, event_date: '2027-01-20', opens_on: '2026-11-22', opens_before: '60 days', opens_time: '14:00:00', rule: 'fixed', url: 'https://example.org/tdr', done: false },
    { id: 'w:shibuya-sky', kind: 'ticket', title: 'Shibuya Sky', stop_seq: 3, event_date: '2027-01-18', opens_on: '2027-01-04', opens_before: '14 days', opens_time: '00:00:00', rule: 'fixed', done: false },
    { id: 'w:kids-kimono-rental-ninenzaka', kind: 'ticket', title: "Kids' kimono rental, Ninenzaka", stop_seq: 2, event_date: '2027-01-11', opens_on: '2026-12-21', opens_before: '21 days', rule: 'reco', done: false },
    { id: 'misc:visa', kind: 'document', title: 'Japan visa — all 4 passports', due_on: '2026-12-01', done: false },
    { id: 'doc:passport-validity', kind: 'document', title: 'Passport validity check', auto: true, done: true, detail: 'All 4 passports are valid.' }];
  const days = []; for (let n = E.dayNum(trip.start); n <= E.dayNum(trip.end); n++) days.push({ n: 'D' + (days.length + 1), date: E.isoOf(n) });
  return Object.assign({ todayIso: '2026-10-26', localTz: 'Asia/Kolkata', synced: true, trip, items, travellers: [{}], days, deps: { 'misc:visa': ['doc:passport-validity'] } }, overrides || {});
}
const byId = (list, id) => list.find(i => i.id === id);

test('intervals subtract with Postgres semantics', () => {
  assert.equal(E.subtractInterval('2027-01-20', '60 days'), '2026-11-21');
  assert.equal(E.subtractInterval('2027-01-11', '3 mons'), '2026-10-11');
  assert.equal(E.subtractInterval('2027-01-07', '1 mon'), '2026-12-07');
  assert.equal(E.subtractInterval('2027-03-31', '1 mon'), '2027-02-28');   // clamped to month end
  assert.equal(E.subtractInterval('2027-01-18', '14 days'), '2027-01-04');
});

test('destination wall-clock times convert to the right instant', () => {
  const ts = E.zonedToUtc('2026-11-21', '14:00', 'Asia/Tokyo');
  assert.equal(new Date(ts).toISOString(), '2026-11-21T05:00:00.000Z');
  assert.equal(E.fmtInstant(ts, 'Asia/Kolkata'), 'Sat 21 Nov 10:30');
  // Shibuya Sky midnight JST is still the previous evening in India.
  const sky = E.zonedToUtc('2027-01-04', '00:00', 'Asia/Tokyo');
  assert.equal(E.fmtInstant(sky, 'Asia/Kolkata'), 'Sun 3 Jan 20:30');
  // DST-observing zone: 1 Jun London is BST (UTC+1)
  assert.equal(new Date(E.zonedToUtc('2026-06-01', '12:40', 'Europe/London')).toISOString(), '2026-06-01T11:40:00.000Z');
});

test('Tokyo hotel occupancy mismatch is urgent, dated by free cancellation', () => {
  const ins = E.buildInsights(japan());
  const occ = byId(ins, 'occ:h:tokyo');
  assert.ok(occ, 'occupancy insight exists');
  assert.equal(occ.priority, 'urgent');
  assert.match(occ.title, /2 adults, 0 children/);
  assert.equal(occ.date.date, '2027-01-12');
  assert.ok(!byId(ins, 'rev:h:tokyo'), 'review flag merged into the occupancy insight');
  assert.ok(!byId(ins, 'occ:h:osaka') && !byId(ins, 'occ:h:kyoto'), 'matching hotels are not flagged');
});

test('a release date that disagrees with its own rule is flagged, never changed', () => {
  const m = japan();
  const ins = E.buildInsights(m);
  const r = byId(ins, 'rule:w:tokyo-disneyland-dated-ticket');
  assert.ok(r);
  assert.equal(r.date.date, '2026-11-21');                    // earlier of the two dates
  assert.equal(new Date(r.date.ts).toISOString(), '2026-11-21T05:00:00.000Z');
  assert.equal(byId(m.items, 'w:tokyo-disneyland-dated-ticket').opens_on, '2026-11-22'); // data untouched
});

test('open windows are urgent; estimates are labelled as estimates', () => {
  const ins = E.buildInsights(japan());
  assert.equal(byId(ins, 'open:w:gion-corner-tickets').priority, 'urgent');
  const kimono = byId(ins, 'win:w:kids-kimono-rental-ninenzaka');
  assert.equal(kimono.provenance, 'estimate');
  assert.equal(kimono.priority, 'upcoming');
  assert.equal(byId(ins, 'win:w:shibuya-sky').provenance, 'vendor_rule');
});

test('hotel coverage, itinerary coverage and passports are confirmed', () => {
  const ins = E.buildInsights(japan());
  assert.equal(byId(ins, 'nights').priority, 'confirmed');
  assert.match(byId(ins, 'nights').title, /All 15 nights/);
  assert.equal(byId(ins, 'gaps').priority, 'confirmed');
  assert.equal(byId(ins, 'pp:doc:passport-validity').priority, 'confirmed');
});

test('validation catches uncovered nights, day gaps and activities outside the stay', () => {
  const m = japan();
  m.items = m.items.filter(i => i.id !== 'h:kyoto');
  m.days = m.days.filter(d => d.date !== '2027-01-15');
  m.items.push({ id: 'w:x', kind: 'ticket', title: 'Fushimi tour', stop_seq: 2, event_date: '2027-01-16', opens_on: '2026-12-01', rule: 'reco', done: false });
  const ins = E.buildInsights(m);
  assert.match(byId(ins, 'nights').title, /^3 nights without a hotel/);
  assert.match(byId(ins, 'gaps').title, /^1 day with no plan/);
  assert.equal(byId(ins, 'loc:w:x').priority, 'urgent');
});

test('insights are ordered urgent → upcoming → confirmed', () => {
  const ins = E.buildInsights(japan());
  const rank = { urgent: 0, upcoming: 1, confirmed: 2 };
  for (let i = 1; i < ins.length; i++) assert.ok(rank[ins[i - 1].priority] <= rank[ins[i].priority]);
});

test('answers are grounded and say what is missing', () => {
  const unsynced = japan({ synced: false });
  const a = E.answer('ready', unsynced);
  assert.match(a.headline, /^Not yet/);
  assert.ok(a.missing.some(x => /isn’t synced/.test(x)));
  const next = E.answer('next', japan());
  assert.match(next.headline, /Gion Corner/);
  assert.equal(E.detectIntent('what should I book next?'), 'next');
  assert.equal(E.detectIntent('which deadlines are coming'), 'deadlines');
  assert.equal(E.detectIntent('tell me a joke'), null);
});

test('completed trips produce no nagging insights', () => {
  const m = japan(); m.trip.status = 'completed';
  const ins = E.buildInsights(m);
  assert.ok(ins.every(i => i.priority === 'confirmed'));
});

test('reminder presets use the exact release instant when known', () => {
  const p = E.reminderPresets({ kind: 'booking_window', date: '2026-11-21', ts: E.zonedToUtc('2026-11-21', '14:00', 'Asia/Tokyo') }, 'Asia/Kolkata');
  assert.equal(new Date(p[0].at).toISOString(), '2026-11-21T05:00:00.000Z');
  assert.equal(new Date(p[1].at).toISOString(), '2026-11-21T04:00:00.000Z');
});

test('a problem with an existing booking outranks booking windows', () => {
  const ins = E.buildInsights(japan());
  assert.equal(ins[0].id, 'occ:h:tokyo');
});

test('unsynced devices are not nagged about data they cannot load', () => {
  const m = japan({ synced: false });
  m.items.forEach(i => { if (i.kind === 'hotel') { i.adults = null; i.children = null; } });
  assert.ok(!E.buildInsights(m).some(i => i.id.startsWith('pty:')));
});
