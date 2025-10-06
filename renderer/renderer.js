import { toCSV } from "../utils/csv.js";

const $ = (sel) => document.querySelector(sel);

const state = {
  casinos: [],
  entries: [],
  budgets: { weekly: 0, monthly: 0 },
  settings: {
    commitmentMode: false,
    cooldownMinutes: 3,
    hideBalances: false,
    currency: "EUR",
    currencySymbol: "€",
  },
};
let cooldownUntil = null;
let sessionStart = Date.now();

function money(n) {
  return state.settings.hideBalances
    ? "•••"
    : `${state.settings.currencySymbol}${(n || 0).toFixed(2)}`;
}
function net(e) {
  return (e.won || 0) - (e.spent || 0);
}

async function load() {
  // Apply theme class early
  document.body.classList.toggle(
    "theme-stake",
    (state.settings.theme || "stake") === "stake"
  );
  document.body.classList.toggle(
    "theme-shuffle",
    (state.settings.theme || "stake") === "shuffle"
  );
  const s = await window.api.getState();
  Object.assign(state, s);
  renderCasinos();
  fillCasinoSelect();
  restoreBudgets();
  renderHistory();
  renderSummary();
  drawCharts();
}

function restoreBudgets() {
  // Theme dropdown
  const themeSel = document.getElementById("themeToggle");
  if (themeSel) themeSel.value = state.settings.theme || "stake";

  $("#weeklyBudget").value = state.budgets.weekly || 0;
  $("#monthlyBudget").value = state.budgets.monthly || 0;
  $("#commitmentMode").checked = !!state.settings.commitmentMode;
  $("#cooldownMinutes").value = state.settings.cooldownMinutes || 3;
  $("#hideBalances").checked = !!state.settings.hideBalances;
  const options = Array.from($("#currencySelect").options);
  const match = options.find((o) =>
    o.value.startsWith(state.settings.currency + "|")
  );
  if (match) $("#currencySelect").value = match.value;
}

function renderSummary() {
  window.api.computeSummary().then((s) => {
    const weekOver =
      state.budgets.weekly > 0 && s.week.spent > state.budgets.weekly;
    const monthOver =
      state.budgets.monthly > 0 && s.month.spent > state.budgets.monthly;
    const remainingW = Math.max(0, (state.budgets.weekly || 0) - s.week.spent);
    const remainingM = Math.max(
      0,
      (state.budgets.monthly || 0) - s.month.spent
    );

    const perCasinoBadges = s.week.byCasino
      .map((c) => {
        const over = c.weeklyLimit && c.spent >= c.weeklyLimit;
        return `<span class="badge ${over ? "warn" : ""}">${c.name}: ${money(
          c.spent
        )}${c.weeklyLimit ? ` / ${money(c.weeklyLimit)}` : ""}</span>`;
      })
      .join(" ");

    $("#summary").innerHTML = `
      <div class="tile">
        <div class="k">This week</div>
        <div class="v ${weekOver ? "over" : ""}">Spent ${money(
      s.week.spent
    )} · Won ${money(s.week.won)} · Net <span class="${
      s.week.net >= 0 ? "net-pos" : "net-neg"
    }">${money(s.week.net)}</span></div>
        <div class="muted">Budget: ${
          state.budgets.weekly ? money(state.budgets.weekly) : "—"
        } · Remaining: ${state.budgets.weekly ? money(remainingW) : "—"}</div>
        <div class="muted" style="margin-top:6px;">Per-casino this week: ${
          perCasinoBadges || "—"
        }</div>
      </div>
      <div class="tile">
        <div class="k">This month</div>
        <div class="v ${monthOver ? "over" : ""}">Spent ${money(
      s.month.spent
    )} · Won ${money(s.month.won)} · Net <span class="${
      s.month.net >= 0 ? "net-pos" : "net-neg"
    }">${money(s.month.net)}</span></div>
        <div class="muted">Budget: ${
          state.budgets.monthly ? money(state.budgets.monthly) : "—"
        } · Remaining: ${state.budgets.monthly ? money(remainingM) : "—"}</div>
      </div>`;
  });
}

function renderCasinos() {
  const ul = $("#casinoList");
  ul.innerHTML = "";
  state.casinos.forEach((c) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${c.name}</span>
      <div class="limit">Weekly <input type="number" min="0" step="1" value="${
        c.weeklyLimit || 0
      }" data-wl="${c.id}">
      Monthly <input type="number" min="0" step="1" value="${
        c.monthlyLimit || 0
      }" data-ml="${c.id}"></div>
      <button data-save="${c.id}">Save limits</button>
      <button data-id="${c.id}" class="danger">Remove</button>`;
    ul.appendChild(li);
  });

  ul.onclick = async (e) => {
    const id = e.target?.dataset?.id;
    if (id) {
      await window.api.removeCasino(id);
      Object.assign(state, await window.api.getState());
      renderCasinos();
      fillCasinoSelect();
      renderHistory();
      renderSummary();
      drawCharts();
      return;
    }
    const saveId = e.target?.dataset?.save;
    if (saveId) {
      const wl = ul.querySelector(`input[data-wl="${saveId}"]`)?.value || 0;
      const ml = ul.querySelector(`input[data-ml="${saveId}"]`)?.value || 0;
      await window.api.updateCasinoLimits(saveId, Number(wl), Number(ml));
      Object.assign(state, await window.api.getState());
      renderSummary();
      drawCharts();
    }
  };
}

function fillCasinoSelect() {
  const sel = $("#entryCasino");
  sel.innerHTML = '<option value="" disabled selected>Select…</option>';
  state.casinos.forEach((c) => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.name;
    sel.appendChild(o);
  });
}

function renderHistory() {
  const tbody = $("#historyTable tbody");
  tbody.innerHTML = "";
  const byDate = [...state.entries].sort(
    (a, b) => new Date(b.dateISO) - new Date(a.dateISO)
  );
  byDate.forEach((e) => {
    const tr = document.createElement("tr");
    const casinoName =
      state.casinos.find((c) => c.id === e.casinoId)?.name || "—";
    tr.innerHTML = `
      <td>${new Date(e.dateISO).toLocaleDateString()}</td>
      <td>${casinoName}</td>
      <td>${money(e.spent)}</td>
      <td>${money(e.won)}</td>
      <td class="${net(e) >= 0 ? "net-pos" : "net-neg"}">${money(net(e))}</td>
      <td>${e.notes || ""}</td>
      <td><button data-del="${e.id}" class="danger">Delete</button></td>`;
    tbody.appendChild(tr);
  });

  tbody.onclick = async (e) => {
    const id = e.target?.dataset?.del;
    if (!id) return;
    await window.api.deleteEntry(id);
    Object.assign(state, await window.api.getState());
    renderHistory();
    renderSummary();
    drawCharts();
  };
}

async function maybeCooldownGateForCasino(casinoId) {
  if (!state.settings.commitmentMode) return true;
  const s = await window.api.computeSummary();
  const c = s.week.byCasino.find((x) => x.casinoId === casinoId);
  const reachedCasino = c && c.weeklyLimit && c.spent >= c.weeklyLimit;
  const reachedGlobal =
    (state.budgets.weekly && s.week.spent >= state.budgets.weekly) ||
    (state.budgets.monthly && s.month.spent >= state.budgets.monthly);
  if (!reachedCasino && !reachedGlobal) return true;
  return await cooldownDialog();
}

function cooldownDialog() {
  const dlg = $("#cooldownDialog");
  const status = $("#cooldownStatus");
  const reason = $("#cooldownReason");
  reason.value = "";
  status.textContent = "";
  dlg.showModal();

  return new Promise((resolve) => {
    let timer = null;
    $("#startCooldownBtn").onclick = (ev) => {
      if (!reason.value.trim()) {
        status.textContent = "Please write a short reason to proceed.";
        ev.preventDefault();
        return;
      }
      const mins = Number(
        $("#cooldownMinutes").value || state.settings.cooldownMinutes || 3
      );
      cooldownUntil = Date.now() + mins * 60000;
      tick();
      timer = setInterval(tick, 1000);
      function tick() {
        const remain = Math.max(
          0,
          Math.floor((cooldownUntil - Date.now()) / 1000)
        );
        status.textContent =
          remain > 0 ? `Cooling down… ${remain}s` : "You can proceed now.";
        if (remain <= 0) {
          clearInterval(timer);
        }
      }
    };

    dlg.addEventListener(
      "close",
      () => {
        const ok = cooldownUntil && Date.now() >= cooldownUntil;
        resolve(!!ok);
      },
      { once: true }
    );
  });
}

// Simple canvas charts

function setupCanvasDPR(canvas, height = 220) {
  const parentW = Math.max(
    320,
    canvas.parentElement?.clientWidth || canvas.width || 800
  );
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = parentW + "px";
  canvas.style.height = height + "px";
  canvas.width = Math.floor(parentW * dpr);
  canvas.height = Math.floor(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function drawPlaceholder(ctx, text) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height;
  ctx.save();
  ctx.fillStyle = "#2a3442";
  ctx.font = "13px Inter, system-ui";
  ctx.fillText(text, 24, h / dpr / 2 || 80);
  ctx.restore();
}

function drawLineChart(ctx, labels, values) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const pad = 30;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const rng = max - min || 1;
  ctx.strokeStyle = "#2a3442";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, h - pad);
  ctx.stroke();
  const y0 = h - pad - ((0 - min) / rng) * (h - 2 * pad);
  ctx.strokeStyle = "#314055";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(pad, y0);
  ctx.lineTo(w - pad, y0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "#7a5cff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad + i * ((w - 2 * pad) / Math.max(1, values.length - 1));
    const y = h - pad - ((v - min) / rng) * (h - 2 * pad);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawBarChart(ctx, labels, values) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const pad = 30;
  const max = Math.max(1, ...values);
  const barW = ((w - 2 * pad) / Math.max(1, values.length)) * 0.6;
  labels.forEach((label, i) => {
    const v = values[i] || 0;
    const x =
      pad +
      i * ((w - 2 * pad) / Math.max(1, values.length)) +
      ((w - 2 * pad) / Math.max(1, values.length) - barW) / 2;
    const bh = (v / max) * (h - 2 * pad);
    ctx.fillStyle = "#00e1a1";
    ctx.fillRect(x, h - pad - bh, barW, bh);
  });
}

function drawCharts() {
  const byDay = {};
  state.entries.forEach((e) => {
    const d = new Date(e.dateISO).toISOString().slice(0, 10);
    byDay[d] = (byDay[d] || 0) + (e.won - e.spent);
  });
  const days = Object.keys(byDay).sort().slice(-8);
  const vals = days.map((d) => byDay[d]);
  const line = setupCanvasDPR($("#weeklyNetChart"));
  if (days.length) {
    drawLineChart(line, days, vals);
  }

  // Weekly spend per casino
  const now = new Date();
  const monday = new Date(now);
  const day = (now.getDay() + 6) % 7;
  monday.setDate(now.getDate() - day);
  const weekEntries = state.entries.filter(
    (e) => new Date(e.dateISO) >= monday
  );
  const spendByCasino = new Map();
  weekEntries.forEach((e) => {
    const name = state.casinos.find((c) => c.id === e.casinoId)?.name || "—";
    spendByCasino.set(name, (spendByCasino.get(name) || 0) + e.spent);
  });
  const labels = Array.from(spendByCasino.keys());
  const spendVals = Array.from(spendByCasino.values());
  const bars = setupCanvasDPR($("#casinoSpendChart"));
  if (labels.length) {
    drawBarChart(bars, labels, spendVals);
  }
}

// Events
document.getElementById("budgetForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const weekly = Number(document.getElementById("weeklyBudget").value || 0);
  const monthly = Number(document.getElementById("monthlyBudget").value || 0);
  await window.api.setBudgets({ weekly, monthly });
  const [code, symbol] = document
    .getElementById("currencySelect")
    .value.split("|");
  await window.api.setSettings({
    commitmentMode: document.getElementById("commitmentMode").checked,
    cooldownMinutes: Number(
      document.getElementById("cooldownMinutes").value || 3
    ),
    hideBalances: document.getElementById("hideBalances").checked,
    currency: code,
    currencySymbol: symbol,
  });
  Object.assign(state, await window.api.getState());
  renderSummary();
  renderHistory();
  drawCharts();
});

document.getElementById("casinoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("casinoName").value.trim();
  const wl = Number(document.getElementById("casinoWeeklyLimit").value || 0);
  const ml = Number(document.getElementById("casinoMonthlyLimit").value || 0);
  if (!name) return;
  await window.api.addCasino(name, wl, ml);
  Object.assign(state, await window.api.getState());
  document.getElementById("casinoName").value = "";
  document.getElementById("casinoWeeklyLimit").value = "";
  document.getElementById("casinoMonthlyLimit").value = "";
  renderCasinos();
  fillCasinoSelect();
  drawCharts();
});

document.getElementById("entryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const casinoId = document.getElementById("entryCasino").value;
  const ok = await maybeCooldownGateForCasino(casinoId);
  if (!ok) return;
  const dateISO = new Date(
    document.getElementById("entryDate").value
  ).toISOString();
  const spent = Number(document.getElementById("entrySpent").value || 0);
  const won = Number(document.getElementById("entryWon").value || 0);
  const notes = document.getElementById("entryNotes").value;
  if (!dateISO || !casinoId) return;
  await window.api.addEntry({ dateISO, casinoId, spent, won, notes });
  Object.assign(state, await window.api.getState());
  renderHistory();
  renderSummary();
  drawCharts();
  document.getElementById("entrySpent").value = "";
  document.getElementById("entryWon").value = "";
  document.getElementById("entryNotes").value = "";
});

document.getElementById("historyTable").addEventListener("click", async (e) => {
  const id = e.target?.dataset?.del;
  if (!id) return;
  await window.api.deleteEntry(id);
  Object.assign(state, await window.api.getState());
  renderHistory();
  renderSummary();
  drawCharts();
});

document.getElementById("wipeDataBtn").addEventListener("click", async () => {
  const wiped = await window.api.clearAll();
  if (wiped) {
    Object.assign(state, await window.api.getState());
    renderCasinos();
    fillCasinoSelect();
    renderHistory();
    renderSummary();
    restoreBudgets();
    drawCharts();
  }
});

document
  .getElementById("exportBtn")
  .addEventListener("click", () => exportCSV());
window.api.onExportCSV(() => exportCSV());

document.getElementById("panicBtn").addEventListener("click", () => {
  const resources = [
    ["BeGambleAware (UK)", "https://www.begambleaware.org/"],
    ["GamCare (UK)", "https://www.gamcare.org.uk/"],
    ["Gamblers Anonymous", "https://www.gamblersanonymous.org.uk/"],
  ];
  const pick = resources[Math.floor(Math.random() * resources.length)];
  window.open(pick[1], "_blank");
});

async function exportCSV() {
  const rows = state.entries.map((e) => ({
    date: new Date(e.dateISO).toISOString().slice(0, 10),
    casino: state.casinos.find((c) => c.id === e.casinoId)?.name || "",
    spent: e.spent,
    won: e.won,
    net: (e.won - e.spent).toFixed(2),
    currency: state.settings.currency,
    notes: e.notes || "",
  }));

  const headers = [
    { key: "date", label: "Date" },
    { key: "casino", label: "Casino" },
    { key: "spent", label: "Spent" },
    { key: "won", label: "Won" },
    { key: "net", label: "Net" },
    { key: "currency", label: "Currency" },
    { key: "notes", label: "Notes" },
  ];

  const csv = toCSV(rows, headers);
  const path = await window.api.saveCSV("casino-tracker.csv", csv);
  if (path) alert("Exported to " + path);
}

document.getElementById("entryDate").valueAsDate = new Date();

setInterval(() => {
  const ms = Date.now() - sessionStart;
  const m = Math.floor(ms / 60000),
    s = Math.floor((ms % 60000) / 1000);
  document.getElementById("sessionTimer").textContent = `Session: ${String(
    m
  ).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}, 1000);

load();

// Theme switch
const themeSel = document.getElementById("themeToggle");
if (themeSel) {
  themeSel.addEventListener("change", async () => {
    const theme = themeSel.value;
    await window.api.setSettings({ theme });
    Object.assign(state, await window.api.getState());
    document.body.classList.toggle("theme-stake", theme === "stake");
    document.body.classList.toggle("theme-shuffle", theme === "shuffle");
  });
}

let chartsResizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(chartsResizeTimer);
  chartsResizeTimer = setTimeout(drawCharts, 150);
});
