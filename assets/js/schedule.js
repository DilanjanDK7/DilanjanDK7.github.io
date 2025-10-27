(() => {
  const state = {
    eventName: '',
    participantName: '',
    participantPassword: '',
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    useLocalTZ: true,
    startDate: null,
    endDate: null,
    dayStart: '09:00',
    dayEnd: '18:00',
    slotMinutes: 30,
    daysOfWeek: new Set([1,2,3,4,5]),
    // availability map: isoDate -> { timeKey -> Set(participantName) }
    availability: new Map(),
    meKey: null,
    participantId: null,
    eventId: null,
    db: null,
    auth: null,
    unsub: null,
    isHost: false,
    calMonth: null,
    persistTimer: null,
    participantCount: 0, // Added for dynamic coloring
  };

  const els = {
    eventName: document.getElementById('eventName'),
    eventNameRow: document.getElementById('eventNameRow'),
    pageTitle: document.getElementById('pageTitle'),
    participantName: document.getElementById('participantName'),
    participantPassword: document.getElementById('participantPassword'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    dayStart: document.getElementById('dayStart'),
    dayEnd: document.getElementById('dayEnd'),
    slotMinutes: document.getElementById('slotMinutes'),
    tzDisplay: document.getElementById('tzDisplay'),
    toggleLocalTZ: document.getElementById('toggleLocalTZ'),
    applySettings: document.getElementById('applySettings'),
    dowPicker: document.querySelector('.dow-picker'),
    grid: document.getElementById('availabilityGrid'),
    bestSlots: document.getElementById('bestSlots'),
    makeShareLink: document.getElementById('makeShareLink'),
    shareLink: document.getElementById('shareLink'),
    copyMyAvailability: document.getElementById('copyMyAvailability'),
    importText: document.getElementById('importText'),
    importAvailability: document.getElementById('importAvailability'),
    selectAll: document.getElementById('selectAll'),
    clearAll: document.getElementById('clearAll'),
    invertSel: document.getElementById('invertSel'),
    copyPrevDay: document.getElementById('copyPrevDay'),
    participantsList: document.getElementById('participantsList'),
    liveBadge: document.getElementById('liveBadge'),
    minAvailable: document.getElementById('minAvailable'),
    statusDisplay: document.getElementById('statusDisplay'),
    eventSettings: document.getElementById('eventSettings'),
    eventSettingsHeader: document.getElementById('eventSettingsHeader'),
    createEventBtn: document.getElementById('createEventBtn'),
    eventLink: document.getElementById('eventLink'),
    copyEventLink: document.getElementById('copyEventLink'),
  };

  init();

  function init() {
    console.log('[Scheduler] Init started.');
    restoreFromURL();
    const isSharedEvent = !!state.eventId;

    if (isSharedEvent) {
      console.log(`[Scheduler] Detected shared event ID: ${state.eventId}`);
      showStatus('Loading event...');
      if (!window.FIREBASE_CONFIG || window.FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
        console.error('[Scheduler] Firebase config is missing or invalid.');
        showStatus('Live sharing is not configured. Cannot load event.', true);
        return;
      }
    } else {
      // Not loading a shared event, restore local draft
      restoreDraft();
    }
    state.meKey = getMeKey();
    updateTZDisplay();
    initDOW();

    // Defaults: next 7 days if none provided AND it's not a shared event
    if (!isSharedEvent && (!state.startDate || !state.endDate)) {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      state.startDate = start;
      state.endDate = end;
      if (els.startDate) els.startDate.value = formatISODate(start);
      if (els.endDate) els.endDate.value = formatISODate(end);
    }

    attachHandlers();
    // Calendar picker
    if (typeof window.initCalendar === 'function') window.initCalendar();
    
    // Only render grid if it's NOT a shared event. Shared events render inside the subscription callback.
    if (!isSharedEvent && state.startDate && state.endDate) {
        renderGrid();
    }
    
    // Initialize Firebase lazily after UI is ready
    if (typeof window.initFirebase === 'function') window.initFirebase();
    updateControlsForRole();
    console.log('[Scheduler] Init finished.');
  }

  function getMeKey() {
    const name = (els.participantName?.value || '').trim() || 'Me';
    return name;
  }

  function getPassword() {
    return (els.participantPassword?.value || '').trim();
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function computeParticipantId() {
    if (!state.eventId) return null;
    const name = (state.meKey || '').trim().toLowerCase();
    const pwd = (state.participantPassword || '').trim();
    const key = `${state.eventId}|${name}|${pwd}`;
    const pid = await sha256Hex(key);
    state.participantId = pid;
    return pid;
  }

  function attachHandlers() {
    els.applySettings?.addEventListener('click', () => {
      state.eventName = (els.eventName?.value || '').trim();
      state.participantName = (els.participantName?.value || '').trim();
      state.participantPassword = getPassword();
      state.meKey = getMeKey();
      state.startDate = parseDateInput(els.startDate?.value);
      state.endDate = parseDateInput(els.endDate?.value);
      state.dayStart = els.dayStart?.value || '09:00';
      state.dayEnd = els.dayEnd?.value || '18:00';
      state.slotMinutes = Number(els.slotMinutes?.value || 30);
      persistDraft();
      renderGrid();
      if (els.pageTitle && state.eventName) els.pageTitle.textContent = state.eventName;
      computeBest();
      // If bound to an event, persist settings
      if (typeof window.persistEventMeta === 'function') window.persistEventMeta();
    });

    els.toggleLocalTZ?.addEventListener('click', () => {
      state.useLocalTZ = true;
      state.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      updateTZDisplay();
    });

    const createEventBtn = document.getElementById('createEventBtn');
    const eventLink = document.getElementById('eventLink');
    const copyEventLink = document.getElementById('copyEventLink');
    
    copyEventLink?.addEventListener('click', async () => {
      if (!eventLink?.value) return;
      try { await navigator.clipboard.writeText(eventLink.value); showToast('Link copied'); } catch (_) { showToast('Copy failed'); }
    });

    createEventBtn?.addEventListener('click', async () => {
      // Guard: config missing
      if (!window.FIREBASE_CONFIG) {
        alert('Live sharing is not configured. Please add your Firebase config in assets/js/firebase-config.js and reload.');
        return;
      }
      // Lazy init if needed
      if (!state.db && typeof window.initFirebase === 'function') {
        await window.initFirebase();
      }
      if (!state.db) { alert('Live sharing is still initializing. Please try again in a moment.'); return; }
      // Capture latest event name from input before creating/updating
      state.eventName = (els.eventName?.value || '').trim();
      if (els.pageTitle && state.eventName) els.pageTitle.textContent = state.eventName;
      if (typeof window.ensureSignedIn === 'function') await window.ensureSignedIn();
      const eventId = typeof window.createOrEnsureEvent === 'function' ? await window.createOrEnsureEvent() : null;
      state.eventId = eventId;
      // compute participant id from name+password
      state.meKey = getMeKey();
      state.participantPassword = getPassword();
      await computeParticipantId();
      const url = new URL(location.href);
      url.searchParams.set('event', eventId);
      eventLink.value = url.toString();
      try { await navigator.clipboard.writeText(eventLink.value); } catch (_) {}
      if (typeof window.subscribeToEvent === 'function') window.subscribeToEvent(eventId);
      if (typeof window.persistEventMeta === 'function') await window.persistEventMeta();
      if (typeof window.persistMyAvailability === 'function') await window.persistMyAvailability();
      updateControlsForRole();
    });

    els.selectAll?.addEventListener('click', () => bulkSelect('all'));
    els.clearAll?.addEventListener('click', () => bulkSelect('clear'));
    els.invertSel?.addEventListener('click', () => bulkSelect('invert'));
    els.copyPrevDay?.addEventListener('click', () => copyPreviousDay());
  }

  function updateTZDisplay() {
    if (els.tzDisplay) els.tzDisplay.textContent = state.tz + (state.useLocalTZ ? ' (local)' : '');
  }

  function initDOW() {
    if (!els.dowPicker) return;
    els.dowPicker.querySelectorAll('button').forEach(btn => {
      const dow = Number(btn.getAttribute('data-dow'));
      syncDowButton(btn, state.daysOfWeek.has(dow));
      btn.addEventListener('click', () => {
        if (state.daysOfWeek.has(dow)) state.daysOfWeek.delete(dow); else state.daysOfWeek.add(dow);
        syncDowButton(btn, state.daysOfWeek.has(dow));
      });
    });
  }
  function syncDowButton(btn, on) {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  }

  function parseDateInput(v) {
    if (!v) return null;
    const d = new Date(v + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function formatISODate(d) {
    return d.toISOString().slice(0,10);
  }

  function timeStringToMinutes(t) {
    const [h, m] = (t || '00:00').split(':').map(Number);
    return h * 60 + (m || 0);
  }

  function minutesToTimeString(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  }

  function* dateRange(start, end) {
    const d = new Date(start);
    while (d <= end) {
      yield new Date(d);
      d.setDate(d.getDate() + 1);
    }
  }

  function clearGrid() {
    if (els.grid) els.grid.innerHTML = '';
  }

  function renderGrid(resetMyToggles = true) {
    if (!els.grid || !state.startDate || !state.endDate) return;
    clearGrid();
    const startMin = timeStringToMinutes(state.dayStart);
    const endMin = timeStringToMinutes(state.dayEnd);
    const slot = Math.max(5, state.slotMinutes);
    const timeKeys = [];
    for (let m = startMin; m < endMin; m += slot) timeKeys.push(minutesToTimeString(m));

    // Header row
    const header = document.createElement('div');
    header.className = 'grid-row header-row';
    header.appendChild(cell('Time', 'time-col head'));
    for (const day of dateRange(state.startDate, state.endDate)) {
      if (!state.daysOfWeek.has(day.getDay())) continue;
      header.appendChild(cell(day.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }), 'day-col head'));
    }
    els.grid.appendChild(header);

    // Body rows
    timeKeys.forEach((tk, rowIdx) => {
      const row = document.createElement('div');
      row.className = 'grid-row';
      row.appendChild(cell(tk, 'time-col'));
      for (const day of dateRange(state.startDate, state.endDate)) {
        if (!state.daysOfWeek.has(day.getDay())) continue;
        const iso = formatISODate(day);
        const key = iso + ' ' + tk;
        const c = cell('', 'slot');
        c.setAttribute('role','gridcell');
        c.dataset.key = key;
        if (resetMyToggles) ensureSlot(key, false, state.meKey, false);
        paintSlot(c);
        attachSlotHandlers(c, rowIdx);
        row.appendChild(c);
      }
      els.grid.appendChild(row);
    });

    computeBest();
  }

  function cell(text, cls='') {
    const el = document.createElement('div');
    el.className = cls;
    if (text) el.textContent = text;
    return el;
  }

  let isDragging = false;
  let dragModeSelect = true; // true => add, false => remove

  function attachSlotHandlers(c, rowIdx) {
    c.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      const hasMe = slotHasMe(c.dataset.key);
      dragModeSelect = !hasMe; // if already selected, drag will remove
      toggleMyAvailability(c.dataset.key, dragModeSelect);
      paintSlot(c);
    });
    document.addEventListener('mouseup', () => { isDragging = false; });
    c.addEventListener('mouseenter', () => {
      if (!isDragging) return;
      toggleMyAvailability(c.dataset.key, dragModeSelect);
      paintSlot(c);
    });
    c.addEventListener('click', () => {
      toggleMyAvailability(c.dataset.key, !slotHasMe(c.dataset.key));
      paintSlot(c);
    });

    // Keyboard support
    c.tabIndex = 0;
    c.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleMyAvailability(c.dataset.key, !slotHasMe(c.dataset.key));
        paintSlot(c);
      }
    });
  }

  function ensureSlot(timeKey, touch, participant, make) {
    const [dateIso] = timeKey.split(' ');
    if (!state.availability.has(dateIso)) state.availability.set(dateIso, new Map());
    const dayMap = state.availability.get(dateIso);
    if (!dayMap.has(timeKey)) dayMap.set(timeKey, new Set());
    if (make && participant) dayMap.get(timeKey).add(participant);
    return dayMap.get(timeKey);
  }

  function slotHasMe(timeKey) {
    const [dateIso] = timeKey.split(' ');
    const dayMap = state.availability.get(dateIso);
    const set = dayMap?.get(timeKey);
    return !!set && set.has(state.meKey);
  }

  function toggleMyAvailability(timeKey, on) {
    const set = ensureSlot(timeKey, true, null, false);
    if (on) set.add(state.meKey); else set.delete(state.meKey);
    persistDraft();
    // Persist to backend if joined an event
    if (typeof window.throttlePersist === 'function') window.throttlePersist();
  }

  function paintSlot(cellEl) {
    const key = cellEl.dataset.key;
    const [dateIso] = key.split(' ');
    const set = state.availability.get(dateIso)?.get(key) || new Set();
    const count = set.size;
    const total = state.participantCount || count;
    
    cellEl.classList.toggle('me', set.has(state.meKey));
    cellEl.setAttribute('data-count', String(count));
    cellEl.title = `${count} available: ${Array.from(set).join(', ')}`;

    // Dynamic coloring
    if (total > 0) {
      const ratio = count / total;
      if (count === 0) {
        cellEl.style.background = '';
      } else if (ratio < 0.5) {
        cellEl.style.background = '#e3ecff'; // Light blue
      } else if (ratio < 1) {
        cellEl.style.background = '#cbdcff'; // Medium blue
      } else { // Everyone is available
        cellEl.style.background = '#b3caff'; // Dark blue
      }
    } else {
      cellEl.style.background = '';
    }
  }

  function computeBest() {
    if (!els.bestSlots) return;
    const scores = [];
    for (const [dateIso, dayMap] of state.availability.entries()) {
      for (const [timeKey, set] of dayMap.entries()) {
        const count = set.size;
        const minReq = Number(els.minAvailable?.value || '1');
        if (count >= minReq) scores.push({ key: timeKey, count });
      }
    }
    scores.sort((a,b) => b.count - a.count || a.key.localeCompare(b.key));
    const top = scores.slice(0, 10);
    els.bestSlots.innerHTML = top.map(s => `<li><strong>${s.key.slice(0,10)}</strong> ${s.key.slice(11)} — ${s.count} available</li>`).join('') || '<li>No availability yet</li>';
  }

  function bulkSelect(mode) {
    if (!state.startDate || !state.endDate) return;
    const startMin = timeStringToMinutes(state.dayStart);
    const endMin = timeStringToMinutes(state.dayEnd);
    const slot = Math.max(5, state.slotMinutes);
    for (const day of dateRange(state.startDate, state.endDate)) {
      if (!state.daysOfWeek.has(day.getDay())) continue;
      const iso = formatISODate(day);
      for (let m = startMin; m < endMin; m += slot) {
        const tk = minutesToTimeString(m);
        const key = iso + ' ' + tk;
        if (mode === 'all') toggleMyAvailability(key, true);
        else if (mode === 'clear') toggleMyAvailability(key, false);
        else if (mode === 'invert') toggleMyAvailability(key, !slotHasMe(key));
      }
    }
    // repaint all
    els.grid?.querySelectorAll('.slot').forEach(paintSlot);
    computeBest();
    if (typeof window.throttlePersist === 'function') window.throttlePersist();
  }

  function copyPreviousDay() {
    if (!state.startDate || !state.endDate) return;
    const days = Array.from(dateRange(state.startDate, state.endDate)).filter(d => state.daysOfWeek.has(d.getDay()));
    for (let i = 1; i < days.length; i++) {
      const prev = formatISODate(days[i-1]);
      const cur = formatISODate(days[i]);
      const prevMap = state.availability.get(prev);
      if (!prevMap) continue;
      for (const [timeKey, set] of prevMap.entries()) {
        const tk = cur + ' ' + timeKey.slice(11);
        const target = ensureSlot(tk, true, null, false);
        if (set.has(state.meKey)) target.add(state.meKey); else target.delete(state.meKey);
      }
    }
    els.grid?.querySelectorAll('.slot').forEach(paintSlot);
    computeBest();
    persistDraft();
    if (typeof window.throttlePersist === 'function') window.throttlePersist();
  }

  function serializeState() {
    const out = {
      v: 1,
      eventName: state.eventName,
      tz: state.tz,
      startDate: state.startDate ? formatISODate(state.startDate) : null,
      endDate: state.endDate ? formatISODate(state.endDate) : null,
      dayStart: state.dayStart,
      dayEnd: state.dayEnd,
      slotMinutes: state.slotMinutes,
      daysOfWeek: Array.from(state.daysOfWeek),
      availability: exportAllAvailability(),
    };
    return out;
  }

  function exportAllAvailability() {
    const out = {};
    for (const [dateIso, map] of state.availability.entries()) {
      out[dateIso] = {};
      for (const [timeKey, set] of map.entries()) {
        out[dateIso][timeKey.slice(11)] = Array.from(set);
      }
    }
    return out;
  }

  function exportMyAvailability() {
    const out = {};
    for (const [dateIso, map] of state.availability.entries()) {
      out[dateIso] = [];
      for (const [timeKey, set] of map.entries()) {
        if (set.has(state.meKey)) out[dateIso].push(timeKey.slice(11));
      }
    }
    return { participant: state.meKey, slots: out };
  }

  function mergeAvailabilityImport(obj) {
    const name = String(obj.participant || 'Guest');
    const slots = obj.slots || {};
    for (const [dateIso, arr] of Object.entries(slots)) {
      if (!state.availability.has(dateIso)) state.availability.set(dateIso, new Map());
      const map = state.availability.get(dateIso);
      for (const time of arr) {
        const key = dateIso + ' ' + time;
        const set = ensureSlot(key, true, null, false);
        set.add(name);
      }
    }
    persistDraft();
  }

  function restoreFromURL() {
    const url = new URL(location.href);
    const eventId = url.searchParams.get('event');
    if (eventId) state.eventId = eventId;
  }

  function applyRestoredData(data) {
    state.eventName = data.eventName || '';
    state.tz = data.tz || state.tz;
    state.startDate = data.startDate ? parseDateInput(data.startDate) : null;
    state.endDate = data.endDate ? parseDateInput(data.endDate) : null;
    state.dayStart = data.dayStart || state.dayStart;
    state.dayEnd = data.dayEnd || state.dayEnd;
    state.slotMinutes = Number(data.slotMinutes || state.slotMinutes);
    state.daysOfWeek = new Set(Array.isArray(data.daysOfWeek) ? data.daysOfWeek : [1,2,3,4,5]);
    // availability
    state.availability = new Map();
    const avail = data.availability || {};
    for (const [dateIso, byTime] of Object.entries(avail)) {
      const map = new Map();
      for (const [time, participants] of Object.entries(byTime)) {
        const key = dateIso + ' ' + time;
        map.set(key, new Set(participants));
      }
      state.availability.set(dateIso, map);
    }
    // fill UI
    if (els.eventName) els.eventName.value = state.eventName;
    if (els.pageTitle && state.eventName) els.pageTitle.textContent = state.eventName;
    if (els.startDate) els.startDate.value = state.startDate ? formatISODate(state.startDate) : '';
    if (els.endDate) els.endDate.value = state.endDate ? formatISODate(state.endDate) : '';
    if (els.dayStart) els.dayStart.value = state.dayStart;
    if (els.dayEnd) els.dayEnd.value = state.dayEnd;
    if (els.slotMinutes) els.slotMinutes.value = String(state.slotMinutes);
  }

  function persistDraft() {
    try {
      const draft = serializeState();
      draft.me = state.meKey;
      draft.pwd = state.participantPassword || '';
      localStorage.setItem('scheduleDraft', JSON.stringify(draft));
    } catch (_) {}
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem('scheduleDraft');
      if (!raw) return;
      const draft = JSON.parse(raw);
      applyRestoredData(draft);
      if (draft.me) state.meKey = draft.me;
      if (typeof draft.pwd === 'string') state.participantPassword = draft.pwd;
    } catch (_) {}
  }
  // --- Firebase integration (uses window.FIREBASE_CONFIG) ---
  async function firebaseModules() {
    const v = '10.13.2';
    const appMod = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`);
    const fsMod = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`);
    const auMod = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-auth.js`);
    return { appMod, fsMod, auMod };
  }

  window.initFirebase = async function initFirebase() {
    if (state.db) {
      console.log('[Scheduler] Firebase already initialized.');
      return; // Already initialized
    }
    try {
      console.log('[Scheduler] Initializing Firebase...');
      if (!window.FIREBASE_CONFIG || window.FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
        console.warn('[Scheduler] Firebase init skipped: config missing.');
        showStatus('Firebase configuration is missing. Live sharing unavailable.', true);
        return;
      }
      const { appMod, fsMod, auMod } = await firebaseModules();
      const { initializeApp } = appMod;
      const { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, enableIndexedDbPersistence, serverTimestamp } = fsMod;
      const { getAuth, signInAnonymously, onAuthStateChanged } = auMod;

      const app = initializeApp(window.FIREBASE_CONFIG);
      const db = getFirestore(app);
      const auth = getAuth(app);
      try { await enableIndexedDbPersistence(db); } catch (_) {}
      state.db = db;
      state.auth = auth;
      console.log('[Scheduler] Firebase initialized successfully.');

      onAuthStateChanged(auth, (u) => {
        if (u) {
          console.log(`[Scheduler] Auth state changed: Signed in as ${u.uid}`);
          if (state.eventId) window.subscribeToEvent(state.eventId);
        } else {
          console.log('[Scheduler] Auth state changed: Signed out.');
        }
      });

      if (state.eventId) {
        await window.ensureSignedIn();
        window.subscribeToEvent(state.eventId);
      }

      // Store module fns on window for later use
      window.__fb = { doc, setDoc, getDoc, collection, onSnapshot, serverTimestamp, signInAnonymously };
    } catch (e) {
      console.error('Firebase init failed', e);
      showStatus(`Live sharing failed to initialize. Check console for errors and verify your Firebase config, domain restrictions, and API key restrictions.`, true);
    }
  };

  window.ensureSignedIn = async function ensureSignedIn() {
    if (!state.auth) return;
    if (state.auth.currentUser) return;
    await window.__fb.signInAnonymously(state.auth);
  };

  window.generateId = function generateId() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  window.createOrEnsureEvent = async function createOrEnsureEvent() {
    const id = state.eventId || window.generateId();
    const ref = window.__fb.doc(state.db, 'events', id);
    const snap = await window.__fb.getDoc(ref);
    if (!snap.exists()) {
      await window.__fb.setDoc(ref, {
        createdAt: window.__fb.serverTimestamp(),
        hostUid: state.auth?.currentUser?.uid || null,
        eventName: state.eventName || 'Untitled Event',
        tz: state.tz,
        startDate: state.startDate ? formatISODate(state.startDate) : null,
        endDate: state.endDate ? formatISODate(state.endDate) : null,
        dayStart: state.dayStart,
        dayEnd: state.dayEnd,
        slotMinutes: state.slotMinutes,
        daysOfWeek: Array.from(state.daysOfWeek),
      });
      state.isHost = true;
    } else {
      // Event exists; ensure title is up to date if host
      const cur = snap.data();
      if (state.isHost && state.eventName && cur.eventName !== state.eventName) {
        await window.__fb.setDoc(ref, { eventName: state.eventName, updatedAt: window.__fb.serverTimestamp() }, { merge: true });
      }
    }
    return id;
  };

  window.persistEventMeta = async function persistEventMeta() {
    if (!state.db || !state.eventId) return;
    if (!state.isHost) return; // only host updates metadata
    const ref = window.__fb.doc(state.db, 'events', state.eventId);
    await window.__fb.setDoc(ref, {
      eventName: state.eventName || 'Untitled Event',
      tz: state.tz,
      startDate: state.startDate ? formatISODate(state.startDate) : null,
      endDate: state.endDate ? formatISODate(state.endDate) : null,
      dayStart: state.dayStart,
      dayEnd: state.dayEnd,
      slotMinutes: state.slotMinutes,
      daysOfWeek: Array.from(state.daysOfWeek),
      updatedAt: window.__fb.serverTimestamp(),
    }, { merge: true });
  };

  window.persistMyAvailability = async function persistMyAvailability() {
    if (!state.db || !state.eventId || !state.auth?.currentUser) return;
    if (!state.participantId) await computeParticipantId();
    const my = exportMyAvailability();
    const pref = window.__fb.doc(state.db, 'events', state.eventId, 'participants', state.participantId);
    await window.__fb.setDoc(pref, {
      name: state.meKey,
      pid: state.participantId,
      slots: my.slots,
      updatedAt: window.__fb.serverTimestamp(),
    }, { merge: true });
  };

  window.throttlePersist = function throttlePersist() {
    if (!state.eventId) return; // nothing to do yet
    clearTimeout(state.persistTimer);
    state.persistTimer = setTimeout(() => { window.persistMyAvailability().catch(()=>{}); }, 600);
  };

  window.subscribeToEvent = function subscribeToEvent(eventId) {
    if (state.unsub) { try { state.unsub(); } catch (_) {} state.unsub = null; }
    console.log(`[Scheduler] Subscribing to event: ${eventId}`);

    let isFirstEventSnapshot = true;
    const eventRef = window.__fb.doc(state.db, 'events', eventId);
    const partsRef = window.__fb.collection(state.db, 'events', eventId, 'participants');

    const unsubEvent = window.__fb.onSnapshot(eventRef, (snap) => {
      console.log('[Scheduler] Received event snapshot.');
      if (!snap.exists()) {
        console.error(`[Scheduler] Event document ${eventId} does not exist.`);
        showStatus('Error: Event not found or has been deleted.', true);
        return;
      }
      const d = snap.data();
      if (!d) {
        console.error(`[Scheduler] Event document ${eventId} has no data.`);
        showStatus('Error: Event data is empty or corrupted.', true);
        return;
      }
      console.log('[Scheduler] Event data:', d);

      hideStatus();
      state.isHost = !!(state.auth?.currentUser && d.hostUid === state.auth.currentUser.uid);
      
      const metaChanged =
        (d.startDate && (!state.startDate || formatISODate(state.startDate) !== d.startDate)) ||
        (d.endDate && (!state.endDate || formatISODate(state.endDate) !== d.endDate)) ||
        d.dayStart !== state.dayStart || d.dayEnd !== state.dayEnd ||
        d.slotMinutes !== state.slotMinutes || (Array.isArray(d.daysOfWeek) && d.daysOfWeek.length !== state.daysOfWeek.size) ||
        (typeof d.eventName === 'string' && d.eventName !== state.eventName);
      
      // Update state from Firestore data
      state.eventName = d.eventName || 'Event';
      state.startDate = d.startDate ? parseDateInput(d.startDate) : null;
      state.endDate = d.endDate ? parseDateInput(d.endDate) : null;
      state.dayStart = d.dayStart || '09:00';
      state.dayEnd = d.dayEnd || '18:00';
      state.slotMinutes = d.slotMinutes || 30;
      if (Array.isArray(d.daysOfWeek)) {
        state.daysOfWeek = new Set(d.daysOfWeek);
      }
      
      // Update UI from new state
      if (els.eventName) els.eventName.value = state.eventName;
      if (els.pageTitle) els.pageTitle.textContent = state.eventName;
      if (els.startDate && state.startDate) els.startDate.value = formatISODate(state.startDate);
      if (els.endDate && state.endDate) els.endDate.value = formatISODate(state.endDate);
      if (els.dayStart) els.dayStart.value = state.dayStart;
      if (els.dayEnd) els.dayEnd.value = state.dayEnd;
      if (els.slotMinutes) els.slotMinutes.value = String(state.slotMinutes);
      els.dowPicker?.querySelectorAll('button').forEach(btn => {
        const dow = Number(btn.getAttribute('data-dow'));
        syncDowButton(btn, state.daysOfWeek.has(dow));
      });

      // On first load, OR if metadata changed, re-render the grid and calendar
      if (metaChanged || isFirstEventSnapshot) {
        if (state.startDate) {
            state.calMonth = new Date(state.startDate.getFullYear(), state.startDate.getMonth(), 1);
            if (typeof window.renderCalendar === 'function') window.renderCalendar();
        }
        renderGrid(false);
      }
      
      updateControlsForRole();
      isFirstEventSnapshot = false;
    }, (error) => {
      console.error(`[Scheduler] Error subscribing to event ${eventId}:`, error);
      showStatus(`Error loading event. Check console for details. (Code: ${error.code})`, true);
    });

    const unsubParts = window.__fb.onSnapshot(partsRef, (qs) => {
      const newAvail = new Map();
      const names = [];
      function ensure(map, dateIso, key) {
        if (!map.has(dateIso)) map.set(dateIso, new Map());
        const day = map.get(dateIso);
        if (!day.has(key)) day.set(key, new Set());
        return day.get(key);
      }
      qs.forEach(docSnap => {
        const pdata = docSnap.data();
        const pname = pdata.name || 'Guest';
        names.push(pname);
        const slots = pdata.slots || {};
        for (const [dateIso, arr] of Object.entries(slots)) {
          for (const time of arr) {
            const key = dateIso + ' ' + time;
            ensure(newAvail, dateIso, key).add(pname);
          }
        }
      });
      state.availability = newAvail;
      state.participantCount = names.length;
      els.grid?.querySelectorAll('.slot').forEach(paintSlot);
      computeBest();
      renderParticipants(names);
      setLive(true);
    });

    state.unsub = () => { unsubEvent(); unsubParts(); };
  };

  function renderParticipants(names) {
    if (!els.participantsList) return;
    const unique = Array.from(new Set(names)).sort();
    els.participantsList.innerHTML = unique.map(n => `<li>${escapeHtml(n)}</li>`).join('') || '<li>No participants yet</li>';
  }

  function setLive(on) {
    if (!els.liveBadge) return;
    els.liveBadge.style.display = on ? 'inline-block' : 'none';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"{}]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','{':'&#123;','}':'&#125;'}[c]); });
  }

  function showToast(text) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = text;
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  function showStatus(text, isError = false) {
    if (!els.statusDisplay) return;
    els.statusDisplay.textContent = text;
    els.statusDisplay.classList.toggle('error', isError);
    els.statusDisplay.hidden = false;
    if (els.grid) els.grid.hidden = true;
  }

  function hideStatus() {
    if (!els.statusDisplay) return;
    els.statusDisplay.hidden = true;
    if (els.grid) els.grid.hidden = false;
  }

  function disableForm(disabled) {
    // Legacy function - no longer used. Control is now via updateControlsForRole()
  }

  function updateControlsForRole() {
    const isHost = state.isHost;
    const isEvent = !!state.eventId;

    // Hide entire Event Settings section for non-host participants
    if (els.eventSettingsHeader) {
        els.eventSettingsHeader.style.display = (isEvent && !isHost) ? 'none' : '';
    }
    if (els.eventSettings) {
        els.eventSettings.style.display = (isEvent && !isHost) ? 'none' : '';
        els.eventSettings.disabled = false;  // Never blanket-disable; visibility controls access
    }

    // Disable individual settings fields for participants
    if (isEvent && !isHost && els.eventSettings) {
      els.eventSettings.querySelectorAll('input, select, button').forEach(el => {
        el.disabled = true;
      });
    } else if (els.eventSettings) {
      els.eventSettings.querySelectorAll('input, select, button').forEach(el => {
        el.disabled = false;
      });
    }

    // Hide Share section for non-host participants
    if (els.createEventBtn) {
        const shareSection = els.createEventBtn.closest('div')?.previousElementSibling;
        if (shareSection && shareSection.tagName === 'H3') {
            shareSection.style.display = (isEvent && !isHost) ? 'none' : '';
        }
        const shareGrid = els.createEventBtn.parentElement;
        if (shareGrid) {
            shareGrid.style.display = (isEvent && !isHost) ? 'none' : '';
        }
        
        // Update button text for host
        if (isEvent && isHost) {
            els.createEventBtn.textContent = 'Update Event Link';
        } else if (!isEvent) {
            els.createEventBtn.textContent = 'Create Event Link';
        }
    }

    // Always enable grid and participant inputs (name, password, view options)
    if (els.participantName) els.participantName.disabled = false;
    if (els.participantPassword) els.participantPassword.disabled = false;
    if (els.minAvailable) els.minAvailable.disabled = false;
    if (els.grid) els.grid.style.pointerEvents = 'auto';
  }

  // --- Calendar rendering ---
  window.initCalendar = function initCalendar() {
    const cal = document.getElementById('calendar');
    if (!cal) return;
    const base = state.startDate || new Date();
    state.calMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    window.renderCalendar();
  };

  window.renderCalendar = function renderCalendar() {
    const cal = document.getElementById('calendar');
    if (!cal) return;
    const month = state.calMonth || new Date();
    const year = month.getFullYear();
    const monthName = month.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    const firstDay = new Date(year, month.getMonth(), 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month.getMonth()+1, 0).getDate();

    const header = document.createElement('div');
    header.className = 'cal-header';
    const prev = document.createElement('button'); prev.className='btn'; prev.textContent = '◀';
    const next = document.createElement('button'); next.className='btn'; next.textContent = '▶';
    const title = document.createElement('div'); title.className='cal-title'; title.textContent = monthName;
    header.appendChild(prev); header.appendChild(title); header.appendChild(next);

    const grid = document.createElement('div');
    grid.className = 'cal-grid';
    const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    labels.forEach(l => { const el = document.createElement('div'); el.className='cal-label'; el.textContent=l; grid.appendChild(el); });
    for (let i=0;i<startWeekday;i++){ const el=document.createElement('div'); el.className='cal-cell out'; grid.appendChild(el); }
    for (let d=1; d<=daysInMonth; d++){
      const cur = new Date(year, month.getMonth(), d);
      const el = document.createElement('div'); el.className='cal-cell'; el.textContent=String(d);
      const inRange = state.startDate && state.endDate && cur>=new Date(state.startDate.getFullYear(), state.startDate.getMonth(), state.startDate.getDate()) && cur<=new Date(state.endDate.getFullYear(), state.endDate.getMonth(), state.endDate.getDate());
      if (inRange) el.classList.add('in-range');
      const isStart = state.startDate && cur.toDateString() === state.startDate.toDateString();
      const isEnd = state.endDate && cur.toDateString() === state.endDate.toDateString();
      if (isStart || isEnd) el.classList.add('selected');
      el.addEventListener('click', () => {
        const clickedDate = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate());
        
        if (!state.startDate || (state.startDate && state.endDate)) {
          // This is the first click of a new selection, reset to a single day
          state.startDate = clickedDate;
          state.endDate = clickedDate;
        } else {
          // This is the second click, completing a range
          let s = state.startDate;
          let e = clickedDate;
          if (e < s) { [s, e] = [e, s]; } // swap
          state.startDate = s;
          state.endDate = e;
        }

        if (els.startDate) els.startDate.value = state.startDate ? formatISODate(state.startDate) : '';
        if (els.endDate) els.endDate.value = state.endDate ? formatISODate(state.endDate) : '';
        window.renderCalendar();
        if (state.startDate && state.endDate) { renderGrid(false); computeBest(); if (typeof window.throttlePersist === 'function') window.throttlePersist(); }
      });
      grid.appendChild(el);
    }

    cal.innerHTML = '';
    cal.appendChild(header);
    cal.appendChild(grid);
    prev.addEventListener('click', () => { state.calMonth.setMonth(state.calMonth.getMonth()-1); window.renderCalendar(); });
    next.addEventListener('click', () => { state.calMonth.setMonth(state.calMonth.getMonth()+1); window.renderCalendar(); });
  };
})();

// Firebase helpers
 



