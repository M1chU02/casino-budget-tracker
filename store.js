import Store from "electron-store";
import { randomUUID } from "node:crypto";

const schema = {
  casinos: {
    type: "array",
    default: [], // { id, name, weeklyLimit, monthlyLimit }
  },
  entries: {
    type: "array",
    default: [], // { id, dateISO, casinoId, spent, won, notes }
  },
  budgets: {
    type: "object",
    properties: {
      weekly: { type: "number", default: 0 },
      monthly: { type: "number", default: 0 },
    },
    default: { weekly: 0, monthly: 0 },
  },
  settings: {
    type: "object",
    properties: {
      commitmentMode: { type: "boolean", default: false },
      cooldownMinutes: { type: "number", default: 3 },
      hideBalances: { type: "boolean", default: false },
      currency: { type: "string", default: "EUR" },
      currencySymbol: { type: "string", default: "€" },
      theme: { type: "string", default: "stake" },
    },
    default: {
      commitmentMode: false,
      cooldownMinutes: 3,
      hideBalances: false,
      currency: "EUR",
      currencySymbol: "€",
      theme: "stake",
    },
  },
};

export const store = new Store({ schema, name: "casino-tracker" });

export const helpers = {
  id: () => randomUUID(),
  nowISO: () => new Date().toISOString(),
  weekKey(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const week =
      1 +
      Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    const yr = d.getFullYear();
    return `${yr}-W${String(week).padStart(2, "0")}`;
  },
  monthKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  },
};

export function getState() {
  return {
    casinos: store.get("casinos"),
    entries: store.get("entries"),
    budgets: store.get("budgets"),
    settings: store.get("settings"),
  };
}

export function addCasino(name, weeklyLimit = 0, monthlyLimit = 0) {
  const casinos = store.get("casinos");
  const id = helpers.id();
  casinos.push({
    id,
    name: name.trim(),
    weeklyLimit: Number(weeklyLimit) || 0,
    monthlyLimit: Number(monthlyLimit) || 0,
  });
  store.set("casinos", casinos);
  return id;
}

export function updateCasinoLimits(id, weeklyLimit, monthlyLimit) {
  const casinos = store
    .get("casinos")
    .map((c) =>
      c.id === id
        ? {
            ...c,
            weeklyLimit: Number(weeklyLimit) || 0,
            monthlyLimit: Number(monthlyLimit) || 0,
          }
        : c
    );
  store.set("casinos", casinos);
}

export function removeCasino(id) {
  store.set(
    "casinos",
    store.get("casinos").filter((c) => c.id !== id)
  );
  store.set(
    "entries",
    store.get("entries").filter((e) => e.casinoId !== id)
  );
}

export function addEntry({ dateISO, casinoId, spent, won, notes }) {
  const entries = store.get("entries");
  const id = helpers.id();
  entries.push({
    id,
    dateISO,
    casinoId,
    spent: Number(spent) || 0,
    won: Number(won) || 0,
    notes: (notes || "").trim(),
  });
  store.set("entries", entries);
  return id;
}

export function deleteEntry(id) {
  store.set(
    "entries",
    store.get("entries").filter((e) => e.id !== id)
  );
}

export function setBudgets({ weekly, monthly }) {
  store.set("budgets", {
    weekly: Number(weekly) || 0,
    monthly: Number(monthly) || 0,
  });
}

export function setSettings(next) {
  store.set("settings", { ...store.get("settings"), ...next });
}

export function clearAllData() {
  store.set("casinos", []);
  store.set("entries", []);
  store.set("budgets", { weekly: 0, monthly: 0 });
  store.set("settings", {
    commitmentMode: false,
    cooldownMinutes: 3,
    hideBalances: false,
    currency: "EUR",
    currencySymbol: "€",
  });
}
