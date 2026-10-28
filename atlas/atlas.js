/* ATLAS — family travel command centre (app layer).
 *
 * Loaded with `defer` after the inline script in index.html, so it can use the
 * existing globals: TRIP_DASHBOARDS, JP_BOOKING_WINDOWS, JP_HOTEL_TRACKER,
 * show(), showTab(), dayCardDate(), slug(), windowKey(), hotelKey(),
 * refreshJapanStatus(), syncTabsH().
 *
 * Data: the static trip data below mirrors the `atlas` schema in Supabase
 * (project "Studio RYST", ap-south-1). When the signed-in family member can
 * reach Supabase, booking/document status comes from the database and syncs
 * across devices; otherwise ATLAS runs on the static copy plus per-browser
 * ticks, exactly like before.
 */
(function () {
  'use strict';

  // ---------- Config ----------
  const SB_URL = 'https://rtkshjedyaqwwmfcaufk.supabase.co';
  // Publishable key: designed to ship in client code; row-level security in the
  // `atlas` schema only lets the two family Google accounts read or tick items.
  const SB_KEY = 'sb_publishable_h8CLgkQC7y9n-OorHF0ViQ_HG_2X3M1';
  const SB_SESSION = 'atlas_sb_session';
  const FOCUS_KEY = 'atlas_focus';
  const NAMES = { 'mailyuvanesh@gmail.com': 'Yuvan', 'ramyaayuvan@gmail.com': 'Ramyaa' };
  const HOME = { name: 'Chennai', lat: 13.0827, lng: 80.2707 };
  const RAD = Math.PI / 180;
  const REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- Static trip data (mirrors atlas.trips / atlas.trip_stops) ----------
  const TRIPS = [
    { id: 'japan', dash: 'dashboard-japan', short: 'Japan', name: 'Japan', country: 'Japan', flag: '🇯🇵',
      start: '2027-01-06', end: '2027-01-21', image: 'img/japan',
      tabs: { itinerary: 'jit', bookings: 'jbk', hotels: 'jht', flights: 'jfl' },
      passportMonths: 6,   // site rule for Japan: 6+ months beyond the return date
      outbound: 'Chennai → Kansai · Thai Airways via Bangkok', inbound: 'Haneda → Chennai · Air India via Delhi',
      stops: [
        { name: 'Osaka', lat: 34.6687, lng: 135.5013, arrive: '2027-01-06', depart: '2027-01-10', hotel: 'Namba Oriental Hotel', hotelId: 'h:osaka', travel_in: 'Thai Airways via Bangkok → Kansai (KIX)', image: 'img/osaka' },
        { name: 'Kyoto', lat: 35.0094, lng: 135.7756, arrive: '2027-01-10', depart: '2027-01-13', hotel: 'Minn Gion Sanjo', hotelId: 'h:kyoto', travel_in: 'Kintetsu/JR via Nara', image: 'img/kyoto' },
        { name: 'Tokyo', lat: 35.6938, lng: 139.7034, arrive: '2027-01-13', depart: '2027-01-21', hotel: 'Hotel Gracery Shinjuku', hotelId: 'h:tokyo', travel_in: 'Shinkansen via Yokohama', image: 'img/tokyo' }
      ] },
    { id: 'kerala', dash: 'dashboard-bekal', short: 'Bekal', name: 'Bekal & Mangaluru', country: 'India', flag: '🇮🇳',
      start: '2026-09-11', end: '2026-09-14', image: 'img/bekal',
      tabs: { itinerary: 'kit', bookings: 'kht', hotels: 'kht', flights: 'kfl' },
      passportMonths: null, // domestic — no passport needed
      outbound: 'Chennai → Mangaluru · IndiGo', inbound: 'Mangaluru → Chennai · IndiGo',
      stops: [
        { name: 'Bekal', lat: 12.3929, lng: 75.0330, arrive: '2026-09-11', depart: '2026-09-13', hotel: 'Taj Bekal Resort & Spa', travel_in: 'IndiGo Chennai → Mangaluru', image: 'img/bekal' },
        { name: 'Mangaluru', lat: 12.9141, lng: 74.8560, arrive: '2026-09-13', depart: '2026-09-14', hotel: 'Vivanta Mangalore Oldport Road', travel_in: 'By road (~1.5–2h)' }
      ] },
    { id: 'ireland', dash: 'dashboard', short: 'Ireland & UK', name: 'Ireland · Scotland · London', country: 'Ireland & United Kingdom', flag: '🇮🇪',
      start: '2026-05-18', end: '2026-06-01', image: 'img/ireland',
      tabs: { itinerary: 'it', bookings: 'bk', hotels: 'ht', flights: 'fl' },
      passportMonths: 0,   // Ireland & UK: valid for the whole stay
      outbound: 'Chennai → Dublin · BA via Heathrow', inbound: 'Heathrow → Chennai · British Airways',
      stops: [
        { name: 'Dublin', lat: 53.3498, lng: -6.2603, arrive: '2026-05-18', depart: '2026-05-20', hotel: 'Premier Inn Dublin City Centre', travel_in: 'BA via London Heathrow', image: 'img/ireland' },
        { name: 'Cork', lat: 51.8985, lng: -8.4756, arrive: '2026-05-20', depart: '2026-05-22', hotel: 'Premier Inn Cork City Centre', travel_in: 'Hire car' },
        { name: 'Dingle', lat: 52.1409, lng: -10.2689, arrive: '2026-05-22', depart: '2026-05-24', hotel: 'The Plough B&B', travel_in: 'Hire car' },
        { name: 'Belfast', lat: 54.5973, lng: -5.9301, arrive: '2026-05-24', depart: '2026-05-26', hotel: 'Premier Inn Belfast Titanic Quarter', travel_in: 'Hire car' },
        { name: 'Edinburgh', lat: 55.9533, lng: -3.1883, arrive: '2026-05-26', depart: '2026-05-27', hotel: 'Novotel Edinburgh Centre', travel_in: 'easyJet Belfast → Edinburgh' },
        { name: 'London', lat: 51.5072, lng: -0.1276, arrive: '2026-05-28', depart: '2026-06-01', hotel: 'Family home', travel_in: 'Caledonian Sleeper' }
      ] }
  ];
  // Items that exist only here (everything else is derived from JP_* in index.html).
  const JP_FLIGHTS = [
    { id: 'f:outbound', kind: 'flight', title: 'Chennai → Osaka (Kansai)', detail: 'Thai Airways via Bangkok · 6 Jan 01:00 → KIX 15:45 · all 4 travellers', icon: '✈️', event_date: '2027-01-06', done: true },
    { id: 'f:return', kind: 'flight', title: 'Tokyo (Haneda) → Chennai', detail: 'Air India via Delhi · 21 Jan 10:30 → MAA 22 Jan 00:30 · all 4 travellers', icon: '✈️', event_date: '2027-01-21', done: true }
  ];
  const JP_DOCS = [
    { id: 'misc:visa', kind: 'document', title: 'Japan visa — all 4 passports', detail: 'Apply via VFS Global by ~1 Dec 2026 for a comfortable buffer: processing is 4–7 working days, but appointment + document prep + return realistically runs 2–3 weeks.', icon: '📄', due_on: '2026-12-01' },
    { id: 'doc:passport-validity', kind: 'document', title: 'Passport validity check', detail: 'Each passport needs 6+ months of validity beyond 21 Jan 2027 — check before the visa application.', icon: '🛂', due_on: '2026-12-01' }
  ];
  // Dependencies: an item can't sensibly be done before these.
  const DEPS = { 'misc:visa': ['doc:passport-validity'] };
  const CREDITS = [
    ['Japan — Mount Fuji from Arakurayama', 'Ximonic (Simo Räsänen)', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:View_towards_Mount_Fuji_from_Arakurayama_Sengen_Park_in_Fujiyoshida,_Yamanashi,_Japan,_2024_May_-_2.jpg'],
    ['Osaka — Dotonbori', 'DXR', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Dotonbori_Neon_Sign,_Osaka_20190415_1.jpg'],
    ['Kyoto — Yasaka-dori', 'Basile Morin', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Yasaka-dori_early_morning_with_street_lanterns_and_the_Tower_of_Yasaka_(Hokan-ji_Temple),_Kyoto,_Japan.jpg'],
    ['Tokyo — Tokyo Tower', 'David Kernan', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Tokyo_Tower,_Minato_City.jpg'],
    ['Bekal Fort', 'Vijayanrajapuram', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Bekal_fort_kasaragod_07.jpg'],
    ['Cliffs of Moher', 'Berthold Werner', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Ireland_Cliffs_of_Moher_BW_2025-09-11_13-47-21.jpg']
  ];

  // ---------- Helpers ----------
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const decode = s => String(s || '').replace(/&amp;/g, '&').replace(/&rsquo;/g, '’');
  const parse = s => { if (!s) return null; const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const days = s => { const d = parse(s); return d ? Math.round((d - today()) / 86400000) : null; };
  const fmt = (s, o) => { const d = typeof s === 'string' ? parse(s) : s; return d ? d.toLocaleDateString('en-GB', o || { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
  const fmtShort = s => fmt(s, { day: 'numeric', month: 'short' });
  const plural = (n, w, pl) => n + ' ' + (n === 1 ? w : (pl || w + 's'));
  const nights = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  function range(a, b) {
    const A = parse(a), B = parse(b);
    if (!A || !B) return '';
    if (A.getMonth() === B.getMonth() && A.getFullYear() === B.getFullYear()) return A.getDate() + '–' + fmt(B, { day: 'numeric', month: 'short' });
    return fmtShort(a) + ' – ' + fmtShort(b);
  }
  function longRange(t) {
    const A = parse(t.start), B = parse(t.end);
    const sameMonth = A.getMonth() === B.getMonth();
    return (sameMonth ? A.getDate() : fmt(A, { day: 'numeric', month: 'long' })) + ' – ' + fmt(B, { day: 'numeric', month: 'long', year: 'numeric' });
  }
  const tripDays = t => nights(t.start, t.end) + 1;
  const ymdOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const ICON = {
    plane: '<path d="M2 16l20-7-20-7 4 7-4 7z" transform="rotate(-20 12 12)"/>',
    bed: '<path d="M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3M7 11.5a1.5 1.5 0 1 0 0-.01"/>',
    ticket: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
    doc: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'
  };
  const svg = (k, cls) => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${ICON[k]}</svg>`;
  function photo(base, initial, sizes) {
    if (!base) return `<div class="ax-photo noimg" data-initial="${esc(initial)}"></div>`;
    base = String(base).replace(/(-sm)?\.jpe?g$/, '');
    return `<div class="ax-photo" data-initial="${esc(initial)}"><img class="ld" src="${esc(base)}-sm.jpg" srcset="${esc(base)}-sm.jpg 640w, ${esc(base)}.jpg 1400w" sizes="${sizes || '300px'}" alt="" loading="lazy" decoding="async" onload="this.classList.remove('ld')" onerror="this.parentNode.classList.add('noimg')"></div>`;
  }
  function ring(pct, r) {
    r = r || 24; const c = 2 * Math.PI * r, s = (r + 4) * 2;
    return `<div class="ax-ring" role="img" aria-label="${pct}% ready"><svg viewBox="0 0 ${s} ${s}"><circle class="trk" cx="${s / 2}" cy="${s / 2}" r="${r}"/><circle class="val" cx="${s / 2}" cy="${s / 2}" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(1)}"/></svg><b>${pct}%</b></div>`;
  }
  let toastT = 0;
  function toast(msg) {
    let t = $('#ax-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ax-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    t.textContent = msg; t.className = 'on';
    clearTimeout(toastT); toastT = setTimeout(() => { t.className = ''; }, 3600);
  }

  // ---------- Store: Supabase when reachable, per-browser ticks otherwise ----------
  const TICKS = 'trip_done_v1';
  const Store = {
    remote: null,        // Map id -> booking_items row
    remoteTrips: null,   // Map id -> trip row (+ stops)
    travellers: null,    // atlas.travellers rows (members only)
    attachments: null,   // atlas.attachments rows (wallet files)
    reminders: null,     // atlas.reminders rows
    mode: 'local', note: 'This browser only',
    lastLoad: 0,
    ticks() { try { return JSON.parse(localStorage.getItem(TICKS) || '{}') || {}; } catch (e) { return {}; } },
    saveTicks(m) { try { localStorage.setItem(TICKS, JSON.stringify(m)); } catch (e) {} },
    isDone(id, staticDone) {
      const r = this.remote && this.remote.get(id);
      if (r) return !!r.done;
      return !!staticDone || !!this.ticks()[id];
    },
    needsReview(id, staticFlag) {
      const r = this.remote && this.remote.get(id);
      if (r) return !!r.needs_review;
      return !!staticFlag && !this.ticks()[id];
    },
    async set(id, field, value) {
      const row = this.remote && this.remote.get(id);
      if (row) {
        const prev = row[field];
        row[field] = value; refreshAll();
        try {
          await sbFetch('booking_items?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ [field]: value }), headers: { Prefer: 'return=representation' } })
            .then(rows => { if (rows && rows[0]) this.remote.set(id, rows[0]); });
          toast(field === 'done' ? (value ? 'Marked done — synced for the family' : 'Moved back to the to-do list') : (value ? 'Flagged for review' : 'Marked as confirmed — synced'));
        } catch (e) {
          row[field] = prev; refreshAll();
          toast('Couldn’t save to ATLAS — check your connection and try again');
        }
        refreshAll();
        return;
      }
      const m = this.ticks();
      const on = field === 'done' ? value : !value;
      if (on) m[id] = 1; else delete m[id];
      this.saveTicks(m);
      refreshAll();
      toast(on ? 'Saved on this device' : 'Undone');
    }
  };

  // ---------- Supabase (plain fetch — no SDK needed) ----------
  function session() { try { return JSON.parse(sessionStorage.getItem(SB_SESSION) || 'null'); } catch (e) { return null; } }
  function saveSession(s) {
    if (!s || !s.access_token) return null;
    const v = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600) };
    try { sessionStorage.setItem(SB_SESSION, JSON.stringify(v)); } catch (e) {}
    return v;
  }
  async function authCall(grant, body) {
    const r = await fetch(SB_URL + '/auth/v1/token?grant_type=' + grant, { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.msg || j.error_description || j.message || ('auth ' + r.status)), { status: r.status, kind: 'auth' });
    return saveSession(j);
  }
  async function validSession() {
    let s = session();
    if (!s) return null;
    if (s.expires_at - 60 < Date.now() / 1000) {
      try { s = await authCall('refresh_token', { refresh_token: s.refresh_token }); } catch (e) { sessionStorage.removeItem(SB_SESSION); return null; }
    }
    return s;
  }
  async function sbFetch(path, opts) {
    const s = await validSession();
    if (!s) throw Object.assign(new Error('not signed in to ATLAS'), { kind: 'auth' });
    opts = opts || {};
    const r = await fetch(SB_URL + '/rest/v1/' + path, Object.assign({}, opts, {
      headers: Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token, 'Accept-Profile': 'atlas', 'Content-Profile': 'atlas', 'Content-Type': 'application/json' }, opts.headers || {})
    }));
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw Object.assign(new Error(r.status + ' ' + t.slice(0, 160)), { status: r.status, kind: 'rest', body: t });
    }
    return r.status === 204 ? null : r.json();
  }
  function setSync(mode, note) {
    Store.mode = mode; Store.note = note;
    const el = $('#ax-sync');
    if (el) { el.className = 'ax-sync ' + mode; el.querySelector('span').textContent = note; el.title = mode === 'synced' ? 'Status changes sync across the family’s devices via Supabase (Mumbai).' : mode === 'local' ? 'Ticks are saved in this browser only. ' + (Store.reason || '') : 'Connecting…'; }
  }
  async function loadRemote() {
    setSync('syncing', 'Syncing…');
    try {
      const [items, trips, stops] = await Promise.all([
        sbFetch('booking_items?select=*&order=sort'),
        sbFetch('trips?select=*&order=sort'),
        sbFetch('trip_stops?select=*&order=trip_id,seq')
      ]);
      if (!items.length && !trips.length) throw Object.assign(new Error('no rows visible'), { kind: 'empty' });
      Store.remote = new Map(items.map(r => [r.id, r]));
      Store.remoteTrips = new Map(trips.map(t => [t.id, Object.assign({}, t, { stops: stops.filter(s => s.trip_id === t.id) })]));
      try { Store.travellers = await sbFetch('travellers?select=*&order=sort'); } catch (e) { Store.travellers = null; }
      try { Store.attachments = await sbFetch('attachments?select=*&order=created_at'); } catch (e) { Store.attachments = null; }
      try { Store.reminders = await sbFetch('reminders?select=*&order=remind_at'); } catch (e) { Store.reminders = null; }
      Store.lastLoad = Date.now(); Store.reason = '';
      setSync('synced', 'Synced');
      refreshAll();
    } catch (e) {
      Store.remote = null; Store.remoteTrips = null; Store.travellers = null; Store.attachments = null; Store.reminders = null;
      Store.reason = e.kind === 'auth' ? 'Supabase sign-in isn’t available yet (Google provider not enabled).'
        : /schema/i.test(e.body || '') ? 'The atlas schema isn’t exposed in the Supabase API settings yet.'
        : e.kind === 'empty' ? 'This account isn’t on the ATLAS access list.' : 'Supabase couldn’t be reached.';
      setSync('local', 'This browser only');
      if (window.console) console.info('[ATLAS] running on local data:', Store.reason, e.message);
    }
  }
  async function connect(idToken) {
    try { await authCall('id_token', { provider: 'google', id_token: idToken }); }
    catch (e) { Store.reason = 'Supabase sign-in isn’t available yet (Google provider not enabled).'; setSync('local', 'This browser only'); if (window.console) console.info('[ATLAS] Supabase sign-in unavailable:', e.message); return; }
    loadRemote();
  }

  // ---------- Model ----------
  const STATIC_TZ = { japan: () => 'Asia/Tokyo', kerala: () => 'Asia/Kolkata', ireland: s => /Dublin|Cork|Dingle/.test(s.name) ? 'Europe/Dublin' : 'Europe/London' };
  function trips() {
    return TRIPS.map(t0 => {
      const t = Object.assign({ adults: 2, children: 2 }, t0, { stops: t0.stops.map((s, i) => Object.assign({ seq: i + 1, tz: STATIC_TZ[t0.id](s) }, s)) });
      const r = Store.remoteTrips && Store.remoteTrips.get(t.id);
      if (!r) return t;
      const stops = (r.stops && r.stops.length ? r.stops : t.stops).map((s, i) => Object.assign({}, t.stops[i] || {}, s, { image: s.image || (t.stops[i] && t.stops[i].image) }));
      return Object.assign({}, t, { name: r.name || t.name, country: r.country || t.country, flag: r.flag || t.flag, start: r.start_date || t.start, end: r.end_date || t.end, image: r.image || t.image, summary: r.summary, adults: r.adults != null ? r.adults : t.adults, children: r.children != null ? r.children : t.children, stops });
    });
  }
  const trip = id => trips().find(t => t.id === id);
  function status(t) { const s = days(t.start), e = days(t.end); return e < 0 ? 'completed' : s > 0 ? 'upcoming' : 'active'; }
  function nextTrip() {
    return trips().filter(t => status(t) !== 'completed').sort((a, b) => parse(a.start) - parse(b.start))[0] || null;
  }
  // Passport validity is checked automatically for every international trip as
  // soon as the family's passports are available (synced devices). It overrides
  // any manual tick, so a passport that stops qualifying re-opens the task.
  function passportCheck(t) {
    if (!t || t.passportMonths == null || !Store.travellers || !Store.travellers.length) return null;
    const need = needBy(t);
    const rows = Store.travellers.map(p => {
      const exp = parse(p.passport_expiry);
      return { name: p.display_name, exp, ok: !!exp && exp >= need };
    });
    return { ok: rows.every(r => r.ok), need, rows, rule: t.passportMonths ? `${t.passportMonths} months beyond the trip’s last day` : 'the whole trip' };
  }
  function items(tripId) {
    const list = baseItems(tripId), t = trip(tripId), pc = passportCheck(t);
    if (!pc) return list;
    const id = tripId === 'japan' ? 'doc:passport-validity' : 'doc:passport-validity:' + tripId;
    const at = list.findIndex(i => i.id === id);
    const base = at >= 0 ? list[at] : { id, trip_id: tripId, kind: 'document', title: 'Passport validity check', icon: '🛂', sort: 99 };
    const bad = pc.rows.filter(r => !r.ok);
    const minExp = pc.rows.reduce((m, r) => (!m || (r.exp && r.exp < m) ? r.exp : m), null);
    const auto = Object.assign({}, base, {
      done: pc.ok, needs_review: false, auto: true, check: pc,
      detail: pc.ok
        ? `All ${pc.rows.length} passports are valid until at least ${fmt(minExp)} — past ${fmt(pc.need)} (${pc.rule}). Checked automatically against the saved passports.`
        : bad.map(r => r.exp ? `${r.name}’s passport expires ${fmt(r.exp)}` : `${r.name}’s passport isn’t saved yet`).join(' · ') + ` — each must run to ${fmt(pc.need)} (${pc.rule}).`
    });
    const out = list.slice();
    if (at >= 0) out[at] = auto; else out.push(auto);
    return out;
  }
  function baseItems(tripId) {
    if (Store.remote) return Array.from(Store.remote.values()).filter(r => r.trip_id === tripId).sort((a, b) => a.sort - b.sort);
    if (tripId !== 'japan' || typeof JP_BOOKING_WINDOWS === 'undefined') return [];
    const out = [];
    JP_FLIGHTS.forEach(f => out.push(Object.assign({}, f, { done: Store.isDone(f.id, f.done) })));
    JP_HOTEL_TRACKER.forEach(h => {
      const id = hotelKey(h);
      out.push({ id, kind: 'hotel', title: h.city.replace(/^[^(]*\(.*?—\s*/, '').replace(/\)$/, ''), detail: h.note.replace(/^⚠️\s*/, ''), icon: h.icon,
        cancel_by: h.freeCancelUntil || null, done: !!h.booked, needs_review: !!h.booked && Store.needsReview(id, !!h.warning) });
    });
    JP_BOOKING_WINDOWS.forEach(b => out.push({ id: windowKey(b), kind: 'ticket', title: decode(b.item), detail: decode(b.why) + ' (' + decode(b.when) + ')', icon: b.icon,
      opens_on: b.date, rule: b.type, url: b.url || null, done: Store.isDone(windowKey(b), b.booked) }));
    JP_DOCS.forEach(d => out.push(Object.assign({}, d, { done: Store.isDone(d.id, false) })));
    return out;
  }
  const CATS = [['flight', 'Flights', 'plane'], ['hotel', 'Hotels', 'bed'], ['ticket', 'Activities', 'ticket'], ['document', 'Documents', 'doc']];
  function readiness(tripId) {
    const its = items(tripId);
    if (!its.length) return null;
    let ok = 0, total = 0;
    const cats = CATS.map(([k, label, icon]) => {
      const xs = its.filter(i => i.kind === k);
      const good = xs.filter(i => i.done && !i.needs_review).length;
      const review = xs.filter(i => i.done && i.needs_review).length;
      const open = xs.filter(i => !i.done && i.opens_on && days(i.opens_on) <= 0).length;
      const due = xs.filter(i => !i.done && i.due_on).sort((a, b) => parse(a.due_on) - parse(b.due_on))[0];
      ok += good; total += xs.length;
      let state, text;
      if (!xs.length) { state = 'none'; text = '—'; }
      else if (good === xs.length) { state = 'done'; text = k === 'document' ? 'Complete' : 'Booked'; }
      else if (xs.some(i => i.auto && !i.done)) { state = 'attention'; text = 'Passport renewal'; }
      else if (review) { state = 'attention'; text = review + ' to review'; }
      else if (open) { state = 'attention'; text = open + ' open now'; }
      else if (due) { state = days(due.due_on) <= 21 ? 'attention' : 'progress'; text = 'Due ' + fmtShort(due.due_on); }
      else if (good) { state = 'progress'; text = good + ' of ' + xs.length; }
      else { state = 'todo'; text = 'To do'; }
      return { key: k, label, icon, done: good, total: xs.length, state, text };
    });
    return { cats, done: ok, total, pct: total ? Math.round(ok / total * 100) : 0 };
  }
  function stopFor(t, date) {
    const d = date.getTime();
    const s = t.stops.find(s => parse(s.arrive).getTime() <= d && d < parse(s.depart).getTime());
    return s || (d >= parse(t.stops[t.stops.length - 1].arrive).getTime() ? t.stops[t.stops.length - 1] : t.stops[0]);
  }
  function hotelItem(t, s) { return s.hotelId ? items(t.id).find(i => i.id === s.hotelId) : null; }

  // ---------- Itinerary (read from the existing day cards — the itinerary's own source) ----------
  function dayList(t) {
    const sec = document.getElementById(t.tabs.itinerary);
    if (!sec || typeof dayCardDate !== 'function') return [];
    const year = +sec.getAttribute('data-year');
    return $$('.day', sec).map(c => {
      const date = dayCardDate(c, year);
      const n = c.querySelector('.dn-n'), dt = c.querySelector('.dt');
      return date && n && dt ? { card: c, date, n: n.textContent.trim(), title: dt.textContent.replace(/\s+/g, ' ').trim() } : null;
    }).filter(Boolean);
  }

  // ---------- Router ----------
  let started = false, focusId = null, libTab = 'upcoming';
  const DASH_TO_TRIP = () => { const m = {}; trips().forEach(t => { m[t.dash] = t.id; }); return m; };
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function setNav(v) { $$('.ax-links a').forEach(a => { const on = a.getAttribute('data-nav') === v; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); }
  function hideDashboards() { trips().forEach(t => { const el = document.getElementById(t.dash); if (el) el.style.display = 'none'; }); }
  function route() {
    if (!started) return;
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const v = parts[0] || 'overview';
    if (v === 'trip') return openTrip(parts[1], parts[2], parts[3]);
    if (v === 'itinerary' || v === 'bookings') {
      const t = trip(focusId) || nextTrip() || trips()[0];
      return location.replace('#/trip/' + t.id + '/' + (v === 'itinerary' ? t.tabs.itinerary : t.tabs.bookings));
    }
    if (['overview', 'trips', 'documents'].indexOf(v) < 0) return location.replace('#/overview');
    hideDashboards();
    $('#ax-main').hidden = false;
    $$('.ax-view').forEach(s => s.classList.toggle('on', s.getAttribute('data-view') === v));
    setNav(v);
    if (v === 'overview') { renderOverview(); Globe.start(); } else Globe.stop();
    if (v === 'trips') renderTripsView();
    if (v === 'documents') {
      const itemId = parts[1] === 'item' && parts[2] ? decodeURIComponent(parts[2]) : null;
      const owner = itemId && trips().find(x => items(x.id).some(i => i.id === itemId));
      if (owner) setFocus(owner.id, true);
      if (itemId) walletOpen = itemId;
      renderDocsView();
      if (itemId) {
        const card = $(`.ax-wal[data-item="${CSS.escape(itemId)}"]`) || $(`.ax-doc`);
        if (card) { requestAnimationFrame(() => { card.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'center' }); card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash'); }); document.title = 'ATLAS · Documents'; return; }
      }
    }
    document.title = { overview: 'ATLAS · Overview', trips: 'ATLAS · Trips', documents: 'ATLAS · Documents' }[v];
    window.scrollTo(0, 0);
  }
  function openTrip(id, tab, day) {
    const t = trip(id);
    if (!t) return location.replace('#/trips');
    Globe.stop();
    setFocus(t.id, true);
    $('#ax-main').hidden = true;
    hideDashboards();
    const root = document.getElementById(t.dash);
    root.style.display = 'block';
    if (tab && document.getElementById(tab)) showTab(root, tab);
    const active = $('.sec.active', root);
    const cur = active ? active.id : t.tabs.itinerary;
    setNav(cur === t.tabs.itinerary ? 'itinerary' : [t.tabs.bookings, t.tabs.hotels, t.tabs.flights].indexOf(cur) >= 0 ? 'bookings' : 'trips');
    if (typeof syncTabsH === 'function') syncTabsH();
    document.title = 'ATLAS · ' + t.name;
    if (day) {
      const sec = document.getElementById(t.tabs.itinerary);
      const card = $$('.day', sec).find(c => { const n = c.querySelector('.dn-n'); return n && n.textContent.trim() === day; });
      if (sec && sec.classList.contains('cal-mode')) { const b = $$('.itin-toggle button', sec).find(x => /List/.test(x.textContent)); if (b) b.click(); }
      if (card) {
        requestAnimationFrame(() => {
          card.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'center' });
          card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
        });
        return;
      }
    }
    window.scrollTo(0, 0);
  }
  // Tab clicks inside a dashboard keep the URL in step (replace, so Back leaves the trip).
  function onTab(id, btn) {
    const root = btn && btn.closest('.dash-root');
    const tid = root && DASH_TO_TRIP()[root.id];
    if (!tid || !started) return;
    try { history.replaceState(null, '', '#/trip/' + tid + '/' + id); } catch (e) {}
    const t = trip(tid);
    setNav(id === t.tabs.itinerary ? 'itinerary' : [t.tabs.bookings, t.tabs.hotels, t.tabs.flights].indexOf(id) >= 0 ? 'bookings' : 'trips');
  }
  function setFocus(id, quiet) {
    if (!trip(id)) return;
    focusId = id;
    try { sessionStorage.setItem(FOCUS_KEY, id); } catch (e) {}
    const sel = $('#ax-dest'); if (sel) sel.value = id;
    if (!quiet) { renderOverview(); Globe.focus(id); }
  }

  // ---------- Overview ----------
  function renderOverview() {
    const t = trip(focusId);
    if (!t) return;
    renderHero(t); renderSummary(t); renderIntel(t); renderJourney(t); renderDays(t); renderLibrary($('#ax-lib-ov'), 'tabs');
  }
  function renderHero(t) {
    const st = status(t), name = esc(t.short === 'Ireland & UK' ? 'Ireland & the UK' : t.name);
    const nxt = nextTrip();
    $('#ax-h1').innerHTML = st === 'upcoming' ? `Your next chapter starts in <em>${name}.</em>`
      : st === 'active' ? `You’re in <em>${name}</em> right now.` : `Relive <em>${name}.</em>`;
    const d = days(t.start);
    $('#ax-lede').textContent = st === 'upcoming' ? `${plural(d, 'day')} until you fly · ${t.stops.map(s => s.name).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`
      : st === 'active' ? `Day ${-d + 1} of ${tripDays(t)} — everything for today is one tap away.`
      : `${longRange(t)} · ${plural(t.stops.length, 'place')} · ${nxt ? 'next up: ' + nxt.name + ' in ' + plural(days(nxt.start), 'day') : 'no upcoming trips yet'}.`;
  }
  function renderSummary(t) {
    const st = status(t), r = readiness(t.id);
    const kicker = st === 'upcoming' ? (t === nextTrip() || (nextTrip() && nextTrip().id === t.id) ? 'Next trip' : 'Upcoming trip') : st === 'active' ? 'In progress' : 'Completed';
    const d = days(t.start);
    const count = st === 'upcoming' ? `<div class="ax-count"><b>${d}</b><span>${d === 1 ? 'day' : 'days'} to departure · ${fmt(t.start, { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>`
      : st === 'active' ? `<div class="ax-count"><b>Day ${-d + 1}</b><span>of ${tripDays(t)}</span></div>`
      : `<div class="ax-count"><b>${tripDays(t)}</b><span>days · ${plural(t.stops.length, 'place')} · trip complete</span></div>`;
    let rows = '', ready = '';
    if (r && st !== 'completed') {
      rows = '<ul class="ax-status">' + r.cats.map(c => `<li><button type="button" data-route="#/${c.key === 'document' ? 'documents' : 'trip/' + t.id + '/' + (c.key === 'flight' ? t.tabs.flights : c.key === 'hotel' ? t.tabs.hotels : t.tabs.bookings)}">${svg(c.icon)}<span class="ax-st-label">${c.label}</span><span class="ax-st-val ${c.state}">${esc(c.text)}</span><i class="ax-chev"></i></button></li>`).join('') + '</ul>';
      const left = r.total - r.done;
      ready = `<div class="ax-ready">${ring(r.pct)}<div class="ax-ready-txt">Trip readiness<small>${r.done} of ${r.total} done · ${left} left</small></div><a class="ax-cta" href="#/trip/${t.id}">Open trip ${svg('arrow')}</a></div>`;
    } else {
      rows = `<ul class="ax-status">${CATS.slice(0, 2).map(([k, label, icon]) => `<li><button type="button" data-route="#/trip/${t.id}/${k === 'flight' ? t.tabs.flights : t.tabs.hotels}">${svg(icon)}<span class="ax-st-label">${label}</span><span class="ax-st-val ${st === 'completed' ? 'done' : 'none'}">${st === 'completed' ? 'Completed' : 'See trip'}</span><i class="ax-chev"></i></button></li>`).join('')}</ul>`;
      ready = `<div class="ax-ready"><div class="ax-ready-txt">${st === 'completed' ? 'Your travel journal' : 'Trip dashboard'}<small>${st === 'completed' ? 'Day-by-day recap, hotels and flights' : 'Itinerary, bookings and tips'}</small></div><a class="ax-cta" href="#/trip/${t.id}">${st === 'completed' ? 'Open recap' : 'Open trip'} ${svg('arrow')}</a></div>`;
    }
    $('#ax-summary').innerHTML = `
      <div class="ax-sum-photo" style="background-image:url('${esc(String(t.image).replace(/\.jpe?g$/, ''))}-sm.jpg')"><span class="ax-kicker ${st === 'completed' ? 'done' : ''}">${kicker}</span></div>
      <div class="ax-sum-body">
        <div class="ax-sum-name">${esc(t.name)} <small>${t.flag}</small></div>
        <div class="ax-sum-dates">${esc(longRange(t))} · ${tripDays(t)} days</div>
        <div class="ax-sum-cities">${svg('pin')}${esc(t.stops.map(s => s.name).join(' · '))}</div>
        ${count}${rows}${ready}
      </div>`;
  }
  function renderJourney(t) {
    const dl = dayList(t);
    const hiFor = s => dl.filter(d => d.date >= parse(s.arrive) && d.date < parse(s.depart));
    let html = `<div class="ax-jn-end"><div class="ax-plane">${svg('plane')}</div><b>${fmtShort(t.start)}</b><span>${fmt(t.start, { weekday: 'short' })} · ${esc(t.outbound)}</span></div>`;
    t.stops.forEach((s, i) => {
      if (i > 0) html += `<div class="ax-jn-link" aria-hidden="true"><i>${/car|road/i.test(s.travel_in) ? '🚗' : /sleeper|shinkansen|kintetsu|jr|train/i.test(s.travel_in) ? '🚆' : /easyjet|indigo|ba |flight|air/i.test(s.travel_in) ? '✈️' : '→'}</i><span>${esc(s.travel_in)}</span></div>`;
      const hi = hiFor(s), h = hotelItem(t, s), n = nights(s.arrive, s.depart);
      const stay = h ? (h.needs_review ? '<i class="warn"></i>' : h.done ? '<i class="ok"></i>' : '<i></i>') : (status(t) === 'completed' ? '<i class="ok"></i>' : '<i></i>');
      const flag = h && h.needs_review ? '<em>Check occupancy</em>' : '';
      const acts = hi.slice(0, 3).map(d => `<li>${esc(d.title.replace(/\s*[—–-]\s*.*$/, '').slice(0, 64))}</li>`).join('') + (hi.length > 3 ? `<li class="more">+${hi.length - 3} more ${hi.length - 3 === 1 ? 'day' : 'days'}</li>` : '');
      html += `<button type="button" class="ax-stop" data-route="#/trip/${t.id}/${t.tabs.itinerary}${hi[0] ? '/' + hi[0].n : ''}" aria-label="${esc(s.name)}, ${esc(range(s.arrive, s.depart))} — open in itinerary">
        ${photo(s.image, s.name[0], '268px')}
        <div class="ax-stop-b">
          <div class="ax-stop-name"><b>${esc(s.name)}</b><span>${esc(range(s.arrive, s.depart))} · ${n ? plural(n, 'night') : 'overnight'}</span></div>
          ${s.hotel ? `<div class="ax-stay">${stay}${esc(s.hotel)}${flag}</div>` : ''}
          ${acts ? `<ul class="ax-acts">${acts}</ul>` : ''}
        </div></button>`;
    });
    html += `<div class="ax-jn-link" aria-hidden="true"><i>✈️</i><span>Fly home</span></div><div class="ax-jn-end"><div class="ax-plane">${svg('plane')}</div><b>${fmtShort(t.end)}</b><span>${fmt(t.end, { weekday: 'short' })} · ${esc(t.inbound)}</span></div>`;
    $('#ax-journey').innerHTML = html;
    $('#ax-journey-link').setAttribute('href', '#/trip/' + t.id + '/' + t.tabs.itinerary);
  }
  function renderDays(t) {
    const dl = dayList(t), box = $('#ax-days');
    $('#ax-days-sub').textContent = `${plural(dl.length, 'day')} · tap a day to open it in the full itinerary.`;
    if (!dl.length) { box.innerHTML = '<div class="ax-empty"><b>No day plan yet</b>The itinerary for this trip hasn’t been written.</div>'; return; }
    const td = today().getTime();
    box.innerHTML = dl.map(d => {
      const s = stopFor(t, d.date), wk = d.date.getDay() === 0 || d.date.getDay() === 6;
      return `<button type="button" class="ax-day${d.date.getTime() === td ? ' today' : ''}" data-route="#/trip/${t.id}/${t.tabs.itinerary}/${esc(d.n)}">
        ${photo(s.image, s.name[0], '196px')}
        <div class="ax-day-b"><div class="ax-day-k"><span>Day ${esc(d.n.replace(/^D/, ''))}</span><span class="${wk ? 'wk' : ''}">${fmt(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
        <div class="ax-day-t">${esc(d.title)}</div><div class="ax-day-p">${esc(s.name)}${d.date.getTime() === td ? ' · today' : ''}</div></div></button>`;
    }).join('');
    box.classList.add('collapsed');
    const m = $('#ax-days-more'); m.hidden = dl.length <= 5; m.textContent = `Show all ${dl.length} days`;
    // Bring today (or the first day) into view in the strip.
    const tEl = $('.ax-day.today', box);
    if (tEl && box.scrollWidth > box.clientWidth) box.scrollLeft = tEl.offsetLeft - 8;
  }
  function libCard(t) {
    const st = status(t), r = readiness(t.id), next = st !== 'completed' ? (insightsFor(t) || []).find(x => x.priority !== 'confirmed') : null;
    const chip = st === 'upcoming' ? '<span class="ax-kicker">Upcoming</span>' : st === 'active' ? '<span class="ax-kicker">In progress</span>' : '<span class="ax-kicker done">✓ Completed</span>';
    const foot = st !== 'completed'
      ? `${r ? ring(r.pct, 17) : ''}<span>${r ? 'Trip readiness · ' + r.done + ' of ' + r.total : 'Open the trip dashboard'}<small>${next ? 'Next: ' + esc(next.title) : (days(t.start) > 0 ? plural(days(t.start), 'day') + ' to go' : '')}</small></span>`
      : `<span>${tripDays(t)} days · ${plural(t.stops.length, 'place')}<small>Open the recap — day by day</small></span>`;
    return `<button type="button" class="ax-trip" data-route="#/trip/${t.id}" aria-label="${esc(t.name)}, ${esc(longRange(t))} — ${st}">
      ${photo(t.image, t.name[0], '(max-width:600px) 100vw, 420px')}
      <div class="ax-trip-top">${chip}</div>
      <div class="ax-trip-b"><b>${esc(t.name)} ${t.flag}</b><div class="ax-trip-meta">${esc(longRange(t))} · ${tripDays(t)} days</div><div class="ax-trip-cities">${esc(t.stops.map(s => s.name).join(' · '))}</div>
      <div class="ax-trip-foot">${foot}<span class="ax-go">${svg('arrow')}</span></div></div></button>`;
  }
  function groups() {
    const all = trips();
    return {
      upcoming: all.filter(t => status(t) !== 'completed').sort((a, b) => parse(a.start) - parse(b.start)),
      completed: all.filter(t => status(t) === 'completed').sort((a, b) => parse(b.end) - parse(a.end)),
      saved: [] // no saved-plan records exist yet (atlas.trips has no "saved" trips)
    };
  }
  const SAVED_EMPTY = '<div class="ax-empty" style="grid-column:1/-1"><b>No saved plans yet</b>Trip ideas with flexible dates will live here once you start one — nothing is saved so far.</div>';
  function renderLibrary(box, mode) {
    if (!box) return;
    const g = groups();
    if (mode === 'tabs') {
      $$('#ax-lib-tabs button').forEach(b => { const k = b.getAttribute('data-tab'); b.setAttribute('aria-selected', String(k === libTab)); b.tabIndex = k === libTab ? 0 : -1; b.querySelector('span').textContent = '(' + g[k].length + ')'; });
      box.innerHTML = g[libTab].length ? g[libTab].map(libCard).join('') : (libTab === 'saved' ? SAVED_EMPTY : `<div class="ax-empty" style="grid-column:1/-1"><b>Nothing here yet</b>${libTab === 'upcoming' ? 'No upcoming trips — time to plan one.' : 'Completed trips will appear here.'}</div>`);
      return;
    }
    box.innerHTML = [['upcoming', 'Upcoming'], ['completed', 'Completed — your travel journal'], ['saved', 'Saved plans']].map(([k, label]) =>
      `<section class="ax-lib-group"><h3>${label} (${g[k].length})</h3><div class="ax-lib">${g[k].length ? g[k].map(libCard).join('') : (k === 'saved' ? SAVED_EMPTY : '<div class="ax-empty" style="grid-column:1/-1">Nothing here yet.</div>')}</div></section>`).join('');
  }
  function renderTripsView() { renderLibrary($('#ax-lib-all'), 'all'); }
  function renderDocsView() {
    const t = trip(focusId) || nextTrip() || trips()[0];
    const docs = items(t.id).filter(i => i.kind === 'document');
    $('#ax-docs-h').textContent = t.name + ' ' + t.flag;
    const chips = $('#ax-doc-trips');
    if (chips) chips.innerHTML = groups().upcoming.concat(groups().completed).map(x => `<button type="button" data-doc-trip="${x.id}" aria-pressed="${x.id === t.id}">${x.flag} ${esc(x.short)}</button>`).join('');
    renderPassportList(t);
    renderWallet(t);
    const box = $('#ax-docs');
    if (!docs.length) {
      box.innerHTML = t.passportMonths == null
        ? `<div class="ax-empty"><b>Domestic trip</b>No passport or visa needed for ${esc(t.name)}.</div>`
        : `<div class="ax-empty"><b>No documents tracked</b>${status(t) === 'completed' ? 'This trip is complete — nothing to prepare.' : 'Passports are checked automatically once this device is synced.'}</div>`;
    } else {
    const byId = new Map(docs.map(d => [d.id, d]));
    box.innerHTML = docs.slice().sort((a, b) => (a.done - b.done) || ((DEPS[a.id] || []).length - (DEPS[b.id] || []).length)).map(d => {
      const n = days(d.due_on), deps = (DEPS[d.id] || []).map(x => byId.get(x)).filter(x => x && !x.done);
      const pill = d.auto ? (d.done ? '<span class="ax-pill done">✓ Auto-checked</span>' : '<span class="ax-pill urgent">Renewal needed</span>')
        : d.done ? '<span class="ax-pill done">✓ Done</span>' : `<span class="ax-pill ${n <= 14 ? 'urgent' : 'soon'}">${n < 0 ? 'Overdue' : 'Due in ' + n + ' days'}</span>`;
      if (d.auto) return `<article class="ax-doc${d.done ? ' is-done' : ''}"><span class="ax-act-ic" aria-hidden="true">${esc(d.icon)}</span>
        <div><h3>${esc(d.title)}</h3><p>${esc(d.detail)}</p></div>
        <div class="ax-doc-side">${pill}<span class="ax-when">Must be valid until<b>${fmt(d.check.need)}</b></span></div></article>`;
      return `<article class="ax-doc${d.done ? ' is-done' : ''}"><span class="ax-act-ic" aria-hidden="true">${esc(d.icon)}</span>
        <div><h3>${esc(d.title)}</h3><p>${esc(d.detail)}</p>${deps.length ? `<div class="ax-dep" style="margin-top:8px">Do first: ${deps.map(x => esc(x.title)).join(', ')}</div>` : ''}</div>
        <div class="ax-doc-side">${pill}${d.due_on ? `<span class="ax-when">Do by<b>${fmt(d.due_on)}</b></span>` : ''}
          ${d.done ? `<button type="button" class="ax-btn tick" data-tick="${esc(d.id)}" data-field="done" data-value="false">↩ Undo</button>` : `<button type="button" class="ax-btn ghost" data-ics="${esc(d.id)}">🔔 Reminder</button><button type="button" class="ax-btn pri" data-tick="${esc(d.id)}" data-field="done" data-value="true">✓ Mark done</button>`}</div></article>`;
    }).join('');
    }
  }

  // ---------- Passports (atlas.travellers: family members only, never in the page source) ----------
  const FAMILY = ['yuvan', 'ramyaa', 'sana', 'tara'];
  let lastFocus = null;
  function travellerFor(name) { return (Store.travellers || []).find(t => t.display_name.toLowerCase() === String(name).trim().toLowerCase()) || null; }
  function needBy(t) { const d = parse(t.end); d.setMonth(d.getMonth() + (t.passportMonths || 0)); return d; }
  function ppState(p, t) {
    if (!p || !p.passport_expiry) return { cls: 'none', text: 'Not added yet' };
    const exp = parse(p.passport_expiry), need = t && t.passportMonths != null ? needBy(t) : null;
    if (exp < today()) return { cls: 'bad', text: 'Expired ' + fmt(exp) };
    if (need && exp < need) return { cls: 'warn', text: `Expires ${fmt(exp)} — must run to ${fmt(need)} for ${t.name}` };
    return { cls: 'ok', text: 'Valid to ' + fmt(exp) + (need ? ` · covers ${t.name}${t.passportMonths ? ' + ' + t.passportMonths + ' months' : ''}` : '') };
  }
  const maskNo = n => n ? n.slice(0, 1) + '•'.repeat(Math.max(1, n.length - 3)) + n.slice(-2) : '—';
  function contextTrip(el) {
    const root = el && el.closest && el.closest('.dash-root');
    const id = root && DASH_TO_TRIP()[root.id];
    return trip(id) || trip(focusId) || nextTrip();
  }
  function renderChips() {
    $$('.dash-root .tv').forEach(chip => {
      const name = ((chip.querySelector('.tv-n') || {}).textContent || '').trim();
      const sub = chip.querySelector('.tv-a');
      if (!sub || FAMILY.indexOf(name.toLowerCase()) < 0) return;
      if (!chip.classList.contains('pp')) {
        chip.classList.add('pp'); chip.setAttribute('role', 'button'); chip.tabIndex = 0;
        chip.setAttribute('aria-label', 'Passport details for ' + name);
        chip.addEventListener('click', () => passport(name, chip));
        chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); passport(name, chip); } });
      }
      if (!Store.travellers) { sub.textContent = '🔒 Tap for passport'; return; }
      const st = ppState(travellerFor(name), contextTrip(chip));
      sub.textContent = st.cls === 'ok' ? '🛂 ' + st.text.split(' · ')[0] : st.cls === 'none' ? '🛂 Add passport' : st.cls === 'bad' ? '⚠️ Passport expired' : '⚠️ Check expiry';
    });
  }
  function passport(name, from) {
    const t = contextTrip(from), p = travellerFor(name);
    let m = $('#ax-pp');
    if (!m) {
      m = document.createElement('div'); m.id = 'ax-pp'; m.className = 'ax-pp';
      m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'ax-pp-h');
      document.body.appendChild(m);
      m.addEventListener('click', e => {
        if (e.target === m || e.target.closest('[data-pp-close]')) return closePassport();
        const sh = e.target.closest('[data-pp-show]');
        if (sh) { const v = $('#ax-pp-no'); const on = v.getAttribute('data-shown') !== '1'; v.textContent = on ? v.getAttribute('data-full') : v.getAttribute('data-mask'); v.setAttribute('data-shown', on ? '1' : '0'); sh.textContent = on ? 'Hide' : 'Show'; }
        const cp = e.target.closest('[data-pp-copy]');
        if (cp) { const n = $('#ax-pp-no').getAttribute('data-full'); if (navigator.clipboard) navigator.clipboard.writeText(n).then(() => toast('Passport number copied'), () => toast('Copy isn’t available here')); }
      });
      document.addEventListener('keydown', e => {
        if (!m.classList.contains('on')) return;
        if (e.key === 'Escape') return closePassport();
        if (e.key === 'Tab') { const f = $$('button', m); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
      });
    }
    lastFocus = from || document.activeElement;
    let body;
    if (!Store.travellers) body = `<p class="ax-pp-note">Passport details live in ATLAS’s private database (family accounts only) and appear once this device is <b>synced</b>. ${esc(Store.mode === 'syncing' ? 'Syncing now — try again in a moment.' : (Store.reason || 'Sign out and back in to connect.'))}</p>`;
    else if (!p || !p.passport_no) body = `<p class="ax-pp-note">No passport saved for ${esc(name)} yet. Add it in Supabase → Table Editor → <b>atlas.travellers</b>, then reopen ATLAS.</p>`;
    else {
      const st = ppState(p, t);
      const rows = [['Given name', p.given_name], ['Surname', p.surname], ['Nationality', p.nationality], ['Date of birth', p.date_of_birth ? fmt(p.date_of_birth) : ''], ['Sex', { M: 'Male', F: 'Female', X: 'X' }[p.sex]], ['Place of issue', p.place_of_issue], ['Issued', p.passport_issued ? fmt(p.passport_issued) : ''], ['Expires', p.passport_expiry ? fmt(p.passport_expiry) : '']];
      body = `<div class="ax-pp-no"><div><small>Passport number</small><b id="ax-pp-no" data-full="${esc(p.passport_no)}" data-mask="${esc(maskNo(p.passport_no))}">${esc(maskNo(p.passport_no))}</b></div><div class="ax-pp-btns"><button type="button" class="ax-btn ghost" data-pp-show>Show</button><button type="button" class="ax-btn ghost" data-pp-copy>Copy</button></div></div>
        <div class="ax-pp-st ${st.cls}">${esc(st.text)}</div>
        <dl class="ax-pp-rows">${rows.map(r => `<div><dt>${r[0]}</dt><dd>${esc(r[1] || '—')}</dd></div>`).join('')}</dl>`;
    }
    const color = /^#[0-9a-f]{3,8}$/i.test((p && p.color) || '') ? p.color : '#8B9AAF';
    m.innerHTML = `<div class="ax-pp-card"><header><span class="ax-avatar" style="background:${color};color:#fff">${esc(name[0])}</span><div><small>Passport</small><h2 id="ax-pp-h">${esc(p ? p.given_name + ' ' + p.surname : name)}</h2></div><button type="button" class="ax-pp-x" data-pp-close aria-label="Close">×</button></header>${body}</div>`;
    m.classList.add('on');
    const x = $('.ax-pp-x', m); if (x) x.focus();
  }
  // Closing removes the details from the DOM entirely.
  function closePassport() { const m = $('#ax-pp'); if (!m) return; m.classList.remove('on'); m.innerHTML = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function renderPassportList(t) {
    const box = $('#ax-pp-list'); if (!box) return;
    const tr = Store.travellers;
    if (!tr) { box.innerHTML = `<div class="ax-empty"><b>Passports are private</b>They appear here on synced devices only. ${esc(Store.reason || '')}</div>`; return; }
    const ctx = t.passportMonths != null ? t : null;
    box.innerHTML = tr.map(p => {
      const st = ppState(p, ctx), c = /^#[0-9a-f]{3,8}$/i.test(p.color || '') ? p.color : '#8B9AAF';
      return `<button type="button" class="ax-ppi" data-pp="${esc(p.display_name)}"><span class="ax-avatar" style="background:${c};color:#fff">${esc(p.display_name[0])}</span><span class="ax-ppi-t"><b>${esc(p.display_name)}</b><small>${esc(st.text)}</small></span><span class="ax-pill ${st.cls === 'ok' ? 'done' : st.cls === 'none' ? 'later' : 'urgent'}">${st.cls === 'ok' ? 'Valid' : st.cls === 'none' ? 'Not added' : st.cls === 'bad' ? 'Expired' : 'Check'}</span></button>`;
    }).join('');
  }


  // ---------- Travel wallet (bookings + references + confirmation files) ----------
  // References live in atlas.booking_items.reference and files in the private
  // `atlas-docs` storage bucket; both are readable only by the family accounts.
  const KIND_LABEL = { flight: 'Flights', hotel: 'Hotels', ticket: 'Tickets & reservations' };
  const OK_MIME = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/;
  const attachmentsFor = id => (Store.attachments || []).filter(a => a.item_id === id);
  const encPath = p => p.split('/').map(encodeURIComponent).join('/');
  async function sbStorage(path, opts) {
    const s = await validSession();
    if (!s) throw new Error('this device isn’t synced');
    opts = opts || {};
    const r = await fetch(SB_URL + '/storage/v1/object/' + path, Object.assign({}, opts, { headers: Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + s.access_token }, opts.headers || {}) }));
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error((JSON.parse(t || '{}').message) || ('storage ' + r.status)); }
    return r;
  }
  function walletFacts(i) {
    const f = [];
    if (i.adults != null && i.children != null) f.push(`👪 ${plural(i.adults, 'adult')} · ${i.children === 1 ? '1 child' : i.children + ' children'}`);
    if (i.cancel_by) f.push(days(i.cancel_by) >= 0 ? `↩️ Free cancellation until ${fmt(i.cancel_by)}` : `🔒 Non-refundable since ${fmt(AtlasEngine.isoOf(AtlasEngine.dayNum(i.cancel_by) + 1))}`);
    if (i.kind === 'ticket' && i.opens_on && !i.done && window.AtlasEngine) {
      const t = trips().find(x => x.id === i.trip_id) || trip(focusId), st = (t && t.stops || []).find(s => s.seq === i.stop_seq) || (t && t.stops[0]);
      const ts = i.opens_time && st && st.tz ? AtlasEngine.zonedToUtc(i.opens_on, i.opens_time, st.tz) : null;
      f.push(`🎟️ ${i.rule === 'reco' ? 'Book from (estimate)' : 'Opens'} ${AtlasEngine.whenText({ date: i.opens_on, ts, tz: st && st.tz }, LOCAL_TZ)}`);
    }
    const ver = i.verified_at ? `<span class="ax-ver ok">✓ Verified ${fmt(String(i.verified_at).slice(0, 10))}${i.verified_by ? ' · ' + esc(String(i.verified_by).split('@')[0]) : ''}</span>`
      : (i.done && Store.remote ? `<span class="ax-ver">Not verified yet</span>` : '');
    const vbtn = i.done && Store.remote ? `<button type="button" class="ax-btn tick" data-verify="${esc(i.id)}">${i.verified_at ? 'Re-verify today' : 'Mark verified today'}</button>` : '';
    return f.length || ver ? `<ul class="ax-facts">${f.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${ver || vbtn ? `<div class="ax-ver-row">${ver}${vbtn}</div>` : ''}` : '';
  }
  // ---------- Travel wallet: Apple-Wallet-style stacks of passes ----------
  let walletOpen = null;
  const dateKey = i => i.event_date || i.opens_on || i.due_on || '9999-12-31';
  function stopOfItem(t, i) {
    if (i.stop_seq != null) { const s = t.stops.find((x, k) => (x.seq || k + 1) === i.stop_seq); if (s) return s; }
    return i.event_date ? stopFor(t, parse(i.event_date)) : null;
  }
  function renderWallet(t) {
    const box = $('#ax-wallet'); if (!box) return;
    const synced = !!Store.remote;
    const its = items(t.id).filter(i => KIND_LABEL[i.kind]).sort((a, b) => dateKey(a) < dateKey(b) ? -1 : dateKey(a) > dateKey(b) ? 1 : (a.sort || 0) - (b.sort || 0));
    if (!its.length) { box.innerHTML = `<div class="ax-empty"><b>No bookings here yet</b>${synced ? 'Nothing has been booked for this trip.' : 'This trip’s bookings appear on synced devices.'}</div>`; return; }
    const booked = its.filter(i => i.done), todo = its.filter(i => !i.done);
    const stack = (list, label, cls) => list.length ? `<section class="ax-stack-col ${cls}" aria-label="${esc(label)}">
        <h3 class="ax-stack-h">${esc(label)} <span>${plural(list.length, 'pass', 'passes')}</span></h3>
        <div class="ax-stack" role="list">${list.map(i => passCard(i, t, synced)).join('')}</div></section>` : '';
    box.innerHTML = (synced ? '' : `<p class="ax-note ax-wal-note">Attaching confirmations and saving booking references works on synced devices. ${esc(Store.reason || '')}</p>`)
      + `<p class="ax-stack-hint">Tap a pass to pull it out · ${plural(booked.length, 'booking')} confirmed${todo.length ? ' · ' + todo.length + ' still to book' : ''}</p>`
      + `<div class="ax-stacks">${stack(booked, 'Booked', 'booked')}${stack(todo, 'Still to book', 'todo')}</div>`;
    applyWalletState();
    bindPassDrag();
  }
  function passFace(i, t) {
    const s = stopOfItem(t, i), d = i.detail || '';
    const day = iso => iso ? fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
    const cell = (k, v) => `<span><small>${k}</small>${esc(v)}</span>`;
    if (i.kind === 'flight') {
      const ends = String(i.title).split('·')[0].split('→').map(x => x.replace(/\(.*?\)/g, '').trim());
      // Real IATA codes only: the trips' known airports, else none (never derived from city names).
      const IATA = [[/haneda/i, 'HND'], [/kansai|osaka/i, 'KIX'], [/chennai/i, 'MAA'], [/mangal/i, 'IXE'], [/heathrow/i, 'LHR'], [/dublin/i, 'DUB'], [/belfast/i, 'BFS'], [/edinburgh/i, 'EDI']];
      const iata = txt => { const m = IATA.find(([re]) => re.test(txt || '')); return m ? m[1] : ''; };
      const codes = [iata(String(i.title).split('→')[0]), iata(String(i.title).split('→')[1])];
      const times = d.match(/\b\d{1,2}:\d{2}\b/g) || [];
      const pax = i.adults != null && i.children != null ? String(i.adults + i.children) : '—';
      const code = (k, city) => codes[k] || city || '';
      return `<div class="pf-route${codes[0] && codes[1] ? '' : ' names'}"><div><small>From</small><b>${esc(code(0, ends[0]))}</b><span>${esc(ends[0] || '')}</span></div><i aria-hidden="true">✈</i><div class="r"><small>To</small><b>${esc(code(1, ends[1]))}</b><span>${esc(ends[1] || '')}</span></div></div>
        <div class="pf-row">${cell('Date', day(i.event_date))}${cell('Departs', times[0] || '—')}${cell('Travellers', pax)}</div>`;
    }
    if (i.kind === 'hotel') {
      const n = s ? nights(i.event_date || s.arrive, s.depart) : null;
      return `<div class="pf-hotel"><small>${esc(s ? s.name : 'Hotel')}</small><b>${esc(String(i.title).replace(/\s*\(.*\)$/, ''))}</b></div>
        <div class="pf-row">${cell('Check-in', day(i.event_date || (s && s.arrive)))}${cell('Check-out', day(s && s.depart))}${cell('Nights', n != null ? String(n) : '—')}</div>`;
    }
    return `<div class="pf-ticket"><small>${esc(s ? s.name : t.name)}</small><b>${esc(i.title)}</b></div>
      <div class="pf-row">${cell('For', day(i.event_date))}${i.done ? cell('Status', 'Booked') : cell(i.rule === 'reco' ? 'Book from' : 'Opens', day(i.opens_on))}${cell('Ref', i.reference ? maskNo(i.reference) : '—')}</div>`;
  }
  function passCard(i, t, synced) {
    const open = walletOpen === i.id, s = stopOfItem(t, i);
    const files = attachmentsFor(i.id);
    const kindLabel = { flight: 'Boarding pass', hotel: 'Hotel', ticket: i.done ? 'Ticket' : 'To book' }[i.kind];
    const when = i.event_date ? fmt(i.event_date, { day: 'numeric', month: 'short' }) : i.opens_on ? 'opens ' + fmt(i.opens_on, { day: 'numeric', month: 'short' }) : '';
    const status = i.done ? (i.needs_review ? '<em class="warn">Review</em>' : '<em class="ok">✓</em>') : '<em class="todo">To book</em>';
    // Absolute URL: url() inside a custom property resolves against the stylesheet's folder otherwise.
    const imgUrl = i.kind === 'hotel' && s && s.image ? new URL(String(s.image).replace(/(-sm)?\.jpe?g$/, '') + '-sm.jpg', location.href).href : '';
    const bg = imgUrl ? ` style="--pass-img:url('${esc(imgUrl)}')"` : '';
    const ref = i.reference
      ? `<div class="ax-ref"><small>Booking ref</small><b data-full="${esc(i.reference)}" data-mask="${esc(maskNo(i.reference))}">${esc(maskNo(i.reference))}</b><button type="button" class="ax-btn tick" data-ref-show>Show</button><button type="button" class="ax-btn tick" data-ref-copy>Copy</button>${synced ? `<button type="button" class="ax-btn tick" data-ref-edit="${esc(i.id)}">Edit</button>` : ''}</div>`
      : (synced ? `<button type="button" class="ax-btn tick ax-ref-add" data-ref-edit="${esc(i.id)}">＋ Add booking reference</button>` : '');
    const fileHtml = files.map(f => `<span class="ax-file"><button type="button" class="ax-file-open" data-file-open="${esc(f.path)}" data-file-name="${esc(f.file_name)}">${/pdf/.test(f.mime || '') ? '📄' : '🖼️'} ${esc(f.file_name)}</button><button type="button" class="ax-file-del" data-file-del="${esc(f.id)}" aria-label="Remove ${esc(f.file_name)}">×</button></span>`).join('');
    const bodyId = 'pass-' + i.id.replace(/[^a-z0-9]/gi, '-');
    return `<article class="ax-wal ax-pass k-${i.kind}${i.done ? '' : ' todo'}${open ? ' open' : ''}${bg ? ' has-img' : ''}" data-item="${esc(i.id)}" role="listitem"${bg}>
      <button type="button" class="ax-pass-head" data-pass="${esc(i.id)}" aria-expanded="${open}" aria-controls="${bodyId}">
        <span class="ph-ic" aria-hidden="true">${esc(i.icon || '•')}</span>
        <span class="ph-t"><small>${esc(kindLabel)}${when ? ' · ' + esc(when) : ''}</small><b>${esc(String(i.title).replace(/\s*\(.*\)$/, ''))}</b></span>
        ${status}
      </button>
      <div class="ax-pass-face" aria-hidden="${!open}">${passFace(i, t)}</div>
      <div class="ax-pass-body" id="${bodyId}"${open ? '' : ' hidden'}>
        ${i.detail ? `<p>${esc(i.detail)}</p>` : ''}
        ${walletFacts(i)}
        <div class="ax-ref-slot">${ref}</div>
        <div class="ax-files">${fileHtml}${synced ? `<label class="ax-btn ghost ax-upload">📎 ${files.length ? 'Add file' : 'Attach confirmation'}<input type="file" accept="application/pdf,image/*" data-upload="${esc(i.id)}"></label>` : ''}</div>
        <div class="ax-pass-foot"><div class="ax-pass-nav" role="group" aria-label="Browse passes"><button type="button" class="ax-btn tick" data-pass-step="-1" aria-label="Previous pass">‹</button><span class="ax-pass-pos" aria-live="polite"></span><button type="button" class="ax-btn tick" data-pass-step="1" aria-label="Next pass">›</button></div>${i.url ? `<a class="ax-btn tick" href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">Official site ↗</a>` : ''}<button type="button" class="ax-btn ghost" data-pass="${esc(i.id)}">Put back</button></div>
      </div>
    </article>`;
  }
  // ---------- Wallet motion: spring physics + FLIP (Web Animations API, no library) ----------
  // A damped spring (mass 1) sampled into a CSS linear() easing — the same model
  // animation libraries use — so cards overshoot a touch and settle like Wallet.
  const springCache = {};
  const LINEAR_OK = !!(window.CSS && CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 1)'));
  function spring(stiffness, damping) {
    const key = stiffness + '/' + damping;
    if (springCache[key]) return springCache[key];
    let x = 0, v = 0, t = 0;
    const dt = 1 / 600, every = 10, pts = [0];
    for (let k = 1; t < 2; k++) {
      v += (-stiffness * (x - 1) - damping * v) * dt; x += v * dt; t += dt;
      if (k % every === 0) pts.push(x);
      if (t > 0.15 && Math.abs(x - 1) < 0.0008 && Math.abs(v) < 0.01) break;
    }
    pts.push(1);
    return (springCache[key] = LINEAR_OK
      ? { easing: 'linear(' + pts.map(n => +n.toFixed(4)).join(', ') + ')', duration: Math.round(t * 1000) }
      : { easing: 'cubic-bezier(.2,.95,.3,1.08)', duration: 520 });
  }
  const SPR_MOVE = () => spring(240, 23);   // cards travelling — slight overshoot
  const SPR_BODY = () => spring(300, 32);   // back of the pass unfolding — no wobble

  // Class/attribute state for every pass in the wallet (no re-render, so it can animate)
  function applyWalletState() {
    $$('.ax-stack').forEach(stack => {
      const cards = $$('.ax-pass', stack);
      const openCard = cards.find(c => c.getAttribute('data-item') === walletOpen);
      stack.classList.toggle('has-open', !!openCard);
      let firstPiled = true;
      cards.forEach(c => {
        const on = c === openCard;
        c.classList.toggle('open', on);
        c.classList.toggle('pile-first', !!openCard && !on && firstPiled);
        if (openCard && !on) firstPiled = false;
        const head = $('.ax-pass-head', c), face = $('.ax-pass-face', c), body = $('.ax-pass-body', c);
        if (head) head.setAttribute('aria-expanded', String(on));
        if (face) face.setAttribute('aria-hidden', String(!on));
        if (body) { if (on) body.hidden = false; else if (!body.dataset.closing) body.hidden = true; }
        if (on) {
          const k = cards.indexOf(c), pos = $('.ax-pass-pos', c), btns = $$('[data-pass-step]', c);
          if (pos) pos.textContent = (k + 1) + ' of ' + cards.length;
          if (btns[0]) btns[0].disabled = k === 0;
          if (btns[1]) btns[1].disabled = k === cards.length - 1;
        }
      });
    });
  }
  let suppressClick = false;
  function togglePass(id, opts) {
    opts = opts || {};
    const t = trip(focusId); if (!t) return;
    const next = walletOpen === id ? null : id;
    const target = id && $(`.ax-pass[data-item="${CSS.escape(id)}"]`);
    const prev = walletOpen && $(`.ax-pass[data-item="${CSS.escape(walletOpen)}"]`);
    if (!target) { walletOpen = next; return renderWallet(t); }
    const stacks = Array.from(new Set([target.closest('.ax-stack'), prev && prev.closest('.ax-stack')].filter(Boolean)));
    const cards = stacks.reduce((a, s) => a.concat($$('.ax-pass', s)), []);
    const animate = !REDUCE && typeof target.animate === 'function';
    // FIRST — where every card is on screen right now (mid-animation positions included)
    // Neighbouring stacks (stacked vertically on phones) move with the same spring instead of jumping.
    const neighbours = $$('.ax-stack-col').filter(col => stacks.indexOf($('.ax-stack', col)) < 0);
    const first = new Map(cards.concat(neighbours).map(c => [c, c.getBoundingClientRect().top]));
    neighbours.forEach(n => n.getAnimations().forEach(a => a.cancel()));
    const closingBody = prev && prev !== (next && target) ? $('.ax-pass-body', prev) : null;
    const closingH = closingBody && !closingBody.hidden ? closingBody.getBoundingClientRect().height : 0;
    cards.forEach(c => { c.style.transform = ''; c.getAnimations({ subtree: true }).forEach(a => a.cancel()); });
    // Change state
    if (closingBody && animate && closingH) { closingBody.dataset.closing = '1'; closingBody.style.height = '0px'; closingBody.style.paddingTop = closingBody.style.paddingBottom = '0px'; closingBody.style.overflow = 'hidden'; }
    walletOpen = next;
    applyWalletState();
    const head = $('.ax-pass-head', target); if (head && !opts.noFocus) head.focus({ preventScroll: true });
    if (!animate) { if (closingBody) { closingBody.hidden = true; delete closingBody.dataset.closing; } return; }
    // LAST — and INVERT/PLAY with a spring; piled cards cascade with a small stagger
    const mv = SPR_MOVE(); let pileIndex = 0;
    cards.forEach(c => {
      const dy = first.get(c) - c.getBoundingClientRect().top;
      const piled = c.closest('.has-open') && !c.classList.contains('open');
      const delay = piled ? Math.min(pileIndex++, 8) * 16 : 0;
      if (opts.enterX && c === target) {
        // swiped in: arrives from the side at its open position
        c.animate([{ transform: `translateX(${opts.enterX}px) rotate(${opts.enterX > 0 ? 2 : -2}deg)`, opacity: 0.4 }, { transform: 'translateX(0) rotate(0deg)', opacity: 1 }], { duration: mv.duration, easing: mv.easing });
        return;
      }
      if (opts.fromX != null && c === prev) {
        // swiped out: continues from where the finger left it, then drops into the pile
        c.animate([{ transform: `translate(${opts.fromX}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: mv.duration + delay, easing: mv.easing });
        return;
      }
      if (Math.abs(dy) < 0.5) return;
      c.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: mv.duration + delay, easing: mv.easing, delay: 0, fill: 'backwards' });
    });
    neighbours.forEach(n => {
      const dy = first.get(n) - n.getBoundingClientRect().top;
      if (Math.abs(dy) >= 0.5) n.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: mv.duration, easing: mv.easing });
    });
    const bd = SPR_BODY();
    const openBody = next && $('.ax-pass-body', target);
    if (openBody) {
      const h = openBody.scrollHeight;
      openBody.animate([{ height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0, overflow: 'hidden' }, { height: h + 'px', paddingTop: '14px', paddingBottom: '16px', opacity: 1, overflow: 'hidden' }], { duration: bd.duration, easing: bd.easing });
      requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }
    if (closingBody && closingH) {
      const a = closingBody.animate([{ height: closingH + 'px', paddingTop: '14px', paddingBottom: '16px', opacity: 1 }, { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 }], { duration: Math.round(bd.duration * 0.8), easing: bd.easing });
      const done = () => { delete closingBody.dataset.closing; closingBody.style.cssText = ''; if (!closingBody.closest('.ax-pass.open')) closingBody.hidden = true; };
      a.onfinish = done; a.oncancel = done;
    }
  }
  // Neighbouring pass in the same stack (date order); dir +1 = next, -1 = previous
  function passNeighbour(card, dir) {
    const list = $$('.ax-pass', card.closest('.ax-stack'));
    return list[list.indexOf(card) + dir] || null;
  }
  function stepPass(dir, fromX) {
    const card = walletOpen && $(`.ax-pass[data-item="${CSS.escape(walletOpen)}"]`); if (!card) return false;
    const to = passNeighbour(card, dir);
    if (!to) {   // end of the stack: a little bump instead of a flip
      if (!REDUCE) card.animate([{ transform: `translateX(${fromX || 0}px)` }, { transform: `translateX(${dir > 0 ? -14 : 14}px)` }, { transform: 'translateX(0)' }], { duration: 360, easing: 'cubic-bezier(.3,.7,.4,1)' });
      return false;
    }
    const w = card.getBoundingClientRect().width;
    togglePass(to.getAttribute('data-item'), { enterX: dir > 0 ? w * 0.9 : -w * 0.9, fromX: fromX || 0 });
    return true;
  }
  // Drag the pulled-out pass: down to put it back; left/right to flip to the next/previous pass.
  function bindPassDrag() {
    const box = $('#ax-wallet'); if (!box || box.dataset.drag) return;
    box.dataset.drag = '1';
    let drag = null;
    box.addEventListener('pointerdown', e => {
      const card = e.target.closest('.ax-pass.open');
      if (!card || !e.target.closest('.ax-pass-head, .ax-pass-face') || e.button > 0) return;
      drag = { card, x: e.clientX, y: e.clientY, dx: 0, dy: 0, id: e.pointerId, axis: null, samples: [[performance.now(), e.clientX]] };
    });
    box.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const rx = e.clientX - drag.x, ry = e.clientY - drag.y;
      if (!drag.active && Math.hypot(rx, ry) < 6) return;
      if (!drag.active) {
        drag.active = true; drag.axis = Math.abs(rx) > Math.abs(ry) ? 'x' : 'y';
        try { drag.card.setPointerCapture(e.pointerId); } catch (err) {}
        drag.card.getAnimations().forEach(a => a.cancel()); drag.card.classList.add('dragging');
      }
      const now = performance.now();
      if (drag.axis === 'x') {
        // follow sideways; resist where there's no pass to flip to
        const dir = rx < 0 ? 1 : -1, can = !!passNeighbour(drag.card, dir);
        drag.dx = can ? rx : rx * 0.28;
        drag.samples.push([now, e.clientX]); while (drag.samples.length > 2 && now - drag.samples[0][0] > 100) drag.samples.shift();
        drag.card.style.transform = `translateX(${drag.dx}px) rotate(${Math.max(-3, Math.min(3, drag.dx / 120))}deg)`;
      } else {
        // follow the finger downwards, rubber-band upwards
        drag.dy = ry > 0 ? ry : -Math.sqrt(-ry) * 3;
        drag.card.style.transform = `translateY(${drag.dy}px) rotate(${Math.max(-1.2, Math.min(1.2, drag.dy / 260))}deg)`;
      }
      e.preventDefault();
    });
    const end = e => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const d = drag; drag = null;
      d.card.classList.remove('dragging');
      if (!d.active) return;
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      if (d.axis === 'x') {
        // release speed over the last ~100 ms (px/ms) — a quick flick flips even if it's short
        const sm = d.samples, a = sm[0], z = sm[sm.length - 1], vx = (z[1] - a[1]) / Math.max(16, z[0] - a[0]);
        const dir = d.dx < 0 ? 1 : -1, flick = Math.abs(vx) > 0.4 && Math.abs(d.dx) > 24 && Math.sign(vx) === Math.sign(d.dx);
        if ((Math.abs(d.dx) > 80 || flick) && passNeighbour(d.card, dir)) { stepPass(dir, d.dx); return; }
      }
      if (d.axis === 'y' && d.dy > 90) togglePass(d.card.getAttribute('data-item'), { noFocus: false });   // FLIP starts from the dragged position
      else {
        const mv = SPR_MOVE(), from = d.card.style.transform;
        d.card.style.transform = '';
        if (!REDUCE) d.card.animate([{ transform: from }, { transform: 'translate(0, 0) rotate(0deg)' }], { duration: mv.duration, easing: mv.easing });
      }
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
  }
  function editRef(id) {
    const card = $(`.ax-wal[data-item="${CSS.escape(id)}"]`); if (!card) return;
    const row = Store.remote && Store.remote.get(id);
    const slot = $('.ax-ref-slot', card);
    slot.innerHTML = `<form class="ax-ref-form"><label class="ax-sr" for="ax-ref-in">Booking reference</label><input id="ax-ref-in" maxlength="60" autocomplete="off" spellcheck="false" placeholder="e.g. PNR or confirmation no." value="${esc((row && row.reference) || '')}"><button type="submit" class="ax-btn pri">Save</button><button type="button" class="ax-btn tick" data-ref-cancel>Cancel</button></form>`;
    const f = $('form', slot), inp = $('input', slot); inp.focus();
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const v = inp.value.trim() || null;
      try {
        const rows = await sbFetch('booking_items?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ reference: v }), headers: { Prefer: 'return=representation' } });
        if (rows && rows[0]) Store.remote.set(id, rows[0]);
        toast(v ? 'Reference saved — synced for the family' : 'Reference removed');
      } catch (err) { toast('Couldn’t save the reference: ' + String(err.message || err).slice(0, 80)); }
      renderDocsView();
    });
  }
  async function uploadFile(itemId, input) {
    const file = input.files && input.files[0]; if (!file) return;
    input.value = '';
    if (!OK_MIME.test(file.type)) return toast('Only PDFs and photos (JPG, PNG, WebP, HEIC) can be attached');
    if (file.size > 10485760) return toast('That file is over 10 MB');
    const it = Store.remote && Store.remote.get(itemId); if (!it) return toast('Sync this device first');
    const safe = file.name.replace(/[^A-Za-z0-9._ ()+-]+/g, '-').replace(/^-+|-+$/g, '').slice(-80) || 'file';
    const path = `${it.trip_id}/${itemId}/${Date.now()}-${safe}`;
    const label = input.closest('label'); if (label) label.classList.add('busy');
    toast('Uploading ' + safe + '…');
    try {
      await sbStorage('atlas-docs/' + encPath(path), { method: 'POST', body: file, headers: { 'Content-Type': file.type, 'x-upsert': 'false' } });
      try {
        const rows = await sbFetch('attachments', { method: 'POST', body: JSON.stringify({ item_id: itemId, path, file_name: safe, mime: file.type, size_bytes: file.size }), headers: { Prefer: 'return=representation' } });
        Store.attachments = (Store.attachments || []).concat(rows || []);
      } catch (e) { await sbStorage('atlas-docs/' + encPath(path), { method: 'DELETE' }).catch(() => {}); throw e; }
      toast('Attached — available to the family on every synced device');
    } catch (e) { toast('Upload failed: ' + String(e.message || e).slice(0, 90)); }
    renderDocsView();
  }
  async function openFile(path, name) {
    const w = window.open('', '_blank');
    if (w) { try { w.document.title = name; w.document.body.style.cssText = 'font:14px system-ui;padding:24px;color:#555'; w.document.body.textContent = 'Opening ' + name + '…'; } catch (e) {} }
    try {
      const r = await sbStorage('authenticated/atlas-docs/' + encPath(path));
      const url = URL.createObjectURL(await r.blob());
      if (w) w.location.href = url;
      else { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { if (w) w.close(); toast('Couldn’t open the file: ' + String(e.message || e).slice(0, 80)); }
  }
  async function deleteFile(id) {
    const f = (Store.attachments || []).find(a => a.id === id); if (!f) return;
    if (!window.confirm('Remove “' + f.file_name + '” for everyone?')) return;
    try {
      await sbStorage('atlas-docs/' + encPath(f.path), { method: 'DELETE' });
      await sbFetch('attachments?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
      Store.attachments = Store.attachments.filter(a => a.id !== id);
      toast('Removed');
    } catch (e) { toast('Couldn’t remove it: ' + String(e.message || e).slice(0, 80)); }
    renderDocsView();
  }

  // ---------- ATLAS Intelligence (UI over atlas/engine.js) ----------
  const PROV = { verified: 'Verified', vendor_rule: 'Vendor rule', estimate: 'Estimate', check: 'ATLAS check', suggestion: 'Suggestion', recorded: 'Recorded', planned: 'Planned' };
  const PROV_TIP = { verified: 'From a confirmation or a booking marked done', vendor_rule: 'The vendor’s published release rule, as researched — not re-checked', estimate: 'ATLAS’s recommended buffer, not a vendor date', check: 'Computed by ATLAS from your bookings and trip dates', suggestion: 'An ATLAS recommendation', recorded: 'Entered in ATLAS, not yet verified', planned: 'In the plan, not booked' };
  const PRI_LABEL = { urgent: 'Urgent', upcoming: 'Upcoming', confirmed: 'Confirmed' };
  const LOCAL_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'; } catch (e) { return 'Asia/Kolkata'; } })();
  let intelOpen = false, intelTab = 'all', askIntent = null, remindFor = null, calPast = false;
  function engineModel(t) {
    return { todayIso: ymdOf(today()), nowMs: Date.now(), localTz: LOCAL_TZ, synced: !!Store.remote,
      trip: Object.assign({}, t, { status: status(t), stops: t.stops.map((s, i) => Object.assign({ seq: i + 1 }, s)) }),
      items: items(t.id), travellers: Store.travellers, deps: DEPS,
      days: dayList(t).map(d => ({ n: d.n, date: ymdOf(d.date) })) };
  }
  function insightsFor(t) { try { return window.AtlasEngine ? AtlasEngine.buildInsights(engineModel(t)) : []; } catch (e) { if (window.console) console.error('[ATLAS] insights failed', e); return null; } }
  const provTag = p => p ? `<span class="ax-prov ${esc(p)}" title="${esc(PROV_TIP[p] || '')}">${esc(PROV[p] || p)}</span>` : '';
  function dateLine(d) {
    if (!d) return '';
    const txt = window.AtlasEngine ? AtlasEngine.whenText({ date: d.date, ts: d.ts, tz: d.tz }, LOCAL_TZ) : fmt(d.date);
    const n = days(d.date);
    const rel = n == null ? '' : n === 0 ? 'today' : n > 0 ? 'in ' + plural(n, 'day') : plural(-n, 'day') + ' ago';
    return `<div class="ax-in-date"><span>${esc(d.label || 'Date')}</span><b>${esc(txt)}</b><em>${esc(rel)}</em></div>`;
  }
  function insightCard(x, compact) {
    const a = x.action || {};
    const act = a.href ? `<a class="ax-btn ${x.priority === 'urgent' ? 'urgent' : 'pri'}" href="${esc(a.href)}" target="_blank" rel="noopener noreferrer">${esc(a.label)} ↗</a>`
      : a.remind ? `<button type="button" class="ax-btn pri" data-remind="${esc(x.id)}">🔔 ${esc(a.label)}</button>`
      : a.route ? `<button type="button" class="ax-btn ${x.priority === 'urgent' ? 'urgent' : 'pri'}" data-route="${esc(a.route)}">${esc(a.label)} →</button>` : '';
    const rem = x.remind && !(a.remind) ? `<button type="button" class="ax-btn tick" data-remind="${esc(x.id)}">🔔 Remind me</button>` : '';
    const tick = x.tick && Store.remote !== undefined ? `<button type="button" class="ax-btn tick" data-tick="${esc(x.tick.id)}" data-field="done" data-value="true">✓ ${esc(x.tick.label)}</button>` : '';
    const link = x.link ? `<a class="ax-in-link" href="${esc(x.link.route)}" data-route="${esc(x.link.route)}">${esc(x.link.label)}</a>` : '';
    const picker = remindFor === x.id ? remindPicker(x) : '';
    return `<article class="ax-in ${x.priority}" data-insight="${esc(x.id)}">
      <div class="ax-in-top"><span class="ax-in-pri">${PRI_LABEL[x.priority]}</span>${provTag(x.provenance)}${link}</div>
      <h3>${esc(x.title)}</h3>
      <p>${esc(x.text || '')}</p>
      ${x.why && !compact ? `<p class="ax-in-why"><b>Why it matters</b> ${esc(x.why)}</p>` : x.why ? `<p class="ax-in-why">${esc(x.why)}</p>` : ''}
      ${dateLine(x.date)}
      ${picker}
      <div class="ax-in-foot">${tick}${rem}${act}</div>
    </article>`;
  }
  function renderIntel(t) {
    const box = $('#ax-insights'); if (!box) return;
    const sub = $('#ax-intel-sub'), counts = $('#ax-intel-counts'), toggle = $('#ax-intel-toggle');
    if (!window.AtlasEngine) { box.innerHTML = '<div class="ax-empty"><b>Intelligence didn’t load</b>Refresh the page to try again.</div>'; return; }
    const list = insightsFor(t);
    if (list == null) { box.innerHTML = '<div class="ax-empty"><b>Couldn’t analyse this trip</b>Something in the trip data couldn’t be read. The rest of ATLAS still works.</div>'; return; }
    const by = p => list.filter(x => x.priority === p);
    const u = by('urgent'), up = by('upcoming'), c = by('confirmed');
    counts.innerHTML = `<span class="u">${u.length} urgent</span><span class="a">${up.length} upcoming</span><span class="c">${c.length} confirmed</span>`;
    sub.textContent = Store.mode === 'syncing' ? 'Checking your latest bookings…'
      : Store.remote ? `Checked against ${t.name}’s bookings, dates and travellers just now.`
      : 'Using this device’s copy — passports, party sizes and references need sync for the full check.';
    const top = u.concat(up).slice(0, 3);
    if (!list.length) box.innerHTML = '<div class="ax-empty"><b>Nothing to report</b>No bookings or deadlines are recorded for this trip yet.</div>';
    else if (!top.length) box.innerHTML = `<div class="ax-empty ok"><b>All clear</b>${c.length ? c.map(x => esc(x.title)).join(' · ') : 'Nothing needs attention.'}</div>`;
    else box.innerHTML = top.map(x => insightCard(x, true)).join('');
    toggle.textContent = intelOpen ? 'Hide details' : `View all ${plural(list.length, 'insight')}`;
    toggle.setAttribute('aria-expanded', String(intelOpen));
    const panel = $('#ax-intel-panel'); panel.hidden = !intelOpen;
    $$('#ax-intel-tabs button').forEach(b => { const on = b.getAttribute('data-itab') === intelTab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    if (intelOpen) renderIntelPane(t, list);
    renderAskChips();
  }
  function renderIntelPane(t, list) {
    const pane = $('#ax-intel-pane');
    if (intelTab === 'all') {
      pane.innerHTML = ['urgent', 'upcoming', 'confirmed'].map(p => { const xs = list.filter(x => x.priority === p); return xs.length ? `<section class="ax-in-group ${p}"><h3>${PRI_LABEL[p]} <span>${xs.length}</span></h3><div class="ax-insights all">${xs.map(x => insightCard(x, false)).join('')}</div></section>` : ''; }).join('')
        + `<p class="ax-in-legend">${Object.keys(PROV).filter(k => k !== 'recorded' && k !== 'planned').map(k => provTag(k) + ' ' + esc(PROV_TIP[k])).join('<br>')}</p>`;
    } else if (intelTab === 'calendar') pane.innerHTML = calendarHtml(t);
    else if (intelTab === 'reminders') pane.innerHTML = remindersHtml(t);
    else if (intelTab === 'ask') pane.innerHTML = askHtml(t, list);
  }
  // Booking calendar: every dated event of the trip, by month
  const TL_ICON = { window: '🎟️', cancel: '↩️', document: '📄', flight: '✈️', checkin: '🏨', checkout: '🧳', activity: '📍', trip: '🌏' };
  function calendarHtml(t) {
    const tl = AtlasEngine.buildTimeline(engineModel(t));
    if (!tl.length) return '<div class="ax-empty"><b>No dated bookings yet</b>Booking windows, deadlines and stays appear here once they’re recorded.</div>';
    const todayIso = ymdOf(today());
    const past = tl.filter(e => e.date < todayIso), next = tl.filter(e => e.date >= todayIso);
    const row = e => {
      const n = days(e.date);
      return `<li class="ax-cal-row ${e.type}${e.conflict ? ' conflict' : ''}${e.done ? ' done' : ''}">
        <span class="ax-cal-d"><b>${parse(e.date).getDate()}</b>${fmt(e.date, { weekday: 'short' })}</span>
        <span class="ax-cal-i" aria-hidden="true">${TL_ICON[e.type] || '•'}</span>
        <span class="ax-cal-t"><b>${esc(e.title)}</b><small>${esc(AtlasEngine.whenText(e, LOCAL_TZ))}${e.conflict ? ' · ⚠️ rule gives ' + esc(AtlasEngine.fmtDate(e.ruleDate)) : ''}</small></span>
        ${provTag(e.provenance)}<span class="ax-cal-n">${n === 0 ? 'today' : n > 0 ? 'in ' + n + 'd' : ''}</span>
        ${e.itemId ? `<a class="ax-in-link" href="#/documents/item/${encodeURIComponent(e.itemId)}" data-route="#/documents/item/${encodeURIComponent(e.itemId)}" aria-label="Open ${esc(e.title)} in the wallet">→</a>` : '<span></span>'}</li>`;
    };
    const months = {};
    next.forEach(e => { const k = e.date.slice(0, 7); (months[k] = months[k] || []).push(e); });
    return `<p class="ax-cal-note">Times are shown at the destination and in your time zone (${esc(AtlasEngine.tzShort(LOCAL_TZ))}). Dates without a time are the local date there.</p>`
      + Object.keys(months).map(k => `<section class="ax-cal-m"><h3>${fmt(k + '-01', { month: 'long', year: 'numeric' })}</h3><ul>${months[k].map(row).join('')}</ul></section>`).join('')
      + (past.length ? `<button type="button" class="ax-btn tick" data-cal-past>${calPast ? 'Hide' : 'Show'} ${plural(past.length, 'earlier date')}</button>${calPast ? `<ul class="ax-cal-past">${past.map(row).join('')}</ul>` : ''}` : '');
  }
  // Reminders: saved in atlas.reminders; delivered by the device calendar (.ics)
  function remindPicker(x) {
    const presets = AtlasEngine.reminderPresets(x.remind, LOCAL_TZ).filter(p => p.at > Date.now());
    if (!presets.length) return '<div class="ax-remind"><span>This date has already passed.</span></div>';
    return `<div class="ax-remind" role="group" aria-label="Choose when to be reminded"><span>Remind me…</span>${presets.map(p => `<button type="button" class="ax-btn ghost" data-remind-at="${p.at}" data-remind-key="${esc(x.id)}">${esc(p.label)}<small>${esc(AtlasEngine.fmtInstant(p.at, LOCAL_TZ))}</small></button>`).join('')}<button type="button" class="ax-btn tick" data-remind-cancel>Cancel</button></div>`;
  }
  function icsEvent(o) {
    const e = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const utc = ts => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const d8 = iso => iso.replace(/-/g, '');
    const start = o.ts != null ? 'DTSTART:' + utc(o.ts) : 'DTSTART;VALUE=DATE:' + d8(o.date);
    const end = o.ts != null ? 'DTEND:' + utc(o.ts + 1800000) : 'DTEND;VALUE=DATE:' + d8(AtlasEngine.isoOf(AtlasEngine.dayNum(o.date) + 1));
    return ['BEGIN:VEVENT', 'UID:' + o.uid + '@travel.ryst.in', 'DTSTAMP:' + utc(Date.now()), start, end, 'SUMMARY:' + e(o.title), 'DESCRIPTION:' + e(o.desc || ''), o.url ? 'URL:' + o.url : '',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + e(o.title), 'TRIGGER;VALUE=DATE-TIME:' + utc(o.alarmAt), 'END:VALARM', 'END:VEVENT'].filter(Boolean);
  }
  function downloadIcs(events, name) {
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ATLAS//Family Travel//EN', 'CALSCALE:GREGORIAN'].concat(...events, ['END:VCALENDAR']).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function createReminder(x, at) {
    const t = trip(focusId), r = x.remind;
    const item = r.itemId ? items(t.id).find(i => i.id === r.itemId) : null;
    const ev = { uid: 'atlas-' + (r.itemId || x.id).replace(/[^a-z0-9]/gi, '-') + '-' + at, title: r.title, date: r.date, ts: r.ts != null ? r.ts : null, alarmAt: at,
      desc: (x.text || '') + (x.why ? '\n' + x.why : ''), url: item && item.url };
    downloadIcs([icsEvent(ev)], 'atlas-reminder.ics');
    remindFor = null;
    if (Store.remote) {
      try {
        const rows = await sbFetch('reminders', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ trip_id: t.id, item_id: r.itemId || null, kind: r.kind, title: r.title, remind_at: new Date(at).toISOString(), event_at: r.ts != null ? new Date(r.ts).toISOString() : new Date(AtlasEngine.zonedToUtc(r.date, '09:00', LOCAL_TZ)).toISOString(), channel: 'calendar' }) });
        Store.reminders = (Store.reminders || []).concat(rows || []);
        toast('Reminder saved in ATLAS and added to your calendar file — open it to finish');
      } catch (e) { toast('Calendar file downloaded; saving to ATLAS failed — ' + String(e.message || e).slice(0, 60)); }
    } else toast('Calendar file downloaded — open it to add the reminder (sync to keep a copy in ATLAS)');
    renderIntel(t);
  }
  function remindersHtml(t) {
    const head = '<p class="ax-cal-note">ATLAS saves reminders here and puts them in your phone or computer calendar, which sends the alert. ATLAS can’t send notifications on its own yet — email or push needs a scheduled sender on the server (not set up).</p>';
    if (!Store.remote) return head + '<div class="ax-empty"><b>Sync to keep reminders</b>On this device, “Remind me” only downloads a calendar file.</div>';
    const rs = (Store.reminders || []).filter(r => r.trip_id === t.id && r.status !== 'dismissed').sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at));
    if (!rs.length) return head + '<div class="ax-empty"><b>No reminders yet</b>Use “Remind me” on any insight — booking windows, cancellation deadlines, documents or flights.</div>';
    return head + `<ul class="ax-rem-list">${rs.map(r => `<li><span class="ax-cal-i">🔔</span><span class="ax-cal-t"><b>${esc(r.title)}</b><small>Remind ${esc(AtlasEngine.fmtInstant(new Date(r.remind_at).getTime(), LOCAL_TZ))} ${esc(AtlasEngine.tzShort(LOCAL_TZ))}${new Date(r.remind_at) < new Date() ? ' · passed' : ''} · by ${esc((r.created_by || '').split('@')[0])}</small></span><button type="button" class="ax-btn tick" data-rem-ics="${esc(r.id)}">Add to calendar</button><button type="button" class="ax-btn tick" data-rem-del="${esc(r.id)}">Remove</button></li>`).join('')}</ul>
      <button type="button" class="ax-btn ghost" data-rem-all>Add all ${rs.length} to calendar</button>`;
  }
  function remIcs(r) { return icsEvent({ uid: 'atlas-rem-' + r.id, title: r.title, date: (r.event_at || r.remind_at).slice(0, 10), ts: r.event_at ? new Date(r.event_at).getTime() : null, alarmAt: new Date(r.remind_at).getTime(), desc: 'ATLAS reminder' }); }
  // Ask ATLAS — deterministic answers from the engine
  function renderAskChips() {
    const row = $('#ax-ask-chips'); if (!row || !window.AtlasEngine) return;
    row.innerHTML = AtlasEngine.INTENTS.map(i => `<button type="button" data-ask="${i.id}" aria-pressed="${askIntent === i.id && intelOpen && intelTab === 'ask'}">${esc(i.label)}</button>`).join('');
  }
  function askHtml(t, list) {
    const form = `<form class="ax-ask-form" id="ax-ask-form"><label class="ax-sr" for="ax-ask-in">Ask ATLAS about this trip</label><input id="ax-ask-in" placeholder="Ask about ${esc(t.name)} — e.g. what should I book next?" autocomplete="off"><button class="ax-btn pri" type="submit">Ask</button></form>`;
    if (!askIntent) return form + '<p class="ax-cal-note">Pick a question above or type one. Answers come only from your ATLAS data — no AI model is connected yet, so anything ATLAS can’t determine is listed as missing.</p>';
    const a = AtlasEngine.answer(askIntent, engineModel(t), list);
    const q = AtlasEngine.INTENTS.find(i => i.id === askIntent);
    return form + `<div class="ax-answer" aria-live="polite"><small>${esc(q ? q.label : 'Your question')}</small><h3>${esc(a.headline)}</h3>
      ${a.points.length ? `<ul>${a.points.map(p => `<li class="${p.ok ? 'ok' : ''}">${provTag(p.provenance)} ${esc(p.text)}</li>`).join('')}</ul>` : ''}
      ${a.missing.length ? `<div class="ax-missing"><b>Can’t tell from your data</b>${a.missing.map(x => `<p>${esc(x)}</p>`).join('')}</div>` : ''}
      <p class="ax-in-legend">Grounded in ${esc(t.name)}’s bookings, dates and travellers in ATLAS. Labels show what’s verified, a vendor rule, an estimate or an ATLAS check.</p></div>`;
  }
  function intelClick(e) {
    const t = trip(focusId); if (!t) return false;
    const tg = e.target.closest('#ax-intel-toggle');
    if (tg) { intelOpen = !intelOpen; renderIntel(t); return true; }
    const tab = e.target.closest('#ax-intel-tabs button');
    if (tab) { intelTab = tab.getAttribute('data-itab'); intelOpen = true; renderIntel(t); return true; }
    const ask = e.target.closest('[data-ask]');
    if (ask) { askIntent = ask.getAttribute('data-ask'); intelOpen = true; intelTab = 'ask'; renderIntel(t); const p = $('#ax-intel-panel'); if (p) p.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' }); return true; }
    const rm = e.target.closest('[data-remind]');
    if (rm) { remindFor = remindFor === rm.getAttribute('data-remind') ? null : rm.getAttribute('data-remind'); renderIntel(t); const c = $(`[data-insight="${CSS.escape(rm.getAttribute('data-remind'))}"] .ax-remind button`); if (c) c.focus(); return true; }
    if (e.target.closest('[data-remind-cancel]')) { remindFor = null; renderIntel(t); return true; }
    const at = e.target.closest('[data-remind-at]');
    if (at) { const x = (insightsFor(t) || []).find(i => i.id === at.getAttribute('data-remind-key')); if (x) createReminder(x, +at.getAttribute('data-remind-at')); return true; }
    if (e.target.closest('[data-cal-past]')) { calPast = !calPast; renderIntel(t); return true; }
    const ri = e.target.closest('[data-rem-ics]');
    if (ri) { const r = (Store.reminders || []).find(x => x.id === ri.getAttribute('data-rem-ics')); if (r) { downloadIcs([remIcs(r)], 'atlas-reminder.ics'); toast('Calendar file downloaded — open it to add the reminder'); } return true; }
    if (e.target.closest('[data-rem-all]')) { const rs = (Store.reminders || []).filter(r => r.trip_id === t.id && r.status !== 'dismissed'); downloadIcs(rs.map(remIcs), 'atlas-reminders.ics'); toast(`${plural(rs.length, 'reminder')} in one calendar file — open it to add them`); return true; }
    const rd = e.target.closest('[data-rem-del]');
    if (rd) { (async () => { try { await sbFetch('reminders?id=eq.' + encodeURIComponent(rd.getAttribute('data-rem-del')), { method: 'DELETE' }); Store.reminders = Store.reminders.filter(r => r.id !== rd.getAttribute('data-rem-del')); toast('Reminder removed from ATLAS (remove it from your calendar too)'); } catch (err) { toast('Couldn’t remove it'); } renderIntel(t); })(); return true; }
    return false;
  }
  function intelSubmit(e) {
    if (!e.target.closest('#ax-ask-form')) return false;
    e.preventDefault();
    const q = $('#ax-ask-in').value, id = AtlasEngine.detectIntent(q);
    askIntent = id; renderIntel(trip(focusId));
    if (!id) { const p = $('#ax-intel-pane'); p.insertAdjacentHTML('beforeend', `<div class="ax-missing"><b>ATLAS can’t answer that from your data yet</b><p>It can answer: ${AtlasEngine.INTENTS.map(i => esc(i.label)).join(' · ')}</p></div>`); }
    return true;
  }
  function verifyItem(id) {
    (async () => {
      try { const rows = await sbFetch('booking_items?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ verified_at: new Date().toISOString() }) }); if (rows && rows[0]) Store.remote.set(id, rows[0]); toast('Marked as verified today'); }
      catch (e) { toast('Couldn’t save — ' + String(e.message || e).slice(0, 60)); }
      refreshAll();
    })();
  }

  // ---------- Calendar reminders (.ics) ----------
  function ics(id) {
    const all = trips().reduce((a, t) => a.concat(items(t.id)), []);
    const i = all.find(x => x.id === id);
    if (!i) return;
    const date = i.opens_on || i.due_on || i.event_date;
    const D = parse(date); if (!D) return;
    const ymd = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const end = new Date(D); end.setDate(end.getDate() + 1);
    const e = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const summary = i.opens_on ? 'Booking opens: ' + i.title : 'Due: ' + i.title;
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ATLAS//Family Travel//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:atlas-' + id.replace(/[^a-z0-9]/gi, '-') + '@travel.ryst.in', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
      'DTSTART;VALUE=DATE:' + ymd(D), 'DTEND;VALUE=DATE:' + ymd(end), 'SUMMARY:' + e(summary), 'DESCRIPTION:' + e(i.detail + (i.url ? '\n' + i.url : '')),
      i.url ? 'URL:' + i.url : '', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + e(summary),
      i.opens_on ? 'TRIGGER;RELATED=START:PT8H' : 'TRIGGER;RELATED=START:-P7D', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean);
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'atlas-' + id.replace(/[^a-z0-9]+/gi, '-') + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(i.opens_on ? `Reminder for ${fmt(date)} downloaded — open it to add to your calendar` : `Reminder (a week before ${fmt(date)}) downloaded`);
  }

  // ---------- Globe (Canvas 2D: no WebGL and no library needed) ----------
  const LAND_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAQAAAACAAQAAAADMzoqnAAAAAXNSR0IArs4c6QAABA5JREFUeNrV179uHEUAx/Hf3JpbF+E2VASBsmVKTBcpKJs3SMEDcDwBiVJAAewYEBUivIHT0uUBIt0YCovKD0CRjUC4QfHYh8hYXu+P25vZ2Zm9c66gMd/GJ/tz82d3bk8GN4SrByYF2366FNTACIAkivVAAazQdnf3MvAlbNUQfOPAdQDvSAimMWhwy4I2g4SU+Kp04ISLpPBAKLxPyic3O/CCi+Y7rUJbiodcpDOFY7CgxCEXmdYD2EYK2s5lApOx5pEDDYCUwM1XdJUwBV11QQMg59kePSCaPAASQMEL2hwo6TJFgxpg+TgC2ymXPbuvc40awr3D1QCFfbH9kcoqAOkZozpQo0aqAGQRKCog/+tjkgbNFEtg2FffBvBGlSxHoAaAa1u6X4PBAwDiR8FFsrQgeUhfJTSALaB9jy5NCybJPn1SVFiWk7ywN+KzhH1aKAuydhGkbEF4lWohLXDXavlyFgHY7LBnLRdlAP6BS5Cc8RfVDXbkwN/oIvmY+6obbNeBP0JwTuMGu9gTzy1Q4RS/cWpfzszeYwd+CAFrtBW/Hur0gLbJGlD+/OjVwe/drfBxkbbg63dndEDfiEBlAd7ac0BPe1D6Jd8dfbLH+RI0OzseFB5s01/M+gMdAeluLOCAuaUA9Lezo/vSgXoCX9rtEiXnp7Q1W/CNyWcd8DXoS6jH/YZ5vAJEWY2dXFQe2TUgaFaNejCzJ98g6HnlVrsE58sDcYqg+9XY75fPqdoh/kRQWiXKg8MWlJQxUFMPjqnyujhFBE7UxIMjyszk0QwQlFsezImsyvUYYYVED2pk6m0Tg8T04Fwjk2kdAwSACqlM6gRRt3vQYAFGX0Ah7Ebx1H+MDRI5ui0QldH4j7FGcm90XdxD2Jg1AOEAVAKhEFXSn4cKUELurIAKwJ3MArypPscQaLhJFICJ0ohjDySAdH8AhDtCiTuMycH8CXzhH9jUACAO5uMhoAwA5i+T6WAKmmAqnLy80wxHqIPFYpqCwxGaYLt4Dyievg5kEoVEUAhs6pqKgFtDQYOuaXypaWKQfIuwwoGSZgfLsu/XAtI8cGN+h7Cc1A5oLOMhwlIPXuhu48AIvsSBkvtV9wsJRKCyYLfq5lTrQMFd1a262oqBck9K1V0YjQg0iEYYgpS1A9GlXQV5cykwm4A7BzVsxQqo7E+zCegO7Ma7yKgsuOcfKbMBwLC8wvVNYDsANYalEpOAa6zpWjTeMKGwEwC1CiQewJc5EKfgy7GmRAZA4vUVGwE2dPM/g0xuAInE/yG5aZ8ISxWGfYigUVbdyBElTHh2uCwGdfCkOLGgQVBh3Ewp+/QK4CDlR5Ws/Zf7yhCf8pH7vinWAvoVCQ6zz0NX5V/6GkAVV+2/5qsJ/gU8bsxpM8IeAQAAAABJRU5ErkJggg==';
  const Globe = (function () {
    let copyBox = null, stage, cv, ctx, W = 0, H = 0, dpr = 1, R = 0, cx = 0, cy = 0, pts = null, stars = [], arcs = [], labels = [], tip;
    let raf = 0, running = false, visible = true, last = 0, dirty = true, inited = false;
    const st = { lam: 108 * RAD, phi: 24 * RAD, vLam: 0, vPhi: 0, drag: null, hover: null, paused: false, target: null };
    const v3 = (lat, lng) => { const a = lat * RAD, o = lng * RAD; return [Math.cos(a) * Math.cos(o), Math.cos(a) * Math.sin(o), Math.sin(a)]; };
    function project(x, y, z) {
      const cl = Math.cos(st.lam), sl = Math.sin(st.lam), cp = Math.cos(st.phi), sp = Math.sin(st.phi);
      const px = x * cl + y * sl, py = -x * sl + y * cl;
      return { x: cx + R * py, y: cy - R * (-px * sp + z * cp), d: px * cp + z * sp, r: py, u: -px * sp + z * cp };
    }
    function centerOn(t) {
      const a = v3(HOME.lat, HOME.lng), hub = t.stops[0], b = v3(hub.lat, hub.lng);
      const ang = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
      const m = ang < 0.12 ? b : [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
      const len = Math.hypot(m[0], m[1], m[2]);
      return { lam: Math.atan2(m[1] / len, m[0] / len), phi: Math.max(-0.35, Math.min(0.75, Math.asin(m[2] / len))) };
    }
    function buildArcs() {
      const nx = nextTrip();
      arcs = [];
      const add = (A, B, next) => {
        const a = v3(A.lat, A.lng), b = v3(B.lat, B.lng);
        const w = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
        if (w < 0.03) return;
        const S = 64, out = new Float32Array(S * 3), alt = Math.min(0.32, 0.08 + w * 0.2), sw = Math.sin(w);
        for (let k = 0; k < S; k++) {
          const f = k / (S - 1), s1 = Math.sin((1 - f) * w) / sw, s2 = Math.sin(f * w) / sw, h = 1 + alt * Math.sin(Math.PI * f);
          out[k * 3] = (a[0] * s1 + b[0] * s2) * h; out[k * 3 + 1] = (a[1] * s1 + b[1] * s2) * h; out[k * 3 + 2] = (a[2] * s1 + b[2] * s2) * h;
        }
        arcs.push({ pts: out, next, off: arcs.length * 0.37 });
      };
      trips().forEach(t => {
        const isNext = nx && nx.id === t.id;
        add(HOME, t.stops[0], isNext);
        for (let k = 1; k < t.stops.length; k++) add(t.stops[k - 1], t.stops[k], isNext);
        add(t.stops[t.stops.length - 1], HOME, isNext);
      });
    }
    function buildLabels() {
      $$('.ax-pin', stage).forEach(n => n.remove());
      const nx = nextTrip();
      labels = trips().map(t => {
        const b = document.createElement('button');
        b.type = 'button';
        const isNext = nx && nx.id === t.id, st0 = status(t);
        b.className = 'ax-pin off' + (isNext ? ' next' : '');
        b.innerHTML = `<i></i>${esc(t.short)} <small>${isNext ? (days(t.start) > 0 ? days(t.start) + ' days' : 'now') : st0 === 'completed' ? '✓' : ''}</small>`;
        b.setAttribute('aria-label', `Open ${t.name} trip, ${longRange(t)}`);
        b.addEventListener('click', () => go('#/trip/' + t.id));
        b.addEventListener('mouseenter', () => showTip(t.id));
        b.addEventListener('focus', () => showTip(t.id));
        b.addEventListener('mouseleave', hideTip);
        b.addEventListener('blur', hideTip);
        stage.appendChild(b);
        return { el: b, t, v: v3(t.stops[0].lat, t.stops[0].lng) };
      });
      const h = document.createElement('span');
      h.className = 'ax-pin home off'; h.innerHTML = '<i></i>Home · Chennai'; h.setAttribute('aria-hidden', 'true');
      stage.appendChild(h);
      labels.push({ el: h, home: true, v: v3(HOME.lat, HOME.lng) });
      const fb = $('.ax-globe-fallback', stage);
      if (fb) fb.innerHTML = trips().map(t => `<button type="button" class="ax-pin" data-route="#/trip/${t.id}"><i></i>${esc(t.short)}</button>`).join('');
    }
    function showTip(id) {
      const t = trip(id); if (!t || !tip) return;
      const r = readiness(id), stt = status(t);
      tip.innerHTML = `<b>${esc(t.name)} ${t.flag}</b><span>${esc(longRange(t))} · ${tripDays(t)} days<br>${esc(t.stops.map(s => s.name).join(' · '))}</span><em>${stt === 'completed' ? 'Completed · open recap' : (days(t.start) > 0 ? plural(days(t.start), 'day') + ' to go' : 'In progress') + (r ? ' · ' + r.pct + '% ready' : '')}</em>`;
      st.hover = id; st.paused = true; place(); tip.classList.add('on');
    }
    function hideTip() { st.hover = null; st.paused = false; if (tip) tip.classList.remove('on'); }
    function place() {
      if (!st.hover || !tip) return;
      const L = labels.find(l => l.t && l.t.id === st.hover); if (!L) return;
      const p = project(L.v[0], L.v[1], L.v[2]);
      const x = Math.max(8, Math.min(W - 248, p.x + 14)), y = Math.max(8, Math.min(H - 120, p.y + 14));
      tip.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px)`;
    }
    function resize() {
      const r = stage.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const wide = W > 520 && getComputedStyle(stage).position === 'absolute';
      R = wide ? Math.min(W * 0.36, H * 0.39) : Math.min(W * 0.43, H * 0.43);
      cx = wide ? W * 0.58 : W / 2; cy = wide ? H * 0.57 : H / 2;
      // Where the headline sits (desktop overlay only): labels hide while under it.
      const copy = wide && $('.ax-hero-copy');
      if (copy) { const c = copy.getBoundingClientRect(); copyBox = { l: c.left - r.left - 70, r: c.right - r.left + 70, t: c.top - r.top - 10, b: c.bottom - r.top + 34 }; } else copyBox = null;
      stars = [];
      let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let k = 0; k < Math.round(W * H / 9000); k++) {
        const x = rnd() * W, y = rnd() * H;
        if (Math.hypot(x - cx, y - cy) < R * 1.25) continue;
        stars.push({ x, y, s: rnd() < 0.15 ? 1.4 : 0.9, a: 0.15 + rnd() * 0.45, f: 0.0004 + rnd() * 0.0012, p: rnd() * 6.28 });
      }
      dirty = true;
    }
    function loadLand() {
      return new Promise(res => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = 256; c.height = 128;
          const x = c.getContext('2d'); x.drawImage(img, 0, 0);
          let data; try { data = x.getImageData(0, 0, 256, 128).data; } catch (e) { pts = new Float32Array(0); return res(); }
          const N = 16000, ga = Math.PI * (3 - Math.sqrt(5)), out = [];
          for (let i = 0; i < N; i++) {
            const z = 1 - 2 * (i + 0.5) / N, lat = Math.asin(z), lon = ((i * ga) % (2 * Math.PI)) - Math.PI;
            const latD = lat / RAD, lonD = lon / RAD;
            if (latD < -58) continue;
            const px = Math.floor((lonD + 180) / 360 * 256) % 256, py = Math.min(127, Math.floor((90 - latD) / 180 * 128));
            if (data[(py * 256 + px) * 4] > 128) {
              const h = Math.sin(i * 12.9898) * 43758.5453;
              out.push(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat), 0.55 + 0.45 * (h - Math.floor(h)));
            }
          }
          pts = new Float32Array(out); res();
        };
        img.onerror = () => { pts = new Float32Array(0); res(); };
        img.src = 'data:image/png;base64,' + LAND_PNG;
      });
    }
    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (let k = 0; k < stars.length; k++) {
        const s = stars[k];
        ctx.fillStyle = 'rgba(220,230,245,' + (REDUCE ? s.a : s.a * (0.55 + 0.45 * Math.sin(now * s.f + s.p))).toFixed(3) + ')';
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      let g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.3);
      g.addColorStop(0, 'rgba(98,150,230,0.20)'); g.addColorStop(0.35, 'rgba(98,150,230,0.06)'); g.addColorStop(1, 'rgba(98,150,230,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.3, 0, 6.2832); ctx.fill();
      g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
      g.addColorStop(0, '#17324f'); g.addColorStop(0.6, '#0c1f36'); g.addColorStop(1, '#081a2d');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(150,185,240,0.22)'; ctx.lineWidth = 1; ctx.stroke();
      // land as warm "city light" dots, 4 brightness buckets = 4 fills per frame
      if (pts) {
        const cl = Math.cos(st.lam), sl = Math.sin(st.lam), cp = Math.cos(st.phi), sp = Math.sin(st.phi);
        const P = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], sz = Math.max(1.1, R / 170), hs = sz / 2;
        for (let i = 0; i < pts.length; i += 4) {
          const x = pts[i], y = pts[i + 1], z = pts[i + 2];
          const px = x * cl + y * sl, d = px * cp + z * sp;
          if (d < 0.04) continue;
          const py = -x * sl + y * cl, u = -px * sp + z * cp;
          const l = Math.sqrt(d) * pts[i + 3];
          P[l > 0.82 ? 3 : l > 0.62 ? 2 : l > 0.42 ? 1 : 0].rect(cx + R * py - hs, cy - R * u - hs, sz, sz);
        }
        const A = ['rgba(240,214,170,0.22)', 'rgba(244,222,184,0.42)', 'rgba(247,231,200,0.66)', 'rgba(255,240,214,0.92)'];
        for (let b = 0; b < 4; b++) { ctx.fillStyle = A[b]; ctx.fill(P[b]); }
      }
      // routes
      for (let a = 0; a < arcs.length; a++) {
        const A = arcs[a], n = A.pts.length / 3, scr = new Array(n);
        for (let k = 0; k < n; k++) {
          const p = project(A.pts[k * 3], A.pts[k * 3 + 1], A.pts[k * 3 + 2]);
          p.vis = p.d >= 0 || (p.r * p.r + p.u * p.u) > 1;
          scr[k] = p;
        }
        ctx.lineWidth = A.next ? 1.6 : 1;
        ctx.strokeStyle = A.next ? (REDUCE ? 'rgba(255,107,94,0.75)' : 'rgba(255,107,94,0.35)') : 'rgba(139,154,175,0.30)';
        ctx.beginPath();
        let pen = false;
        for (let k = 0; k < n; k++) { const p = scr[k]; if (!p.vis) { pen = false; continue; } if (pen) ctx.lineTo(p.x, p.y); else { ctx.moveTo(p.x, p.y); pen = true; } }
        ctx.stroke();
        if (A.next && !REDUCE) {
          const head = ((now / 2800 + A.off) % 1.35);
          for (let k = 1; k < n; k++) {
            const f = k / (n - 1), dist = head - f;
            if (dist < 0 || dist > 0.22 || !scr[k].vis || !scr[k - 1].vis) continue;
            ctx.strokeStyle = 'rgba(255,140,128,' + (1 - dist / 0.22).toFixed(3) + ')'; ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.moveTo(scr[k - 1].x, scr[k - 1].y); ctx.lineTo(scr[k].x, scr[k].y); ctx.stroke();
          }
        }
      }
      // markers
      const nx = nextTrip();
      trips().forEach(t => {
        const isNext = nx && nx.id === t.id, hov = st.hover === t.id;
        t.stops.forEach((s, k) => {
          const v = v3(s.lat, s.lng), p = project(v[0], v[1], v[2]);
          if (p.d < 0.02) return;
          ctx.fillStyle = isNext ? '#FF6B5E' : hov ? '#ffffff' : '#C9D3E0';
          ctx.beginPath(); ctx.arc(p.x, p.y, k === 0 ? 3 : 2, 0, 6.2832); ctx.fill();
          if (k === 0 && isNext) {
            const ph = REDUCE ? 0.5 : (now / 1600) % 1;
            ctx.strokeStyle = 'rgba(255,107,94,' + (0.6 * (1 - ph)).toFixed(3) + ')'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(p.x, p.y, 4 + ph * 12, 0, 6.2832); ctx.stroke();
          }
        });
      });
      const hv = v3(HOME.lat, HOME.lng), hp = project(hv[0], hv[1], hv[2]);
      if (hp.d > 0.02) { ctx.fillStyle = '#F4B84A'; ctx.beginPath(); ctx.arc(hp.x, hp.y, 3, 0, 6.2832); ctx.fill(); ctx.strokeStyle = 'rgba(244,184,74,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hp.x, hp.y, 6.5, 0, 6.2832); ctx.stroke(); }
      // HTML labels follow their markers
      for (let k = 0; k < labels.length; k++) {
        const L = labels[k], p = project(L.v[0], L.v[1], L.v[2]);
        L.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,${L.home ? '55%' : '-150%'})`;
        const under = copyBox && p.x > copyBox.l && p.x < copyBox.r && p.y > copyBox.t && p.y < copyBox.b;
        L.el.classList.toggle('off', p.d < 0.18 || !!under);
        L.sx = p.x; L.sy = p.y; L.vis = p.d >= 0.05;
      }
      place();
    }
    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (!running || !visible || document.hidden) { last = now; return; }
      const dt = Math.min(50, now - (last || now)); last = now;
      let moving = false;
      if (st.drag == null) {
        if (st.target) {
          let dl = st.target.lam - st.lam; dl = Math.atan2(Math.sin(dl), Math.cos(dl));
          const dp = st.target.phi - st.phi;
          if (REDUCE || (Math.abs(dl) < 0.002 && Math.abs(dp) < 0.002)) { st.lam = st.target.lam; st.phi = st.target.phi; st.target = null; }
          else { st.lam += dl * 0.07; st.phi += dp * 0.07; }
          moving = true;
        } else if (Math.abs(st.vLam) + Math.abs(st.vPhi) > 1e-5) {
          st.lam += st.vLam; st.phi += st.vPhi; st.vLam *= 0.93; st.vPhi *= 0.93; moving = true;
        } else if (!REDUCE && !st.paused) { st.lam -= 0.000035 * dt; moving = true; }
      } else moving = true;
      st.phi = Math.max(-0.6, Math.min(1.0, st.phi));
      if (REDUCE && !moving && !dirty) return;
      dirty = false;
      draw(now);
    }
    function hit(x, y) {
      let best = null, bd = 20;
      trips().forEach(t => t.stops.forEach(s => {
        const v = v3(s.lat, s.lng), p = project(v[0], v[1], v[2]);
        if (p.d < 0.05) return;
        const dd = Math.hypot(p.x - x, p.y - y);
        if (dd < bd) { bd = dd; best = t.id; }
      }));
      return best;
    }
    function bind() {
      const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      cv.addEventListener('pointerdown', e => {
        const p = pos(e);
        st.drag = { x: p.x, y: p.y, lam: st.lam, phi: st.phi, moved: 0, t: performance.now(), px: p.x, py: p.y };
        st.target = null; st.vLam = st.vPhi = 0;
        cv.classList.add('drag');
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      });
      cv.addEventListener('pointermove', e => {
        const p = pos(e);
        if (st.drag) {
          const D = st.drag, k = 1 / R;
          st.lam = D.lam - (p.x - D.x) * k;
          if (e.pointerType !== 'touch') st.phi = D.phi + (p.y - D.y) * k;
          st.vLam = -(p.x - D.px) * k * 0.6; st.vPhi = e.pointerType !== 'touch' ? (p.y - D.py) * k * 0.6 : 0;
          D.px = p.x; D.py = p.y;
          D.moved = Math.max(D.moved, Math.hypot(p.x - D.x, p.y - D.y));
          dirty = true; return;
        }
        const h = hit(p.x, p.y);
        cv.style.cursor = h ? 'pointer' : '';
        if (h !== st.hover) { if (h) showTip(h); else hideTip(); }
      });
      const end = e => {
        if (!st.drag) return;
        const D = st.drag; st.drag = null; cv.classList.remove('drag');
        if (D.moved < 5) { const p = pos(e), h = hit(p.x, p.y); if (h) go('#/trip/' + h); }
        if (REDUCE) { st.vLam = st.vPhi = 0; }
      };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', () => { st.drag = null; cv.classList.remove('drag'); });
      cv.addEventListener('pointerleave', () => { if (!st.drag) { hideTip(); cv.style.cursor = ''; } });
      if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
      if (window.IntersectionObserver) new IntersectionObserver(es => { visible = es[0].isIntersecting; dirty = true; }).observe(stage);
    }
    return {
      init() {
        if (inited) return; inited = true;
        stage = $('#ax-globe-stage'); cv = $('#ax-globe'); tip = $('#ax-tip');
        ctx = cv && cv.getContext ? cv.getContext('2d') : null;
        if (!ctx || typeof Path2D === 'undefined') { stage.classList.add('nogl'); buildLabels(); return; }
        stage.classList.add('loading');
        resize(); bind(); buildArcs(); buildLabels();
        const t = trip(focusId) || nextTrip(); if (t) { const c = centerOn(t); st.lam = c.lam; st.phi = c.phi; }
        loadLand().then(() => { stage.classList.remove('loading'); dirty = true; });
        raf = requestAnimationFrame(tick);
      },
      start() { running = true; dirty = true; if (stage && inited) resize(); },
      stop() { running = false; hideTip(); },
      focus(id) { const t = trip(id); if (!t || !inited || !ctx) return; st.target = centerOn(t); st.vLam = st.vPhi = 0; dirty = true; },
      refresh() { if (!inited || !ctx) return; buildArcs(); buildLabels(); dirty = true; }
    };
  })();

  // ---------- Wiring ----------
  function refreshAll() {
    if (typeof renderBookingTimeline === 'function') { renderBookingTimeline(); renderHotelTracker(); renderReadiness(); renderTabBadges(); }
    renderChips();
    if (!started) return;
    const v = $('.ax-view.on');
    if (!$('#ax-main').hidden && v) {
      const name = v.getAttribute('data-view');
      if (name === 'overview') renderOverview();
      if (name === 'trips') renderTripsView();
      if (name === 'documents') renderDocsView();
    }
  }
  function onClick(e) {
    if (intelClick(e)) return;
    const st = e.target.closest('[data-pass-step]');
    if (st) { stepPass(+st.getAttribute('data-pass-step')); return; }
    const ps = e.target.closest('[data-pass]');
    if (ps) {
      if (suppressClick) return;
      const id = ps.getAttribute('data-pass');
      // Like Wallet: with a pass pulled out, tapping the pile below puts that pass back
      // (doesn't open the tapped one). Keyboard activation (detail 0) still opens directly.
      const piled = walletOpen && walletOpen !== id && ps.closest('.ax-stack.has-open') && !ps.closest('.ax-pass.open');
      togglePass(piled && e.detail > 0 ? walletOpen : id);
      return;
    }
    const vf = e.target.closest('[data-verify]');
    if (vf) { verifyItem(vf.getAttribute('data-verify')); return; }
    const r = e.target.closest('[data-route]');
    if (r) { e.preventDefault(); go(r.getAttribute('data-route')); return; }
    const tk = e.target.closest('[data-tick]');
    if (tk) { Store.set(tk.getAttribute('data-tick'), tk.getAttribute('data-field'), tk.getAttribute('data-value') === 'true'); return; }
    const dt = e.target.closest('[data-doc-trip]');
    if (dt) { walletOpen = null; setFocus(dt.getAttribute('data-doc-trip'), true); renderDocsView(); return; }
    const re = e.target.closest('[data-ref-edit]');
    if (re) { editRef(re.getAttribute('data-ref-edit')); return; }
    if (e.target.closest('[data-ref-cancel]')) { renderDocsView(); return; }
    const rs = e.target.closest('[data-ref-show]');
    if (rs) { const v = rs.parentNode.querySelector('b'); const on = v.getAttribute('data-shown') !== '1'; v.textContent = on ? v.getAttribute('data-full') : v.getAttribute('data-mask'); v.setAttribute('data-shown', on ? '1' : '0'); rs.textContent = on ? 'Hide' : 'Show'; return; }
    const rc = e.target.closest('[data-ref-copy]');
    if (rc) { const v = rc.parentNode.querySelector('b').getAttribute('data-full'); if (navigator.clipboard) navigator.clipboard.writeText(v).then(() => toast('Reference copied'), () => toast('Copy isn’t available here')); return; }
    const fo = e.target.closest('[data-file-open]');
    if (fo) { openFile(fo.getAttribute('data-file-open'), fo.getAttribute('data-file-name')); return; }
    const fd = e.target.closest('[data-file-del]');
    if (fd) { deleteFile(fd.getAttribute('data-file-del')); return; }
    const pp = e.target.closest('[data-pp]');
    if (pp) { passport(pp.getAttribute('data-pp'), pp); return; }
    const ic = e.target.closest('[data-ics]');
    if (ic) { ics(ic.getAttribute('data-ics')); return; }
    if (e.target.closest('#ax-days-more')) { const b = $('#ax-days'); b.classList.toggle('collapsed'); e.target.textContent = b.classList.contains('collapsed') ? `Show all ${b.children.length} days` : 'Show fewer'; return; }
    const tab = e.target.closest('#ax-lib-tabs button');
    if (tab) { libTab = tab.getAttribute('data-tab'); renderLibrary($('#ax-lib-ov'), 'tabs'); return; }
    const sc = e.target.closest('[data-scroll]');
    if (sc) { const b = $('#ax-days'); b.scrollBy({ left: (+sc.getAttribute('data-scroll')) * b.clientWidth * 0.8, behavior: REDUCE ? 'auto' : 'smooth' }); }
  }
  function onKey(e) {
    if (e.key === 'Escape' && walletOpen && !$('#ax-pp.on')) { togglePass(walletOpen); return; }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && walletOpen && !$('#ax-pp.on') && !(e.target.closest && e.target.closest('input, textarea, select, #ax-lib-tabs'))) {
      e.preventDefault(); stepPass(e.key === 'ArrowRight' ? 1 : -1); return;
    }
    const tab = e.target.closest && e.target.closest('#ax-lib-tabs button');
    if (!tab || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    const bs = $$('#ax-lib-tabs button'), i = bs.indexOf(tab), n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length];
    libTab = n.getAttribute('data-tab'); renderLibrary($('#ax-lib-ov'), 'tabs'); n.focus();
  }
  function start() {
    if (started) return;
    started = true;
    document.body.classList.add('ax-on');
    $('#atlas').hidden = false;
    const email = (sessionStorage.getItem('google_ok') || '').toLowerCase();
    const name = NAMES[email] || (email.split('@')[0] || 'there');
    $$('.ax-avatar').forEach(a => { a.textContent = name[0].toUpperCase(); });
    $('#ax-user-name').textContent = name; $('#ax-user-email').textContent = email; $('#ax-mname').textContent = name;
    $('#ax-eyebrow').textContent = 'Welcome back, ' + name;
    // destination selector
    let saved = null; try { saved = sessionStorage.getItem(FOCUS_KEY); } catch (e) {}
    const nx = nextTrip();
    focusId = (saved && trip(saved) ? saved : null) || (nx ? nx.id : trips()[0].id);
    const g = groups(), sel = $('#ax-dest');
    sel.innerHTML = g.upcoming.concat(g.completed).map(t => `<option value="${t.id}">${t.flag} ${esc(t.name)} · ${esc(range(t.start, t.end))} ${parse(t.start).getFullYear()}</option>`).join('');
    sel.value = focusId;
    sel.addEventListener('change', () => setFocus(sel.value));
    $('#ax-credits').innerHTML = 'Photos via Wikimedia Commons: ' + CREDITS.map(c => `<a href="${c[3]}" target="_blank" rel="noopener noreferrer">${esc(c[0])}</a> by ${esc(c[1])} (${c[2]})`).join(' · ') + '.';
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('submit', e => { intelSubmit(e); });
    document.addEventListener('change', e => { const u = e.target.closest && e.target.closest('[data-upload]'); if (u) uploadFile(u.getAttribute('data-upload'), u); });
    window.addEventListener('hashchange', route);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Store.mode === 'synced' && Date.now() - Store.lastLoad > 60000) loadRemote(); });
    Globe.init();
    renderChips();
    setSync('local', 'This browser only');
    if (session()) loadRemote(); else Store.reason = 'Sign in again to connect to Supabase.';
    if (!/^#\/./.test(location.hash)) { try { history.replaceState(null, '', '#/overview'); } catch (e) {} }
    route();
  }

  window.Atlas = { start, connect, route, go, onTab, refresh: refreshAll, store: Store, passport, readiness, insights: id => insightsFor(trip(id)), model: id => engineModel(trip(id)), items, trips, ics };
})();
