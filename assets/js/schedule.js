(() => {
  const state = {
    eventName: '',
    participantName: '',
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
  };

  const els = {
    eventName: document.getElementById('eventName'),
    participantName: document.getElementById('participantName'),
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
  };

  init();

  function init() {
    restoreFromURL();
    restoreDraft();
    state.meKey = getMeKey();
    updateTZDisplay();
    initDOW();
    // Defaults: next 7 days if none provided
    if (!state.startDate || !state.endDate) {
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
    if (state.startDate && state.endDate) renderGrid();
  }

  function getMeKey() {
    const name = (els.participantName?.value || '').trim() || 'Me';
    return name;
  }

  function attachHandlers() {
    els.applySettings?.addEventListener('click', () => {
      state.eventName = (els.eventName?.value || '').trim();
      state.participantName = (els.participantName?.value || '').trim();
      state.meKey = getMeKey();
      state.startDate = parseDateInput(els.startDate?.value);
      state.endDate = parseDateInput(els.endDate?.value);
      state.dayStart = els.dayStart?.value || '09:00';
      state.dayEnd = els.dayEnd?.value || '18:00';
      state.slotMinutes = Number(els.slotMinutes?.value || 30);
      persistDraft();
      renderGrid();
      computeBest();
    });

    els.toggleLocalTZ?.addEventListener('click', () => {
      state.useLocalTZ = true;
      state.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      updateTZDisplay();
    });

    els.makeShareLink?.addEventListener('click', () => {
      const data = serializeState();
      const url = new URL(location.href);
      url.hash = 's=' + encodeURIComponent(btoa(JSON.stringify(data)));
      els.shareLink.value = url.toString();
      try { navigator.clipboard.writeText(els.shareLink.value); } catch (_) {}
    });

    els.copyMyAvailability?.addEventListener('click', () => {
      const myData = exportMyAvailability();
      const text = JSON.stringify(myData);
      try { navigator.clipboard.writeText(text); } catch (_) {}
    });

    els.importAvailability?.addEventListener('click', () => {
      const text = els.importText.value.trim();
      if (!text) return;
      try {
        const obj = JSON.parse(text);
        mergeAvailabilityImport(obj);
        renderGrid(false);
        computeBest();
      } catch (_) {
        alert('Invalid JSON');
      }
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
  }

  function paintSlot(cellEl) {
    const key = cellEl.dataset.key;
    const [dateIso] = key.split(' ');
    const set = state.availability.get(dateIso)?.get(key) || new Set();
    const count = set.size;
    cellEl.classList.toggle('me', set.has(state.meKey));
    cellEl.setAttribute('data-count', String(count));
    cellEl.title = `${count} available`;
  }

  function computeBest() {
    if (!els.bestSlots) return;
    const scores = [];
    for (const [dateIso, dayMap] of state.availability.entries()) {
      for (const [timeKey, set] of dayMap.entries()) {
        const count = set.size;
        if (count > 0) scores.push({ key: timeKey, count });
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
    const h = location.hash;
    const m = h.match(/[#&]s=([^&]+)/);
    if (!m) return;
    try {
      const json = atob(decodeURIComponent(m[1]));
      const data = JSON.parse(json);
      applyRestoredData(data);
    } catch (_) { /* ignore */ }
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
    } catch (_) {}
  }
})();


