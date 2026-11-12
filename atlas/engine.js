/* ATLAS Intelligence engine — pure functions, no DOM.
 *
 * Input is a "model" assembled by atlas.js from the app's real data:
 *   { todayIso, nowMs, localTz, synced,
 *     trip:  { id, name, start, end, status, adults, children, passportMonths, tabs,
 *              stops: [{ seq, name, arrive, depart, tz, hotel }] },
 *     items: [booking_items rows, normalised; see atlas.js items()],
 *     travellers: [atlas.travellers rows] | null,
 *     days:  [{ n: 'D1', date: 'YYYY-MM-DD' }] }   // from the itinerary day cards
 *
 * Every insight / answer carries a provenance so the UI can say how sure it is:
 *   verified    – from a confirmation or a booking marked done
 *   vendor_rule – the vendor's published release rule, as researched (not re-checked)
 *   estimate    – ATLAS's own recommended buffer
 *   check       – computed by ATLAS from the data above (validation)
 *   suggestion  – an ATLAS recommendation
 *
 * Nothing here changes data. Works in the browser (window.AtlasEngine) and in
 * Node (module.exports) for the unit tests in tests/.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Dates (date-only values are handled as UTC days: no DST drift) ----------
  const DAY = 86400000;
  const isoRe = /^(\d{4})-(\d{2})-(\d{2})/;
  function dayNum(iso) { const m = String(iso || '').match(isoRe); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : null; }
  function isoOf(n) { const d = new Date(n * DAY); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function daysBetween(a, b) { const x = dayNum(a), y = dayNum(b); return x == null || y == null ? null : y - x; }

  // Postgres interval text as returned by PostgREST: "3 mons", "1 mon", "60 days", "1 year 2 mons 3 days".
  function parseInterval(s) {
    if (!s) return null;
    const t = String(s), get = re => { const m = t.match(re); return m ? +m[1] : 0; };
    const v = { years: get(/(-?\d+)\s*years?/), months: get(/(-?\d+)\s*mons?(?:ths?)?/), days: get(/(-?\d+)\s*days?/) };
    return v.years || v.months || v.days ? v : null;
  }
  // date − interval with Postgres semantics (months first, clamped to month end; then days).
  function subtractInterval(iso, interval) {
    const iv = typeof interval === 'string' ? parseInterval(interval) : interval;
    const m = String(iso || '').match(isoRe);
    if (!iv || !m) return null;
    let y = +m[1], mo = +m[2] - 1 - (iv.years * 12 + iv.months), d = +m[3];
    y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
    const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    return isoOf(Date.UTC(y, mo, Math.min(d, last)) / DAY - iv.days);
  }

  // ---------- Time zones ----------
  function tzOffsetMs(ts, tz) {
    const p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ts)).forEach(x => { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ts;
  }
  // Wall-clock time in `tz` → epoch ms.
  function zonedToUtc(dateIso, time, tz) {
    const m = String(dateIso).match(isoRe), t = String(time || '00:00').match(/^(\d{1,2}):(\d{2})/);
    if (!m || !t) return null;
    const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
    let ts = wall - tzOffsetMs(wall, tz);
    ts = wall - tzOffsetMs(ts, tz);
    return ts;
  }
  const TZ_SHORT = { 'Asia/Tokyo': 'JST', 'Asia/Kolkata': 'IST', 'Asia/Calcutta': 'IST', 'Europe/London': 'UK time', 'Europe/Dublin': 'Irish time' };
  const tzShort = tz => TZ_SHORT[tz] || (tz || '').split('/').pop().replace(/_/g, ' ');
  function fmtDate(iso, opts) {
    const n = dayNum(iso); if (n == null) return '';
    return new Date(n * DAY).toLocaleDateString('en-GB', Object.assign({ timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, opts || {}));
  }
  function fmtInstant(ts, tz, withDate) {
    const o = { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
    if (withDate !== false) Object.assign(o, { weekday: 'short', day: 'numeric', month: 'short' });
    return new Date(ts).toLocaleString('en-GB', o).replace(',', '');
  }
  // "Sat 21 Nov, 14:00 JST · 10:30 IST your time" (local part only when it differs)
  function whenText(e, localTz) {
    if (e.ts != null && e.tz) {
      const dest = fmtInstant(e.ts, e.tz) + ' ' + tzShort(e.tz);
      if (!localTz || localTz === e.tz) return dest;
      const same = fmtInstant(e.ts, e.tz, true).slice(0, 10) === fmtInstant(e.ts, localTz, true).slice(0, 10);
      return dest + ' · ' + fmtInstant(e.ts, localTz, !same) + ' ' + tzShort(localTz) + ' your time';
    }
    return fmtDate(e.date);
  }

  // ---------- Helpers over the model ----------
  const stopOf = (m, it) => it && it.stop_seq != null ? (m.trip.stops || []).find(s => s.seq === it.stop_seq) : null;
  const destTz = (m, it) => { const s = stopOf(m, it) || (m.trip.stops || [])[0]; return (s && s.tz) || null; };
  const party = t => (t.adults != null && t.children != null) ? { adults: t.adults, children: t.children } : null;
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const short = s => String(s || '').replace(/\s*\(.*$/, '');
  const itemLink = it => ({ label: 'Open in wallet', route: '#/documents/item/' + encodeURIComponent(it.id) });
  function openingInstant(m, it) {
    const tz = destTz(m, it);
    if (!it.opens_on) return null;
    return it.opens_time && tz ? { date: it.opens_on, ts: zonedToUtc(it.opens_on, it.opens_time, tz), tz } : { date: it.opens_on, ts: null, tz };
  }
  function ruleDate(it) { return it.opens_before && it.event_date ? subtractInterval(it.event_date, it.opens_before) : null; }

  // ---------- Booking calendar (every dated thing, chronological) ----------
  function buildTimeline(m) {
    const t = m.trip, out = [];
    (m.items || []).forEach(it => {
      if (it.kind === 'ticket' && it.opens_on && !it.done) {
        const o = openingInstant(m, it), rd = ruleDate(it);
        out.push({ id: 'win:' + it.id, itemId: it.id, type: 'window', date: o.date, ts: o.ts, tz: o.tz, title: 'Booking opens · ' + it.title,
          provenance: it.rule === 'reco' ? 'estimate' : 'vendor_rule', conflict: !!(rd && rd !== it.opens_on), ruleDate: rd, url: it.url || null });
      }
      if (it.kind === 'ticket' && it.event_date) out.push({ id: 'evt:' + it.id, itemId: it.id, type: 'activity', date: it.event_date, title: it.title, provenance: it.done ? 'verified' : 'planned', done: !!it.done });
      if (it.cancel_by) out.push({ id: 'cxl:' + it.id, itemId: it.id, type: 'cancel', date: it.cancel_by, title: 'Free cancellation ends · ' + it.title, provenance: it.verified_at ? 'verified' : 'recorded' });
      if (it.kind === 'document' && !it.done && it.due_on) out.push({ id: 'doc:' + it.id, itemId: it.id, type: 'document', date: it.due_on, title: it.title, provenance: 'estimate' });
      if (it.kind === 'flight' && it.event_date) out.push({ id: 'flt:' + it.id, itemId: it.id, type: 'flight', date: it.event_date, title: it.title, provenance: it.done ? 'verified' : 'planned', done: !!it.done });
      if (it.kind === 'hotel' && it.event_date) {
        const s = stopOf(m, it);
        out.push({ id: 'cin:' + it.id, itemId: it.id, type: 'checkin', date: it.event_date, title: 'Check in · ' + it.title, provenance: it.done ? 'verified' : 'planned', done: !!it.done });
        if (s && s.depart) out.push({ id: 'cout:' + it.id, itemId: it.id, type: 'checkout', date: s.depart, title: 'Check out · ' + it.title, provenance: it.done ? 'verified' : 'planned', done: !!it.done });
      }
    });
    if (t && t.start) out.push({ id: 'trip:start', type: 'trip', date: t.start, title: t.name + ' begins', provenance: 'verified' });
    return out.sort((a, b) => (dayNum(a.date) - dayNum(b.date)) || ((a.ts || 0) - (b.ts || 0)));
  }

  // ---------- Insights ----------
  const PRI = { urgent: 0, upcoming: 1, confirmed: 2 };
  function buildInsights(m) {
    const t = m.trip, today = m.todayIso, items = m.items || [], out = [];
    const completed = t.status === 'completed';
    const add = x => out.push(x);
    const fam = party(t);

    // 1 + 3. Hotels: occupancy vs family, review flags, cancellation deadlines, missing party
    items.filter(i => i.kind === 'hotel').forEach(h => {
      const s = stopOf(m, h), city = s ? s.name : short(h.title);
      const cx = h.cancel_by ? daysBetween(today, h.cancel_by) : null;
      const recorded = h.adults != null && h.children != null;
      const mismatch = !completed && fam && recorded && (h.adults !== fam.adults || h.children !== fam.children);
      if (mismatch) {
        add({ id: 'occ:' + h.id, priority: 'urgent', category: 'booking', provenance: 'check', itemId: h.id,
          title: `${city} hotel is booked for ${plural(h.adults, 'adult')}, ${h.children === 1 ? '1 child' : h.children + ' children'}`,
          text: `Your family is ${plural(fam.adults, 'adult')} and ${fam.children === 1 ? '1 child' : fam.children + ' children'}; the ${short(h.title)} booking lists only ${plural(h.adults + h.children, 'guest')}.`,
          why: 'Japanese hotels register every guest — unlisted children can be refused at check-in or charged on arrival.' +
            (cx != null && cx >= 0 ? ` Free cancellation runs until ${fmtDate(h.cancel_by)}, so there is time to fix it.` : cx != null ? ' Free cancellation has already ended.' : ''),
          date: h.cancel_by ? { date: h.cancel_by, label: 'Free cancellation until' } : null,
          action: { label: 'Review booking', route: '#/trip/' + t.id + '/' + t.tabs.hotels }, link: itemLink(h),
          remind: h.cancel_by && cx >= 0 ? { kind: 'cancellation', itemId: h.id, date: h.cancel_by, title: `Free cancellation ends — ${short(h.title)}` } : null });
      } else if (!completed && h.done && h.needs_review) {
        add({ id: 'rev:' + h.id, priority: 'urgent', category: 'booking', provenance: 'verified', itemId: h.id,
          title: s ? `Review the ${city} hotel booking` : `Review the ${short(h.title)} booking`, text: h.detail || 'This booking was flagged for review.', why: 'It was flagged as not matching your plans.',
          date: h.cancel_by ? { date: h.cancel_by, label: 'Free cancellation until' } : null,
          action: { label: 'Review booking', route: '#/trip/' + t.id + '/' + t.tabs.hotels }, link: itemLink(h) });
      } else if (!completed && h.cancel_by && cx >= 0 && cx <= 30) {
        add({ id: 'cxl:' + h.id, priority: cx <= 7 ? 'urgent' : 'upcoming', category: 'cancellation', provenance: h.verified_at ? 'verified' : 'check', itemId: h.id,
          title: `Free cancellation for ${short(h.title)} ends ${cx === 0 ? 'today' : 'in ' + plural(cx, 'day')}`,
          text: 'After this date the booking can no longer be cancelled for free.', why: 'Last chance to change plans without paying.',
          date: { date: h.cancel_by, label: 'Free cancellation until' }, action: { label: 'Open booking', route: itemLink(h).route }, link: itemLink(h),
          remind: { kind: 'cancellation', itemId: h.id, date: h.cancel_by, title: `Free cancellation ends — ${short(h.title)}` } });
      }
      if (!completed && h.done && !recorded && m.synced) add({ id: 'pty:' + h.id, priority: 'upcoming', category: 'missing', provenance: 'check', itemId: h.id,
        title: `Record the party size on the ${city} hotel`, text: 'ATLAS doesn’t know how many adults and children this booking covers, so it can’t check occupancy.',
        why: 'Occupancy mismatches are the most common cause of check-in problems with children.', action: { label: 'Open booking', route: itemLink(h).route }, link: itemLink(h) });
      if (!completed && !h.done) add({ id: 'nb:' + h.id, priority: 'urgent', category: 'booking', provenance: 'check', itemId: h.id,
        title: `Book the ${city} hotel`, text: `${short(h.title)} isn’t booked yet.`, why: 'Family rooms are the scarce resource.', action: { label: 'Open hotels', route: '#/trip/' + t.id + '/' + t.tabs.hotels }, link: itemLink(h) });
    });

    // Hotel coverage: every night between start and end must fall inside a booked stay.
    if (!completed && t.start && t.end) {
      const stays = items.filter(i => i.kind === 'hotel' && i.done && i.event_date).map(h => { const s = stopOf(m, h); return s ? [dayNum(h.event_date), dayNum(s.depart)] : null; }).filter(Boolean);
      const missing = [];
      for (let n = dayNum(t.start); n < dayNum(t.end); n++) if (!stays.some(([a, b]) => n >= a && n < b)) missing.push(isoOf(n));
      if (stays.length) {
        if (missing.length) add({ id: 'nights', priority: 'urgent', category: 'itinerary', provenance: 'check',
          title: `${plural(missing.length, 'night')} without a hotel`, text: 'No booked hotel covers: ' + missing.map(d => fmtDate(d, { year: undefined })).join(', ') + '.',
          why: 'Every night of the trip needs somewhere to sleep.', date: { date: missing[0], label: 'First uncovered night' }, action: { label: 'Open hotels', route: '#/trip/' + t.id + '/' + t.tabs.hotels } });
        else add({ id: 'nights', priority: 'confirmed', category: 'booking', provenance: 'verified',
          title: `All ${plural(dayNum(t.end) - dayNum(t.start), 'night')} have a booked hotel`, text: (t.stops || []).filter(s => s.hotel).map(s => s.name + ' — ' + s.hotel).join(' · '),
          why: 'Checked night by night against the booked stays.', action: { label: 'Open hotels', route: '#/trip/' + t.id + '/' + t.tabs.hotels } });
      }
    }

    // Flights booked for the whole family
    const flights = items.filter(i => i.kind === 'flight');
    if (flights.length) {
      const ok = flights.every(f => f.done), size = fam ? fam.adults + fam.children : null;
      const short_ = flights.filter(f => f.done && f.adults != null && size != null && f.adults + f.children !== size);
      if (!completed && short_.length) add({ id: 'flt-party', priority: 'urgent', category: 'booking', provenance: 'check',
        title: 'A flight booking doesn’t cover the whole family', text: short_.map(f => short(f.title)).join(', '), why: 'Every traveller needs a ticket.', action: { label: 'Open flights', route: '#/trip/' + t.id + '/' + t.tabs.flights } });
      else if (ok) add({ id: 'flights', priority: 'confirmed', category: 'booking', provenance: flights.every(f => f.reference) ? 'verified' : 'recorded',
        title: `${plural(flights.length, 'flight')} booked${size ? ' for all ' + size : ''}`, text: flights.map(f => short(f.title)).join(' · '),
        why: flights.every(f => f.reference) ? 'Each has a confirmation reference in the wallet.' : 'Add the booking references to the wallet so they’re to hand at the airport.',
        action: { label: 'Open flights', route: '#/trip/' + t.id + '/' + t.tabs.flights },
        remind: !completed ? { kind: 'flight', itemId: flights[0].id, date: flights[0].event_date, title: 'Flight day — ' + short(flights[0].title) } : null });
    }

    // 2. Booking windows (+ rule consistency, + windows that open too late)
    items.filter(i => i.kind === 'ticket' && !i.done && i.opens_on && !completed).forEach(w => {
      const o = openingInstant(m, w), d = daysBetween(today, w.opens_on), rd = ruleDate(w);
      const est = w.rule === 'reco', s = stopOf(m, w), link = itemLink(w);
      const when = whenText(o, m.localTz);
      const remind = { kind: 'booking_window', itemId: w.id, date: w.opens_on, ts: o.ts, tz: o.tz, title: 'Booking opens — ' + w.title };
      if (rd && rd !== w.opens_on) {
        const early = dayNum(rd) < dayNum(w.opens_on) ? rd : w.opens_on;
        const eo = w.opens_time && o.tz ? { date: early, ts: zonedToUtc(early, w.opens_time, o.tz), tz: o.tz } : { date: early };
        add({ id: 'rule:' + w.id, priority: daysBetween(today, early) <= 30 ? 'urgent' : 'upcoming', category: 'conflict', provenance: 'check', itemId: w.id,
          title: `Check the release date for ${short(w.title)}`,
          text: `ATLAS has ${fmtDate(w.opens_on)}, but the rule stored with it (“opens ${w.opens_before.replace('mons', 'months').replace('mon', 'month')} before” the ${fmtDate(w.event_date, { weekday: undefined, year: undefined })} visit) gives ${fmtDate(rd)}.`,
          why: `If the earlier date is right you could miss the release. Be ready from ${whenText(eo, m.localTz)} and confirm on the official site.`,
          date: { date: early, ts: eo.ts, tz: eo.tz, label: 'Be ready from' }, action: w.url ? { label: 'Check official site', href: w.url } : { label: 'Open booking', route: link.route }, link,
          remind: Object.assign({}, remind, { date: early, ts: eo.ts }) });
        return;
      }
      if (w.event_date && dayNum(w.opens_on) > dayNum(w.event_date)) {
        add({ id: 'late:' + w.id, priority: 'urgent', category: 'conflict', provenance: 'check', itemId: w.id, title: `${short(w.title)}: booking opens after the visit`,
          text: `Opens ${fmtDate(w.opens_on)}, but the visit is ${fmtDate(w.event_date)}.`, why: 'One of the two dates is wrong.', action: { label: 'Open booking', route: link.route }, link });
        return;
      }
      if (d <= 0) add({ id: 'open:' + w.id, priority: 'urgent', category: 'window', provenance: est ? 'estimate' : 'vendor_rule', itemId: w.id,
        title: `Book ${short(w.title)} — window is open`, text: `${est ? 'ATLAS suggested booking from' : 'Bookings opened'} ${fmtDate(w.opens_on)}${w.event_date ? ' for ' + fmtDate(w.event_date, { year: undefined }) + (s ? ' in ' + s.name : '') : ''}.`,
          why: est ? 'Capacity is limited and the date can’t move.' : 'Popular slots sell out once a window opens.',
          date: { date: w.opens_on, label: est ? 'Suggested from' : 'Opened' }, action: w.url ? { label: 'Book now', href: w.url } : { label: 'Open booking', route: link.route }, link,
          tick: { id: w.id, label: 'Mark booked' } });
      else add({ id: 'win:' + w.id, priority: 'upcoming', category: 'window', provenance: est ? 'estimate' : 'vendor_rule', itemId: w.id,
        title: est ? `${short(w.title)} — ATLAS suggests booking ${d === 1 ? 'tomorrow' : 'in ' + plural(d, 'day')}` : `${short(w.title)} — booking opens ${d === 1 ? 'tomorrow' : 'in ' + plural(d, 'day')}`,
        text: `${est ? 'Recommended' : 'Opens'} ${when}${w.event_date ? ' · for ' + fmtDate(w.event_date, { year: undefined }) + (s ? ' in ' + s.name : '') : ''}.`,
        why: est ? 'No fixed release date — this is ATLAS’s recommended buffer, not a vendor rule.' : 'Released on a fixed schedule; popular dates can go the same day.',
        date: { date: w.opens_on, ts: o.ts, tz: o.tz, label: est ? 'Book from (estimate)' : 'Opens' },
        action: { label: 'Remind me', remind: true }, link, remind });
    });

    // 4. Documents (passport auto-check comes in as an item with auto:true)
    items.filter(i => i.kind === 'document' && !completed).forEach(doc => {
      if (doc.auto) {
        add(doc.done
          ? { id: 'pp:' + doc.id, priority: 'confirmed', category: 'document', provenance: 'check', itemId: doc.id, title: 'Passports valid for this trip', text: doc.detail, why: 'Checked automatically against the saved passports.', action: { label: 'View passports', route: '#/documents' } }
          : { id: 'pp:' + doc.id, priority: 'urgent', category: 'document', provenance: 'check', itemId: doc.id, title: 'A passport needs renewing before this trip', text: doc.detail, why: 'Entry can be refused if a passport is too close to expiry.', action: { label: 'Review passports', route: '#/documents' } });
        return;
      }
      if (doc.done) { add({ id: 'doc:' + doc.id, priority: 'confirmed', category: 'document', provenance: 'verified', itemId: doc.id, title: doc.title + ' — done', text: doc.detail, why: 'Marked done.', action: { label: 'Open documents', route: '#/documents' } }); return; }
      const d = doc.due_on ? daysBetween(today, doc.due_on) : null;
      const blockers = (m.deps && m.deps[doc.id] || []).map(id => items.find(x => x.id === id)).filter(x => x && !x.done);
      add({ id: 'doc:' + doc.id, priority: d != null && d <= 14 ? 'urgent' : 'upcoming', category: 'document', provenance: 'estimate', itemId: doc.id,
        title: d == null ? doc.title : d < 0 ? `${doc.title} — overdue` : `${doc.title} — due in ${plural(d, 'day')}`, text: doc.detail,
        why: blockers.length ? 'Do first: ' + blockers.map(b => b.title).join(', ') + '.' : 'Needed before you can travel.',
        date: doc.due_on ? { date: doc.due_on, label: 'Target date' } : null, action: { label: 'Open checklist', route: '#/documents' },
        tick: { id: doc.id, label: 'Mark done' }, remind: doc.due_on ? { kind: 'document', itemId: doc.id, date: doc.due_on, title: doc.title } : null });
    });
    if (!completed && t.passportMonths != null && !items.some(i => i.kind === 'document' && /passport/i.test(i.id)) && !m.travellers)
      add({ id: 'pp-missing', priority: 'upcoming', category: 'missing', provenance: 'check', title: 'Passports can’t be checked on this device', text: 'Passport details are only available on synced devices.', why: 'International trips need passports valid for the whole stay.', action: { label: 'Open documents', route: '#/documents' } });

    // 5 + 6. Itinerary completeness and scheduling conflicts
    if (!completed && t.start && t.end) {
      const planned = new Set((m.days || []).map(d => d.date));
      const gaps = [];
      for (let n = dayNum(t.start); n <= dayNum(t.end); n++) if (!planned.has(isoOf(n))) gaps.push(isoOf(n));
      if (m.days && m.days.length) {
        if (gaps.length) add({ id: 'gaps', priority: 'upcoming', category: 'itinerary', provenance: 'check', title: `${plural(gaps.length, 'day')} with no plan`,
          text: gaps.map(d => fmtDate(d, { year: undefined })).join(', '), why: 'Each day of the trip should have a plan, even a rest day.', date: { date: gaps[0], label: 'First gap' }, action: { label: 'Open itinerary', route: '#/trip/' + t.id + '/' + t.tabs.itinerary } });
        else add({ id: 'gaps', priority: 'confirmed', category: 'itinerary', provenance: 'check', title: `Itinerary covers all ${plural(dayNum(t.end) - dayNum(t.start) + 1, 'day')}`, text: `${fmtDate(t.start, { year: undefined })} – ${fmtDate(t.end)}`, why: 'Every date has a day plan.', action: { label: 'Open itinerary', route: '#/trip/' + t.id + '/' + t.tabs.itinerary } });
      }
      items.filter(i => i.kind === 'ticket' && i.event_date).forEach(a => {
        const s = stopOf(m, a), n = dayNum(a.event_date);
        if (n < dayNum(t.start) || n > dayNum(t.end)) add({ id: 'out:' + a.id, priority: 'urgent', category: 'conflict', provenance: 'check', itemId: a.id,
          title: `${short(a.title)} is outside the trip dates`, text: `Planned for ${fmtDate(a.event_date)}; the trip runs ${fmtDate(t.start, { year: undefined })} – ${fmtDate(t.end)}.`, why: 'It can’t happen on that date.', action: { label: 'Open booking', route: itemLink(a).route }, link: itemLink(a) });
        else if (s && (n < dayNum(s.arrive) || n > dayNum(s.depart))) add({ id: 'loc:' + a.id, priority: 'urgent', category: 'conflict', provenance: 'check', itemId: a.id,
          title: `${short(a.title)} isn’t while you’re in ${s.name}`, text: `Planned for ${fmtDate(a.event_date)}; you’re in ${s.name} ${fmtDate(s.arrive, { year: undefined })} – ${fmtDate(s.depart, { year: undefined })}.`,
          why: 'The activity and the stay don’t line up.', action: { label: 'Open itinerary', route: '#/trip/' + t.id + '/' + t.tabs.itinerary }, link: itemLink(a) });
      });
      // Two windows that need booking on the same day
      const byDay = {};
      items.filter(i => i.kind === 'ticket' && !i.done && i.opens_on && daysBetween(today, i.opens_on) > 0).forEach(w => { (byDay[w.opens_on] = byDay[w.opens_on] || []).push(w); });
      Object.keys(byDay).filter(d => byDay[d].length > 1).forEach(d => add({ id: 'clash:' + d, priority: 'upcoming', category: 'conflict', provenance: 'check',
        title: `${plural(byDay[d].length, 'booking')} open on ${fmtDate(d, { year: undefined })}`, text: byDay[d].map(w => short(w.title)).join(' · '), why: 'Plan who books what so nothing is missed.', date: { date: d, label: 'Same day' }, action: { label: 'Open bookings', route: '#/trip/' + t.id + '/' + t.tabs.bookings } }));
    }

    // 7. Booked but no reference in the wallet
    if (!completed) {
      const noRef = items.filter(i => (i.kind === 'flight' || i.kind === 'hotel') && i.done && !i.reference);
      if (noRef.length && m.synced) add({ id: 'refs', priority: 'upcoming', category: 'missing', provenance: 'check', title: `${plural(noRef.length, 'booking')} without a reference`,
        text: noRef.map(i => short(i.title)).join(' · '), why: 'You’ll be asked for them at check-in and the airport.', action: { label: 'Open wallet', route: '#/documents' } });
    }

    if (completed) add({ id: 'done', priority: 'confirmed', category: 'booking', provenance: 'verified', title: 'Trip complete', text: `${t.name} · ${fmtDate(t.start, { year: undefined })} – ${fmtDate(t.end)}`, why: 'Everything for this trip is in the past.', action: { label: 'Open recap', route: '#/trip/' + t.id } });

    // Within a priority: problems with what is already booked (wrong occupancy, uncovered
    // nights, unbookable activity, passport renewal) first, then by date.
    const SEV = { booking: 0, document: 1, conflict: 1, window: 2, cancellation: 2, itinerary: 2, missing: 3 };
    const sev = x => (x.priority === 'urgent' && /^(occ|nb|nights|pp|flt-party|out|loc|late)/.test(x.id)) ? -1 : (SEV[x.category] != null ? SEV[x.category] : 2);
    const when = x => x.date ? (x.date.ts != null ? x.date.ts / DAY : dayNum(x.date.date)) : 1e9;
    return out.sort((a, b) => (PRI[a.priority] - PRI[b.priority]) || (sev(a) - sev(b)) || (when(a) - when(b)));
  }

  // ---------- Reminder presets ----------
  function reminderPresets(r, localTz) {
    if (!r || !r.date) return [];
    const at = (iso, time) => zonedToUtc(iso, time, localTz || 'UTC');
    const base = r.ts != null ? r.ts : at(r.date, '09:00');
    const P = [];
    if (r.kind === 'booking_window') {
      P.push({ key: 'at', label: r.ts != null ? 'When it opens' : 'Morning it opens (09:00)', at: base });
      P.push({ key: '1h', label: '1 hour before', at: (r.ts != null ? r.ts : at(r.date, '09:00')) - 3600000, hide: r.ts == null });
      P.push({ key: '1d', label: '1 day before', at: at(subtractInterval(r.date, '1 day'), '09:00') });
    } else if (r.kind === 'cancellation') {
      P.push({ key: '7d', label: '1 week before', at: at(subtractInterval(r.date, '7 days'), '09:00') });
      P.push({ key: '1d', label: '1 day before', at: at(subtractInterval(r.date, '1 day'), '09:00') });
    } else if (r.kind === 'document') {
      P.push({ key: '14d', label: '2 weeks before', at: at(subtractInterval(r.date, '14 days'), '09:00') });
      P.push({ key: '3d', label: '3 days before', at: at(subtractInterval(r.date, '3 days'), '09:00') });
    } else {
      P.push({ key: '1d', label: '1 day before', at: at(subtractInterval(r.date, '1 day'), '09:00') });
      P.push({ key: '7d', label: '1 week before', at: at(subtractInterval(r.date, '7 days'), '09:00') });
    }
    return P.filter(p => !p.hide);
  }

  // ---------- Ask ATLAS (deterministic, grounded answers) ----------
  const INTENTS = [
    { id: 'ready', label: 'Is my trip ready?', re: /ready|prepared|on track/i },
    { id: 'next', label: 'What should I book next?', re: /book next|next.*book|what.*book|buy/i },
    { id: 'deadlines', label: 'Which deadlines are approaching?', re: /deadline|due|cancel|expire/i },
    { id: 'gaps', label: 'Are there gaps in my itinerary?', re: /gap|missing|empty|plan/i },
    { id: 'week', label: 'What needs attention this week?', re: /week|soon|urgent|attention|today/i }
  ];
  const detectIntent = q => { const x = INTENTS.find(i => i.re.test(q || '')); return x ? x.id : null; };
  function answer(intent, m, insights) {
    insights = insights || buildInsights(m);
    const today = m.todayIso, items = m.items || [], t = m.trip, pts = [], missing = [];
    if (!m.synced) missing.push('This device isn’t synced, so passports, party sizes and booking references aren’t available to check.');
    if (t.status === 'completed') return { headline: `${t.name} is complete — there’s nothing left to prepare.`, points: [], missing: [] };
    const tickets = items.filter(i => i.kind === 'ticket');
    if (intent === 'ready') {
      const urgent = insights.filter(i => i.priority === 'urgent'), conf = insights.filter(i => i.priority === 'confirmed');
      const notBooked = tickets.filter(i => !i.done);
      urgent.forEach(i => pts.push({ text: i.title, provenance: i.provenance }));
      conf.forEach(i => pts.push({ text: i.title, provenance: i.provenance, ok: true }));
      if (notBooked.length) pts.push({ text: `${notBooked.length} ${notBooked.length === 1 ? 'ticket or reservation' : 'tickets or reservations'} not booked yet`, provenance: 'verified' });
      return { headline: urgent.length ? `Not yet — ${plural(urgent.length, 'thing')} need${urgent.length === 1 ? 's' : ''} attention first.` : notBooked.length ? 'The essentials are in place; some tickets are still to book.' : 'Yes — everything ATLAS tracks is booked and checked.', points: pts, missing };
    }
    if (intent === 'next') {
      const open = tickets.filter(i => !i.done && i.opens_on && daysBetween(today, i.opens_on) <= 0);
      const soon = tickets.filter(i => !i.done && i.opens_on && daysBetween(today, i.opens_on) > 0).sort((a, b) => dayNum(a.opens_on) - dayNum(b.opens_on));
      open.forEach(i => pts.push({ text: `${short(i.title)} — booking is open now`, provenance: i.rule === 'reco' ? 'estimate' : 'vendor_rule' }));
      soon.slice(0, 3).forEach(i => { const o = openingInstant(m, i); pts.push({ text: `${short(i.title)} — opens ${whenText(o, m.localTz)}`, provenance: i.rule === 'reco' ? 'estimate' : 'vendor_rule' }); });
      if (!tickets.length) missing.push('No tickets or reservations are recorded for this trip.');
      return { headline: open.length ? `Book ${short(open[0].title)} first — its window is already open.` : soon.length ? `Next up: ${short(soon[0].title)}.` : 'Nothing is waiting to be booked.', points: pts, missing };
    }
    if (intent === 'deadlines') {
      const tl = buildTimeline(m).filter(e => ['window', 'cancel', 'document'].indexOf(e.type) >= 0 && daysBetween(today, e.date) >= 0 && daysBetween(today, e.date) <= 60);
      tl.forEach(e => pts.push({ text: `${whenText(e, m.localTz)} — ${e.title}`, provenance: e.provenance }));
      return { headline: tl.length ? `${plural(tl.length, 'deadline')} in the next 60 days.` : 'No deadlines in the next 60 days.', points: pts, missing };
    }
    if (intent === 'gaps') {
      insights.filter(i => ['itinerary', 'missing', 'conflict'].indexOf(i.category) >= 0).forEach(i => pts.push({ text: i.title + (i.priority === 'confirmed' ? '' : ' — ' + i.text), provenance: i.provenance, ok: i.priority === 'confirmed' }));
      if (!m.days || !m.days.length) missing.push('The day-by-day itinerary for this trip isn’t loaded.');
      const gaps = pts.filter(p => !p.ok);
      return { headline: gaps.length ? `${plural(gaps.length, 'issue')} found in the plan or booking data.` : 'No gaps found in the itinerary or bookings.', points: pts, missing };
    }
    if (intent === 'week') {
      const inWeek = insights.filter(i => i.priority !== 'confirmed' && ((i.date && daysBetween(today, i.date.date) <= 7) || /open/.test(i.id)));
      inWeek.forEach(i => pts.push({ text: i.title, provenance: i.provenance }));
      return { headline: inWeek.length ? `${plural(inWeek.length, 'thing')} for this week.` : 'Nothing is due this week.', points: pts, missing };
    }
    return { headline: 'I can only answer from your ATLAS data — try one of the suggested questions.', points: [], missing: [] };
  }

  return { version: 1, dayNum, isoOf, daysBetween, parseInterval, subtractInterval, zonedToUtc, tzShort, fmtDate, fmtInstant, whenText,
    buildTimeline, buildInsights, reminderPresets, answer, detectIntent, INTENTS };
});
