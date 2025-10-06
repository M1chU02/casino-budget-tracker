import { toCSV } from '../utils/csv.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const state = { casinos: [], entries: [], budgets: { weekly: 0, monthly: 0 }, settings: { commitmentMode:false, cooldownMinutes:3, hideBalances:false } };
let cooldownUntil = null; // timestamp
let sessionStart = Date.now();

function fmtMoney(n) { return (state.settings.hideBalances ? '•••' : `€${(n||0).toFixed(2)}`); }
function net(e) { return (e.won||0) - (e.spent||0); }

async function load() {
  const s = await window.api.getState();
  Object.assign(state, s);
  renderCasinos();
  fillCasinoSelect();
  restoreBudgets();
  renderHistory();
  renderSummary();
}

function restoreBudgets() {
  $('#weeklyBudget').value = state.budgets.weekly || 0;
  $('#monthlyBudget').value = state.budgets.monthly || 0;
  $('#commitmentMode').checked = !!state.settings.commitmentMode;
  $('#cooldownMinutes').value = state.settings.cooldownMinutes || 3;
  $('#hideBalances').checked = !!state.settings.hideBalances;
}

function renderSummary() {
  window.api.computeSummary().then(s => {
    const weekOver = state.budgets.weekly > 0 && s.week.spent > state.budgets.weekly;
    const monthOver = state.budgets.monthly > 0 && s.month.spent > state.budgets.monthly;

    const el = $('#summary');
    el.innerHTML = `
      <div class="tile">
        <div class="k">This week</div>
        <div class="v ${weekOver ? 'over':''}">Spent ${fmtMoney(s.week.spent)} · Won ${fmtMoney(s.week.won)} · Net <span class="${s.week.net>=0?'net-pos':'net-neg'}">${fmtMoney(s.week.net)}</span></div>
        <div class="muted">Budget: ${state.budgets.weekly?fmtMoney(state.budgets.weekly):'—'} · Remaining: ${state.budgets.weekly?fmtMoney(Math.max(0, state.budgets.weekly - s.week.spent)):'—'}</div>
      </div>
      <div class="tile">
        <div class="k">This month</div>
        <div class="v ${monthOver ? 'over':''}">Spent ${fmtMoney(s.month.spent)} · Won ${fmtMoney(s.month.won)} · Net <span class="${s.month.net>=0?'net-pos':'net-neg'}">${fmtMoney(s.month.net)}</span></div>
        <div class="muted">Budget: ${state.budgets.monthly?fmtMoney(state.budgets.monthly):'—'} · Remaining: ${state.budgets.monthly?fmtMoney(Math.max(0, state.budgets.monthly - s.month.spent)):'—'}</div>
      </div>`;
  });
}

function renderCasinos() {
  const ul = $('#casinoList');
  ul.innerHTML = '';
  state.casinos.forEach(c => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${c.name}</span> <button data-id="${c.id}" class="danger">Remove</button>`;
    ul.appendChild(li);
  });
}

function fillCasinoSelect() {
  const sel = $('#entryCasino');
  sel.innerHTML = '<option value="" disabled selected>Select…</option>';
  state.casinos.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.name; sel.appendChild(o);
  });
}

function renderHistory() {
  const tbody = $('#historyTable tbody');
  tbody.innerHTML = '';
  const byDate = [...state.entries].sort((a,b)=>new Date(b.dateISO)-new Date(a.dateISO));
  byDate.forEach(e => {
    const tr = document.createElement('tr');
    const casinoName = state.casinos.find(c=>c.id===e.casinoId)?.name || '—';
    tr.innerHTML = `
      <td>${new Date(e.dateISO).toLocaleDateString()}</td>
      <td>${casinoName}</td>
      <td>${fmtMoney(e.spent)}</td>
      <td>${fmtMoney(e.won)}</td>
      <td class="${net(e)>=0?'net-pos':'net-neg'}">${fmtMoney(net(e))}</td>
      <td>${e.notes||''}</td>
      <td><button data-del="${e.id}" class="danger">Delete</button></td>`;
    tbody.appendChild(tr);
  });
}

// Safety: commitment mode cooldown gate when over budget
async function maybeCooldownGate() {
  if (!state.settings.commitmentMode) return true;
  const s = await window.api.computeSummary();
  const over = (state.budgets.weekly && s.week.spent >= state.budgets.weekly) ||
               (state.budgets.monthly && s.month.spent >= state.budgets.monthly);
  if (!over) return true;

  const dlg = $('#cooldownDialog');
  const status = $('#cooldownStatus');
  const reason = $('#cooldownReason');
  reason.value = '';
  status.textContent = '';
  dlg.showModal();

  return new Promise(resolve => {
    let timer = null;
    $('#startCooldownBtn').onclick = (ev) => {
      if (!reason.value.trim()) {
        status.textContent = 'Please write a short reason to proceed.';
        ev.preventDefault();
        return;
      }
      const mins = Number($('#cooldownMinutes').value || state.settings.cooldownMinutes || 3);
      cooldownUntil = Date.now() + mins * 60000;
      tick();
      timer = setInterval(tick, 1000);
      function tick() {
        const remain = Math.max(0, Math.floor((cooldownUntil - Date.now())/1000));
        status.textContent = remain > 0 ? `Cooling down… ${remain}s` : 'You can proceed now.';
        if (remain <= 0) { clearInterval(timer); }
      }
    };

    dlg.addEventListener('close', () => {
      const ok = cooldownUntil && Date.now() >= cooldownUntil;
      resolve(!!ok);
    }, { once: true });
  });
}

// Session timer
setInterval(() => {
  const ms = Date.now() - sessionStart;
  const m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000);
  $('#sessionTimer').textContent = `Session: ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}, 1000);

// ==== Events ====

$('#budgetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const weekly = Number($('#weeklyBudget').value || 0);
  const monthly = Number($('#monthlyBudget').value || 0);
  await window.api.setBudgets({ weekly, monthly });
  await window.api.setSettings({
    commitmentMode: $('#commitmentMode').checked,
    cooldownMinutes: Number($('#cooldownMinutes').value || 3),
    hideBalances: $('#hideBalances').checked
  });
  Object.assign(state, await window.api.getState());
  renderSummary();
});

$('#casinoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#casinoName').value.trim();
  if (!name) return;
  await window.api.addCasino(name);
  Object.assign(state, await window.api.getState());
  $('#casinoName').value='';
  renderCasinos();
  fillCasinoSelect();
});

$('#casinoList').addEventListener('click', async (e) => {
  const id = e.target?.dataset?.id;
  if (!id) return;
  await window.api.removeCasino(id);
  Object.assign(state, await window.api.getState());
  renderCasinos();
  fillCasinoSelect();
  renderHistory();
  renderSummary();
});

$('#entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const ok = await maybeCooldownGate();
  if (!ok) return; // user canceled or cooldown not finished

  const dateISO = new Date($('#entryDate').value).toISOString();
  const casinoId = $('#entryCasino').value;
  const spent = Number($('#entrySpent').value || 0);
  const won = Number($('#entryWon').value || 0);
  const notes = $('#entryNotes').value;
  if (!dateISO || !casinoId) return;
  await window.api.addEntry({ dateISO, casinoId, spent, won, notes });
  Object.assign(state, await window.api.getState());
  renderHistory();
  renderSummary();
  // Clear entry inputs except date
  $('#entrySpent').value = '';
  $('#entryWon').value = '';
  $('#entryNotes').value = '';
});

$('#historyTable').addEventListener('click', async (e) => {
  const id = e.target?.dataset?.del;
  if (!id) return;
  await window.api.deleteEntry(id);
  Object.assign(state, await window.api.getState());
  renderHistory();
  renderSummary();
});

$('#wipeDataBtn').addEventListener('click', async () => {
  const wiped = await window.api.clearAll();
  if (wiped) {
    Object.assign(state, await window.api.getState());
    renderCasinos(); fillCasinoSelect(); renderHistory(); renderSummary(); restoreBudgets();
  }
});

$('#exportBtn').addEventListener('click', () => exportCSV());
window.api.onExportCSV(() => exportCSV());

$('#panicBtn').addEventListener('click', () => {
  // EU/UK resources; feel free to add local hotlines
  const resources = [
    ['BeGambleAware (UK)', 'https://www.begambleaware.org/'],
    ['GamCare (UK)', 'https://www.gamcare.org.uk/'],
    ['Gamblers Anonymous', 'https://www.gamblersanonymous.org.uk/']
  ];
  const pick = resources[Math.floor(Math.random()*resources.length)];
  window.open(pick[1], '_blank');
});

async function exportCSV() {
  const rows = state.entries.map(e => ({
    date: new Date(e.dateISO).toISOString().slice(0,10),
    casino: state.casinos.find(c=>c.id===e.casinoId)?.name || '',
    spent: e.spent,
    won: e.won,
    net: (e.won - e.spent).toFixed(2),
    notes: e.notes || ''
  }));

  const headers = [
    { key:'date', label: 'Date' },
    { key:'casino', label: 'Casino' },
    { key:'spent', label: 'Spent' },
    { key:'won', label: 'Won' },
    { key:'net', label: 'Net' },
    { key:'notes', label: 'Notes' }
  ];

  const csv = toCSV(rows, headers);
  const path = await window.api.saveCSV('casino-tracker.csv', csv);
  if (path) alert('Exported to '+path);
}

// Default date to today
$('#entryDate').valueAsDate = new Date();

// Kick off
load();
