export function toCSV(rows, headers) {
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = headers.map((h) => esc(h.label)).join(",");
  const body = rows
    .map((r) => headers.map((h) => esc(r[h.key])).join(","))
    .join("\n");
  return head + "\n" + body + "\n";
}
