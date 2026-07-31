// XYZ Financial Report — published static build.
// Source of truth for the application is this file (app.jsx); app.js is the
// browser-ready transpile produced from it (see BUILD.md). The two ES-module
// imports of the original (react, xlsx) are replaced here by the runtime
// globals that the vendored UMD bundles put on window: React / ReactDOM, and
// XLSX (referenced directly as a global, so nothing is redeclared here).
const { useState, useEffect, Fragment, Component } = React;

// XYZ Financial Report — build v3.8 (29 Jul 2026)
// Includes: auto-seeded register · invoices (raise / pay / outstanding) · one combined
// Invoice + Payments Received + Allocations table · disbursements edited per payment and
// mirrored from the Disbursements tab · party statements with Total Paid and Net Due
// closed & archived agreements locked until reopened · Super Admin + Admin roles · invite-only
// registration with auto-generated links · release panel with full-page data-entry lock.

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div className="p-6 m-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
        <b>Something went wrong on this page.</b>
        <div className="mt-1 text-xs font-mono whitespace-pre-wrap">{String((this.state.error && (this.state.error.message || this.state.error)) || "Unknown error")}</div>
        <button onClick={() => this.setState({ error: null })} className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-rose-600 text-white">Try again</button>
      </div>
    );
    return this.props.children;
  }
}

const USD_AED = 3.65;
const DEFAULT_CURRENCIES = [
  { code: "USD", rate: 1, fixed: true },
  { code: "AED", rate: 1 / USD_AED, fixed: true },
  { code: "EUR", rate: null, fixed: false },
  { code: "AOA", rate: null, fixed: false },
  { code: "GBP", rate: null, fixed: false },
];

const DEFAULT_PARTIES = [
  "AF", "CB***", "CB", "RS", "PCA", "CP", "Cash (Others)", "O. Dev",
].map((name, i) => ({ id: "dp" + i, name, type: "disbursement" }));

const AG_STATUSES = ["Ongoing", "Hold", "Pending", "Overdue", "Closed"];
const PAY_STATUSES = ["Ongoing", "Hold", "Pending", "Overdue", "Paid"];
// Global ordering: parties and accounts are shown alphabetically everywhere,
// with the "Cash …" party and "O. Dev" always pinned to the end.
const orderName = (a, b) => String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
const orderPartyName = (a, b) => { const pin = (n) => (n === "O. Dev" ? 2 : /^cash/i.test(n) ? 1 : 0); return (pin(a) - pin(b)) || orderName(a, b); };
const LOGIN_ENABLED = true; // lock screen on - first account created becomes Admin
const SHARED = true; // team-shared storage: all users of the published app see the same data
const stGet = async (k, shared = SHARED) => { try { const r = await window.storage.get(k, shared); return r && r.value ? r.value : null; } catch (e) { return null; } };
const stSet = async (k, v, shared = SHARED) => { try { await window.storage.set(k, v, shared); } catch (e) { console.error("storage set failed", e); } };

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmt = (n) => (isNaN(n) ? "0.00" : Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const csym = (c) => ({ USD: "$", EUR: "€", AED: "د.إ", GBP: "£", AOA: "Kz" }[c] || c);
const FX = { USD: 1, EUR: 1.08232, AED: 1 / 3.65, GBP: 1.27, AOA: 0.0011 };
const Amt = ({ v, sym = "$", className = "" }) => {
  const n = Number(v || 0);
  return (
    <span className={`flex items-baseline justify-between gap-3 w-full tabular-nums ${className}`}>
      <span className="opacity-50 font-normal">{sym}</span>
      <span>{n < -0.005 ? `(${fmt(-n)})` : fmt(n)}</span>
    </span>
  );
};
// Tile variant: the currency symbol travels with the figure. Amt's justify-between
// layout is right for narrow table cells but leaves a void across a wide card.
const AmtTile = ({ v, sym = "$", className = "" }) => {
  const n = Number(v || 0);
  return (
    <span className={`inline-flex items-baseline gap-2 tabular-nums ${className}`}>
      <span className="opacity-40 font-normal text-[0.7em]">{sym}</span>
      <span>{n < -0.005 ? `(${fmt(-n)})` : fmt(n)}</span>
    </span>
  );
};
const AmtG = ({ v, sym = "$", className = "" }) => {
  const n = Number(v || 0);
  return (
    <span className={`inline-flex items-baseline justify-end gap-1.5 tabular-nums ${className}`}>
      <span className="inline-block text-right" style={{ minWidth: "6.5rem" }}>{n < -0.005 ? `(${fmt(-n)})` : fmt(n)}</span>
      <span className="opacity-50">{sym}</span>
    </span>
  );
};
const PartyName = ({ name, className }) => (
  <span className={className}>
    {name}
    {name === "O. Dev" && <span className="block text-[10px] italic text-slate-400 font-normal leading-tight">(NOT Service Fee)</span>}
  </span>
);
const yearOf = (d) => (d ? new Date(d).getFullYear().toString() : "");
const APP_VERSION = "v3.8";
const BUILD = "2026-07-29 · v3.8";
const SUPER = "superadmin";
const SUPER_ADMIN_ID = "AL1409"; // this user ID always holds Super Admin
const roleLabel = (r) => (r === SUPER ? "Super Admin" : "Admin");
const isLocked = (a) => !!a && (a.status === "Closed" || !!a.archived);
const LOCK_MSG = "This agreement is closed or archived — reopen it before making changes.";
const hrefPrint = () => { try { return window.location.href; } catch (e) { return ""; } };
const refPrint = () => { try { return document.referrer || ""; } catch (e) { return ""; } };
const hostOnly = () => { try { return window.location.host || ""; } catch (e) { return ""; } };
const pagePrint = () => {
  const r = refPrint();
  if (/^https?:\/\//i.test(r)) { try { const u = new URL(r); return u.host + u.pathname.replace(/\/+$/, ""); } catch (e) {} }
  try { return (window.location.host || "") + (window.location.pathname || "").replace(/\/+$/, ""); } catch (e) {}
  return "unknown";
};
const urlParam = (k) => {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get(k) || new URLSearchParams((window.location.hash || "").replace(/^#/, "")).get(k) || "";
  } catch (e) { return ""; }
};

const MON = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
const pd = (s) => { const m = /(\d{1,2})-(\w{3})-(\d{2})/.exec(s || ""); return m ? `20${m[3]}-${MON[m[2]]}-${String(m[1]).padStart(2, "0")}` : ""; };
// ---- invoice sequence helpers -------------------------------------------------
// Legacy receipts carry their invoice reference in `notes` (e.g. "Inv #1 (000072)").
// These helpers promote those references into real invoice records so the register
// starts from the historical sequence instead of restarting at the first new entry.
const invRefFromNote = (note) => {
  const s = String(note || "").trim();
  if (!s) return "";
  const m = /\(([^)]+)\)\s*$/.exec(s);
  return (m ? m[1] : s).trim();
};
const splitNum = (s) => {
  const m = /^(.*?)(\d+)\s*$/.exec(String(s || "").trim());
  return m ? { prefix: m[1], digits: m[2], value: parseInt(m[2], 10) } : null;
};
// Suggests the next number by continuing the dominant numbering family already in
// use (same prefix + same digit width), so 000113 -> 000114 rather than restarting.
// The agreement's own numbering wins; the wider register is only a fallback for an
// agreement that has no usable number of its own yet.
const seqFrom = (agreements) => {
  const fam = {};
  (agreements || []).forEach((a) => (a.invoices || []).forEach((iv) => {
    const p = splitNum(iv.number);
    if (!p || !isFinite(p.value)) return;
    const k = p.prefix + "|" + p.digits.length;
    if (!fam[k]) fam[k] = { prefix: p.prefix, width: p.digits.length, max: p.value, count: 0 };
    fam[k].count++;
    if (p.value > fam[k].max) fam[k].max = p.value;
  }));
  const list = Object.values(fam);
  if (!list.length) return "";
  list.sort((x, y) => (y.count - x.count) || (y.max - x.max));
  const best = list[0];
  return best.prefix + String(best.max + 1).padStart(best.width, "0");
};
const nextInvNumber = (agreements, agreement) => invSuggestion(agreements, agreement).number;
const numberBasis = (agreements, agreement) => invSuggestion(agreements, agreement).basis;
// Continues the open agreement's own numbering, but declines to suggest a number
// that is already used elsewhere or that sits below the register's high-water mark
// in the same numbering family — either would duplicate a number across agreements.
function invSuggestion(agreements, agreement) {
  const reg = { number: seqFrom(agreements), basis: "the register" };
  if (!agreement) return reg;
  const own = seqFrom([agreement]);
  if (!own) return reg;
  const used = new Set();
  (agreements || []).forEach((a) => (a.invoices || []).forEach((iv) => {
    const s = String(iv.number || "").trim();
    if (s) used.add(s.toLowerCase());
  }));
  if (used.has(own.toLowerCase())) return reg;
  const p = splitNum(own);
  if (p) {
    let famMax = -Infinity;
    (agreements || []).forEach((a) => (a.invoices || []).forEach((iv) => {
      const q = splitNum(iv.number);
      if (q && q.prefix === p.prefix && q.digits.length === p.digits.length && q.value > famMax) famMax = q.value;
    }));
    if (p.value <= famMax) return reg;
  }
  return { number: own, basis: "this agreement" };
}
const backfillInvoices = (d) => {
  if (!d || !Array.isArray(d.agreements)) return d;
  let touched = false;
  const agreements = d.agreements.map((a) => {
    const receipts = a.receipts || [];
    if ((a.invoices || []).length > 0 || receipts.length === 0) return a;
    const groups = [], byNote = {};
    receipts.forEach((r) => {
      const key = String(r.notes || "").trim();
      let g = key ? byNote[key] : null;
      if (!g) { g = { key, rows: [] }; groups.push(g); if (key) byNote[key] = g; }
      g.rows.push(r);
    });
    const invoices = groups.map((g) => ({
      id: uid(),
      date: g.rows[0].date || a.date || "",
      number: invRefFromNote(g.key),
      dueDate: "",
      amount: g.rows.reduce((s, r) => s + Number(r.amount || 0), 0),
      rate: Number(g.rows[0].rate || 1),
      notes: g.key,
      backfilled: true,
    }));
    const link = {};
    groups.forEach((g, i) => g.rows.forEach((r) => { link[r.id] = invoices[i].id; }));
    touched = true;
    return { ...a, invoices, receipts: receipts.map((r) => (r.invoiceId ? r : { ...r, invoiceId: link[r.id] || "" })) };
  });
  return touched ? { ...d, agreements } : d;
};

// Links any receipt that has no invoice of its own to the oldest invoice still
// carrying a balance, preferring an invoice whose balance matches the receipt exactly.
const autoLinkReceipts = (d) => {
  if (!d || !Array.isArray(d.agreements)) return d;
  let changed = false;
  const agreements = d.agreements.map((a) => {
    const invs = a.invoices || [], rcpts = a.receipts || [];
    if (!invs.length || !rcpts.length) return a;
    const ids = new Set(invs.map((iv) => iv.id));
    if (rcpts.every((r) => r.invoiceId && ids.has(r.invoiceId))) return a;
    const bal = {};
    invs.forEach((iv) => { bal[iv.id] = Number(iv.amount || 0); });
    rcpts.forEach((r) => { if (r.invoiceId && ids.has(r.invoiceId)) bal[r.invoiceId] -= Number(r.amount || 0); });
    const order = [...invs].sort((x, y) => String(x.date || "").localeCompare(String(y.date || "")));
    let local = false;
    const next = rcpts.map((r) => {
      if (r.invoiceId && ids.has(r.invoiceId)) return r;
      const amt = Number(r.amount || 0);
      const pick = order.find((iv) => Math.abs(bal[iv.id] - amt) < 0.005) || order.find((iv) => bal[iv.id] > 0.005);
      if (!pick) return r;
      bal[pick.id] -= amt;
      local = true; changed = true;
      return { ...r, invoiceId: pick.id, autoLinked: true };
    });
    return local ? { ...a, receipts: next } : a;
  });
  return changed ? { ...d, agreements } : d;
};
const normalizeInvoices = (d) => autoLinkReceipts(backfillInvoices(d));

const REGISTER = [
  { ref: "1", title: "Amufert SA", cur: "USD", total: 500950, status: "Closed",
    receipts: [["17-Jun-24", "Inv #1 (000072)", 270000], ["15-Jul-24", "Inv #2 (000071)", 230950]],
    alloc: { AF: 400950, "O. Dev": 100000 } },
  { ref: "2", title: "Consulmet", cur: "USD", total: 300000, status: "Closed",
    receipts: [["28-Jun-24", "Inv #1 (000069)", 300000]], alloc: { AF: 300000 } },
  { ref: "3", title: "XYZ (S)", cur: "USD", total: 1250000, status: "Closed",
    receipts: [["1-Jun-24", "Inv #1 (000067)", 750000], ["15-Jun-24", "Inv #2 (000068)", 500000]], alloc: { AF: 1250000 } },
  { ref: "4", title: "DAR Ang.", cur: "EUR", total: 813848.59, status: "Ongoing",
    receipts: [
      ["28-Oct-24", "Inv #1 (INV-000074)", 34361.25, 38286], ["28-Dec-24", "Inv #2 (INV-000081)", 110250, 119325.78],
      ["5-Feb-25", "Inv #3 (INV-000082)", 98000, 106067.36], ["16-Jun-25", "Inv #4 (00000093)", 31556, 34153.69],
      ["14-Jun-25", "Inv #5 (0000094)", 73631, 79692.57], ["9-Jul-25", "Inv #6 (00000097)", 105188, 113846.54],
      ["10-Oct-25", "Inv #7 (000000100)", 32465.24, 32960.80], ["14-Nov-25", "Inv #8 (000000101)", 75752.20, 89979.77],
      ["15-Dec-25", "Inv #9 (000000102)", 108217.43, 128542.53], ["31-Jan-26", "Inv #10 (000000107)", 25675.17, 29625.29],
      ["31-Mar-26", "Inv #10 (000000108)", 72746.29, 78060.41]],
    alloc: { "CB***": 850540.89 } },
  { ref: "5", title: "DXB", cur: "USD", total: 1500005, status: "Ongoing", note: "Received in AED",
    receipts: [["16-Oct-24", "Inv #1 (AF)", 382738.36], ["5-Jan-25", "Invst #1 (0000XX)", 778136.99], ["5-Mar-25", "Invst #2 (0000XX)", 317000]],
    alloc: { AF: 760000, CB: 290000, RS: 450000 } },
  { ref: "6", title: "RS Dxb 200", cur: "USD", total: 200000, status: "Closed",
    receipts: [["1-Dec-24", "Inv #1 (INV 000184)", 200000]], alloc: { CB: 20000, RS: 180000 } },
  { ref: "7", title: "XYZ (S)", cur: "USD", total: 1100000, status: "Closed",
    receipts: [["8-Jan-25", "Inv #1 (INV-000085)", 242000], ["12-Feb-25", "Inv #2 (INV-000086)", 319000], ["9-Mar-25", "Inv #3 (INV-000087)", 198000], ["23-Apr-25", "Inv # (INV-000088)", 341000]],
    alloc: { AF: 1000000, CB: 100000 } },
  { ref: "8", title: "RS Dxb 100", cur: "USD", total: 99885.05, status: "Closed",
    receipts: [["20-Mar-25", "Inv #1 (INV-000089)", 99885]], alloc: { CB: 10000, RS: 89885 } },
  { ref: "9", title: "RS NorjMarine", cur: "USD", total: 770000, status: "Ongoing",
    receipts: [["1-Oct-25", "Invst#3 (000099)", 179990]], alloc: { AF: 49000, "CB***": 80000, RS: 79990 } },
  { ref: "9", title: "DXB 1.5M (AF)", cur: "USD", total: 576071.23, status: "Ongoing",
    receipts: [["3-Nov-25", "Invst #4 (0000XX)", 300000], ["8-Feb-26", "Invst #5 (0000XX)", 276071.23]], alloc: { AF: 576071.23 } },
  { ref: "9.a", title: "DXB _Oak Adjusment", cur: "USD", total: 526421.23, status: "Ongoing",
    receipts: [["31-Jul-25", "Invst#3 (0000XX)", 387671.23], ["3-Apr-26", "Invst #5 (0000XX)", 138750]], alloc: { AF: 526421.23, "Cash (Others)": 151441.14 } },
  { ref: "10", title: "Okut 1", cur: "USD", total: 653882.30, status: "Ongoing", note: "Received amounts not logged in USD column on source",
    receipts: [], alloc: { AF: 309720.57, PCA: 192720.57, CP: 117000, "Cash (Others)": 75720.57 } },
  { ref: "11", title: "XYZ (S) 2", cur: "USD", total: 1065000, status: "Closed",
    receipts: [["1-Nov-25", "Inv #1 (000104)", 395000], ["1-Dec-25", "Inv #2 (000105)", 245000], ["1-Jan-26", "Inv #3 (000106)", 425000]], alloc: { AF: 1065000 } },
  { ref: "12", title: "London (1079) / Conc.", cur: "EUR", total: 863712, status: "Ongoing", note: "Invoices not yet received",
    receipts: [], alloc: { AF: 87287.16 } },
  { ref: "13", title: "Cedilha 2025", cur: "EUR", total: 270800, status: "Closed",
    receipts: [["1-Dec-25", "Inv #1 (66/65/65/63)", 270800, 293092.26]], alloc: { AF: 146546.13, CP: 146546.13 } },
  { ref: "14", title: "Cedilha 2026 (400)", cur: "EUR", total: 400000, status: "Ongoing",
    receipts: [["15-Feb-26", "Inv #1 (000111)", 169535.16], ["15-Mar-26", "Inv #2", 58052.45], ["15-Apr-26", "Inv #3", 53791.30]], alloc: { "Cash (Others)": 448922.05 } },
  { ref: "15", title: "Angola _K (1M)", cur: "USD", total: 1000000, status: "Pending", receipts: [], alloc: {} },
  { ref: "16", title: "Trans Africa (VRD)", cur: "EUR", total: 1000000, status: "Ongoing", note: "Allocations to AF; USD receipts not logged on source",
    receipts: [], alloc: { AF: 765484.26 } },
  { ref: "17", title: "Angola (CBAdw)", cur: "USD", total: 319320, status: "Ongoing",
    receipts: [["20-Apr-26", "Inv #1 (000113)", 319320]], alloc: { "CB***": 319320 } },
  { ref: "18", title: "XYZ (S) 3", cur: "USD", total: 1000000, status: "Closed",
    receipts: [["5-Feb-26", "Inv #1 (000104)", 325000], ["5-Mar-26", "Inv #2 (000105)", 245000], ["5-Apr-26", "Inv #3 (000106)", 430000]], alloc: { AF: 1000000 } },
  { ref: "19", title: "XYZ (S) 4", cur: "USD", total: 1000000, status: "Pending",
    receipts: [], alloc: { "CB***": 1000000 } },
  { ref: "20", title: "DXB (BD)_Russo", cur: "USD", total: 526421.23, status: "Ongoing",
    receipts: [["31-Jul-25", "Invst#3 (0000XX)", 387671.23], ["3-Apr-26", "Invst #5 (0000XX)", 138750]], alloc: { RS: 450671.23, "Cash (Others)": 50000, "O. Dev": 25750 } },
];

function buildSeed() {
  const agreements = [], disbursements = [];
  REGISTER.forEach((a) => {
    const id = uid();
    const receipts = (a.receipts || []).map((r) => r.length === 4
      ? { id: uid(), date: pd(r[0]), amount: r[2], rate: r[2] ? r[3] / r[2] : 1, notes: r[1] }
      : { id: uid(), date: pd(r[0]), amount: r[2], rate: 1, notes: r[1] });
    const hasReceipts = receipts.length > 0;
    const firstDate = receipts[0]?.date || "";
    agreements.push({ id, ref: a.ref, title: a.title, party: a.title, date: firstDate, currency: a.cur, totalValue: a.total, status: a.status, paymentStatus: a.status === "Closed" ? "Paid" : hasReceipts ? "Ongoing" : "Pending", comment: a.note || "", receipts });
    Object.entries(a.alloc || {}).forEach(([party, amt]) => {
      if (!amt) return;
      const paid = a.status === "Closed" || hasReceipts;
      disbursements.push({ id: uid(), agreementId: id, party, description: "Allocation", date: firstDate, currency: "USD", amount: amt, paymentStatus: paid ? "Paid" : "Pending", comment: "", payments: paid ? [{ id: uid(), date: firstDate, amount: amt, rate: 1, notes: "Allocated from register" }] : [] });
    });
  });
  const accounts = ["RE Acquisitions", "Undeposited Funds", "Aegis Account", "Soba CBD (Q4 2025)", "Oak - AC", "CP Undeposited", "AEGIS - DA", "CP-AE-CBD", "CP (Emaar)", "DA"].map((n) => ({ id: uid(), name: n, currency: "USD", comment: "" }));
  return { currencies: DEFAULT_CURRENCIES, parties: DEFAULT_PARTIES, agreements, disbursements, transfers: [], accounts, notes: [] };
}

function App() {
  const SESSION_HOURS = 24;
  const MAX_USERS = 3;
  const [authChecked, setAuthChecked] = useState(false);
  const [users, setUsers] = useState([]);
  const [authed, setAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  useEffect(() => {
    (async () => {
      let raw = await stGet("fintrack-auth-v2");
      if (!raw) { raw = await stGet("fintrack-auth-v2", false); if (raw) await stSet("fintrack-auth-v2", raw); }
      if (raw) {
        try {
          const isNamedSuper = (id) => (id || "").toLowerCase() === SUPER_ADMIN_ID.toLowerCase();
          let arr = JSON.parse(raw).map((u) => ({ ...u, role: isNamedSuper(u.userId) || u.role === SUPER ? SUPER : "admin", registered: u.registered !== undefined ? u.registered : !!u.hash }));
          if (arr.some((u) => isNamedSuper(u.userId))) arr = arr.map((u) => ({ ...u, role: isNamedSuper(u.userId) ? SUPER : "admin" }));
          else if (arr.length && !arr.some((u) => u.role === SUPER)) arr[0] = { ...arr[0], role: SUPER };
          setUsers(arr);
        } catch (e) {}
      }
      try {
        const s = await window.storage.get("fintrack-session-v1");
        if (s && s.value) {
          const sess = JSON.parse(s.value);
          if (sess.expires && sess.expires > Date.now()) { setAuthed(true); setCurrentUser(sess.userId); }
        }
      } catch (e) {}
      setAuthChecked(true);
    })();
  }, []);
  const hash = async (text) => {
    const buf = new TextEncoder().encode(text);
    const out = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(out)).map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  const startSession = async (userId) => {
    const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
    try { await window.storage.set("fintrack-session-v1", JSON.stringify({ expires, userId })); } catch (e) {}
    setAuthed(true);
    setCurrentUser(userId);
  };
  const persistUsers = async (arr) => {
    setUsers(arr);
    await stSet("fintrack-auth-v2", JSON.stringify(arr));
  };
  const addUser = async (userId, password, question, answer) => {
    userId = (userId || "").trim();
    if (!userId) return { ok: false, error: "Choose a user ID." };
    if (users.length >= MAX_USERS) return { ok: false, error: `Maximum ${MAX_USERS} users reached.` };
    if (users.some((u) => u.userId.toLowerCase() === userId.toLowerCase())) return { ok: false, error: "That user ID is already taken." };
    const h = await hash(password);
    const ah = await hash((answer || "").toLowerCase().trim());
    const next = [...users, { userId, hash: h, question, answerHash: ah, role: users.length === 0 ? SUPER : "admin", registered: true }];
    await persistUsers(next);
    await startSession(userId);
    return { ok: true };
  };
  const isSuperAdmin = users.find((u) => u.userId === currentUser)?.role === SUPER;
  // Self-registration is disabled: the Super Admin creates each user ID together
  // with its password (and, optionally, a security question for self-service
  // password reset). Accounts are therefore created already-registered.
  const inviteUser = async (userId, name, password, question, answer) => {
    userId = (userId || "").trim();
    if (!isSuperAdmin) return { ok: false, error: "Only the Super Admin can create user IDs." };
    if (!userId) return { ok: false, error: "Choose a user ID." };
    if ((password || "").length < 6) return { ok: false, error: "Set a password of at least 6 characters for the new user." };
    if (users.length >= MAX_USERS) return { ok: false, error: `Maximum ${MAX_USERS} users reached.` };
    if (users.some((u) => u.userId.toLowerCase() === userId.toLowerCase())) return { ok: false, error: "That user ID already exists." };
    const h = await hash(password);
    const ah = answer ? await hash((answer || "").toLowerCase().trim()) : "";
    await persistUsers([...users, { userId, name: (name || "").trim(), role: "admin", registered: true, hash: h, question: (question || "").trim(), answerHash: ah }]);
    return { ok: true };
  };
  // Super Admin sets or replaces a user's password directly (replaces the old
  // "reset registration" flow, which relied on the user re-registering).
  const setUserPassword = async (userId, password) => {
    if (!isSuperAdmin) return { ok: false, error: "Only the Super Admin can set passwords." };
    if (userId === currentUser) return { ok: false, error: "Use Forgot password on the sign-in screen to change your own password." };
    const idx = users.findIndex((x) => x.userId === userId);
    if (idx < 0) return { ok: false, error: "No such user." };
    if ((password || "").length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    const h = await hash(password);
    const next = [...users];
    next[idx] = { ...next[idx], hash: h, registered: true };
    await persistUsers(next);
    return { ok: true };
  };
  const saveAppUrl = async (u) => {
    if (!isSuperAdmin) { setNotice("Only the Super Admin can set the app address."); return; }
    u = (u || "").trim();
    setAppUrl(u);
    await stSet("fintrack-appurl-v1", u);
    setNotice(u ? "Registration link address saved." : "Registration link address cleared — using the detected address.");
  };
  const registerUser = async (userId, password, question, answer) => {
    const idx = users.findIndex((x) => x.userId.toLowerCase() === (userId || "").trim().toLowerCase());
    if (idx < 0) return { ok: false, error: "No such user ID. Only user IDs created by the Super Admin can register." };
    if (users[idx].registered) return { ok: false, error: "That user ID is already registered — sign in instead." };
    const h = await hash(password);
    const ah = await hash((answer || "").toLowerCase().trim());
    const next = [...users];
    next[idx] = { ...next[idx], hash: h, question, answerHash: ah, registered: true };
    await persistUsers(next);
    await startSession(next[idx].userId);
    return { ok: true };
  };
  const renameUser = async (userId, name) => {
    if (!isSuperAdmin && userId !== currentUser) return false;
    await persistUsers(users.map((u) => (u.userId === userId ? { ...u, name: (name || "").trim() } : u)));
    return true;
  };
  const resetRegistration = async (userId) => {
    if (!isSuperAdmin || userId === currentUser) return false;
    if (users.find((u) => u.userId === userId)?.role === SUPER) return false;
    await persistUsers(users.map((u) => (u.userId === userId ? { userId: u.userId, name: u.name || "", role: u.role, registered: false } : u)));
    return true;
  };
  const tryLogin = async (userId, password) => {
    const u = users.find((x) => x.userId.toLowerCase() === userId.trim().toLowerCase());
    if (!u) return { ok: false, error: "No account with that user ID. Ask the Super Admin to create one." };
    if (!u.registered || !u.hash) return { ok: false, error: "This user ID has not been registered yet — use Register to set a password." };
    const h = await hash(password);
    if (h !== u.hash) return { ok: false, error: "Incorrect password." };
    await startSession(u.userId);
    return { ok: true };
  };
  const resetPassword = async (userId, answer, newPassword) => {
    const idx = users.findIndex((x) => x.userId.toLowerCase() === userId.trim().toLowerCase());
    if (idx < 0) return { ok: false, error: "No account with that user ID." };
    const u = users[idx];
    if (!u.registered || !u.answerHash) return { ok: false, error: "This user ID has not been registered yet — use Register instead." };
    const ah = await hash((answer || "").toLowerCase().trim());
    if (ah !== u.answerHash) return { ok: false, error: "That answer is incorrect." };
    const h = await hash(newPassword);
    const next = [...users];
    next[idx] = { ...u, hash: h };
    await persistUsers(next);
    await startSession(u.userId);
    return { ok: true };
  };
  const logout = async () => {
    try { await window.storage.delete("fintrack-session-v1"); } catch (e) {}
    setAuthed(false);
    setCurrentUser(null);
  };
  const removeUser = async (userId) => {
    if (!isSuperAdmin || userId === currentUser) return false;
    if (users.find((u) => u.userId === userId)?.role === SUPER) return false;
    const next = users.filter((u) => u.userId !== userId);
    await persistUsers(next);
    return true;
  };

  const empty = { currencies: DEFAULT_CURRENCIES, parties: DEFAULT_PARTIES, agreements: [], disbursements: [], transfers: [], accounts: [], notes: [] };
  const [data, setData] = useState(empty);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null);
  const [filters, setFilters] = useState({ party: "all", year: "all", currency: "all", agreement: "all", agStatus: "all", payStatus: "all" });
  const [expanded, setExpanded] = useState(null);
  const [agOpen, setAgOpen] = useState({});
  const [partyPick, setPartyPick] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [partyView, setPartyView] = useState("receipts");
  const [showArchived, setShowArchived] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const ask = (message, onConfirm) => setConfirmState({ message, onConfirm });
  const [collapsedAg, setCollapsedAg] = useState({});
  const [commentRow, setCommentRow] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [rcptCommentEdit, setRcptCommentEdit] = useState(null);
  const [reportModal, setReportModal] = useState(false);
  const [noteModal, setNoteModal] = useState(null);   // {agreementId?} while the note pop-up is open
  const [previewHtml, setPreviewHtml] = useState(null);
  const [appUrl, setAppUrl] = useState("");
  const [release, setRelease] = useState(null);
  const [notice, setNotice] = useState("");
  // Back-to-top button: track how far down we are. The capture-phase listener catches
  // scrolling on the window or on whichever element is actually doing the scrolling.
  const [scroller, setScroller] = useState(null);
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = (e) => {
      const t = e && e.target && e.target.nodeType === 1 && e.target !== document.body && e.target !== document.documentElement ? e.target : null;
      if (t) setScroller(t);
      const y = t ? t.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);
      setShowTop(y > 240);
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, []);
  const scrollToTop = () => {
    const targets = [scroller, document.scrollingElement, document.documentElement, document.body].filter(Boolean);
    targets.forEach((el) => { try { el.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { el.scrollTop = 0; } });
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { window.scrollTo(0, 0); }
    setShowTop(false);
  };
  const [now, setNow] = useState(new Date());
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(""), 6000); return () => clearTimeout(t); }, [notice]);
  useEffect(() => { (async () => { const r = await stGet("fintrack-release-v1"); if (r) { try { setRelease(JSON.parse(r)); } catch (e) {} } const u = await stGet("fintrack-appurl-v1"); if (u) setAppUrl(u); })(); }, []);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (document.getElementById("ft-font-style")) return;
    const s = document.createElement("style");
    s.id = "ft-font-style";
    s.textContent = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap');
      body { font-family: Arial, Helvetica, "Segoe UI", Roboto, sans-serif; }
      .font-serif { font-family: "Playfair Display", Georgia, "Times New Roman", serif !important; font-weight: 700 !important; letter-spacing: 0.005em; }`;
    document.head.appendChild(s);
  }, []);
  // Artifacts run inside a sandboxed frame, where window.open and window.print are
  // silently blocked — the click appears to do nothing. Detect that and hand the
  // document over as a download instead, so the buttons always produce something.
  const inFrame = () => { try { return window.self !== window.top; } catch (e) { return true; } };
  const saveFile = (content, filename, type = "text/html") => {
    try {
      const url = URL.createObjectURL(new Blob([content], { type }));
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.style.display = "none";
      document.body.appendChild(a); a.click();
      setTimeout(() => { try { document.body.removeChild(a); } catch (e) {} URL.revokeObjectURL(url); }, 2000);
      return true;
    } catch (e) { return false; }
  };
  const openOrSave = (html, filename) => {
    let w = null, url = null;
    try { url = URL.createObjectURL(new Blob([html], { type: "text/html" })); w = window.open(url, "_blank"); } catch (e) { w = null; }
    if (w) { setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 20000); return; }
    if (url) { try { URL.revokeObjectURL(url); } catch (e) {} }
    if (saveFile(html, filename)) setNotice(`New tabs are blocked here, so "${filename}" was downloaded instead — open it to view or print.`);
    else setNotice("Could not open or download the file. Open the app in its own browser window and try again.");
  };
  const printView = () => {
    if (!inFrame()) { window.print(); return; }
    const html = generatePrettyReport(Object.keys(partyBalances), true)
      .replace("<body>", '<body onload="setTimeout(function(){try{window.print()}catch(e){}},600)">');
    openOrSave(html, `XYZ_Financial_Report_${new Date().toISOString().slice(0, 10)}.html`);
  };

  useEffect(() => {
    (async () => {
      let raw = await stGet("fintrack-data-v3");
      if (!raw) { raw = await stGet("fintrack-data-v3", false); if (raw) await stSet("fintrack-data-v3", raw); }
      if (raw) {
        try {
          const parsed = { ...empty, ...JSON.parse(raw) };
          const fixed = normalizeInvoices(parsed);
          setData(fixed);
          if (fixed !== parsed) await stSet("fintrack-data-v3", JSON.stringify(fixed));
        } catch (e) {}
      }
      else { const seed = normalizeInvoices(buildSeed()); setData(seed); await stSet("fintrack-data-v3", JSON.stringify(seed)); }
      setLoaded(true);
    })();
  }, []);

  const entryLocked = !!(release && release.locked);
  const legacyHostOnly = entryLocked && !!release.host && !release.host.includes("/");
  const onPublishedHost = !entryLocked || !release.host || release.host === pagePrint() || (legacyHostOnly && release.host === hostOnly());
  const readOnly = entryLocked && !onPublishedHost;
  const save = async (next) => {
    if (readOnly) { setNotice("Read-only \u2014 data entry happens on the published app only."); return; }
    setData(next);
    await stSet("fintrack-data-v3", JSON.stringify(next));
  };
  const publishRelease = async (version, includeData) => {
    if (!isSuperAdmin) { setNotice("Only the Super Admin can publish a release."); return; }
    if (includeData) await stSet("fintrack-data-v3", JSON.stringify(data));
    const rel = { version: (version || "").trim() || "v1.0", publishedAt: Date.now(), publishedBy: currentUser, host: pagePrint(), href: refPrint() || hrefPrint(), locked: true, dataIncluded: !!includeData };
    await stSet("fintrack-release-v1", JSON.stringify(rel));
    setRelease(rel);
    setNotice(`Released ${rel.version}. Data entry is now limited to this page.`);
  };
  const setEntryLock = async (locked) => {
    if (!isSuperAdmin) { setNotice("Only the Super Admin can change this."); return; }
    const rel = { ...(release || { version: "v1.0", publishedAt: Date.now(), publishedBy: currentUser }), host: locked ? pagePrint() : (release && release.host) || "", href: locked ? (refPrint() || hrefPrint()) : (release && release.href) || "", locked };
    await stSet("fintrack-release-v1", JSON.stringify(rel));
    setRelease(rel);
    setNotice(locked ? "Data entry locked to this page." : "Data entry unlocked \u2014 any copy can now write.");
  };

  // One definition of "disbursed", used by the tiles, the party totals and the table:
  // the payments recorded against a disbursement, or — when a disbursement is marked
  // Paid with no payment rows behind it — the full amount.
  const disbPaid = (dd) => {
    const rows = dd.payments || [];
    if (rows.length) return rows.reduce((s, p) => s + Number(p.amount || 0), 0);
    return (dd.paymentStatus || "") === "Paid" ? Number(dd.amount || 0) : 0;
  };
  const disbPaidUSD = (dd) => {
    const rows = dd.payments || [];
    if (rows.length) return rows.reduce((s, p) => s + Number(p.amount || 0) * Number(p.rate || 0), 0);
    return (dd.paymentStatus || "") === "Paid" ? Number(dd.amount || 0) * Number(defaultRate(dd.currency, data.currencies) || 1) : 0;
  };

  const agComputed = data.agreements.map((a) => {
    const received = (a.receipts || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const receivedUSD = (a.receipts || []).reduce((s, r) => s + Number(r.amount || 0) * Number(r.rate || 0), 0);
    const myDisb = data.disbursements.filter((dd) => dd.agreementId === a.id);
    const disbursedUSD = myDisb.reduce((s, dd) => s + disbPaidUSD(dd), 0);
    const allocatedUSD = myDisb.reduce((s, dd) => s + Number(dd.amount || 0), 0);
    const invList = a.invoices || [];
    const hasInv = invList.length > 0;
    const invoiced = hasInv ? invList.reduce((s, i) => s + Number(i.amount || 0), 0) : received;
    const invoicedUSD = hasInv ? invList.reduce((s, i) => s + Number(i.amount || 0) * Number(i.rate || 1), 0) : receivedUSD;
    return { ...a, received, receivedUSD, invoiced, invoicedUSD, hasInvoices: hasInv, outstandingUSD: invoicedUSD - receivedUSD, disbursedUSD, allocatedUSD, undisbursedUSD: receivedUSD - disbursedUSD };
  });

  const hiddenIds = new Set(data.agreements.filter((a) => a.hidden).map((a) => a.id));
  const archivedIds = new Set(data.agreements.filter((a) => a.archived).map((a) => a.id));

  const disbComputed = data.disbursements.filter((dd) => !hiddenIds.has(dd.agreementId)).map((dd) => {
    const ag = data.agreements.find((a) => a.id === dd.agreementId);
    const paid = disbPaid(dd);
    const paidUSD = disbPaidUSD(dd);
    const amount = Number(dd.amount || 0);
    return { ...dd, agreementTitle: ag ? (ag.ref ? ag.ref + " · " : "") + ag.title : "—", paid, paidUSD, outstanding: amount - paid, paymentStatus: dd.paymentStatus || "Ongoing" };
  });

  const trComputed = data.transfers.map((t) => {
    const acc = data.accounts.find((x) => x.id === t.accountId);
    return { ...t, accountName: acc ? acc.name : "—", accountCurrency: acc ? acc.currency : "", usd: Number(t.amount || 0) * Number(t.rate || 0), payType: t.payType || "Full" };
  });

  const partyBalances = {};
  disbComputed.forEach((dd) => { if (!dd.party) return; partyBalances[dd.party] = partyBalances[dd.party] || { inUSD: 0, outUSD: 0 }; partyBalances[dd.party].inUSD += dd.paidUSD; });
  trComputed.forEach((t) => { if (!t.fromParty) return; partyBalances[t.fromParty] = partyBalances[t.fromParty] || { inUSD: 0, outUSD: 0 }; partyBalances[t.fromParty].outUSD += t.usd; });

  const accountTotals = [...data.accounts].sort((a, b) => orderName(a.name, b.name)).map((acc) => {
    const ts = trComputed.filter((t) => t.accountId === acc.id);
    return { ...acc, count: ts.length, original: ts.filter((t) => t.currency === acc.currency).reduce((s, t) => s + Number(t.amount), 0), usd: ts.reduce((s, t) => s + t.usd, 0) };
  });

  const orderParty = orderPartyName;
  const disbursementPartyNames = [...new Set([
    ...data.parties.filter((p) => p.type === "disbursement" || p.type === "both").map((p) => p.name),
    ...disbComputed.map((d) => d.party),
    ...trComputed.map((t) => t.fromParty),
  ])].filter(Boolean).sort(orderParty);
  const allPartyNames = disbursementPartyNames;
  const years = [...new Set([
    ...agComputed.flatMap((a) => (a.receipts || []).map((r) => yearOf(r.date))),
    ...disbComputed.flatMap((d) => [yearOf(d.date), ...(d.payments || []).map((p) => yearOf(p.date))]),
    ...trComputed.map((t) => yearOf(t.date)),
  ])].filter(Boolean).sort().reverse();

  const F = filters;
  const agMatches = (a) => (F.party === "all" || a.party === F.party) && (F.currency === "all" || a.currency === F.currency) && (F.year === "all" || yearOf(a.date) === F.year || (a.receipts || []).some((r) => yearOf(r.date) === F.year)) && (F.agreement === "all" || a.id === F.agreement) && (F.agStatus === "all" || a.status === F.agStatus) && (F.payStatus === "all" || (a.paymentStatus || "Ongoing") === F.payStatus);
  const fAg = agComputed.filter((a) => agMatches(a) && !a.hidden && !a.archived);
  const agPageList = agComputed.filter((a) => agMatches(a) && (showHidden || !a.hidden) && (showArchived || !a.archived));
  const fDisb = disbComputed.filter((d) => (F.party === "all" || d.party === F.party) && (F.currency === "all" || d.currency === F.currency) && (F.year === "all" || yearOf(d.date) === F.year || (d.payments || []).some((p) => yearOf(p.date) === F.year)) && (F.agreement === "all" || d.agreementId === F.agreement) && (F.payStatus === "all" || d.paymentStatus === F.payStatus) && !archivedIds.has(d.agreementId));
  const fTr = trComputed.filter((t) => (F.party === "all" || t.fromParty === F.party) && (F.currency === "all" || t.currency === F.currency) && (F.year === "all" || yearOf(t.date) === F.year));

  const totReceivedUSD = fAg.reduce((s, a) => s + a.receivedUSD, 0);
  const totDisbursedUSD = fDisb.reduce((s, d) => s + d.paidUSD, 0);
  const totTransferredUSD = fTr.reduce((s, t) => s + t.usd, 0);
  const agNum = {}; data.agreements.forEach((a, i) => { agNum[a.id] = i + 1; });
  const nextRef = String(data.agreements.reduce((m, a) => Math.max(m, parseInt(a.ref) || 0), 0) + 1);
  const lockedAg = (agId) => isLocked(data.agreements.find((x) => x.id === agId));
  const blockLocked = (agId) => { if (lockedAg(agId)) { setNotice(LOCK_MSG); return true; } return false; };
  const reopenAgreement = (agId) => {
    const ag = data.agreements.find((x) => x.id === agId);
    if (!ag) return;
    upsert("agreements", { ...ag, status: "Ongoing", archived: false });
    setNotice(`${ag.title} reopened — changes can now be recorded.`);
  };
  const updateReceipt = (agId, recId, patch) => {
    if (blockLocked(agId)) return;
    const ag = data.agreements.find((x) => x.id === agId);
    if (ag) upsert("agreements", { ...ag, receipts: (ag.receipts || []).map((r) => (r.id === recId ? { ...r, ...patch } : r)) });
  };
  const saveInvoice = (agId, inv, addToValue) => {
    if (blockLocked(agId)) return;
    const ag = data.agreements.find((x) => x.id === agId);
    if (!ag) return;
    const list = ag.invoices || [];
    const invoices = list.some((q) => q.id === inv.id) ? list.map((q) => (q.id === inv.id ? inv : q)) : [...list, inv];
    const next = { ...ag, invoices };
    if (addToValue) next.totalValue = Number(ag.totalValue || 0) + Number(inv.amount || 0);
    upsert("agreements", next);
  };
  const deleteInvoice = (agId, invId) => {
    if (blockLocked(agId)) return;
    const ag = data.agreements.find((x) => x.id === agId);
    if (!ag) return;
    // Release any payment that pointed at this invoice, so it is left plainly unlinked
    // rather than holding the id of a record that no longer exists.
    upsert("agreements", {
      ...ag,
      invoices: (ag.invoices || []).filter((q) => q.id !== invId),
      receipts: (ag.receipts || []).map((r) => (r.invoiceId === invId ? { ...r, invoiceId: "" } : r)),
    });
  };
  const updateDisbPayment = (disbId, payId, patch) => {
    const dd = data.disbursements.find((x) => x.id === disbId);
    if (dd) upsert("disbursements", { ...dd, payments: (dd.payments || []).map((p) => (p.id === payId ? { ...p, ...patch } : p)) });
  };
  const getComments = (a) => {
    if (Array.isArray(a.comments)) return a.comments;
    if (a.comment) return [{ id: "legacy", text: a.comment, ts: a.date ? new Date(a.date).getTime() : Date.now() }];
    return [];
  };
  const saveComments = (agId, list) => {
    const ag = data.agreements.find((x) => x.id === agId); if (!ag) return;
    upsert("agreements", { ...ag, comments: list, comment: list.map((c) => c.text).join(" · ") });
  };
  const addComment = (agId, text) => {
    text = (text || "").trim(); if (!text) return;
    const ag = data.agreements.find((x) => x.id === agId); if (!ag) return;
    saveComments(agId, [...getComments(ag), { id: uid(), text, ts: Date.now() }]);
  };
  const removeComment = (agId, cid) => {
    const ag = data.agreements.find((x) => x.id === agId); if (!ag) return;
    saveComments(agId, getComments(ag).filter((c) => c.id !== cid));
  };

  // What the Disbursements tab says this party is owed on this agreement, how much
  // of it has already been spread across receipts, and whether it has been paid out.
  const expectedFor = (agId, party) => {
    const list = data.disbursements.filter((x) => x.agreementId === agId && x.party === party);
    const expected = list.reduce((s, x) => s + Number(x.amount || 0), 0);
    const paid = list.reduce((s, x) => s + disbPaid(x), 0);
    return { expected, paid, stillToPay: expected - paid, isPaid: list.some((x) => x.paymentStatus === "Paid") || paid > 0.005 };
  };

  // Each disbursement is shown against the payment it was funded by: the receipt it is
  // explicitly linked to, or failing that the latest receipt dated on or before it.
  const disbCellsFor = (a) => {
    const rcpts = [...(a.receipts || [])].sort((x, y) => String(x.date || "").localeCompare(String(y.date || "")));
    const map = {};
    if (!rcpts.length) return map;
    const ids = new Set(rcpts.map((r) => r.id));
    data.disbursements.filter((dd) => dd.agreementId === a.id).forEach((dd) => {
      let target = rcpts[0];
      if (dd.receiptId && ids.has(dd.receiptId)) target = rcpts.find((r) => r.id === dd.receiptId);
      else rcpts.forEach((r) => { if (String(r.date || "") <= String(dd.date || "")) target = r; });
      const paid = disbPaid(dd);
      const byParty = map[target.id] || (map[target.id] = {});
      const prev = byParty[dd.party] || { amount: 0, paid: 0, statuses: [], ids: [] };
      byParty[dd.party] = { amount: prev.amount + Number(dd.amount || 0), paid: prev.paid + paid, statuses: [...prev.statuses, dd.paymentStatus || "Ongoing"], ids: [...prev.ids, dd.id] };
    });
    return map;
  };
  // Pending or on hold reads grey, part-paid light green, fully paid green, overdue green.
  const disbCellStyle = (cell) => {
    if (!cell) return "text-slate-300";
    if (cell.statuses.includes("Overdue")) return "text-emerald-700 font-medium";
    if (cell.statuses.length && cell.statuses.every((s) => s === "Paid")) return "text-emerald-700 font-medium";
    if (cell.paid > 0.005) return "text-emerald-500";
    return "text-slate-300";
  };

  const partyOrder = [...new Set([...data.parties.filter((p) => p.type !== "receivable").map((p) => p.name), ...allPartyNames])].sort(orderParty);
  const allocationSummary = partyOrder.map((name) => {
    const list = fDisb.filter((d) => d.party === name);
    const invoiced = list.reduce((s, d) => s + Number(d.amount || 0), 0);
    const paid = list.reduce((s, d) => s + d.paidUSD, 0);
    return { name, invoiced, paid, pending: invoiced - paid };
  }).filter((r) => r.invoiced || r.paid);
  const allocTot = allocationSummary.reduce((a, r) => ({ invoiced: a.invoiced + r.invoiced, paid: a.paid + r.paid, pending: a.pending + r.pending }), { invoiced: 0, paid: 0, pending: 0 });
  const totalInvoicedUSD = fAg.filter((a) => a.currency === "USD").reduce((s, a) => s + Number(a.totalValue || 0), 0);
  const totalInvoicedEUR = fAg.filter((a) => a.currency === "EUR").reduce((s, a) => s + Number(a.totalValue || 0), 0);
  const totalInvoicedAED = fAg.filter((a) => a.currency === "AED").reduce((s, a) => s + Number(a.totalValue || 0), 0);

  const buildStatement = (party) => {
    const rows = [
      ...disbComputed.filter((d) => d.party === party).flatMap((d) => (d.payments || []).map((p) => ({
        date: p.date, kind: "in", desc: `Received — ${d.agreementTitle}${d.description ? ` · ${d.description}` : ""}`, currency: d.currency, amount: Number(p.amount), usd: Number(p.amount) * Number(p.rate), comment: p.notes || "",
      }))),
      ...trComputed.filter((t) => t.fromParty === party).map((t) => ({
        date: t.date, kind: "out", desc: `Transfer out — ${t.accountName} (${t.accountCurrency}) · ${t.payType}`, currency: t.currency, amount: Number(t.amount), usd: t.usd, comment: t.notes || "",
      })),
    ].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    let run = 0;
    const withBal = rows.map((r) => { run += r.kind === "in" ? r.usd : -r.usd; return { ...r, balance: run }; });
    const b = partyBalances[party] || { inUSD: 0, outUSD: 0 };
    const accts = [...data.accounts].sort((a, b) => orderName(a.name, b.name)).map((acc) => {
      const ts = trComputed.filter((t) => t.fromParty === party && t.accountId === acc.id);
      if (!ts.length) return null;
      return { name: acc.name, currency: acc.currency, count: ts.length, usd: ts.reduce((s, t) => s + t.usd, 0), last: ts.map((t) => t.date).sort().pop() };
    }).filter(Boolean);
    return { rows: withBal, inUSD: b.inUSD, outUSD: b.outUSD, holding: b.inUSD - b.outUSD, accts };
  };

  const upsert = (key, item) => {
    const list = data[key];
    const exists = list.some((x) => x.id === item.id);
    save({ ...data, [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] });
  };
  const remove = (key, id) => save({ ...data, [key]: data[key].filter((x) => x.id !== id) });
  const saveAgreementWithAllocs = (a, allocs) => {
    const next = { ...data };
    const exists = next.agreements.some((x) => x.id === a.id);
    next.agreements = exists ? next.agreements.map((x) => (x.id === a.id ? a : x)) : [...next.agreements, a];
    let disb = [...next.disbursements];
    if (isLocked(a)) { save(next); setNotice("Agreement saved. Party allocations were not changed because it is closed or archived."); return; }
    Object.entries(allocs || {}).forEach(([party, amtRaw]) => {
      const amt = Number(amtRaw) || 0;
      const idx = disb.findIndex((d) => d.agreementId === a.id && d.party === party);
      if (amt > 0) {
        if (idx >= 0) disb[idx] = { ...disb[idx], amount: amt };
        else disb.push({ id: uid(), agreementId: a.id, party, description: "Expected allocation", date: a.date, currency: "USD", amount: amt, paymentStatus: "Pending", feePercent: 0, comment: "", payments: [] });
      } else if (idx >= 0 && (!disb[idx].payments || disb[idx].payments.length === 0)) {
        disb.splice(idx, 1);
      }
    });
    next.disbursements = disb;
    save(next);
  };
  // General notes: free-text notes, optionally assigned to a user and/or tied to
  // an agreement, stamped with the date they were entered. Stored in data.notes.
  const saveNote = (note) => {
    const list = data.notes || [];
    const exists = list.some((n) => n.id === note.id);
    save({ ...data, notes: exists ? list.map((n) => (n.id === note.id ? note : n)) : [...list, note] });
  };
  const removeNote = (id) => save({ ...data, notes: (data.notes || []).filter((n) => n.id !== id) });
  const loadRegister = () => {
    const doLoad = () => { save(buildSeed()); setTab("agreements"); };
    if (data.agreements.length) ask("This will REPLACE all current data with the register seed. Continue?", doLoad);
    else doLoad();
  };
  const addParty = (name, type) => {
    name = (name || "").trim();
    if (!name) return null;
    const ex = data.parties.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (ex) return ex.name;
    save({ ...data, parties: [...data.parties, { id: uid(), name, type: type || "disbursement" }] });
    return name;
  };
  const addAccount = (name, currency, comment, party) => {
    name = (name || "").trim();
    if (!name) return null;
    const ex = data.accounts.find((a) => a.name.toLowerCase() === name.toLowerCase());
    if (ex) return ex.id;
    const acc = { id: uid(), name, currency: currency || "USD", comment: comment || "", party: party || "" };
    save({ ...data, accounts: [...data.accounts, acc] });
    return acc.id;
  };
  const addCurrency = (code, rate) => {
    code = (code || "").toUpperCase().trim();
    if (!code || data.currencies.some((c) => c.code === code)) return;
    save({ ...data, currencies: [...data.currencies, { code, rate: rate ? Number(rate) : null, fixed: !!rate }] });
  };

  const generatePrettyReport = (partyList, preview = false, agIds = null) => {
    const d = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const usd = (n) => "$ " + money(n);
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const fmtD = (dd) => (dd ? new Date(dd).toLocaleDateString("en-GB") : "");
    const NAVY = "#0f172a", SLATE = "#334155", LINE = "#e2e8f0", GREEN = "#047857", RED = "#be123c", BLUE = "#1d4ed8", BG = "#f8fafc";
    // Two ways to scope the report:
    //  • by agreement (agIds): only those agreements, the parties allocated on
    //    them, their accounts, and a per-agreement breakdown;
    //  • by party (partyList): only their agreements, accounts and statements.
    // With neither, the full picture is produced.
    const agScope = agIds && agIds.length ? new Set(agIds) : null;
    const sel = new Set(partyList || []);
    let repAg, statementParties, partySet;
    if (agScope) {
      repAg = fAg.filter((a) => agScope.has(a.id));
      statementParties = [...new Set(disbComputed.filter((dd) => agScope.has(dd.agreementId)).map((dd) => dd.party))].filter(Boolean);
      partySet = new Set(statementParties);
    } else if (sel.size > 0) {
      const relAgIds = new Set(disbComputed.filter((dd) => sel.has(dd.party) && dd.agreementId).map((dd) => dd.agreementId));
      repAg = fAg.filter((a) => relAgIds.has(a.id));
      statementParties = partyList;
      partySet = sel;
    } else {
      repAg = fAg;
      statementParties = partyList || [];
      partySet = null;
    }
    const scoped = !!agScope || sel.size > 0;
    const repAccounts = scoped
      ? data.accounts.map((acc) => { const ts = trComputed.filter((t) => t.accountId === acc.id && (!partySet || partySet.has(t.fromParty))); return { ...acc, count: ts.length, usd: ts.reduce((s, t) => s + t.usd, 0) }; }).filter((a) => a.count > 0).sort((a, b) => orderName(a.name, b.name))
      : accountTotals;
    const kReceived = scoped ? repAg.reduce((s, a) => s + a.receivedUSD, 0) : totReceivedUSD;
    const kDisbursed = scoped ? repAg.reduce((s, a) => s + a.disbursedUSD, 0) : totDisbursedUSD;
    const kOnward = scoped ? repAccounts.reduce((s, a) => s + a.usd, 0) : totTransferredUSD;
    const scopeLabel = agScope ? `Agreements: ${repAg.map((a) => esc((a.ref ? a.ref + " · " : "") + a.title)).join(", ")}` : (sel.size > 0 ? `Parties: ${esc(partyList.join(", "))}` : "All parties");
    // Cover KPI tiles, coloured like the dashboard. Agreement reports use the
    // agreement rubrics (Invoiced / Received / Disbursed / Pending); party/all
    // reports keep the funds-flow rubrics.
    const CK = { emerald: "#34d399", rose: "#fb7185", slate: "#cbd5e1", blue: "#60a5fa" };
    const invoicedUSDsum = repAg.reduce((s, a) => s + Number(a.invoicedUSD || 0), 0);
    const contractUSDsum = repAg.reduce((s, a) => s + Number(a.totalValue || 0) * (FX[a.currency] || 1), 0);
    // When every agreement in scope shares one non-USD currency, show the cover
    // figures in that currency with the USD conversion beneath for reference.
    const curs = [...new Set(repAg.map((a) => a.currency))];
    const oneCur = curs.length === 1 ? curs[0] : null;
    const nativeMode = !!agScope && !!oneCur && oneCur !== "USD";
    const rate = FX[oneCur] || 1;
    const invoicedNative = repAg.reduce((s, a) => s + Number(a.invoiced || 0), 0);
    const receivedNative = repAg.reduce((s, a) => s + Number(a.received || 0), 0);
    const contractNative = repAg.reduce((s, a) => s + Number(a.totalValue || 0), 0);
    const nat = (v) => `${csym(oneCur)} ${money(v)}`;
    const kpis = agScope
      ? (nativeMode
        ? [
            { l: "Invoiced", primary: nat(invoicedNative), sub: usd(invoicedUSDsum), c: CK.slate },
            { l: "Received", primary: nat(receivedNative), sub: usd(kReceived), c: CK.emerald },
            { l: "Pending", primary: nat(contractNative - receivedNative), sub: usd(contractUSDsum - kReceived), c: CK.rose },
            { l: "Disbursed", primary: nat(kDisbursed / rate), sub: usd(kDisbursed), c: CK.emerald, sep: true },
          ]
        : [
            { l: "Invoiced", primary: usd(invoicedUSDsum), c: CK.slate },
            { l: "Received", primary: usd(kReceived), c: CK.emerald },
            { l: "Pending", primary: usd(contractUSDsum - kReceived), c: CK.rose },
            { l: "Disbursed", primary: usd(kDisbursed), c: CK.emerald, sep: true },
          ])
      : [
          { l: "Received", primary: usd(kReceived), c: CK.emerald },
          { l: "Disbursed", primary: usd(kDisbursed), c: CK.rose },
          { l: "Undisbursed", primary: usd(kReceived - kDisbursed), c: CK.slate },
          { l: "Onward to Accounts", primary: usd(kOnward), c: CK.blue },
        ];
    const kpiHtml = kpis.map((k) => `<div class="kpi${k.sep ? " sep" : ""}" style="border-top:3px solid ${k.c}"><span>${k.l}</span><b style="color:${k.c}">${k.primary}</b>${k.sub ? `<small>≈ ${k.sub}</small>` : ""}</div>`).join("");
    // Per-agreement detail (agreement-scoped reports only)
    const agDetail = agScope ? repAg.map((a) => {
      const dl = disbComputed.filter((dd) => dd.agreementId === a.id);
      const alT = dl.reduce((s, dd) => ({ al: s.al + Number(dd.amount || 0), pd: s.pd + dd.paidUSD }), { al: 0, pd: 0 });
      const allocBody = dl.length ? dl.map((dd) => { const al = Number(dd.amount || 0); return `<tr><td>${esc(dd.party)}</td><td class="r">${usd(al)}</td><td class="r">${usd(dd.paidUSD)}</td><td class="r b">${usd(al - dd.paidUSD)}</td></tr>`; }).join("") : `<tr><td colspan="4" class="empty">No party allocations.</td></tr>`;
      const allocRows = allocBody + (dl.length ? `<tr class="tot"><td>Total</td><td class="r">${usd(alT.al)}</td><td class="r">${usd(alT.pd)}</td><td class="r">${usd(alT.al - alT.pd)}</td></tr>` : "");
      const recList = a.receipts || [];
      const recNative = recList.reduce((s, r) => s + Number(r.amount || 0), 0);
      const recUSD = recList.reduce((s, r) => s + Number(r.amount || 0) * Number(r.rate || 0), 0);
      const recBody = recList.length ? recList.map((r) => `<tr><td>${fmtD(r.date)}</td><td>${esc(r.notes)}</td><td class="r">${a.currency} ${money(r.amount)}</td><td class="r">${usd(Number(r.amount) * Number(r.rate || 0))}</td></tr>`).join("") : `<tr><td colspan="4" class="empty">No payments received.</td></tr>`;
      const recRows = recBody + (recList.length ? `<tr class="tot"><td>Total</td><td></td><td class="r">${a.currency} ${money(recNative)}</td><td class="r">${usd(recUSD)}</td></tr>` : "");
      const ff = `<table><thead><tr><th>Client</th><th>Status</th><th class="r">Received</th><th class="r">Disbursed</th><th class="r">Undisbursed</th></tr></thead><tbody><tr><td>${esc(a.party)}</td><td><span class="pill ${a.status.toLowerCase()}">${esc(a.status)}</span></td><td class="r" style="color:${GREEN}">${usd(a.receivedUSD)}</td><td class="r" style="color:${RED}">${usd(a.disbursedUSD)}</td><td class="r b">${usd(a.undisbursedUSD)}</td></tr></tbody></table>`;
      const curNote = a.currency !== "USD" ? `<p class="muted" style="margin:-4px 0 8px">Agreement currency is <b>${a.currency}</b>, different from the base currency (USD). Payments are shown in ${a.currency} and converted to USD at the recorded rate.</p>` : "";
      return `<section class="party"><h2>Funds Flow — ${esc((a.ref ? a.ref + " · " : "") + a.title)} <span style="font-size:12px;color:#64748b;font-weight:400">(${a.currency} ${money(a.totalValue || 0)})</span></h2>${ff}<h3>Payments Received</h3>${curNote}<table><thead><tr><th>Date</th><th>Reference</th><th class="r">Amount (${a.currency})</th><th class="r">USD</th></tr></thead><tbody>${recRows}</tbody></table><h3>Allocations to Parties</h3><table><thead><tr><th>Party</th><th class="r">Allocated (USD)</th><th class="r">Disbursed (USD)</th><th class="r">Pending (USD)</th></tr></thead><tbody>${allocRows}</tbody></table></section>`;
    }).join("") : "";
    const agRows = repAg.map((a) => `<tr><td style="font-weight:600">${a.ref ? a.ref + " · " : ""}${a.title}</td><td>${a.party}</td><td><span class="pill ${a.status.toLowerCase()}">${a.status}</span></td><td class="r" style="color:${GREEN}">${usd(a.receivedUSD)}</td><td class="r" style="color:${RED}">${usd(a.disbursedUSD)}</td><td class="r b">${usd(a.undisbursedUSD)}</td></tr>`).join("");
    const accRows = repAccounts.map((a) => `<tr><td style="font-weight:600">${a.name}</td><td>${a.currency}</td><td class="r">${a.count}</td><td class="r b">${usd(a.usd)}</td></tr>`).join("");
    const partySections = statementParties.map((p) => {
      const st = buildStatement(p);
      const dates = st.rows.map((r) => r.date).filter(Boolean).sort();
      const range = dates.length ? `${fmtD(dates[0])} to ${fmtD(dates[dates.length - 1])}` : "—";
      const opening = `<tr><td>${fmtD(dates[0]) || ""}</td><td><b>***Opening Balance***</b></td><td></td><td class="r">$ 0.00</td><td class="r"></td><td class="r b">$ 0.00</td></tr>`;
      const ledger = st.rows.length ? opening + st.rows.map((r) => `<tr><td>${fmtD(r.date)}</td><td>${r.kind === "in" ? "Disbursement" : "Onward Payment"}</td><td>${r.desc} <span class="muted">(${r.currency} ${money(r.amount)})${r.comment ? " · " + r.comment : ""}</span></td><td class="r">${r.kind === "in" ? usd(r.usd) : ""}</td><td class="r">${r.kind === "out" ? usd(r.usd) : ""}</td><td class="r b">${usd(r.balance)}</td></tr>`).join("") : `<tr><td colspan="6" class="empty">No movements yet.</td></tr>`;
      const myAlloc = disbComputed.filter((d) => d.party === p);
      const aT = myAlloc.reduce((s, d) => ({ al: s.al + Number(d.amount || 0), pd: s.pd + d.paidUSD }), { al: 0, pd: 0 });
      const allocTable = myAlloc.length ? `<h3>Allocations by Agreement</h3><table><thead><tr><th>Agreement</th><th class="r">Allocated (USD)</th><th class="r">Paid (USD)</th><th class="r">Pending (USD)</th></tr></thead><tbody>${myAlloc.map((d) => { const al = Number(d.amount || 0); return `<tr><td>${d.agreementTitle}</td><td class="r">${usd(al)}</td><td class="r">${usd(d.paidUSD)}</td><td class="r b">${usd(al - d.paidUSD)}</td></tr>`; }).join("")}<tr class="soa-bal"><td><b>Total</b></td><td class="r"><b>${usd(aT.al)}</b></td><td class="r"><b>${usd(aT.pd)}</b></td><td class="r"><b>${usd(aT.al - aT.pd)}</b></td></tr></tbody></table>` : "";
      const accs = st.accts.length ? `<h3>Associated Accounts</h3><table><thead><tr><th>Account</th><th>Currency</th><th class="r">Transfers</th><th class="r">Total Sent (USD)</th><th>Last</th></tr></thead><tbody>${st.accts.map((a) => `<tr><td>${a.name}</td><td>${a.currency}</td><td class="r">${a.count}</td><td class="r">${usd(a.usd)}</td><td>${fmtD(a.last) || ""}</td></tr>`).join("")}</tbody></table>` : "";
      return `<section class="party"><div class="soa-head"><div class="soa-to"><div class="lbl">To</div><div class="soa-party">${p}</div></div><div class="soa-title"><h2>Statement of Accounts</h2><div class="soa-range">${range}</div><table class="soa-summary"><tr class="soa-sumhdr"><td>Account Summary</td><td></td></tr><tr><td>Opening Balance</td><td class="r">$ 0.00</td></tr><tr><td>Allocated (Received)</td><td class="r">$ ${money(st.inUSD)}</td></tr><tr><td>Paid Onward</td><td class="r">$ ${money(st.outUSD)}</td></tr><tr class="soa-bal"><td>Balance Held</td><td class="r">$ ${money(st.holding)}</td></tr></table></div></div>${allocTable}<h3>Disbursement &amp; Onward Payments</h3><table class="soa-table"><thead><tr><th>Date</th><th>Transactions</th><th>Details</th><th class="r">Amount</th><th class="r">Payments</th><th class="r">Balance</th></tr></thead><tbody>${ledger}</tbody></table><div class="soa-due"><span>Balance Held</span><b>$ ${money(st.holding)}</b></div>${accs}</section>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Funds Flow Report — ${d}</title><style>*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${SLATE};margin:0;background:#fff;font-size:13px;line-height:1.5}.wrap{max-width:1000px;margin:0 auto;padding:0 28px 60px}.cover{background:${NAVY};color:#fff;padding:48px 28px;margin-bottom:32px}.cover .inner{max-width:1000px;margin:0 auto}.cover h1{margin:0 0 6px;font-size:26px}.cover p{margin:0;color:#94a3b8;font-size:13px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:28px auto 0;max-width:1000px}.kpi{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:16px}.kpi span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#cbd5e1;margin-bottom:6px}.kpi b{font-size:20px;color:#fff}.kpi small{display:block;font-size:11px;color:#cbd5e1;margin-top:4px;font-weight:600}.kpi.sep{border-left:3px solid rgba(203,213,225,.55);margin-left:10px;padding-left:20px}tr.tot td{border-top:2px solid ${NAVY};font-weight:700;color:${NAVY};background:${BG}}h2{font-size:18px;color:${NAVY};border-bottom:2px solid ${NAVY};padding-bottom:6px;margin:36px 0 14px}h3{font-size:13px;color:${SLATE};margin:20px 0 8px;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:12px}th{background:${NAVY};color:#fff;text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase}th.r{text-align:right}td{padding:7px 10px;border-bottom:1px solid ${LINE}}td.r{text-align:right}td.b{font-weight:700;color:${NAVY}}tbody tr:nth-child(even){background:${BG}}.muted{color:#94a3b8;font-size:11px}.empty{text-align:center;color:#94a3b8;padding:14px}.party{margin-top:30px;page-break-inside:avoid}.soa-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;gap:24px}.soa-to .lbl{font-weight:700;color:${NAVY};margin-bottom:4px}.soa-party{font-size:15px;font-weight:600;color:${SLATE}}.soa-title{text-align:right;min-width:340px}.soa-title h2{border:0;margin:0 0 2px;font-size:22px;color:${NAVY};padding:0}.soa-range{font-size:12px;color:${SLATE};border-bottom:2px solid ${NAVY};padding-bottom:8px;margin-bottom:12px;display:inline-block}.soa-summary{width:100%;border-collapse:collapse}.soa-summary td{padding:6px 10px;border:0;font-size:12px;text-align:left}.soa-summary td.r{text-align:right;font-weight:600;color:${NAVY}}.soa-summary tr.soa-sumhdr td{background:${BG};font-weight:700;color:${NAVY}}.soa-summary tr.soa-bal td{border-top:1.5px solid ${NAVY};border-bottom:1.5px solid ${NAVY};font-weight:700}.soa-table th{background:#333;color:#fff;text-transform:none}.soa-due{display:flex;justify-content:flex-end;gap:40px;padding:14px 10px;font-size:14px;font-weight:700;border-top:1px solid ${LINE}}.soa-due b{color:${NAVY}}.pill{padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}.pill.ongoing{background:#dbeafe;color:#1e40af}.pill.closed{background:#d1fae5;color:#065f46}.pill.overdue{background:#ffe4e6;color:#9f1239}.pill.hold{background:#fef3c7;color:#92400e}.pill.pending{background:#e2e8f0;color:#334155}.toolbar{position:fixed;top:14px;right:14px}.toolbar button{background:${NAVY};color:#fff;border:0;padding:9px 16px;border-radius:8px;font-size:13px;cursor:pointer}@media print{.toolbar{display:none}.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}th{-webkit-print-color-adjust:exact;print-color-adjust:exact}.party{page-break-before:always}}</style></head><body><div class="toolbar"><button onclick="window.print()">🖨 Print / Save as PDF</button></div><div class="cover"><div class="inner"><h1>Agreement Revenue &amp; Disbursement Report</h1><p>Base currency: USD · Generated ${d} · ${scopeLabel}</p></div><div class="kpis">${kpiHtml}</div></div><div class="wrap">${agScope ? agDetail : `<h2>Funds Flow per Agreement</h2><table><thead><tr><th>Agreement</th><th>Client</th><th>Status</th><th class="r">Received</th><th class="r">Disbursed</th><th class="r">Undisbursed</th></tr></thead><tbody>${agRows || `<tr><td colspan="6" class="empty">No agreements.</td></tr>`}</tbody></table><h2>Account Totals</h2><table><thead><tr><th>Account</th><th>Currency</th><th class="r">Transfers</th><th class="r">Received (USD)</th></tr></thead><tbody>${accRows || `<tr><td colspan="4" class="empty">No accounts.</td></tr>`}</tbody></table><h2 style="border-color:${BLUE};color:${BLUE}">Party Statements</h2>${partySections || `<p class="empty">No parties selected.</p>`}`}</div></body></html>`;
    if (preview) return html;
    openOrSave(html, `Funds_Flow_Report_${new Date().toISOString().slice(0, 10)}.html`);
  };

  const exportExcel = (partyList = [], agIds = null) => {
    const wb = XLSX.utils.book_new();
    // Agreement-scoped export: limit the agreement-derived sheets and the party
    // statements to the chosen agreements and the parties allocated on them.
    const agScope = agIds && agIds.length ? new Set(agIds) : null;
    const xAg = agScope ? fAg.filter((a) => agScope.has(a.id)) : fAg;
    const xDisb = agScope ? fDisb.filter((d) => agScope.has(d.agreementId)) : fDisb;
    const stParties = agScope ? [...new Set(disbComputed.filter((d) => agScope.has(d.agreementId)).map((d) => d.party))].filter(Boolean) : partyList;
    const xTr = agScope ? fTr.filter((t) => stParties.includes(t.fromParty)) : fTr;
    const fLabel = agScope ? `Agreements: ${xAg.map((a) => (a.ref ? a.ref + " · " : "") + a.title).join(", ")}` : (Object.entries(F).filter(([, v]) => v !== "all").map(([k, v]) => `${k}: ${k === "agreement" ? (data.agreements.find((a) => a.id === v)?.title || v) : v}`).join(", ") || "None (all records)");
    const NAVY = "0F172A", BAND = "F1F5F9";
    const hdr = { fill: { fgColor: { rgb: NAVY } }, font: { color: { rgb: "FFFFFF" }, bold: true, sz: 10 }, alignment: { horizontal: "left", vertical: "center" } };
    const titleStyle = { font: { bold: true, sz: 14, color: { rgb: NAVY } } };
    const styleSheet = (ws, headerRowIdx) => {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let R = range.s.r; R <= range.e.r; R++) for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr]; if (!cell) continue;
        if (R === headerRowIdx) cell.s = hdr;
        else if (R > headerRowIdx && (R - headerRowIdx) % 2 === 0) cell.s = { ...(cell.s || {}), fill: { fgColor: { rgb: BAND } } };
      }
    };
    const sum = [
      ["AGREEMENT REVENUE & DISBURSEMENT REPORT (Base Currency: USD)"], [`Generated: ${new Date().toLocaleDateString("en-GB")}`], [`Active filters: ${fLabel}`], [],
      ["FUNDS FLOW (USD)"], ["Total Received under Agreements", totReceivedUSD], ["Total Disbursed to Parties", totDisbursedUSD], ["Undisbursed Balance", totReceivedUSD - totDisbursedUSD], ["Total Onward Transfers to Accounts", totTransferredUSD], [],
      ["PER AGREEMENT (USD)"], ["Ref", "Agreement", "Client", "Agreement Status", "Payment Status", "Currency", "Total Value", "Invoiced (USD)", "Outstanding (USD)", "Received (orig.)", "Received (USD)", "Disbursed (USD)", "Undisbursed (USD)", "Comment"],
      ...xAg.map((a) => [a.ref, a.title, a.party, a.status, a.paymentStatus || "Ongoing", a.currency, Number(a.totalValue || 0), a.invoicedUSD, a.outstandingUSD, a.received, a.receivedUSD, a.disbursedUSD, a.undisbursedUSD, a.comment || ""]), [],
      ["PARTY BALANCES (USD)"], ["Party", "Disbursed In", "Transferred Out", "Balance Held"],
      ...Object.entries(partyBalances).map(([p, b]) => [p, b.inUSD, b.outUSD, b.inUSD - b.outUSD]), [],
      ["ACCOUNT TOTALS"], ["Account", "Currency", "Transfers", "Received (own currency)", "Received (USD)", "Comment"],
      ...accountTotals.map((a) => [a.name, a.currency, a.count, a.original, a.usd, a.comment || ""]), [],
      ["BY YEAR (USD)"], ["Year", "Received", "Disbursed", "Transferred to Accounts"],
      ...years.map((y) => [y, agComputed.flatMap((a) => (a.receipts || []).filter((r) => yearOf(r.date) === y)).reduce((s, r) => s + r.amount * r.rate, 0), disbComputed.flatMap((d) => (d.payments || []).filter((p) => yearOf(p.date) === y)).reduce((s, p) => s + p.amount * p.rate, 0), trComputed.filter((t) => yearOf(t.date) === y).reduce((s, t) => s + t.usd, 0)]),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(sum);
    ws1["!cols"] = [{ wch: 30 }, { wch: 26 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 26 }];
    if (ws1["A1"]) ws1["A1"].s = titleStyle;
    XLSX.utils.book_append_sheet(wb, ws1, "Summary");
    const addStyledSheet = (name, rows, widths) => {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
      if (widths) ws["!cols"] = widths;
      ws["!freeze"] = { xSplit: 0, ySplit: 1 };
      styleSheet(ws, 0);
      XLSX.utils.book_append_sheet(wb, ws, name);
    };
    addStyledSheet("Agreements", xAg.map((a) => ({ Ref: a.ref, Title: a.title, Client: a.party, Date: a.date, "Agreement Status": a.status, "Payment Status": a.paymentStatus || "Ongoing", Currency: a.currency, "Total Value": Number(a.totalValue || 0), "Invoiced (orig.)": a.invoiced, "Invoiced (USD)": a.invoicedUSD, "Outstanding (USD)": a.outstandingUSD, "Received (orig.)": a.received, "Received (USD)": a.receivedUSD, "Disbursed (USD)": a.disbursedUSD, "Undisbursed (USD)": a.undisbursedUSD, Comment: a.comment || "" })));
    addStyledSheet("Invoices", xAg.flatMap((a) => (a.invoices || []).map((iv) => ({ "Invoice Date": iv.date, "Invoice #": iv.number || "", "Due Date": iv.dueDate || "", Agreement: a.title, Ref: a.ref, Client: a.party, Currency: a.currency, Amount: Number(iv.amount || 0), "Rate to USD": Number(iv.rate || 1), "USD Equivalent": Number(iv.amount || 0) * Number(iv.rate || 1), Received: (a.receipts || []).filter((r) => r.invoiceId === iv.id).reduce((t, r) => t + Number(r.amount || 0), 0), Comment: iv.notes || "" }))));
    addStyledSheet("Receipts", xAg.flatMap((a) => (a.receipts || []).map((r) => ({ Date: r.date, Agreement: a.title, Ref: a.ref, Client: a.party, Currency: a.currency, Amount: Number(r.amount), "Rate to USD": Number(r.rate), "USD Equivalent": r.amount * r.rate, Comment: r.notes || "" }))));
    addStyledSheet("Disbursements", xDisb.map((d) => ({ Date: d.date, Party: d.party, "Source Agreement": d.agreementTitle, Description: d.description || "", "Payment Status": d.paymentStatus, Currency: d.currency, "Allocated Amount": Number(d.amount), Paid: d.paid, Outstanding: d.outstanding, "Paid (USD)": d.paidUSD, Comment: d.comment || "" })));
    addStyledSheet("Disb Payments", xDisb.flatMap((d) => (d.payments || []).map((p) => ({ Date: p.date, Party: d.party, "Source Agreement": d.agreementTitle, Currency: d.currency, Amount: Number(p.amount), "Rate to USD": Number(p.rate), "USD Equivalent": p.amount * p.rate, Comment: p.notes || "" }))));
    addStyledSheet("Transfers", xTr.map((t) => ({ Date: t.date, "From Party": t.fromParty, "To Account": t.accountName, "Account Currency": t.accountCurrency, "Partial/Full": t.payType, "Transfer Currency": t.currency, Amount: Number(t.amount), "Rate to USD": Number(t.rate), "USD Equivalent": t.usd, Comment: t.notes || "" })));
    // Excel worksheet names must be unique and <= 31 chars, and cannot contain
    // \ / ? * [ ] :. Stripping those characters can make two different parties
    // collapse to the same name (e.g. "CB" and "CB***" both become "ST · CB"),
    // which makes book_append_sheet throw and aborts the whole export. Force a
    // unique, length-safe name by appending " (2)", " (3)", … on collision.
    const usedSheetNames = new Set(["summary", "agreements", "invoices", "receipts", "disbursements", "disb payments", "transfers"]);
    const uniqueSheetName = (raw) => {
      const clean = raw.replace(/[\\/?*\[\]:]/g, "");
      let name = clean.slice(0, 31);
      let n = 2;
      while (usedSheetNames.has(name.toLowerCase())) {
        const suffix = " (" + n++ + ")";
        name = clean.slice(0, 31 - suffix.length) + suffix;
      }
      usedSheetNames.add(name.toLowerCase());
      return name;
    };
    stParties.forEach((p) => {
      const st = buildStatement(p);
      const rows = [
        [`STATEMENT — ${p}`],
        [`Received (USD): ${fmt(st.inUSD)}`, `Paid Onward (USD): ${fmt(st.outUSD)}`, `Holding (USD): ${fmt(st.holding)}`],
        [],
        ["Date", "Description", "Currency", "Amount", "In (USD)", "Out (USD)", "Balance (USD)", "Comment"],
        ...st.rows.map((r) => [r.date, r.desc, r.currency, r.amount, r.kind === "in" ? r.usd : "", r.kind === "out" ? r.usd : "", r.balance, r.comment]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }];
      if (ws["A1"]) ws["A1"].s = titleStyle;
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let C = 0; C <= range.e.c; C++) { const addr = XLSX.utils.encode_cell({ r: 3, c: C }); if (ws[addr]) ws[addr].s = hdr; }
      const safe = uniqueSheetName("ST · " + p);
      XLSX.utils.book_append_sheet(wb, ws, safe);
    });
    XLSX.writeFile(wb, `Funds_Flow_Report_USD_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (LOGIN_ENABLED && !authChecked) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">…</div>;
  if (LOGIN_ENABLED && !authed) return <AuthScreen users={users} addUser={addUser} tryLogin={tryLogin} resetPassword={resetPassword} />;
  if (!loaded) return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">Loading your records…</div>;

  const Sel = ({ k, label, opts, names }) => (
    <select value={F[k]} onChange={(e) => setFilters({ ...F, [k]: e.target.value })} className="shrink-0 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs bg-white text-slate-700 max-w-[200px] shadow-sm hover:border-slate-300 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-colors">
      <option value="all">{label}: All</option>
      {opts.map((o, i) => <option key={o} value={o}>{names ? names[i] : o}</option>)}
    </select>
  );
  const statusColor = (s) => s === "Paid" || s === "Closed" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : s === "Overdue" ? "bg-rose-50 text-rose-700 ring-rose-600/20" : s === "Hold" ? "bg-amber-50 text-amber-700 ring-amber-600/20" : s === "Pending" ? "bg-slate-100 text-slate-600 ring-slate-500/20" : "bg-blue-50 text-blue-700 ring-blue-600/20";
  const statusDot = (s) => s === "Paid" || s === "Closed" ? "bg-emerald-500" : s === "Overdue" ? "bg-rose-500" : s === "Hold" ? "bg-amber-500" : s === "Pending" ? "bg-slate-400" : "bg-blue-500";
  const Badge = ({ s, prefix }) => (
    <span className={`inline-flex items-center justify-center gap-1.5 min-w-[72px] px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset ${statusColor(s)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${statusDot(s)}`}></span>
      {prefix ? prefix + ": " : ""}{s}
    </span>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @media print {
          .no-print { display: none !important; }
          .overflow-x-auto { overflow: visible !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
      <div className="sticky top-0 z-30 shadow-sm">
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white border-b border-slate-800 shadow-lg">
        <div className="w-full px-3 sm:px-6 lg:px-8 xl:px-10 py-3 sm:py-5 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-md border border-slate-700 bg-slate-900/50 flex items-center justify-center font-serif text-base sm:text-lg tracking-widest text-slate-100">X</div>
            <div className="border-l border-slate-700/70 pl-2.5 sm:pl-4 min-w-0">
              <h1 className="text-base sm:text-xl font-serif tracking-wide text-white truncate">XYZ Financial Report</h1>
              <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.18em] text-slate-400 mt-0.5 truncate">Agreement Revenue &amp; Disbursement<span className="ml-2 normal-case tracking-normal text-slate-500">{APP_VERSION}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">As of</div>
              <div className="text-sm font-medium text-slate-200 tabular-nums">{now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
              <div className="text-[11px] text-slate-400 tabular-nums">{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <div className="h-10 w-px bg-slate-700/70 hidden sm:block"></div>
            <div className="no-print flex gap-1.5">
              <button onClick={printView} title="Print as PDF" className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-700 hover:border-slate-400 hover:bg-slate-800 text-slate-300 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              </button>
              <button onClick={() => setReportModal(true)} title="Generate Report" className="w-8 h-8 flex items-center justify-center rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button onClick={logout} title={`Logout — ${users.find((u) => u.userId === currentUser)?.name || currentUser || ""} · ${currentUser || ""} (${roleLabel(users.find((u) => u.userId === currentUser)?.role)})`} className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-700 hover:border-rose-500 hover:bg-slate-800 text-slate-300 hover:text-rose-400 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-slate-200">
      <div className="no-print w-full px-3 sm:px-6 lg:px-8 xl:px-10 flex gap-4 sm:gap-8 md:justify-between md:gap-4 overflow-x-auto no-scrollbar">
        {[["dashboard", "Dashboard"], ["agreements", "Agreements & Receipts"], ["disbursements", "Disbursements"], ["transfers", "Onward Transfers"], ["parties", "Parties"], ["settings", "Settings"], ["notes", "Notes"]].filter(([k]) => k !== "settings" || !LOGIN_ENABLED || [SUPER, "admin"].includes(users.find((u) => u.userId === currentUser)?.role)).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); if (k !== "parties") setSelectedParty(null); }} className={`relative shrink-0 py-3.5 sm:py-4 text-[10px] sm:text-[11px] lg:text-xs font-medium tracking-[0.12em] sm:tracking-[0.14em] lg:tracking-[0.16em] uppercase whitespace-nowrap transition-colors ${tab === k ? "text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
            {l}
            {tab === k && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-slate-900 rounded-full"></span>}
          </button>
        ))}
      </div>
      </div>

      {tab !== "settings" && tab !== "parties" && tab !== "notes" && (
        <div className="bg-white border-b border-slate-200">
        <div className="no-print w-full px-3 sm:px-6 lg:px-8 xl:px-10 py-2.5 sm:py-3 flex flex-nowrap sm:flex-wrap gap-2 items-center overflow-x-auto sm:overflow-visible no-scrollbar">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.18em] mr-2 shrink-0">Filters</span>
          <Sel k="agreement" label="Agreement" opts={data.agreements.map((a) => a.id)} names={data.agreements.map((a) => (a.ref ? a.ref + " · " : "") + a.title)} />
          <Sel k="party" label="Party" opts={allPartyNames} />
          <Sel k="year" label="Year" opts={years} />
          <Sel k="currency" label="Currency" opts={data.currencies.map((c) => c.code)} />
          <Sel k="agStatus" label="Agreement Status" opts={AG_STATUSES} />
          <Sel k="payStatus" label="Payment Status" opts={PAY_STATUSES} />
          {Object.values(F).some((v) => v !== "all") && (
            <button onClick={() => setFilters({ party: "all", year: "all", currency: "all", agreement: "all", agStatus: "all", payStatus: "all" })} className="text-xs text-blue-700 hover:text-blue-900 underline">Clear all</button>
          )}
        </div>
        </div>
      )}
      </div>

      {readOnly && (
        <div className="bg-amber-50 border-b border-amber-200"><div className="w-full px-3 sm:px-6 lg:px-8 xl:px-10 py-2.5 flex flex-wrap items-center gap-2 text-xs text-amber-900">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <b>Read-only copy.</b>
          <span>Release {release?.version} locked data entry to the published app{release?.host ? ` (${release.host})` : ""}. You can view, filter and export here, but edits will not save.</span>
        </div></div>
      )}
      <ErrorBoundary>
      <div className="w-full px-3 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6">
        {tab === "dashboard" && (
          <div className="space-y-4">
            {data.agreements.length === 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-blue-50/40 border border-blue-200 rounded-xl p-5 flex flex-wrap items-center gap-4 shadow-sm">
                <div className="flex-1 min-w-[220px]">
                  <p className="font-semibold text-blue-900">Load the Invoicing &amp; Allocation Register</p>
                  <p className="text-sm text-blue-700">Populate the tracker with all agreements, received invoices, and per-party allocations.</p>
                </div>
                <button onClick={loadRegister} className="bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors">Load Register Data</button>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y sm:divide-y-0 sm:divide-x divide-slate-200 grid grid-cols-1 sm:grid-cols-3">
              {[
                { l: "Total Invoiced · USD", v: totalInvoicedUSD, sym: "$", dot: "bg-emerald-500" },
                { l: "Total Invoiced · EUR", v: totalInvoicedEUR, sym: "€", dot: "bg-blue-500" },
                { l: "Total Invoiced · AED", v: totalInvoicedAED, sym: "AED", dot: "bg-amber-500" },
              ].map((x) => (
                <div key={x.l} className="px-4 py-3">
                  <div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${x.dot}`}></span><span className="text-[9px] uppercase tracking-[0.16em] text-slate-400 font-semibold">{x.l}</span></div>
                  <div className="text-lg text-slate-900 font-medium mt-1"><AmtTile v={x.v} sym={x.sym} /></div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-slate-200 flex items-baseline justify-between flex-wrap gap-2">
                <h3 className="font-serif text-lg sm:text-xl text-slate-900 tracking-tight">Agreements (Funds Flow)</h3>
                <span className="text-[9px] uppercase tracking-[0.2em] text-slate-400">All amounts in USD unless noted</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 px-4 sm:px-6 lg:px-8 pt-3.5 pb-1">
                {[
                  { l: "Received", v: totReceivedUSD, c: "text-emerald-700", bar: "bg-emerald-500" },
                  { l: "Disbursed to Parties", v: totDisbursedUSD, c: "text-rose-700", bar: "bg-rose-500" },
                  { l: "Undisbursed Balance", v: totReceivedUSD - totDisbursedUSD, c: "text-slate-900", bar: "bg-slate-700" },
                  { l: "Onward to Accounts", v: totTransferredUSD, c: "text-blue-700", bar: "bg-blue-500" },
                ].map((x) => (
                  <div key={x.l} className="relative bg-white rounded-lg border border-slate-200 px-3 py-2.5 overflow-hidden">
                    <span className={`absolute top-0 left-0 right-0 h-0.5 ${x.bar}`}></span>
                    <p className="text-[9px] uppercase tracking-[0.16em] text-slate-400 font-medium truncate">{x.l}</p>
                    <p className={`text-base mt-0.5 ${Number(x.v) < -0.005 ? "text-rose-600" : x.c}`}><AmtTile v={x.v} /></p>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1080px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      <th className="text-left px-4 py-2 font-semibold">#</th>
                      <th className="text-left px-4 py-2 font-semibold">Client</th>
                      <th className="text-left px-4 py-2 font-semibold">Status</th>
                      <th className="text-right px-4 py-2 font-semibold">Agreement Value</th>
                      <th className="text-right px-4 py-2 font-semibold">Invoiced</th>
                      <th className="text-right px-4 py-2 font-semibold">Total Received</th>
                      <th className="text-right px-4 py-2 font-semibold">Pending</th>
                      <th className="text-right px-4 py-2 font-semibold">Disbursed</th>
                      <th className="text-right px-4 py-2 font-semibold">Undisbursed</th>
                      <th className="text-center px-2 py-3 font-semibold w-10">-</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {fAg.length === 0 && <tr><td colSpan={10} className="px-5 py-12 text-center text-slate-400">No agreements yet — start in the Agreements tab.</td></tr>}
                    {fAg.map((a, i) => {
                      const valueUSD = Number(a.totalValue || 0) * (FX[a.currency] || 1);
                      const pending = (a.hasInvoices ? a.invoicedUSD : valueUSD) - a.receivedUSD;
                      return (
                      <Fragment key={a.id}>
                      <tr className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 ? "bg-slate-50/30" : ""}`}>
                        <td className="px-4 py-2 text-slate-400 font-medium tabular-nums">{String(agNum[a.id]).padStart(2, "0")}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{a.title}</div>
                          {a.party && a.party !== a.title && <div className="text-[11px] text-slate-400 mt-0.5">{a.party}</div>}
                        </td>
                        <td className="px-4 py-3"><Badge s={a.status} /></td>
                        <td className="px-4 py-2 text-right whitespace-nowrap text-slate-600"><AmtG v={a.totalValue} sym={csym(a.currency)} /></td>
                        <td className="px-4 py-2 text-right whitespace-nowrap text-slate-500"><AmtG v={a.invoiced} sym={csym(a.currency)} /></td>
                        <td className="px-4 py-2 text-right text-emerald-700 font-medium"><AmtG v={a.receivedUSD} /></td>
                        <td className={`px-4 py-3 text-right ${pending > 0.01 ? "text-rose-400" : "text-slate-300"}`}><AmtG v={pending} /></td>
                        <td className="px-4 py-2 text-right text-emerald-500 font-medium"><AmtG v={a.disbursedUSD} /></td>
                        <td className={`px-4 py-3 text-right font-medium ${a.undisbursedUSD < -0.01 ? "text-rose-500" : a.undisbursedUSD > 0.01 ? "text-rose-300" : "text-slate-300"}`}><AmtG v={a.undisbursedUSD} /></td>
                        <td className="px-2 py-3 text-center">
                          <button onClick={(e) => { e.stopPropagation(); setCommentRow(commentRow === a.id ? null : a.id); setNewComment(""); }} title={getComments(a).length ? `${getComments(a).length} comment(s)` : "Add comment"} className={`relative inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors ${getComments(a).length ? "text-blue-600 border-blue-200 bg-blue-50" : "text-slate-300 border-slate-200 hover:text-slate-500 hover:border-slate-300"}`}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            {getComments(a).length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[8px] font-semibold w-3.5 h-3.5 flex items-center justify-center rounded-full">{getComments(a).length}</span>}
                          </button>
                        </td>
                      </tr>
                      {commentRow === a.id && (
                        <tr className="bg-slate-50">
                          <td colSpan={10} className="px-4 py-2 border-t border-slate-100">
                            <div className="max-w-2xl">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold">Comments — {a.title}</span>
                                <button onClick={() => setCommentRow(null)} className="text-slate-400 hover:text-slate-600 text-xs">Close ✕</button>
                              </div>
                              {getComments(a).length === 0 ? (
                                <p className="text-xs text-slate-400 italic mb-2">No comments yet.</p>
                              ) : (
                                <div className="space-y-1.5 mb-2 max-h-52 overflow-y-auto pr-1">
                                  {getComments(a).slice().sort((x, y) => x.ts - y.ts).map((m) => (
                                    <div key={m.id} className="flex items-start gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs text-slate-700 whitespace-pre-wrap break-words">{m.text}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{new Date(m.ts).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                                      </div>
                                      <button onClick={() => removeComment(a.id, m.id)} title="Delete" className="text-slate-300 hover:text-rose-500 text-xs shrink-0">✕</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <input value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { addComment(a.id, newComment); setNewComment(""); } if (e.key === "Escape") setCommentRow(null); }} autoFocus placeholder="Write a comment… (Enter to post)" className="flex-1 border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100" />
                                <button onClick={() => { addComment(a.id, newComment); setNewComment(""); }} className="bg-slate-900 hover:bg-slate-700 text-white text-xs px-3 py-1.5 rounded-md">Post</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                      );
                    })}
                  </tbody>
                  {fAg.length > 0 && (() => {
                    const t = fAg.reduce((s, a) => {
                      const v = Number(a.totalValue || 0) * (FX[a.currency] || 1);
                      return { val: s.val + v, recv: s.recv + a.receivedUSD, pend: s.pend + ((a.hasInvoices ? a.invoicedUSD : v) - a.receivedUSD), disb: s.disb + a.disbursedUSD, undisb: s.undisb + a.undisbursedUSD };
                    }, { val: 0, recv: 0, pend: 0, disb: 0, undisb: 0 });
                    return (
                      <tfoot className="bg-slate-100 border-t-2 border-slate-300 text-slate-800">
                        <tr className="text-[11px] uppercase tracking-wider font-semibold">
                          <td colSpan={3} className="px-4 py-3">Total ({fAg.length} agreements)</td>
                          <td className="px-4 py-2 text-right"><AmtG v={t.val} /></td>
                          <td></td>
                          <td className="px-4 py-2 text-right text-emerald-700"><AmtG v={t.recv} /></td>
                          <td className="px-4 py-2 text-right text-rose-500"><AmtG v={t.pend} /></td>
                          <td className="px-4 py-2 text-right text-emerald-600"><AmtG v={t.disb} /></td>
                          <td className="px-4 py-2 text-right text-rose-500"><AmtG v={t.undisb} /></td>
                          <td></td>
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
              <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
                <h2 className="font-serif text-2xl text-slate-900 tracking-tight">Allocation Summary</h2>
                <div className="text-right">
                  <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">As of {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</span>
                  <div className="flex justify-end gap-x-5 mt-1.5 text-[11px]">
                    <span><span className="uppercase tracking-[0.12em] text-[9px] text-slate-400 mr-1.5">AED/USD</span><span className="text-slate-700 tabular-nums">3.65</span></span>
                    <span><span className="uppercase tracking-[0.12em] text-[9px] text-slate-400 mr-1.5">EUR/USD</span><span className="text-slate-700 tabular-nums">1.08232</span></span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 italic mb-6 pb-6 border-b border-slate-100">Live figures from the register — reflects current filters.</p>
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-sm min-w-[680px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      <th className="text-left px-4 py-2 font-semibold">Allocation</th>
                      <th className="text-left px-4 py-2 font-semibold">Detail</th>
                      <th className="text-right px-4 py-2 font-semibold">Invoiced (USD)</th>
                      <th className="text-right px-4 py-2 font-semibold">Paid (USD)</th>
                      <th className="text-right px-4 py-2 font-semibold">Pending (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {allocationSummary.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No allocations yet — load the register or add disbursements.</td></tr>}
                    {allocationSummary.map((r, i) => (
                      <tr key={r.name} className={`border-t border-slate-100 hover:bg-slate-50/80 transition-colors ${i % 2 ? "bg-slate-50/30" : ""}`}>
                        <td className="px-4 py-2 font-medium text-slate-800"><PartyName name={r.name} /></td>
                        <td className="px-4 py-3"><button onClick={() => { setSelectedParty(r.name); setTab("parties"); }} className="text-blue-700 hover:text-blue-900 hover:underline text-xs tracking-wide">Open {r.name} statement →</button></td>
                        <td className="px-4 py-2 text-right"><AmtG v={r.invoiced} /></td>
                        <td className="px-4 py-2 text-right text-emerald-700"><AmtG v={r.paid} /></td>
                        <td className={`px-4 py-3 text-right ${r.pending < 0 ? "text-rose-600" : r.pending > 0.01 ? "text-rose-400" : "text-slate-300"}`}><AmtG v={r.pending} /></td>
                      </tr>
                    ))}
                    {allocationSummary.length > 0 && (
                      <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
                        <td className="px-4 py-3.5 text-[10px] uppercase tracking-[0.14em]" colSpan={2}>Total</td>
                        <td className="px-4 py-3.5 text-right"><AmtG v={allocTot.invoiced} /></td>
                        <td className="px-4 py-3.5 text-right text-emerald-700"><AmtG v={allocTot.paid} /></td>
                        <td className={`px-4 py-3.5 text-right ${allocTot.pending < 0 ? "text-rose-600" : "text-slate-900"}`}><AmtG v={allocTot.pending} /></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-slate-200 flex items-baseline justify-between">
                  <h3 className="font-serif text-lg sm:text-xl text-slate-900 tracking-tight">Party Balances</h3>
                  <span className="text-[9px] uppercase tracking-[0.2em] text-slate-400">USD</span>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      <th className="text-left px-5 py-2 font-semibold">Party</th>
                      <th className="text-right px-5 py-2 font-semibold">Received</th>
                      <th className="text-right px-5 py-2 font-semibold">Paid Onward</th>
                      <th className="text-right px-5 py-2 font-semibold">Holding</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {Object.keys(partyBalances).length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400 italic">No disbursements yet.</td></tr>}
                    {Object.entries(partyBalances).sort((a, b2) => orderParty(a[0], b2[0])).map(([p, b], i) => (
                      <tr key={p} className={`border-t border-slate-100 hover:bg-slate-50/80 transition-colors ${i % 2 ? "bg-slate-50/30" : ""}`}>
                        <td className="px-5 py-2 font-medium"><PartyName name={p} /></td>
                        <td className="px-5 py-2 text-right"><AmtG v={b.inUSD} /></td>
                        <td className="px-5 py-2 text-right"><AmtG v={b.outUSD} /></td>
                        <td className="px-5 py-2 text-right font-medium"><AmtG v={b.inUSD - b.outUSD} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "agreements" && (
          <div>
            <div className="flex flex-wrap justify-between items-baseline gap-3 mb-6">
              <div>
                <h2 className="font-serif text-2xl text-slate-900 tracking-tight">Agreements &amp; Receipts</h2>
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 mt-1">{agPageList.length} entries</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {agComputed.some((a) => a.archived) && (<button onClick={() => setShowArchived(!showArchived)} className={`text-[10px] uppercase tracking-[0.14em] px-3 py-2 rounded-lg border transition-colors ${showArchived ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>{showArchived ? "Hide" : "Show"} archived ({agComputed.filter((a) => a.archived).length})</button>)}
                {agComputed.some((a) => a.hidden) && (<button onClick={() => setShowHidden(!showHidden)} className={`text-[10px] uppercase tracking-[0.14em] px-3 py-2 rounded-lg border transition-colors ${showHidden ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>{showHidden ? "Hide" : "Show"} hidden ({agComputed.filter((a) => a.hidden).length})</button>)}
                <button onClick={() => setAgOpen({})} className="text-[10px] uppercase tracking-[0.14em] px-3 py-2 rounded-lg border border-slate-200 text-slate-600 bg-white hover:border-slate-400 transition-colors">Collapse all</button>
                <button onClick={() => setAgOpen(Object.fromEntries(agPageList.map((a) => [a.id, true])))} className="text-[10px] uppercase tracking-[0.14em] px-3 py-2 rounded-lg border border-slate-200 text-slate-600 bg-white hover:border-slate-400 transition-colors">Expand all</button>
                <button onClick={() => setModal({ type: "agreement", payload: null })} className="bg-slate-900 hover:bg-slate-700 text-white text-[11px] uppercase tracking-[0.14em] px-4 py-2 rounded-lg shadow-sm transition-colors">+ New Agreement</button>
              </div>
            </div>
            <div className="space-y-3">
              {agPageList.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 shadow-sm">No agreements match the current filters.</div>}
              {agPageList.map((a) => (
                <div key={a.id} className={`bg-white rounded-xl border shadow-sm transition-shadow hover:shadow-md ${a.hidden ? "border-slate-300 opacity-60" : a.archived ? "border-amber-200" : "border-slate-200"}`}>
                  <div className="px-5 py-4 flex flex-wrap items-center gap-4 cursor-pointer" onClick={() => setAgOpen((o) => ({ ...o, [a.id]: !o[a.id] }))}>
                    <div className="flex items-center gap-4 w-56 shrink-0">
                      <span className="text-slate-400 font-medium tabular-nums text-sm">{String(agNum[a.id]).padStart(2, "0")}</span>
                      <span className="text-base text-slate-900 truncate">{a.title}</span>
                    </div>
                    <Badge s={a.status} />
                    <Badge s={a.paymentStatus || "Ongoing"} prefix="Pay" />
                    {a.archived && <span className="text-[9px] uppercase tracking-[0.18em] px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Archived</span>}
                    {a.hidden && <span className="text-[9px] uppercase tracking-[0.18em] px-2 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Hidden</span>}
                    {isLocked(a) && <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] px-2 py-1 rounded-full bg-slate-800 text-white"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Locked</span>}
                    <div className="ml-auto text-right">
                      <div className="text-[9px] uppercase tracking-wide text-slate-400 leading-none mb-0.5">Contract Value</div>
                      <div className="text-sm font-bold text-slate-800 leading-tight mb-1">{a.currency} {fmt(a.totalValue)}</div>
                      <div className="flex flex-col items-end gap-0.5 text-[10px] min-w-[160px]">
                        <span className="flex items-center justify-between gap-2 px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 w-full"><span className="opacity-80 uppercase tracking-wide text-[8px]">Invoiced</span><span className="whitespace-nowrap"><b className="tabular-nums inline-block text-right" style={{ minWidth: "4.75rem" }}>{fmt(a.invoiced)}</b><span className="text-[8px] opacity-70 ml-1">{a.currency}</span></span></span>
                        <span className="flex items-center justify-between gap-2 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 w-full"><span className="opacity-80 uppercase tracking-wide text-[8px]">Received</span><span className="whitespace-nowrap"><b className="tabular-nums inline-block text-right" style={{ minWidth: "4.75rem" }}>{fmt(a.received)}</b><span className="text-[8px] opacity-70 ml-1">{a.currency}</span></span></span>
                        <span className="flex items-center justify-between gap-2 px-2 py-0.5 rounded bg-emerald-50/60 text-emerald-500 border border-emerald-100 w-full"><span className="opacity-80 uppercase tracking-wide text-[8px]">Disbursed</span><span className="whitespace-nowrap"><b className="tabular-nums inline-block text-right" style={{ minWidth: "4.75rem" }}>{fmt(a.disbursedUSD)}</b><span className="text-[8px] opacity-70 ml-1">USD</span></span></span>
                        <span className="flex items-center justify-between gap-2 px-2 py-0.5 rounded bg-rose-50 text-rose-400 border border-rose-100 w-full"><span className="opacity-80 uppercase tracking-wide text-[8px]">Pending</span><span className="whitespace-nowrap"><b className="tabular-nums inline-block text-right" style={{ minWidth: "4.75rem" }}>{fmt((Number(a.totalValue || 0) * (FX[a.currency] || 1)) - a.receivedUSD)}</b><span className="text-[8px] opacity-70 ml-1">USD</span></span></span>
                      </div>
                    </div>
                    <span className="text-slate-400 self-center">{agOpen[a.id] ? "▲" : "▼"}</span>
                  </div>
                  {agOpen[a.id] && (
                    <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/70 rounded-b-xl">
                      <div className="overflow-x-auto">
                        {(() => {
                          const agParties = [...new Set(data.disbursements.filter((d) => d.agreementId === a.id).map((d) => d.party))].sort(orderParty);
                          const invs = a.invoices || [];
                          const rcpts = a.receipts || [];
                          const invIds = new Set(invs.map((iv) => iv.id));
                          const rows = [];
                          invs.forEach((iv) => {
                            const mine = rcpts.filter((r) => r.invoiceId === iv.id);
                            if (!mine.length) rows.push({ key: "i" + iv.id, iv, r: null, cont: false });
                            else mine.forEach((r, i) => rows.push({ key: r.id, iv, r, cont: i > 0 }));
                          });
                          rcpts.filter((r) => !r.invoiceId || !invIds.has(r.invoiceId)).forEach((r) => rows.push({ key: r.id, iv: null, r, cont: false }));
                          const allocTotal = (p) => expectedFor(a.id, p).paid;
                          const disbCells = disbCellsFor(a);
                          const P = agParties.length;
                          const cols = 7 + P;
                          const outstanding = a.invoiced - a.received;
                          return (<>
                        <table className="text-sm bg-white rounded-lg border border-slate-200 overflow-hidden" style={{ minWidth: 780 + P * 84, width: "100%" }}>
                          <thead className="text-xs text-slate-500 uppercase bg-slate-100">
                            <tr className="text-[10px] tracking-[0.16em] text-slate-400">
                              <th colSpan={3} className="text-left px-3 pt-2 pb-1 border-r border-slate-200">Invoice</th>
                              <th colSpan={3} className={`text-left px-3 pt-2 pb-1 ${P ? "border-r border-slate-200" : ""}`}>Payments Received</th>
                              {P > 0 && <th colSpan={P} className="text-left px-2 pt-2 pb-1 border-r border-slate-200">Allocations</th>}
                              <th></th>
                            </tr>
                            <tr>
                              <th className="text-left px-3 pb-1.5">Invoice Date</th>
                              <th className="text-left px-3 pb-1.5">Invoice #</th>
                              <th className="text-right px-3 pb-1.5 border-r border-slate-200">Amount ({a.currency})</th>
                              <th className="text-left px-3 pb-1.5">Receipt Date</th>
                              <th className="text-right px-3 pb-1.5">Amount ({a.currency})</th>
                              <th className={`text-right px-2 pb-1.5 w-16 ${P ? "border-r border-slate-200" : ""}`}>Rate</th>
                              {agParties.map((p, i) => {
                                const ex = expectedFor(a.id, p);
                                return (
                                <th key={p} className={`text-right px-2 pb-1.5 whitespace-nowrap align-bottom ${i === P - 1 ? "border-r border-slate-200" : ""}`}>
                                  <span className="block">{p}</span>
                                  <span title={`${p} — expected ${fmt(ex.expected)} · disbursed ${fmt(ex.paid)} · still to pay ${fmt(ex.stillToPay)}`} className={`block text-[10px] font-normal normal-case tracking-normal tabular-nums ${ex.isPaid ? "text-emerald-600" : "text-slate-300"}`}>{fmt(ex.expected)}</span>
                                </th>);
                              })}
                              <th className="w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.length === 0 && <tr><td colSpan={cols} className="px-3 py-3 text-center text-slate-400 text-xs">No invoices or payments recorded yet.</td></tr>}
                            {rows.map(({ key, iv, r, cont }) => {
                              const overdue = iv && !r && iv.dueDate && new Date(iv.dueDate) < new Date();
                              return (
                              <tr key={key} className="border-t border-slate-100">
                                <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">{cont ? "" : iv ? iv.date : <span className="text-slate-300">—</span>}</td>
                                <td className="px-3 py-1.5 whitespace-nowrap">
                                  {cont ? <span className="text-slate-300 text-xs">↳ {iv.number || "same invoice"}</span>
                                    : iv ? (isLocked(a) ? <span className="font-medium text-slate-700">{iv.number || "—"}</span>
                                      : <button onClick={() => setModal({ type: "invoice", payload: { agreement: a, invoice: iv } })} title="Edit invoice" className="font-medium text-slate-700 hover:text-blue-700 hover:underline">{iv.number || "—"}</button>)
                                    : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap border-r border-slate-100">{cont || !iv ? <span className="text-slate-300">—</span> : `${csym(a.currency)} ${fmt(iv.amount)}`}</td>
                                <td className="px-3 py-1.5 whitespace-nowrap">
                                  {!r ? <span className={`text-[10px] uppercase tracking-wider ${overdue ? "text-rose-600 font-medium" : "text-slate-400"}`}>{overdue ? "Overdue" : "Awaiting payment"}{iv && iv.dueDate ? ` · due ${iv.dueDate}` : ""}</span>
                                    : isLocked(a) ? r.date
                                    : <button onClick={() => setModal({ type: "receipt", payload: { agreement: a, receipt: r } })} title="Edit this payment" className="hover:text-blue-700 hover:underline">{r.date}</button>}
                                </td>
                                <td className="px-3 py-1.5 text-right whitespace-nowrap text-emerald-700">
                                  {!r ? "" : isLocked(a) ? `${csym(a.currency)} ${fmt(r.amount)}`
                                    : <button onClick={() => setModal({ type: "receipt", payload: { agreement: a, receipt: r } })} title="Edit this payment" className="tabular-nums hover:underline">{csym(a.currency)} {fmt(r.amount)}</button>}
                                </td>
                                <td className={`px-3 py-1.5 text-right ${P ? "border-r border-slate-100" : ""}`}>
                                  {!r ? "" : isLocked(a) ? Number(r.rate).toFixed(2)
                                    : <button onClick={() => setModal({ type: "receipt", payload: { agreement: a, receipt: r } })} title="Edit this payment" className="tabular-nums hover:text-blue-700 hover:underline">{Number(r.rate).toFixed(2)}</button>}
                                </td>
                                {agParties.map((p, i) => {
                                  const cell = r ? (disbCells[r.id] || {})[p] : null;
                                  const many = cell && cell.ids.length > 1;
                                  const open = () => setModal({ type: "cellDisb", payload: { agreement: a, receipt: r, party: p, disbId: cell && !many ? cell.ids[0] : null } });
                                  return (
                                  <td key={p} title={!r ? undefined : cell ? `${p} — disbursement of ${fmt(cell.amount)} · paid ${fmt(cell.paid)} · ${cell.statuses.join(", ")}${many ? " · several records" : ""}. Click to edit.` : `No disbursement to ${p} against this payment. Click to add one.`} className={`px-2 py-1.5 text-right text-xs tabular-nums ${i === P - 1 ? "border-r border-slate-100 " : ""}${disbCellStyle(cell)}`}>
                                    {!r ? <span className="text-slate-200">—</span>
                                      : isLocked(a) ? <span className="inline-flex items-baseline justify-end gap-0.5 w-full"><span>{fmt(cell ? cell.paid : 0)}</span><span className="opacity-50">$</span></span>
                                      : <button onClick={open} className="inline-flex items-baseline justify-end gap-0.5 w-full rounded px-1 py-0.5 border border-transparent hover:border-slate-200 hover:bg-slate-50">
                                          <span>{fmt(cell ? cell.paid : 0)}</span>
                                          <span className="opacity-50">$</span>
                                        </button>}
                                  </td>);
                                })}
                                <td className="px-2 py-1.5 text-center">
                                  {!r ? (
                                    iv && iv.notes ? <span title={iv.notes} className="inline-flex items-center justify-center w-6 h-6 rounded-md border text-slate-400 border-slate-200"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span> : <span className="text-slate-200 text-xs">—</span>
                                  ) : isLocked(a) ? (
                                    r.comment ? <span title={r.comment} className="inline-flex items-center justify-center w-6 h-6 rounded-md border text-slate-400 border-slate-200"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span> : <span className="text-slate-200 text-xs">—</span>
                                  ) : rcptCommentEdit === r.id ? (
                                    <input autoFocus defaultValue={r.comment || ""} onBlur={(e) => { updateReceipt(a.id, r.id, { comment: e.target.value }); setRcptCommentEdit(null); }} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setRcptCommentEdit(null); }} placeholder="Comment…" className="w-32 border border-slate-200 rounded px-2 py-1 text-xs focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100" />
                                  ) : (
                                    <button onClick={() => setRcptCommentEdit(r.id)} title={r.comment || "Add comment"} className={`inline-flex items-center justify-center w-6 h-6 rounded-md border transition-colors ${r.comment ? "text-blue-600 border-blue-200 bg-blue-50" : "text-slate-300 border-slate-200 hover:text-slate-500 hover:border-slate-300"}`}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                    </button>
                                  )}
                                </td>
                              </tr>);
                            })}
                          </tbody>
                          <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                            <tr className="text-[11px] uppercase tracking-wider font-semibold text-slate-700">
                              <td colSpan={2} className="px-3 py-2 whitespace-nowrap">Total{Math.abs(outstanding) > 0.005 ? <span className={`ml-2 text-[10px] normal-case tracking-normal ${outstanding > 0.005 ? "text-rose-600" : "text-slate-400"}`}>· Outstanding {fmt(outstanding)}</span> : null}</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap border-r border-slate-200">{csym(a.currency)} {fmt(a.invoiced)}</td>
                              <td className="px-3 py-2 text-[10px] text-slate-400 normal-case tracking-normal">Received</td>
                              <td className="px-3 py-2 text-right whitespace-nowrap text-emerald-700">{csym(a.currency)} {fmt(a.received)}</td>
                              <td className={P ? "border-r border-slate-200" : ""}></td>
                              {agParties.map((p, i) => <td key={p} className={`px-2 py-2 text-right tabular-nums ${i === P - 1 ? "border-r border-slate-200" : ""}`}>{fmt(allocTotal(p))}</td>)}
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                        {P > 0 && <p className="mt-1.5 text-[10px] text-slate-400">The figure under each party name is the amount allocated to them. Amounts in the Allocations columns are what has actually been disbursed against that payment — grey while pending, light green when part-paid, green when settled. Click a figure to record or edit it; the party totals and the tiles above follow automatically.</p>}
                        </>
                          );
                        })()}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 items-center">
                        {isLocked(a) ? (<>
                          <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            {a.status === "Closed" && a.archived ? "Closed and archived" : a.archived ? "Archived" : "Closed"} — invoices, payments and parties are read-only.
                          </span>
                          <button onClick={() => ask(`Reopen "${a.title}"? Status returns to Ongoing${a.archived ? " and it is unarchived" : ""}, and records become editable again.`, () => reopenAgreement(a.id))} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg shadow-sm">↺ Reopen Agreement</button>
                        </>) : (<>
                        <button onClick={() => setModal({ type: "invoice", payload: { agreement: a, invoice: null } })} className="bg-slate-900 hover:bg-slate-700 text-white text-xs px-3 py-1.5 rounded-lg shadow-sm">+ Record Invoice</button>
                        <button onClick={() => setModal({ type: "receipt", payload: { agreement: a, receipt: null } })} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg shadow-sm">+ Record Payment Received</button>
                        <button onClick={() => setModal({ type: "disbursement", payload: { presetAgreement: a.id } })} className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-3 py-1.5 rounded-lg shadow-sm">+ Disburse from this Agreement</button>
                        </>)}
                        <button onClick={() => setModal({ type: "agreement", payload: a })} className="text-blue-700 text-xs px-2">Edit</button>
                        <button onClick={() => upsert("agreements", { ...data.agreements.find((x) => x.id === a.id), archived: !a.archived })} className="text-amber-700 text-xs px-2">{a.archived ? "Unarchive" : "Archive"}</button>
                        <button onClick={() => upsert("agreements", { ...data.agreements.find((x) => x.id === a.id), hidden: !a.hidden })} className="text-slate-600 text-xs px-2">{a.hidden ? "Unhide" : "Hide"}</button>
                        <button onClick={() => ask("Delete this agreement and its receipts? Linked disbursements remain.", () => remove("agreements", a.id))} className="text-rose-600 text-xs px-2">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "disbursements" && <DisbTab fDisb={fDisb} data={data} agNum={agNum} collapsedAg={collapsedAg} setCollapsedAg={setCollapsedAg} expanded={expanded} setExpanded={setExpanded} setModal={setModal} upsert={upsert} remove={remove} updateDisbPayment={updateDisbPayment} ask={ask} Badge={Badge} />}
        {tab === "parties" && <PartiesTab allPartyNames={allPartyNames} partyPick={partyPick} setPartyPick={setPartyPick} selectedParty={selectedParty} setSelectedParty={setSelectedParty} partyView={partyView} setPartyView={setPartyView} partyBalances={partyBalances} disbComputed={disbComputed} trComputed={trComputed} data={data} setModal={setModal} upsert={upsert} Badge={Badge} />}
        {tab === "transfers" && <TransfersTab fTr={fTr} setModal={setModal} remove={remove} ask={ask} />}
        {tab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PartyPanel data={data} save={save} addParty={addParty} ask={ask} orderParty={orderParty} />
            <AccountPanel data={data} save={save} addAccount={addAccount} ask={ask} />
            <CurrencyPanel data={data} addCurrency={addCurrency} save={save} ask={ask} />
            {isSuperAdmin && <ReleasePanel release={release} readOnly={readOnly} currentHost={pagePrint()} legacyHostOnly={legacyHostOnly} publishRelease={publishRelease} setEntryLock={setEntryLock} ask={ask} />}
            <UserPanel users={users} maxUsers={MAX_USERS} currentUser={currentUser} isSuperAdmin={isSuperAdmin} inviteUser={inviteUser} renameUser={renameUser} removeUser={removeUser} setUserPassword={setUserPassword} ask={ask} />
            <div>
              <h2 className="font-serif text-lg mb-4">Data</h2>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h3 className="text-sm font-semibold mb-2">Register Seed</h3>
                <p className="text-xs text-slate-500 mb-3">Load all agreements, received invoices, and per-party allocations. This replaces all current data.</p>
                <button onClick={loadRegister} className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg shadow-sm">Load / Reload Register Data</button>
              </div>
              <ImportPanel data={data} save={save} ask={ask} />
            </div>
          </div>
        )}

        {tab === "notes" && (
          <NotesPanel notes={data.notes || []} users={users} agreements={data.agreements} onAdd={() => setNoteModal({})} onEdit={(n) => setNoteModal(n)} onDelete={(id, label) => ask(`Delete this note${label ? ` (${label})` : ""}?`, () => removeNote(id))} />
        )}
      </div>
      </ErrorBoundary>

      {modal?.type === "agreement" && <AgreementForm initial={modal.payload} nextRef={nextRef} currencies={data.currencies} parties={data.parties} addParty={addParty}
        existingAllocs={Object.fromEntries(data.disbursements.filter((d) => modal.payload && d.agreementId === modal.payload.id).map((d) => [d.party, Number(d.amount || 0)]))}
        lockedParties={data.disbursements.filter((d) => modal.payload && d.agreementId === modal.payload.id && (d.payments || []).length > 0).map((d) => d.party)}
        onClose={() => setModal(null)} onSave={(a, allocs) => { saveAgreementWithAllocs(a, allocs); setModal(null); }} />}
      {modal?.type === "invoice" && <InvoiceForm agreement={modal.payload.agreement} initial={modal.payload.invoice} currencies={data.currencies} suggestedNumber={nextInvNumber(data.agreements, modal.payload.agreement)} suggestedFrom={numberBasis(data.agreements, modal.payload.agreement)} onClose={() => setModal(null)} onSave={(iv, addToValue) => { saveInvoice(modal.payload.agreement.id, iv, addToValue); setModal(null); }} onDelete={() => { const iv = modal.payload.invoice; const agId = modal.payload.agreement.id; setModal(null); ask(`Delete invoice ${iv.number || ""}? The agreement value is not adjusted back automatically.`, () => deleteInvoice(agId, iv.id)); }} />}
      {modal?.type === "receipt" && <MoneyForm title={modal.payload.receipt ? "Edit Payment" : `Payment Received — ${modal.payload.agreement.title}`} currency={modal.payload.agreement.currency} currencies={data.currencies} initial={modal.payload.receipt} verb="Receipt" invoices={modal.payload.agreement.invoices || []} receipts={modal.payload.agreement.receipts || []} summaryFor={({ amount, invoiceId, id }) => {
        const ag = data.agreements.find((x) => x.id === modal.payload.agreement.id) || modal.payload.agreement;
        const cur = ag.currency;
        const others = (ag.receipts || []).filter((q) => q.id !== id);
        const before = others.reduce((s, q) => s + Number(q.amount || 0), 0);
        const after = before + amount;
        const invoicedTot = (ag.invoices || []).reduce((s, q) => s + Number(q.amount || 0), 0);
        const out = invoicedTot - after;
        const rows = [
          { label: "Received before", value: `${csym(cur)} ${fmt(before)}` },
          { label: "Received after", value: `${csym(cur)} ${fmt(after)}`, bold: true },
          { label: "Invoiced", value: `${csym(cur)} ${fmt(invoicedTot)}` },
          out < -0.005
            ? { label: "Received beyond invoiced", value: `${csym(cur)} ${fmt(Math.abs(out))}`, bold: true, danger: true }
            : { label: "Outstanding after", value: `${csym(cur)} ${fmt(out)}`, bold: true },
        ];
        const iv = (ag.invoices || []).find((q) => q.id === invoiceId);
        if (iv) {
          const paidOther = others.filter((q) => q.invoiceId === iv.id).reduce((s, q) => s + Number(q.amount || 0), 0);
          const bal = Number(iv.amount || 0) - paidOther - amount;
          rows.push({ label: `Balance on ${iv.number || "invoice"}`, value: `${csym(cur)} ${fmt(bal)}`, bold: true, danger: bal < -0.005 });
        }
        return rows;
      }} onDelete={() => {
        const r = modal.payload.receipt; const agId = modal.payload.agreement.id; setModal(null);
        ask(`Delete this payment of ${csym(modal.payload.agreement.currency)} ${fmt(r.amount)} received on ${r.date}? Any allocations recorded against it are removed too.`, () => {
          const ag = data.agreements.find((x) => x.id === agId);
          if (ag) upsert("agreements", { ...ag, receipts: (ag.receipts || []).filter((q) => q.id !== r.id) });
        });
      }} onClose={() => setModal(null)} onSave={(r) => { if (blockLocked(modal.payload.agreement.id)) { setModal(null); return; } const ag = data.agreements.find((x) => x.id === modal.payload.agreement.id); const receipts = (ag.receipts || []).some((q) => q.id === r.id) ? ag.receipts.map((q) => (q.id === r.id ? r : q)) : [...(ag.receipts || []), r]; upsert("agreements", { ...ag, receipts }); setModal(null); }} />}
      {modal?.type === "disbursement" && <DisbursementForm initial={modal.payload.edit} presetAgreement={modal.payload.presetAgreement} agreements={data.agreements} disbursements={data.disbursements} currencies={data.currencies} parties={data.parties} addParty={addParty} onClose={() => setModal(null)} onSave={(d) => { if (blockLocked(d.agreementId)) { setModal(null); return; } upsert("disbursements", d); setModal(null); }} />}
      {modal?.type === "disbPayment" && <MoneyForm title={modal.payload.payment ? `Edit Payment to ${modal.payload.disb.party}` : `Payment to ${modal.payload.disb.party}`} currency={modal.payload.disb.currency} currencies={data.currencies} initial={modal.payload.payment} verb="Payment" summaryTitle="Effect on Disbursement" summaryFor={({ amount, id }) => {
        const dd = data.disbursements.find((x) => x.id === modal.payload.disb.id) || modal.payload.disb;
        const cur = dd.currency;
        const others = (dd.payments || []).filter((q) => q.id !== id);
        const before = others.reduce((s, q) => s + Number(q.amount || 0), 0);
        const after = before + amount;
        const due = Number(dd.amount || 0);
        const left = due - after;
        return [
          { label: "Paid before", value: `${csym(cur)} ${fmt(before)}` },
          { label: "Paid after", value: `${csym(cur)} ${fmt(after)}`, bold: true },
          { label: `Allocated to ${dd.party}`, value: `${csym(cur)} ${fmt(due)}` },
          left < -0.005
            ? { label: "Overpaid by", value: `${csym(cur)} ${fmt(Math.abs(left))}`, bold: true, danger: true }
            : { label: "Still to pay", value: `${csym(cur)} ${fmt(left)}`, bold: true },
        ];
      }} blockWhen={({ amount, id }) => {
        const dd = data.disbursements.find((x) => x.id === modal.payload.disb.id) || modal.payload.disb;
        const due = Number(dd.amount || 0);
        const before = (dd.payments || []).filter((q) => q.id !== id).reduce((s, q) => s + Number(q.amount || 0), 0);
        if (before + amount > due + 0.005) return `This would pay ${csym(dd.currency)} ${fmt(before + amount)} to ${dd.party}, exceeding the allocation of ${csym(dd.currency)} ${fmt(due)}. Increase the allocation for ${dd.party} first (edit the agreement's parties or the Allocated amount), then record this payment.`;
        return null;
      }} onDelete={() => {
        const pay = modal.payload.payment; const dId = modal.payload.disb.id; setModal(null);
        ask(`Delete this payment of ${csym(modal.payload.disb.currency)} ${fmt(pay.amount)} to ${modal.payload.disb.party}?`, () => {
          const dd = data.disbursements.find((x) => x.id === dId);
          if (dd) upsert("disbursements", { ...dd, payments: (dd.payments || []).filter((q) => q.id !== pay.id) });
        });
      }} onClose={() => setModal(null)} onSave={(p) => { if (blockLocked(modal.payload.disb.agreementId)) { setModal(null); return; } const dd = data.disbursements.find((x) => x.id === modal.payload.disb.id); const payments = (dd.payments || []).some((q) => q.id === p.id) ? dd.payments.map((q) => (q.id === p.id ? p : q)) : [...(dd.payments || []), p]; upsert("disbursements", { ...dd, payments }); setModal(null); }} />}
      {modal?.type === "cellDisb" && <CellDisbForm agreement={modal.payload.agreement} receipt={modal.payload.receipt} party={modal.payload.party} initial={modal.payload.disbId ? data.disbursements.find((x) => x.id === modal.payload.disbId) : null} currencies={data.currencies} allDisb={data.disbursements} onClose={() => setModal(null)}
        onSave={(dd) => { if (blockLocked(modal.payload.agreement.id)) { setModal(null); return; } upsert("disbursements", dd); setModal(null); }}
        onDelete={() => { const id = modal.payload.disbId; const party = modal.payload.party; setModal(null); ask(`Delete the disbursement to ${party} on this agreement? Payments recorded against it are removed too.`, () => remove("disbursements", id)); }} />}
      {modal?.type === "transfer" && <TransferForm initial={modal.payload.edit} presetFrom={modal.payload.presetFrom} parties={data.parties} accounts={data.accounts} currencies={data.currencies} addParty={addParty} addAccount={addAccount} onClose={() => setModal(null)} onSave={(t) => { upsert("transfers", t); setModal(null); }} />}

      {reportModal && <ReportModal allParties={allPartyNames} activeParties={Object.keys(partyBalances)} agreements={data.agreements} onClose={() => setReportModal(false)} onPreview={(list, agIds) => { setPreviewHtml(generatePrettyReport(list, true, agIds)); }} onGenerate={(which, list, agIds) => { if (which === "pretty" || which === "both") generatePrettyReport(list, false, agIds); if (which === "excel" || which === "both") exportExcel(list, agIds); setReportModal(false); }} />}

      {noteModal && <NoteModal preset={noteModal} users={users} agreements={data.agreements} currentUser={currentUser} onClose={() => setNoteModal(null)} onSave={(n) => { saveNote(n); setNoteModal(null); setNotice("Note saved — see the Notes tab."); }} />}

      {previewHtml && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex flex-col" onClick={() => setPreviewHtml(null)}>
          <div className="bg-white px-4 py-2.5 flex items-center justify-between shadow" onClick={(e) => e.stopPropagation()}>
            <span className="font-semibold text-slate-800 text-sm">Report Preview</span>
            <div className="flex gap-2">
              <button onClick={() => openOrSave(previewHtml, `Funds_Flow_Report_${new Date().toISOString().slice(0, 10)}.html`)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white">Open in new tab / Print</button>
              <button onClick={() => { if (saveFile(previewHtml, `Funds_Flow_Report_${new Date().toISOString().slice(0, 10)}.html`)) setNotice("Report downloaded."); }} className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700">Download</button>
              <button onClick={() => setPreviewHtml(null)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600">Close</button>
            </div>
          </div>
          <iframe title="report-preview" srcDoc={previewHtml} className="flex-1 w-full bg-white" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {notice && (
        <div className="no-print fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white text-xs px-4 py-3 rounded-lg shadow-2xl flex items-start gap-3">
          <span className="leading-relaxed">{notice}</span>
          <button onClick={() => setNotice("")} className="text-slate-400 hover:text-white shrink-0">✕</button>
        </div>
      )}

      {confirmState && (
        <Modal title="Please confirm" onClose={() => setConfirmState(null)}>
          <p className="text-sm text-slate-600 mb-5">{confirmState.message}</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConfirmState(null)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={() => { confirmState.onConfirm(); setConfirmState(null); }} className="px-4 py-2 text-sm rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-sm">Confirm</button>
          </div>
        </Modal>
      )}

      <div className={`no-print fixed right-6 z-40 flex flex-col items-center gap-2.5 transition-all duration-200 ${notice ? "bottom-24" : "bottom-6"}`}>
        {showTop && (
          <button
            onClick={scrollToTop}
            title="Back to top"
            aria-label="Back to top"
            className="w-11 h-11 rounded-full bg-slate-900 hover:bg-slate-700 text-white shadow-lg flex items-center justify-center transition-all duration-200 opacity-90 hover:opacity-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
        )}
        <button
          onClick={() => setNoteModal({})}
          title="Add a note"
          aria-label="Add a note"
          className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg flex items-center justify-center transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
    </div>
  );
}

function DisbTab({ fDisb, data, agNum, collapsedAg, setCollapsedAg, expanded, setExpanded, setModal, upsert, remove, updateDisbPayment, ask, Badge }) {
  return (
    <div>
      <div className="flex flex-wrap justify-between items-baseline gap-3 mb-6">
        <div>
          <h2 className="font-serif text-2xl text-slate-900 tracking-tight">Disbursements by Agreement</h2>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 mt-1">{fDisb.length} disbursements</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCollapsedAg(Object.fromEntries([...new Set(fDisb.map((d) => d.agreementId || "none"))].map((k) => [k, true])))} className="text-[10px] uppercase tracking-[0.14em] px-3 py-2 rounded-lg border border-slate-200 text-slate-600 bg-white hover:border-slate-400 transition-colors">Collapse all</button>
          <button onClick={() => setCollapsedAg({})} className="text-[10px] uppercase tracking-[0.14em] px-3 py-2 rounded-lg border border-slate-200 text-slate-600 bg-white hover:border-slate-400 transition-colors">Expand all</button>
          <button onClick={() => setModal({ type: "disbursement", payload: {} })} className="bg-slate-900 hover:bg-slate-700 text-white text-[11px] uppercase tracking-[0.14em] px-4 py-2 rounded-lg shadow-sm transition-colors">+ New Disbursement</button>
        </div>
      </div>
      {fDisb.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 shadow-sm">No disbursements match the current filters.</div>}
      {(() => {
        const groups = {};
        fDisb.forEach((d) => { const k = d.agreementId || "none"; (groups[k] = groups[k] || []).push(d); });
        const keys = Object.keys(groups).sort((x, y) => (agNum[x] || 999) - (agNum[y] || 999));
        return keys.map((k) => {
          const list = groups[k];
          const ag = data.agreements.find((a) => a.id === k);
          const agLock = isLocked(ag);
          const allocTot2 = list.reduce((s, d) => s + Number(d.amount || 0), 0);
          const paidTot = list.reduce((s, d) => s + d.paidUSD, 0);
          return (
            <div key={k} className="mb-6 shadow-sm rounded-xl">
              <div onClick={() => setCollapsedAg((c) => ({ ...c, [k]: !c[k] }))} className={`bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-3.5 ${collapsedAg[k] ? "rounded-xl" : "rounded-t-xl"} flex flex-wrap items-center gap-3 cursor-pointer hover:from-slate-800 hover:to-slate-700 transition-all`}>
                <span className="text-slate-400 text-xs w-3 shrink-0">{collapsedAg[k] ? "▸" : "▾"}</span>
                <span className="text-slate-400 tabular-nums text-sm w-6 shrink-0">{ag ? String(agNum[ag.id]).padStart(2, "0") : "—"}</span>
                <span className="text-base tracking-wide w-44 truncate shrink-0">{ag ? ag.title : "Unlinked"}</span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400 w-20 shrink-0">{list.length} {list.length === 1 ? "party" : "parties"}</span>
                <div className="ml-auto flex items-center gap-8 text-xs text-slate-300">
                  <span className="flex items-baseline gap-2"><span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Allocated</span><b className="text-white tabular-nums inline-block text-right" style={{ minWidth: "7.5rem" }}>$ {fmt(allocTot2)}</b></span>
                  <span className="flex items-baseline gap-2"><span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Paid</span><b className="text-white tabular-nums inline-block text-right" style={{ minWidth: "7.5rem" }}>$ {fmt(paidTot)}</b></span>
                  {agLock
                    ? <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-400 whitespace-nowrap"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Locked</span>
                    : <button onClick={(e) => { e.stopPropagation(); setModal({ type: "disbursement", payload: { presetAgreement: k === "none" ? "" : k } }); }} title="Add another party to this contract" className="border border-slate-600 hover:border-slate-300 hover:bg-slate-700 text-slate-200 text-[10px] uppercase tracking-[0.14em] px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap">+ Party</button>}
                </div>
              </div>
              {!collapsedAg[k] && (
              <div className="border border-t-0 border-slate-200 rounded-b-xl divide-y divide-slate-100 bg-white">
                {list.map((d) => (
                  <div key={d.id}>
                    <div className="px-4 py-2.5 flex flex-wrap items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpanded(expanded === d.id ? null : d.id)}>
                      <PartyName name={d.party} className="font-semibold w-36" />
                      <Badge s={d.paymentStatus} />
                      {d.feePercent ? <span className="text-[11px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-100">fee {d.feePercent}%</span> : null}
                      <div className="ml-auto flex items-center gap-4">
                        <div className="text-right leading-tight">
                          <div className="text-sm font-semibold text-slate-800 tabular-nums"><span className="text-slate-400 font-normal text-xs mr-1">{d.currency}</span>{fmt(d.amount)}</div>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5 text-[10px]">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 tabular-nums"><span className="uppercase tracking-wide opacity-70">Paid</span>{fmt(d.paid)}</span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded tabular-nums ${d.outstanding > 0.005 ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-400"}`}><span className="uppercase tracking-wide opacity-70">Due</span>{fmt(d.outstanding)}</span>
                          </div>
                        </div>
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] text-slate-400 hover:bg-slate-100 transition-transform ${expanded === d.id ? "rotate-180" : ""}`}>▼</span>
                      </div>
                    </div>
                    {expanded === d.id && (
                      <div className="px-4 pb-3 bg-slate-50/70">
                        {d.comment && <div className="text-xs text-slate-500 mb-2">💬 {d.comment}</div>}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm bg-white rounded-lg border border-slate-200 min-w-[680px] overflow-hidden">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-100">
                              <tr><th className="text-left px-3 py-1.5">Payment Date</th><th className="text-left px-3 py-1.5">Invoice #</th><th className="text-right px-3 py-1.5">Amount ({d.currency})</th><th className="text-right px-3 py-1.5">Rate → USD</th><th className="text-right px-3 py-1.5">USD Equivalent</th><th className="text-left px-3 py-1.5">Comment</th><th></th></tr>
                            </thead>
                            <tbody>
                              {(d.payments || []).length === 0 && <tr><td colSpan={7} className="px-3 py-3 text-center text-slate-400 text-xs">No payments made yet.</td></tr>}
                              {(d.payments || []).map((p) => (
                                <tr key={p.id} className="border-t border-slate-100">
                                  <td className="px-3 py-1.5 whitespace-nowrap">{p.date}</td>
                                  <td className="px-3 py-1.5"><input defaultValue={p.invoiceNo || ""} onBlur={(e) => updateDisbPayment(d.id, p.id, { invoiceNo: e.target.value })} readOnly={agLock} placeholder="Inv #" className={`w-24 rounded px-1 py-0.5 text-xs border ${agLock ? "border-transparent bg-transparent text-slate-500 cursor-not-allowed" : "border-transparent hover:border-slate-200 focus:border-slate-300"}`} /></td>
                                  <td className="px-3 py-1.5 text-right">{csym(d.currency)} {fmt(p.amount)}</td>
                                  <td className="px-3 py-1.5 text-right">{Number(p.rate).toFixed(4)}</td>
                                  <td className="px-3 py-1.5 text-right font-medium">$ {fmt(p.amount * p.rate)}</td>
                                  <td className="px-3 py-1.5"><input defaultValue={p.notes || ""} onBlur={(e) => updateDisbPayment(d.id, p.id, { notes: e.target.value })} readOnly={agLock} placeholder={agLock ? "" : "…"} className={`w-32 rounded px-1 py-0.5 text-xs border ${agLock ? "border-transparent bg-transparent text-slate-500 cursor-not-allowed" : "border-transparent hover:border-slate-200 focus:border-slate-300"}`} /></td>
                                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                    {agLock ? <span className="text-slate-200 text-xs">—</span> : (<>
                                    <button onClick={() => setModal({ type: "disbPayment", payload: { disb: d, payment: p } })} className="text-blue-700 text-xs mr-2">Edit</button>
                                    <button onClick={() => upsert("disbursements", { ...data.disbursements.find((x) => x.id === d.id), payments: d.payments.filter((q) => q.id !== p.id) })} className="text-rose-600 text-xs">Del</button>
                                    </>)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 items-center">
                          {agLock ? (<>
                            <span className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5">Contract is closed or archived — reopen it under Agreements &amp; Receipts to edit this allocation.</span>
                            <button onClick={() => setModal({ type: "transfer", payload: { presetFrom: d.party } })} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg shadow-sm">+ Onward Transfer from {d.party}</button>
                          </>) : (<>
                          <button onClick={() => setModal({ type: "disbPayment", payload: { disb: d, payment: null } })} className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-3 py-1.5 rounded-lg shadow-sm">+ Record Payment to {d.party}</button>
                          <button onClick={() => setModal({ type: "transfer", payload: { presetFrom: d.party } })} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg shadow-sm">+ Onward Transfer from {d.party}</button>
                          <button onClick={() => setModal({ type: "disbursement", payload: { edit: d } })} className="text-blue-700 text-xs px-2">Edit</button>
                          <button onClick={() => ask("Delete this disbursement and its payments?", () => remove("disbursements", d.id))} className="text-rose-600 text-xs px-2">Delete</button>
                          </>)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              )}
            </div>
          );
        });
      })()}
    </div>
  );
}

function PartiesTab({ allPartyNames, partyPick, setPartyPick, selectedParty, setSelectedParty, partyView, setPartyView, partyBalances, disbComputed, trComputed, data, setModal, upsert, Badge }) {
  const partyRows = allPartyNames.filter((p) => partyPick.length === 0 || partyPick.includes(p)).map((p) => {
    const b = partyBalances[p] || { inUSD: 0, outUSD: 0 };
    return { name: p, ...b, holding: b.inUSD - b.outUSD, disbCount: disbComputed.filter((d) => d.party === p).length, trCount: trComputed.filter((t) => t.fromParty === p).length };
  });

  if (selectedParty) {
    const b = partyBalances[selectedParty] || { inUSD: 0, outUSD: 0 };
    const stRows = [
      ...disbComputed.filter((d) => d.party === selectedParty).flatMap((d) => (d.payments || []).map((p) => ({ date: p.date, kind: "in", desc: `Received — ${d.agreementTitle}${d.description ? ` · ${d.description}` : ""}`, currency: d.currency, amount: Number(p.amount), usd: Number(p.amount) * Number(p.rate), comment: p.notes || "" }))),
      ...trComputed.filter((t) => t.fromParty === selectedParty).map((t) => ({ date: t.date, kind: "out", desc: `Transfer out — ${t.accountName} (${t.accountCurrency}) · ${t.payType}`, currency: t.currency, amount: Number(t.amount), usd: t.usd, comment: t.notes || "" })),
    ].sort((a, b2) => (a.date || "").localeCompare(b2.date || ""));
    let run = 0;
    const stWithBal = stRows.map((r) => { run += r.kind === "in" ? r.usd : -r.usd; return { ...r, balance: run }; });
    const feeRows = disbComputed.filter((d) => d.party === selectedParty).map((d) => {
      // What arises for this party under the agreement, less the service fee, less what
      // has already been paid out to them — the remainder is what is still due.
      const received = Number(d.amount || 0) * Number(defaultRate(d.currency, data.currencies) || 1);
      const paid = d.paidUSD;
      const feePct = Number(d.feePercent || 0); const fee = received * feePct / 100;
      return { id: d.id, agreement: d.agreementTitle, status: d.paymentStatus, received, feePct, fee, paid, net: received - fee - paid, comment: d.comment, payments: d.payments || [], raw: d, locked: isLocked(data.agreements.find((x) => x.id === d.agreementId)) };
    });
    const feeTot = feeRows.reduce((a, r) => ({ received: a.received + r.received, fee: a.fee + r.fee, paid: a.paid + r.paid, net: a.net + r.net }), { received: 0, fee: 0, paid: 0, net: 0 });
    const assocAccounts = [...data.accounts].sort((a, b) => orderName(a.name, b.name)).map((acc) => {
      const ts = trComputed.filter((t) => t.fromParty === selectedParty && t.accountId === acc.id);
      if (!ts.length) return null;
      return { ...acc, count: ts.length, usd: ts.reduce((s, t) => s + t.usd, 0), last: ts.map((t) => t.date).sort().pop() };
    }).filter(Boolean);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setSelectedParty(null)} className="text-sm text-blue-700 hover:text-blue-900">← All Parties</button>
          <h2 className="font-serif text-xl text-slate-900">{selectedParty}{selectedParty === "O. Dev" && <span className="block text-xs italic text-slate-400 font-normal">(NOT Service Fee)</span>}</h2>
        </div>
        <div className="flex gap-1 border-b border-slate-200">
          {[["receipts", "Agreement Receipts"], ["remittance", `Onwards Remittances (From ${selectedParty})`]].map(([k, l]) => (
            <button key={k} onClick={() => setPartyView(k)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${partyView === k ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{l}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {[
            { l: "Received (USD)", v: feeTot.received, c: "text-emerald-700", bar: "bg-emerald-500" },
            { l: "Service Fees (USD)", v: feeTot.fee, c: "text-rose-600", bar: "bg-rose-500" },
            { l: "Total Paid (USD)", v: feeTot.paid, c: "text-emerald-600", bar: "bg-emerald-300" },
            { l: "Net Due (USD)", v: feeTot.net, c: "text-slate-900", bar: "bg-slate-700" },
            { l: "Remitted Onward (USD)", v: b.outUSD, c: "text-blue-700", bar: "bg-blue-500" },
          ].map((x) => (
            <div key={x.l} className="relative bg-white rounded-lg shadow-sm border border-slate-200 px-3 py-2.5 overflow-hidden">
              <span className={`absolute top-0 left-0 right-0 h-0.5 ${x.bar}`}></span>
              <p className="text-[9px] uppercase tracking-[0.16em] text-slate-400 font-medium truncate">{x.l}</p>
              <p className={`text-base font-medium mt-0.5 tabular-nums ${Number(x.v) < -0.005 ? "text-rose-600" : x.c}`}>$ {fmt(x.v)}</p>
            </div>
          ))}
        </div>
        {partyView === "receipts" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-2 border-b border-slate-200 font-semibold text-sm">Agreement Receipts &amp; Service Fees</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-slate-800 text-white text-xs uppercase">
                  <tr><th className="text-left px-4 py-2.5">Agreement</th><th className="text-left px-4 py-2.5">Status</th><th className="text-right px-4 py-2.5">Amount Received (USD)</th><th className="text-right px-4 py-2.5">Fee %</th><th className="text-right px-4 py-2.5">Service Fee (USD)</th><th className="text-right px-4 py-2.5">Paid (USD)</th><th className="text-right px-4 py-2.5">Total Due (USD)</th><th className="text-left px-4 py-2.5">Comments</th><th className="px-4 py-2.5"></th></tr>
                </thead>
                <tbody>
                  {feeRows.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-400">No agreement allocations to this party.</td></tr>}
                  {feeRows.map((r) => (
                    <Fragment key={r.id}>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td className="px-4 py-2 font-medium">{r.agreement}</td>
                        <td className="px-4 py-2"><Badge s={r.status} /></td>
                        <td className="px-4 py-2 text-right">{fmt(r.received)}</td>
                        <td className="px-4 py-2 text-right">{r.locked ? <span className="text-slate-500 text-xs tabular-nums">{r.feePct}</span> : <input type="number" step="0.1" defaultValue={r.feePct} onBlur={(e) => upsert("disbursements", { ...r.raw, feePercent: Number(e.target.value) })} className="w-16 border border-slate-300 rounded px-1 py-0.5 text-right text-xs" />}</td>
                        <td className="px-4 py-2 text-right text-rose-600">{r.fee ? `(${fmt(r.fee)})` : fmt(0)}</td>
                        <td className={`px-4 py-2 text-right tabular-nums ${r.paid > 0.005 ? "text-emerald-700" : "text-slate-300"}`}>{fmt(r.paid)}</td>
                        <td className={`px-4 py-2 text-right font-semibold tabular-nums ${r.net > 0.005 ? "text-slate-900" : r.net < -0.005 ? "text-rose-600" : "text-slate-300"}`}>{fmt(r.net)}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">{r.comment}</td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          {r.locked ? <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400" title="Contract closed or archived — reopen it to edit"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Locked</span> : (<>
                          <button onClick={() => setModal({ type: "disbPayment", payload: { disb: r.raw, payment: null } })} className="text-emerald-700 text-xs mr-2">+ Txn</button>
                          <button onClick={() => setModal({ type: "disbursement", payload: { edit: r.raw } })} className="text-blue-700 text-xs">Edit</button>
                          </>)}
                        </td>
                      </tr>
                      {r.payments.map((p) => (
                        <tr key={p.id} className="border-t border-slate-100 text-xs text-slate-600">
                          <td className="px-4 py-1.5 pl-8" colSpan={2}>↳ {p.notes || "Transaction"} <span className="text-slate-400">· {p.date}</span></td>
                          <td colSpan={3}></td>
                          <td className="px-4 py-1.5 text-right tabular-nums">{fmt(Number(p.amount) * Number(p.rate))}</td>
                          <td></td>
                          <td className="px-4 py-1.5 text-slate-400">{p.notes}</td>
                          <td className="px-4 py-1.5 text-right">{r.locked ? <span className="text-slate-200">—</span> : <button onClick={() => setModal({ type: "disbPayment", payload: { disb: r.raw, payment: p } })} className="text-blue-700">Edit</button>}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  {feeRows.length > 0 && (
                    <tr className="bg-blue-50 font-bold border-t-2 border-slate-400">
                      <td className="px-4 py-2.5" colSpan={2}>TOTAL</td>
                      <td className="px-4 py-2.5 text-right">{fmt(feeTot.received)}</td>
                      <td></td>
                      <td className="px-4 py-2.5 text-right text-rose-600">({fmt(feeTot.fee)})</td>
                      <td className="px-4 py-2.5 text-right text-emerald-700 tabular-nums">{fmt(feeTot.paid)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${feeTot.net > 0.005 ? "text-slate-900" : feeTot.net < -0.005 ? "text-rose-600" : "text-slate-400"}`}>{fmt(feeTot.net)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {partyView === "remittance" && (<>
          <div className="flex justify-end"><button onClick={() => setModal({ type: "transfer", payload: { presetFrom: selectedParty } })} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg shadow-sm">+ Onwards Remittance from {selectedParty}</button></div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-2 border-b border-slate-200 font-semibold text-sm">Associated Accounts</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-5 py-2">Account</th><th className="text-left px-5 py-2">Currency</th><th className="text-right px-5 py-2">Transfers</th><th className="text-right px-5 py-2">Total Sent (USD)</th><th className="text-left px-5 py-2">Last Transfer</th></tr></thead>
                <tbody>
                  {assocAccounts.length === 0 && <tr><td colSpan={5} className="px-5 py-5 text-center text-slate-400">No transfers to accounts yet from this party.</td></tr>}
                  {assocAccounts.map((a) => (<tr key={a.id} className="border-t border-slate-100"><td className="px-5 py-2 font-medium">{a.name}</td><td className="px-5 py-2">{a.currency}</td><td className="px-5 py-2 text-right">{a.count}</td><td className="px-5 py-2 text-right">{fmt(a.usd)}</td><td className="px-5 py-2">{a.last}</td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-2 border-b border-slate-200 font-semibold text-sm">Full Statement (USD)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-5 py-2">Date</th><th className="text-left px-5 py-2">Description</th><th className="text-right px-5 py-2">In (USD)</th><th className="text-right px-5 py-2">Out (USD)</th><th className="text-right px-5 py-2">Balance (USD)</th><th className="text-left px-5 py-2">Comment</th></tr></thead>
                <tbody>
                  {stWithBal.length === 0 && <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-400">No movements yet for this party.</td></tr>}
                  {stWithBal.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-2 whitespace-nowrap">{r.date}</td>
                      <td className="px-5 py-2">{r.desc} <span className="text-xs text-slate-400">({r.currency} {fmt(r.amount)})</span></td>
                      <td className="px-5 py-2 text-right text-emerald-700">{r.kind === "in" ? "$ " + fmt(r.usd) : ""}</td>
                      <td className="px-5 py-2 text-right text-blue-700">{r.kind === "out" ? "$ " + fmt(r.usd) : ""}</td>
                      <td className="px-5 py-2 text-right font-medium">$ {fmt(r.balance)}</td>
                      <td className="px-5 py-2 text-xs text-slate-500">{r.comment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-serif text-lg mr-2">Parties ({partyRows.length})</h2>
        <span className="text-xs text-slate-500">Filter:</span>
        {allPartyNames.map((p) => (
          <button key={p} onClick={() => setPartyPick(partyPick.includes(p) ? partyPick.filter((x) => x !== p) : [...partyPick, p])} className={`px-3 py-1 rounded-full text-xs border transition-colors ${partyPick.includes(p) ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"}`}>{p}</button>
        ))}
        {partyPick.length > 0 && <button onClick={() => setPartyPick([])} className="text-xs text-blue-700 underline">Show all</button>}
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-5 py-2.5">Party</th><th className="text-right px-5 py-2.5">Disbursements</th><th className="text-right px-5 py-2.5">Received (USD)</th><th className="text-right px-5 py-2.5">Paid Onward (USD)</th><th className="text-right px-5 py-2.5">Holding (USD)</th><th className="text-right px-5 py-2.5">Transfers</th><th></th></tr></thead>
          <tbody>
            {partyRows.length === 0 && <tr><td colSpan={7} className="px-5 py-6 text-center text-slate-400">No parties yet.</td></tr>}
            {partyRows.map((p) => (
              <tr key={p.name} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setSelectedParty(p.name)}>
                <td className="px-5 py-2.5 font-medium text-blue-800"><PartyName name={p.name} /></td>
                <td className="px-5 py-2.5 text-right">{p.disbCount}</td>
                <td className="px-5 py-2.5 text-right text-emerald-700">{fmt(p.inUSD)}</td>
                <td className="px-5 py-2.5 text-right text-blue-700">{fmt(p.outUSD)}</td>
                <td className="px-5 py-2.5 text-right font-medium">{fmt(p.holding)}</td>
                <td className="px-5 py-2.5 text-right">{p.trCount}</td>
                <td className="px-5 py-2.5 text-right text-xs text-slate-400">View statement →</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransfersTab({ fTr, setModal, remove, ask }) {
  return (
    <div>
      <div className="flex flex-wrap justify-between items-baseline gap-3 mb-6">
        <div>
          <h2 className="font-serif text-2xl text-slate-900 tracking-tight">Onward Transfers</h2>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 mt-1">Party → Account · {fTr.length} transfers</p>
        </div>
        <button onClick={() => setModal({ type: "transfer", payload: {} })} className="bg-slate-900 hover:bg-slate-700 text-white text-[11px] uppercase tracking-[0.14em] px-4 py-2 rounded-lg shadow-sm transition-colors">+ New Transfer</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr>{["Date", "From Party", "To Account", "Partial/Full", "Currency", "Amount", "Rate → USD", "USD Equivalent", "Comment", ""].map((h) => <th key={h} className="text-left px-4 py-2.5">{h}</th>)}</tr></thead>
          <tbody>
            {fTr.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-400">No transfers match the current filters.</td></tr>}
            {fTr.map((t) => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2">{t.date}</td>
                <td className="px-4 py-2 font-medium"><PartyName name={t.fromParty} /></td>
                <td className="px-4 py-2">{t.accountName} <span className="text-xs text-slate-400">({t.accountCurrency})</span></td>
                <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${t.payType === "Full" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-amber-50 text-amber-700 ring-amber-600/20"}`}>{t.payType}</span></td>
                <td className="px-4 py-2">{t.currency}</td>
                <td className="px-4 py-2 text-right">{csym(t.currency)} {fmt(t.amount)}</td>
                <td className="px-4 py-2 text-right">{Number(t.rate).toFixed(4)}</td>
                <td className="px-4 py-2 text-right font-medium">$ {fmt(t.usd)}</td>
                <td className="px-4 py-2 text-slate-500 text-xs">{t.notes}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <button onClick={() => setModal({ type: "transfer", payload: { edit: t } })} className="text-blue-700 text-xs mr-3">Edit</button>
                  <button onClick={() => ask("Delete this transfer?", () => remove("transfers", t.id))} className="text-rose-600 text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuthScreen({ users, addUser, tryLogin, resetPassword }) {
  const hasUsers = users.length > 0;
  // Self-registration is disabled. Only the initial Super Admin bootstrap
  // (when no accounts exist yet), signing in, and self-service password reset
  // remain — every other account is created by the Super Admin in Settings.
  const [mode, setMode] = useState(hasUsers ? "signin" : "firstSetup");
  const [userId, setUserId] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const QUESTIONS = ["What was the name of your first pet?", "In what city were you born?", "What is your mother's maiden name?", "What was the name of your first school?", "What is your favorite book?", "Custom…"];
  const [qChoice, setQChoice] = useState(QUESTIONS[0]);
  const [question, setQuestion] = useState(QUESTIONS[0]);
  const [answer, setAnswer] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const resetForm = () => { setUserId(""); setPw(""); setPw2(""); setAnswer(""); setNewPw(""); setNewPw2(""); setErr(""); };
  const goto = (m) => { resetForm(); setMode(m); };
  const target = users.find((u) => u.userId.toLowerCase() === userId.trim().toLowerCase());
  const needsCreds = mode === "firstSetup";
  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (mode === "signin") {
        if (!userId || !pw) { setErr("Enter your user ID and password."); return; }
        const res = await tryLogin(userId.trim(), pw);
        if (!res.ok) setErr(res.error);
      } else if (mode === "firstSetup") {
        if (!userId.trim()) { setErr("Choose a user ID."); return; }
        if (pw.length < 6) { setErr("Password must be at least 6 characters."); return; }
        if (pw !== pw2) { setErr("Passwords do not match."); return; }
        if (!question.trim() || !answer.trim()) { setErr("Pick a security question and answer."); return; }
        const res = await addUser(userId.trim(), pw, question.trim(), answer);
        if (!res.ok) setErr(res.error);
      } else if (mode === "reset") {
        if (!userId || !answer) { setErr("Enter your user ID and answer."); return; }
        if (newPw.length < 6) { setErr("New password must be at least 6 characters."); return; }
        if (newPw !== newPw2) { setErr("Passwords do not match."); return; }
        const res = await resetPassword(userId.trim(), answer, newPw);
        if (!res.ok) setErr(res.error);
      }
    } finally { setBusy(false); }
  };
  const subtitle = mode === "firstSetup" ? "Super Admin Setup" : mode === "reset" ? "Reset Password" : "Secure Sign-in";
  const cta = mode === "reset" ? "RESET PASSWORD" : mode === "firstSetup" ? "CREATE & SIGN IN" : "SIGN IN";
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-950 to-slate-900 text-white p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-md border border-slate-600 flex items-center justify-center font-serif text-lg tracking-widest">X</div>
          <div><h1 className="font-serif text-lg tracking-wide">XYZ Financial Report</h1><p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{subtitle}</p></div>
        </div>
        <div className="p-6">
          {mode === "firstSetup" && <p className="text-xs text-slate-500 mb-4">Set up the Super Admin account — yours, and the only one. All further user IDs (and their passwords) are created by you in Settings; there is no self-registration.</p>}
          {mode === "reset" && <p className="text-xs text-slate-500 mb-4">Enter your user ID, then answer your security question to set a new password. If no security question was set, ask the Super Admin to set a new password for you.</p>}
          <label className="block mb-3"><span className="block text-xs font-medium text-slate-600 mb-1">User ID</span><input autoFocus value={userId} onChange={(e) => setUserId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100" placeholder="e.g. AL1409" /></label>
          {mode === "reset" ? (<>
            <div className="block mb-3"><span className="block text-xs font-medium text-slate-600 mb-1">Security Question</span><div className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-700 min-h-[38px]">{target?.question || (userId ? "(no security question on file — ask the Super Admin)" : "Enter user ID first")}</div></div>
            <label className="block mb-3"><span className="block text-xs font-medium text-slate-600 mb-1">Your Answer</span><input value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></label>
            <label className="block mb-3"><span className="block text-xs font-medium text-slate-600 mb-1">New Password</span><input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></label>
            <label className="block mb-3"><span className="block text-xs font-medium text-slate-600 mb-1">Confirm New Password</span><input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></label>
          </>) : (<>
            <label className="block mb-3"><span className="block text-xs font-medium text-slate-600 mb-1">Password</span><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></label>
            {needsCreds && (<>
              <label className="block mb-3"><span className="block text-xs font-medium text-slate-600 mb-1">Confirm Password</span><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></label>
              <label className="block mb-3"><span className="block text-xs font-medium text-slate-600 mb-1">Security Question</span><select value={qChoice} onChange={(e) => { setQChoice(e.target.value); if (e.target.value !== "Custom…") setQuestion(e.target.value); else setQuestion(""); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2">{QUESTIONS.map((q) => <option key={q}>{q}</option>)}</select>{qChoice === "Custom…" && <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Your security question" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />}</label>
              <label className="block mb-3"><span className="block text-xs font-medium text-slate-600 mb-1">Your Answer</span><input value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></label>
            </>)}
          </>)}
          {err && <p className="text-xs text-rose-600 mb-3">{err}</p>}
          <button disabled={busy} onClick={submit} className="w-full bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg tracking-wide shadow-sm">{busy ? "…" : cta}</button>
          {hasUsers && mode === "reset" && (<div className="mt-4 text-xs text-center">
            <button onClick={() => goto("signin")} className="text-slate-500 hover:underline">← Back to sign in</button>
          </div>)}
          {hasUsers && mode === "signin" && (<div className="mt-4 text-xs text-center">
            <button onClick={() => goto("reset")} className="text-blue-700 hover:underline">Forgot password?</button>
          </div>)}
          <p className="text-[10px] text-slate-400 mt-4 text-center">Local lock screen · passwords &amp; answers hashed (SHA-256)</p>
        </div>
      </div>
    </div>
  );
}

function ReleasePanel({ release, readOnly, currentHost, legacyHostOnly, publishRelease, setEntryLock, ask }) {
  const bump = (v) => {
    const m = /^v?(\d+)\.(\d+)$/.exec((v || "").trim());
    return m ? `v${m[1]}.${Number(m[2]) + 1}` : "v1.0";
  };
  const [version, setVersion] = useState(APP_VERSION || (release ? bump(release.version) : "v1.0"));
  const unrecorded = !release || release.version !== APP_VERSION;
  const [includeData, setIncludeData] = useState(false);
  const [busy, setBusy] = useState(false);
  const stamp = (t) => (t ? new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const go = () => {
    ask(
      includeData
        ? `Release ${version} and overwrite the stored records with the data in this session? Data entry will then be locked to this page.`
        : `Release ${version}? Existing records are left untouched, and data entry will be locked to this page.`,
      async () => { setBusy(true); try { await publishRelease(version, includeData); } finally { setBusy(false); } }
    );
  };
  return (
    <div>
      <h2 className="font-serif text-lg mb-4">Release</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
        <div className="grid grid-cols-2 gap-3 text-xs mb-4 pb-4 border-b border-slate-100">
          <div><span className="block text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-0.5">Current release</span><span className="text-slate-800 font-medium">{release?.version || "Not released"}</span><span className="block text-[10px] text-slate-400">this build: {APP_VERSION}</span></div>
          <div><span className="block text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-0.5">Released</span><span className="text-slate-800">{stamp(release?.publishedAt)}</span></div>
          <div><span className="block text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-0.5">By</span><span className="text-slate-800">{release?.publishedBy || "—"}</span></div>
          <div><span className="block text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-0.5">Code build</span><span className="text-slate-800 tabular-nums">{BUILD}</span></div>
          <div><span className="block text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-0.5">Data entry</span>
            {release?.locked
              ? <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset ${readOnly ? "bg-amber-50 text-amber-700 ring-amber-600/20" : "bg-emerald-50 text-emerald-700 ring-emerald-600/20"}`}><span className={`w-1.5 h-1.5 rounded-full ${readOnly ? "bg-amber-500" : "bg-emerald-500"}`}></span>{readOnly ? "Locked elsewhere" : "Open on this page"}</span>
              : <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset bg-slate-100 text-slate-600 ring-slate-500/20"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Open everywhere</span>}
          </div>
        </div>
        {legacyHostOnly && (
          <p className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
            Release <b>{release.version}</b> recorded the domain only (<span className="break-all">{release.host}</span>), which the preview and the published page share — so it cannot tell them apart. Publish again from the published page to record the full address.
          </p>
        )}
        <p className="text-xs text-slate-500 mb-3">Publishing the <b>code</b> is done with the Publish button in the Claude artifact toolbar. This records the release and decides where records may be edited — structural changes never touch your stored data.</p>
        {unrecorded && (
          <p className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
            This build is <b>{APP_VERSION}</b>{release ? <> but the recorded release is <b>{release.version}</b></> : <> and nothing has been recorded yet</>}. Publish the code from the artifact toolbar first, then press the button below to record it.
          </p>
        )}
        <div className="flex flex-wrap gap-2 items-end mb-3">
          <label className="block"><span className="block text-xs text-slate-500 mb-1">Version</span><input value={version} onChange={(e) => setVersion(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-28" placeholder="v1.1" /></label>
          <label className="block flex-1 min-w-[200px]"><span className="block text-xs text-slate-500 mb-1">This page</span><div className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 text-slate-500 truncate" title={currentHost}>{currentHost}</div></label>
        </div>
        <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
          <input type="checkbox" checked={includeData} onChange={(e) => setIncludeData(e.target.checked)} className="mt-0.5 w-4 h-4 accent-rose-600" />
          <span className="text-xs text-slate-600">Also push the data currently loaded in this session <span className="block text-[11px] text-slate-400">Leave unticked to publish structure only and keep every existing record exactly as it is. Tick it to overwrite stored records with what you see now.</span></span>
        </label>
        <button disabled={busy} onClick={go} className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg shadow-sm tracking-wide">{busy ? "…" : `PUBLISH ${version}`}</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-semibold mb-1">Data entry lock</h3>
        <p className="text-xs text-slate-500 mb-3">{release?.locked ? "Only the page recorded at release time can write. Other copies are read-only." : "Any copy of the app can currently write to the shared records."}</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEntryLock(true)} className="bg-slate-900 hover:bg-slate-700 text-white text-xs px-3 py-2 rounded-lg shadow-sm">Lock entry to this page</button>
          <button onClick={() => ask("Unlock data entry? Any copy of the app will be able to edit records again.", () => setEntryLock(false))} disabled={!release?.locked} className="border border-slate-300 disabled:opacity-40 text-slate-600 text-xs px-3 py-2 rounded-lg">Unlock everywhere</button>
        </div>
        <p className="text-[10px] text-slate-400 mt-3">If you ever lock yourself out, sign in as Super Admin on the page that still has access and unlock from here.</p>
      </div>
    </div>
  );
}

function UserPanel({ users, maxUsers, currentUser, isSuperAdmin, inviteUser, renameUser, removeUser, setUserPassword, ask }) {
  const QUESTIONS = ["What was the name of your first pet?", "In what city were you born?", "What is your mother's maiden name?", "What was the name of your first school?", "What is your favorite book?", "Custom…"];
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [qChoice, setQChoice] = useState(QUESTIONS[0]);
  const [question, setQuestion] = useState(QUESTIONS[0]);
  const [answer, setAnswer] = useState("");
  const [editing, setEditing] = useState(null);
  const [pwFor, setPwFor] = useState(null);     // userId whose password is being set
  const [pwValue, setPwValue] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const canAdd = isSuperAdmin && users.length < maxUsers;
  const canRename = (u) => isSuperAdmin || u.userId === currentUser;
  const resetForm = () => { setUserId(""); setNewName(""); setNewPw(""); setNewPw2(""); setAnswer(""); setQChoice(QUESTIONS[0]); setQuestion(QUESTIONS[0]); setErr(""); };
  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (!userId.trim()) { setErr("Choose a user ID."); return; }
      if (newPw.length < 6) { setErr("Set a password of at least 6 characters."); return; }
      if (newPw !== newPw2) { setErr("Passwords do not match."); return; }
      const res = await inviteUser(userId.trim(), newName, newPw, question.trim(), answer);
      if (!res.ok) { setErr(res.error); return; }
      resetForm(); setShowForm(false);
    } finally { setBusy(false); }
  };
  const savePassword = async () => {
    setPwErr("");
    if (pwValue.length < 6) { setPwErr("Password must be at least 6 characters."); return; }
    const res = await setUserPassword(pwFor, pwValue);
    if (!res.ok) { setPwErr(res.error); return; }
    setPwFor(null); setPwValue("");
  };
  const saveName = () => { if (editing) renameUser(editing.userId, editing.name); setEditing(null); };
  return (
    <div>
      <h2 className="font-serif text-lg mb-4">Users ({users.length}/{maxUsers})</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">User ID <span className="normal-case text-[10px] tracking-normal text-slate-400">(fixed)</span></th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-400">No users.</td></tr>}
            {users.map((u) => (
              <tr key={u.userId} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  {editing && editing.userId === u.userId ? (
                    <span className="flex gap-1 items-center">
                      <input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditing(null); }} placeholder="Display name" className="border border-slate-300 rounded px-2 py-1 text-sm w-40 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100" />
                      <button onClick={saveName} className="text-emerald-700 text-xs">Save</button>
                      <button onClick={() => setEditing(null)} className="text-slate-400 text-xs">✕</button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className={u.name ? "font-medium text-slate-800" : "text-slate-300 italic"}>{u.name || "No name set"}</span>
                      {u.userId === currentUser && <span className="text-[10px] uppercase tracking-wide text-emerald-700">You</span>}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-1.5 text-slate-600" title="The user ID / email is the login credential and cannot be changed">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 shrink-0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span className="tabular-nums">{u.userId}</span>
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${u.role === SUPER ? "bg-slate-900 text-white ring-slate-900" : "bg-slate-100 text-slate-600 ring-slate-500/20"}`}>{roleLabel(u.role)}</span>
                </td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-600/20"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Active</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">{u.question ? "Reset Q: " + u.question : "No reset question"}</span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {canRename(u) && (!editing || editing.userId !== u.userId) && <button onClick={() => setEditing({ userId: u.userId, name: u.name || "" })} className="text-blue-700 text-xs mr-3">Rename</button>}
                  {isSuperAdmin && u.userId !== currentUser && u.role !== SUPER ? (<>
                    <button onClick={() => { setPwFor(pwFor === u.userId ? null : u.userId); setPwValue(""); setPwErr(""); }} className="text-amber-700 text-xs mr-3">{pwFor === u.userId ? "Cancel" : "Set password"}</button>
                    <button onClick={() => ask(`Remove "${u.name || u.userId}" (${u.userId})? They will lose access.`, () => removeUser(u.userId))} className="text-rose-600 text-xs">Remove</button>
                  </>) : (!canRename(u) && <span className="text-xs text-slate-300">—</span>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isSuperAdmin && pwFor && (() => {
        const u = users.find((x) => x.userId === pwFor);
        if (!u) return null;
        return (
          <div className="bg-white rounded-xl shadow-sm border border-slate-300 p-4 mb-4">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <h3 className="text-sm font-semibold">Set password — {u.name || u.userId}</h3>
              <button onClick={() => { setPwFor(null); setPwValue(""); setPwErr(""); }} className="text-slate-400 hover:text-slate-600 text-xs">Close ✕</button>
            </div>
            <p className="text-xs text-slate-500 mb-3">Set or replace this user's password. They sign in with their user ID and the password you set here — there is no self-registration.</p>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="block flex-1 min-w-[200px]"><span className="block text-xs text-slate-500 mb-1">New password</span><input autoFocus type="password" value={pwValue} onChange={(e) => setPwValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && savePassword()} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="At least 6 characters" /></label>
              <button onClick={savePassword} className="bg-slate-900 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg shadow-sm">Save password</button>
            </div>
            {pwErr && <p className="text-xs text-rose-600 mt-2">{pwErr}</p>}
          </div>
        );
      })()}

      {!isSuperAdmin ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Only the <b>Super Admin</b> can create, reset or remove user IDs. You can change your own display name; the user ID / email itself is fixed.</p>
        </div>
      ) : (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        {!showForm ? (
          <button onClick={() => setShowForm(true)} disabled={!canAdd} className="bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg shadow-sm">+ Create User ID</button>
        ) : (
          <div>
            <h3 className="text-sm font-semibold mb-1">Create User ID</h3>
            <p className="text-xs text-slate-500 mb-3">New accounts are always <b>Admin</b>. You set the user ID and its <b>password</b> here — the user signs in with them directly; there is no self-registration. The user ID (email) is permanent; the display name can be changed later. A security question is optional and only enables self-service password reset.</p>
            <div className="flex flex-wrap gap-2 items-end mb-3">
              <label className="block flex-1 min-w-[140px]"><span className="block text-xs text-slate-500 mb-1">User ID / email</span><input autoFocus value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. operations@vrd.ae" /></label>
              <label className="block flex-1 min-w-[140px]"><span className="block text-xs text-slate-500 mb-1">Name <span className="text-slate-400">(optional)</span></span><input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Operations" /></label>
              <label className="block"><span className="block text-xs text-slate-500 mb-1">Type</span><div className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500">Admin</div></label>
            </div>
            <div className="flex flex-wrap gap-2 items-end mb-3">
              <label className="block flex-1 min-w-[140px]"><span className="block text-xs text-slate-500 mb-1">Password</span><input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="At least 6 characters" /></label>
              <label className="block flex-1 min-w-[140px]"><span className="block text-xs text-slate-500 mb-1">Confirm Password</span><input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></label>
            </div>
            <div className="flex flex-wrap gap-2 items-end mb-3">
              <label className="block flex-1 min-w-[180px]"><span className="block text-xs text-slate-500 mb-1">Security Question <span className="text-slate-400">(optional)</span></span><select value={qChoice} onChange={(e) => { setQChoice(e.target.value); setQuestion(e.target.value === "Custom…" ? "" : e.target.value); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">{QUESTIONS.map((q) => <option key={q}>{q}</option>)}</select></label>
              {qChoice === "Custom…" && <label className="block flex-1 min-w-[140px]"><span className="block text-xs text-slate-500 mb-1">Custom question</span><input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Your security question" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></label>}
              <label className="block flex-1 min-w-[140px]"><span className="block text-xs text-slate-500 mb-1">Answer <span className="text-slate-400">(optional)</span></span><input value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /></label>
            </div>
            {err && <p className="text-xs text-rose-600 mb-2">{err}</p>}
            <div className="flex gap-2">
              <button disabled={busy} onClick={submit} className="flex-1 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium shadow-sm">Create User ID</button>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm">Cancel</button>
            </div>
          </div>
        )}
        {!canAdd && !showForm && <p className="text-xs text-slate-400 mt-2">Maximum {maxUsers} users reached.</p>}
        {canAdd && !showForm && <p className="text-xs text-slate-400 mt-2">Names are editable; user IDs are not. The Super Admin account cannot be removed or have its password set by others.</p>}
      </div>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="font-serif text-base sm:text-lg text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">✕</button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
const Field = ({ label, children }) => (<label className="block mb-4"><span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-[0.14em] mb-1.5">{label}</span>{children}</label>);
const inp = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-colors";

function ReportModal({ allParties, activeParties, agreements, onClose, onGenerate, onPreview }) {
  const [which, setWhich] = useState("both");
  const [scope, setScope] = useState("party");   // "party" | "agreement"
  const [pick, setPick] = useState(activeParties);
  const [agPick, setAgPick] = useState([]);
  const toggle = (p) => setPick(pick.includes(p) ? pick.filter((x) => x !== p) : [...pick, p]);
  const toggleAg = (id) => setAgPick(agPick.includes(id) ? agPick.filter((x) => x !== id) : [...agPick, id]);
  const chip = (on) => `px-3 py-1 rounded-full text-xs border transition-colors ${on ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"}`;
  const parties = scope === "party" ? pick : [];
  const agIds = scope === "agreement" ? agPick : null;
  return (
    <Modal title="Generate Report" onClose={onClose}>
      <Field label="Format"><div className="grid grid-cols-3 gap-2">{[["pretty", "Pretty PDF"], ["excel", "Excel"], ["both", "Both"]].map(([k, l]) => (<button key={k} onClick={() => setWhich(k)} className={`py-2 rounded-lg text-sm border transition-colors ${which === k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"}`}>{l}</button>))}</div></Field>
      <Field label="Report scope"><div className="grid grid-cols-2 gap-2">{[["party", "By party"], ["agreement", "By agreement"]].map(([k, l]) => (<button key={k} onClick={() => setScope(k)} className={`py-2 rounded-lg text-sm border transition-colors ${scope === k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"}`}>{l}</button>))}</div></Field>
      {scope === "party" ? (
        <Field label="Include party statements for">
          <div className="flex flex-wrap gap-2 mb-2">
            <button onClick={() => setPick(allParties)} className="text-xs text-blue-700 underline">Select all</button>
            <button onClick={() => setPick(activeParties)} className="text-xs text-blue-700 underline">Only active</button>
            <button onClick={() => setPick([])} className="text-xs text-blue-700 underline">None</button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto border border-slate-200 rounded-lg p-2">
            {allParties.length === 0 && <span className="text-xs text-slate-400">No parties yet.</span>}
            {allParties.map((p) => (<button key={p} onClick={() => toggle(p)} className={chip(pick.includes(p))}>{p}</button>))}
          </div>
          <p className="text-xs text-slate-400 mt-1">{pick.length} selected · the report (agreements, accounts and statements) covers only the selected parties. Select none for an all-parties report.</p>
        </Field>
      ) : (
        <Field label="Include agreements">
          <div className="flex flex-wrap gap-2 mb-2">
            <button onClick={() => setAgPick(agreements.map((a) => a.id))} className="text-xs text-blue-700 underline">Select all</button>
            <button onClick={() => setAgPick([])} className="text-xs text-blue-700 underline">None</button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto border border-slate-200 rounded-lg p-2">
            {agreements.length === 0 && <span className="text-xs text-slate-400">No agreements yet.</span>}
            {agreements.map((a) => (<button key={a.id} onClick={() => toggleAg(a.id)} className={chip(agPick.includes(a.id))}>{(a.ref ? a.ref + " · " : "") + a.title}</button>))}
          </div>
          <p className="text-xs text-slate-400 mt-1">{agPick.length} selected · the report covers only the selected agreements — their allocations, payments received, associated accounts, and the statements of the parties allocated on them. Select none for an all-agreements report.</p>
        </Field>
      )}
      <div className="flex gap-2">
        <button onClick={() => onPreview(parties, agIds)} className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-sm font-medium">👁 Preview</button>
        <button onClick={() => onGenerate(which, parties, agIds)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm font-medium shadow-sm">Generate</button>
      </div>
    </Modal>
  );
}
function NoteModal({ preset, users, agreements, currentUser, onClose, onSave }) {
  const editing = !!(preset && preset.id);
  const [text, setText] = useState(editing ? preset.text || "" : "");
  const [assignedTo, setAssignedTo] = useState((preset && preset.assignedTo) || "");
  const [agreementId, setAgreementId] = useState((preset && preset.agreementId) || "");
  const [err, setErr] = useState("");
  const submit = () => {
    if (!text.trim()) { setErr("Enter a note."); return; }
    onSave({
      id: editing ? preset.id : uid(),
      text: text.trim(),
      assignedTo,
      agreementId,
      createdBy: editing ? (preset.createdBy || currentUser || "") : (currentUser || ""),
      ts: editing && preset.ts ? preset.ts : Date.now(),
    });
  };
  return (
    <Modal title={editing ? "Edit note" : "Add a note"} onClose={onClose}>
      <Field label="Note">
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }} rows={4} placeholder="Type your note…" className={inp} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Assign to (optional)">
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={inp}>
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u.userId} value={u.userId}>{u.name ? `${u.name} (${u.userId})` : u.userId}</option>)}
          </select>
        </Field>
        <Field label="Agreement (optional)">
          <select value={agreementId} onChange={(e) => setAgreementId(e.target.value)} className={inp}>
            <option value="">Not linked to an agreement</option>
            {agreements.map((a) => <option key={a.id} value={a.id}>{(a.ref ? a.ref + " · " : "") + a.title}</option>)}
          </select>
        </Field>
      </div>
      {err && <p className="text-xs text-rose-600 mb-2">{err}</p>}
      <div className="flex gap-2 justify-end mt-1">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={submit} className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm">{editing ? "Save note" : "Add note"}</button>
      </div>
    </Modal>
  );
}

function NotesPanel({ notes, users, agreements, onAdd, onEdit, onDelete }) {
  const [q, setQ] = useState("");
  const userName = (id) => { if (!id) return ""; const u = users.find((x) => x.userId === id); return u ? (u.name ? `${u.name} (${u.userId})` : u.userId) : id; };
  const agTitle = (id) => { if (!id) return ""; const a = agreements.find((x) => x.id === id); return a ? (a.ref ? a.ref + " · " : "") + a.title : ""; };
  const fmtDate = (ts) => { try { return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  const sorted = [...notes].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const ql = q.trim().toLowerCase();
  const shown = ql ? sorted.filter((n) => (n.text || "").toLowerCase().includes(ql) || userName(n.assignedTo).toLowerCase().includes(ql) || agTitle(n.agreementId).toLowerCase().includes(ql)) : sorted;
  return (
    <div>
      <div className="flex flex-wrap justify-between items-baseline gap-3 mb-6">
        <div>
          <h2 className="font-serif text-2xl text-slate-900 tracking-tight">Notes</h2>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 mt-1">{notes.length} note{notes.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes…" className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-44 sm:w-56 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100" />
          <button onClick={onAdd} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] uppercase tracking-[0.14em] px-4 py-2 rounded-lg shadow-sm transition-colors whitespace-nowrap">+ New Note</button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                <th className="text-left px-4 py-2 font-semibold w-44">Date Entered</th>
                <th className="text-left px-4 py-2 font-semibold">Note</th>
                <th className="text-left px-4 py-2 font-semibold w-44">Assigned To</th>
                <th className="text-left px-4 py-2 font-semibold w-48">Agreement</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400 italic">{notes.length ? "No notes match your search." : "No notes yet. Use the + button at the bottom-right of any page, or “New Note”."}</td></tr>}
              {shown.map((n) => (
                <tr key={n.id} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                  <td className="px-4 py-3 text-slate-500 tabular-nums whitespace-nowrap">{fmtDate(n.ts)}{n.createdBy && <span className="block text-[10px] text-slate-400">by {n.createdBy}</span>}</td>
                  <td className="px-4 py-3 whitespace-pre-wrap text-slate-800">{n.text}</td>
                  <td className="px-4 py-3">{n.assignedTo ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset bg-blue-50 text-blue-700 ring-blue-600/20">{userName(n.assignedTo)}</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3">{n.agreementId ? <span className="text-slate-700">{agTitle(n.agreementId)}</span> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-2 py-3 text-right whitespace-nowrap"><button onClick={() => onEdit(n)} className="text-blue-700 hover:text-blue-800 text-xs mr-3">Edit</button><button onClick={() => onDelete(n.id, (n.text || "").slice(0, 30))} className="text-rose-600 hover:text-rose-700 text-xs">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const rateHint = (cur) => (cur === "AED" ? "(fixed 0.2740 = 1/3.65 — editable)" : cur === "USD" ? "(1.00)" : "(rate to USD on the day — editable)");
const defaultRate = (cur, currencies) => (cur === "USD" ? 1 : currencies.find((c) => c.code === cur)?.fixed ? currencies.find((c) => c.code === cur).rate : "");

function PartySelect({ value, onChange, type, parties, addParty }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const opts = parties.filter((p) => p.type === type || p.type === "both").sort((a, b) => orderPartyName(a.name, b.name));
  const hasValue = value && !opts.some((p) => p.name === value);
  if (adding) return (
    <div className="flex gap-2">
      <input autoFocus className={inp} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New party name" />
      <button onClick={() => { const n = addParty(newName, type); if (n) { onChange(n); setAdding(false); setNewName(""); } }} className="bg-slate-900 text-white text-xs px-3 rounded-lg whitespace-nowrap">Save</button>
      <button onClick={() => { setAdding(false); setNewName(""); }} className="text-slate-500 text-xs px-1">✕</button>
    </div>
  );
  return (
    <select className={inp} value={value || ""} onChange={(e) => { if (e.target.value === "__add__") setAdding(true); else onChange(e.target.value); }}>
      <option value="">— Select party —</option>
      {hasValue && <option value={value}>{value}</option>}
      {opts.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
      <option value="__add__">＋ Add new party…</option>
    </select>
  );
}

function AgreementForm({ initial, nextRef, currencies, parties, addParty, existingAllocs, lockedParties, onClose, onSave }) {
  const [f, setF] = useState(initial || { id: uid(), ref: nextRef || "", title: "", party: "", date: new Date().toISOString().slice(0, 10), currency: "USD", totalValue: "", status: "Ongoing", paymentStatus: "Ongoing", comment: "", receipts: [] });
  const [allocs, setAllocs] = useState({ ...(existingAllocs || {}) });
  const [pickParty, setPickParty] = useState("");
  const [pickAmt, setPickAmt] = useState("");
  const [adding, setAdding] = useState(false);
  const [newParty, setNewParty] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const locked = new Set(lockedParties || []);
  const agClosed = isLocked(f);
  const partyOpts = parties.filter((p) => p.type === "disbursement" || p.type === "both").map((p) => p.name).sort(orderPartyName);
  const rows = Object.keys(allocs).sort();
  const available = partyOpts.filter((n) => !(n in allocs));
  const addRow = (name, amount) => {
    name = (name || "").trim();
    if (!name) return;
    setAllocs((a) => ({ ...a, [name]: Number(amount) || 0 }));
    setPickParty(""); setPickAmt("");
  };
  const setAmt = (name, v) => setAllocs((a) => ({ ...a, [name]: v === "" ? "" : Number(v) }));
  const dropRow = (name) => setAllocs((a) => { const c = { ...a }; delete c[name]; return c; });
  const allocTotal = rows.reduce((t, n) => t + (Number(allocs[n]) || 0), 0);
  const contract = Number(f.totalValue) || 0;
  const variance = contract - allocTotal;
  return (
    <Modal title={initial ? "Edit Agreement" : "New Agreement"} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Reference"><input className={inp} value={f.ref} onChange={set("ref")} placeholder="AGR-001" /></Field>
        <Field label="Date"><input type="date" className={inp} value={f.date} onChange={set("date")} /></Field>
      </div>
      <Field label="Title"><input className={inp} value={f.title} onChange={set("title")} placeholder="Agreement title" /></Field>
      <Field label="Client / Counterparty"><input className={inp} value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} placeholder="e.g. Amufert SA" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Currency"><select className={inp} value={f.currency} onChange={set("currency")}>{currencies.map((c) => <option key={c.code}>{c.code}</option>)}</select></Field>
        <Field label="Total Agreement Value"><input type="number" className={inp} value={f.totalValue} onChange={set("totalValue")} /></Field>
        <Field label="Agreement Status"><select className={inp} value={f.status} onChange={set("status")}>{AG_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Payment Status"><select className={inp} value={f.paymentStatus || "Ongoing"} onChange={set("paymentStatus")}>{PAY_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>

      <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.14em]">Associated Parties</span>
          <span className="text-[10px] text-slate-400">{rows.length} allocated · amounts in USD</span>
        </div>
        {agClosed && <p className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-800">Locked while the status is <b>{f.archived && f.status !== "Closed" ? "Archived" : f.status}</b>. Set Agreement Status to Ongoing{f.archived ? " and unarchive it" : ""} to change party allocations.</p>}
        {rows.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-400 italic">No parties yet — add one or more below. Each becomes a disbursement line under this contract.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {rows.map((name) => (
                <tr key={name} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <PartyName name={name} className="font-medium text-slate-700" />
                      {locked.has(name) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 shrink-0" title="Payments recorded"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                    </span>
                  </td>
                  <td className="px-3 py-2 w-40">
                    <span className="flex items-baseline gap-1">
                      <span className="text-slate-400 text-xs">$</span>
                      <input type="number" step="0.01" value={allocs[name]} onChange={(e) => setAmt(name, e.target.value)} readOnly={agClosed} className={`w-full rounded px-2 py-1 text-sm text-right tabular-nums border ${agClosed ? "border-transparent bg-transparent text-slate-500 cursor-not-allowed" : "border-slate-200 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"}`} />
                    </span>
                  </td>
                  <td className="px-2 py-2 w-8 text-right">
                    {agClosed
                      ? <span className="text-[10px] text-slate-300">—</span>
                      : locked.has(name)
                        ? <span className="text-[10px] text-slate-300" title="Has payments recorded — remove it from the Disbursements tab">kept</span>
                        : <button onClick={() => dropRow(name)} title="Remove this party" className="text-slate-300 hover:text-rose-500 text-sm">✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!agClosed && <div className="px-3 py-2.5 bg-slate-50/70 border-t border-slate-200">
          {adding ? (
            <div className="flex gap-2">
              <input autoFocus value={newParty} onChange={(e) => setNewParty(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setAdding(false); setNewParty(""); } }} placeholder="New party name" className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
              <button onClick={() => { const n = addParty(newParty, "disbursement"); if (n) { addRow(n, 0); setAdding(false); setNewParty(""); } }} className="bg-slate-900 text-white text-xs px-3 rounded-lg whitespace-nowrap">Save</button>
              <button onClick={() => { setAdding(false); setNewParty(""); }} className="text-slate-500 text-xs px-1">✕</button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <select value={pickParty} onChange={(e) => { if (e.target.value === "__add__") setAdding(true); else setPickParty(e.target.value); }} className="flex-1 min-w-[130px] border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                <option value="">— Select party —</option>
                {available.map((n) => <option key={n} value={n}>{n}</option>)}
                <option value="__add__">＋ Add new party…</option>
              </select>
              <input type="number" step="0.01" value={pickAmt} onChange={(e) => setPickAmt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && pickParty) addRow(pickParty, pickAmt); }} placeholder="Amount (USD)" className="w-32 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums" />
              <button disabled={!pickParty} onClick={() => addRow(pickParty, pickAmt)} className="bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap">+ Add</button>
            </div>
          )}
        </div>}
        {rows.length > 0 && (
          <div className="px-3 py-2 border-t border-slate-200 flex flex-wrap justify-between gap-x-6 gap-y-1 text-xs bg-white">
            <span className="text-slate-500">Allocated <b className="text-slate-800 tabular-nums ml-1">$ {fmt(allocTotal)}</b></span>
            <span className="text-slate-500">Contract <b className="text-slate-800 tabular-nums ml-1">{f.currency} {fmt(contract)}</b></span>
            <span className={Math.abs(variance) < 0.005 ? "text-emerald-700" : "text-rose-600"}>
              {Math.abs(variance) < 0.005 ? "Fully allocated" : <>Unallocated <b className="tabular-nums ml-1">{fmt(variance)}</b></>}
            </span>
          </div>
        )}
      </div>

      <Field label="Comment"><textarea className={inp} rows={2} value={f.comment || ""} onChange={set("comment")} /></Field>
      <button disabled={!f.title || !f.party} onClick={() => onSave(f, allocs)} className="w-full bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium shadow-sm">Save Agreement</button>
      <p className="text-[10px] text-slate-400 mt-2 text-center">Parties saved here appear as disbursement lines under this contract, where they can be edited, paid or deleted.</p>
    </Modal>
  );
}

function InvoiceForm({ agreement, initial, currencies, suggestedNumber, suggestedFrom, onClose, onSave, onDelete }) {
  const cur = agreement.currency;
  const [f, setF] = useState(initial || { id: uid(), date: new Date().toISOString().slice(0, 10), number: suggestedNumber || "", dueDate: "", amount: "", rate: defaultRate(cur, currencies), notes: "" });
  const [addToValue, setAddToValue] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dupe = String(f.number || "").trim() && (agreement.invoices || []).some((q) => q.id !== f.id && String(q.number || "").trim().toLowerCase() === String(f.number).trim().toLowerCase());
  const already = (agreement.invoices || []).filter((q) => q.id !== f.id).reduce((t, q) => t + Number(q.amount || 0), 0);
  const nextTotal = already + (Number(f.amount) || 0);
  const contract = Number(agreement.totalValue || 0);
  const over = nextTotal - contract;
  return (
    <Modal title={initial ? "Edit Invoice" : `Record Invoice — ${agreement.title}`} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Invoice Date"><input type="date" className={inp} value={f.date} onChange={set("date")} /></Field>
        <Field label="Due Date"><input type="date" className={inp} value={f.dueDate || ""} onChange={set("dueDate")} /></Field>
      </div>
      <Field label="Invoice Number"><input className={inp} value={f.number} onChange={set("number")} placeholder="e.g. INV-000114" /></Field>
      {!initial && suggestedNumber && String(f.number).trim() === String(suggestedNumber).trim() && <p className="-mt-2 mb-4 text-[11px] text-slate-400">Continuing the sequence on {suggestedFrom || "this agreement"} — edit if this invoice is numbered differently.</p>}
      {dupe && <p className="-mt-2 mb-4 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">Invoice {f.number} already exists on this agreement. Saving will create a second entry with the same number.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label={`Invoice Amount (${cur})`}><input type="number" className={inp} value={f.amount} onChange={set("amount")} /></Field>
        <Field label={`Rate to USD ${rateHint(cur)}`}><input type="number" step="0.0001" className={inp} value={f.rate} onChange={set("rate")} /></Field>
      </div>
      {f.amount && f.rate && <p className="text-sm text-slate-600 mb-3">USD equivalent: <span className="font-semibold">{fmt(f.amount * f.rate)}</span></p>}

      <div className="border border-slate-200 rounded-lg mb-4 text-xs">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.14em]">Effect on Agreement</div>
        <div className="px-3 py-2 flex justify-between"><span className="text-slate-500">Invoiced before</span><span className="tabular-nums">{csym(cur)} {fmt(already)}</span></div>
        <div className="px-3 py-2 flex justify-between border-t border-slate-100"><span className="text-slate-500">Invoiced after</span><b className="tabular-nums">{csym(cur)} {fmt(nextTotal)}</b></div>
        <div className="px-3 py-2 flex justify-between border-t border-slate-100"><span className="text-slate-500">Contract value</span><span className="tabular-nums">{csym(cur)} {fmt(contract)}</span></div>
        <div className={`px-3 py-2 flex justify-between border-t border-slate-100 ${over > 0.005 ? "text-rose-600" : "text-slate-500"}`}>
          <span>{over > 0.005 ? "Exceeds contract by" : "Remaining to invoice"}</span>
          <b className="tabular-nums">{csym(cur)} {fmt(Math.abs(over))}</b>
        </div>
      </div>

      <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
        <input type="checkbox" checked={addToValue} onChange={(e) => setAddToValue(e.target.checked)} className="mt-0.5 w-4 h-4 accent-slate-900" />
        <span className="text-xs text-slate-600">Increase the agreement value by this invoice <span className="block text-[11px] text-slate-400">For variations or scope additions. Leave unticked when invoicing against the existing contract value — the invoiced total still updates either way.</span></span>
      </label>

      <Field label="Comment"><input className={inp} value={f.notes} onChange={set("notes")} placeholder="Scope, PO reference, remarks…" /></Field>
      <div className="flex gap-2">
        {initial && onDelete && <button onClick={onDelete} className="px-4 py-2 rounded-lg text-sm font-medium border border-rose-200 text-rose-600 hover:bg-rose-50">Delete</button>}
        <button disabled={!f.amount || !f.rate} onClick={() => onSave({ ...f, amount: Number(f.amount), rate: Number(f.rate) }, addToValue)} className="flex-1 bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium shadow-sm">{initial ? "Save Invoice" : "Record Invoice"}</button>
      </div>
    </Modal>
  );
}

function MoneyForm({ title, currency, currencies, initial, verb, invoices, receipts, summaryFor, summaryTitle, blockWhen, onClose, onSave, onDelete }) {
  const invList = invoices || [];
  const openBal = (iv) => Number(iv.amount || 0) - (receipts || []).filter((r) => r.invoiceId === iv.id).reduce((s, r) => s + Number(r.amount || 0), 0);
  const autoPick = [...invList].sort((x, y) => String(x.date || "").localeCompare(String(y.date || ""))).find((iv) => openBal(iv) > 0.005);
  const [f, setF] = useState(initial || { id: uid(), date: new Date().toISOString().slice(0, 10), amount: "", rate: defaultRate(currency, currencies), notes: "", invoiceId: autoPick ? autoPick.id : "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const rows = summaryFor ? summaryFor({ amount: Number(f.amount) || 0, rate: Number(f.rate) || 0, invoiceId: f.invoiceId, id: f.id }) : null;
  const blockMsg = blockWhen ? blockWhen({ amount: Number(f.amount) || 0, id: f.id }) : null;
  return (
    <Modal title={title} onClose={onClose}>
      {invList.length > 0 && (
        <Field label="Associated Invoice">
          <select className={inp} value={f.invoiceId || ""} onChange={(e) => { const iv = invList.find((x) => x.id === e.target.value); setF({ ...f, invoiceId: e.target.value, amount: f.amount || (iv ? iv.amount : ""), rate: f.rate || (iv ? iv.rate : f.rate) }); }}>
            <option value="">— Not linked to an invoice —</option>
            {invList.map((iv) => <option key={iv.id} value={iv.id}>{iv.number || "Invoice"} · {iv.date} · {csym(currency)} {fmt(iv.amount)}{openBal(iv) > 0.005 ? ` · ${fmt(openBal(iv))} open` : " · settled"}</option>)}
          </select>
          {!initial && autoPick && f.invoiceId === autoPick.id && <p className="-mt-2 mb-4 text-[11px] text-slate-400">Associated automatically with {autoPick.number || "the oldest invoice"} — the oldest invoice still carrying a balance ({csym(currency)} {fmt(openBal(autoPick))}).</p>}
        </Field>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Date"><input type="date" className={inp} value={f.date} onChange={set("date")} /></Field>
        <Field label={`Amount (${currency})`}><input type="number" className={inp} value={f.amount} onChange={set("amount")} /></Field>
      </div>
      <Field label={`Exchange Rate to USD ${rateHint(currency)}`}><input type="number" step="0.0001" className={inp} value={f.rate} onChange={set("rate")} placeholder="e.g. 1.08" /></Field>
      {f.amount && f.rate && <p className="text-sm text-slate-600 mb-3">USD equivalent: <span className="font-semibold">{fmt(f.amount * f.rate)}</span></p>}
      {rows && rows.length > 0 && (
        <div className="border border-slate-200 rounded-lg mb-4 text-xs">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.14em]">{summaryTitle || "Effect on Agreement"}</div>
          {rows.map((row, i) => (
            <div key={row.label} className={`px-3 py-2 flex justify-between ${i ? "border-t border-slate-100" : ""} ${row.danger ? "text-rose-600" : ""}`}>
              <span className={row.danger ? "" : "text-slate-500"}>{row.label}</span>
              {row.bold ? <b className="tabular-nums">{row.value}</b> : <span className="tabular-nums">{row.value}</span>}
            </div>
          ))}
        </div>
      )}
      <Field label="Comment"><input className={inp} value={f.notes} onChange={set("notes")} placeholder="Bank ref, remarks…" /></Field>
      {blockMsg && <p className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700">{blockMsg}</p>}
      <div className="flex gap-2">
        {initial && onDelete && <button onClick={onDelete} className="px-4 py-2 rounded-lg text-sm font-medium border border-rose-200 text-rose-600 hover:bg-rose-50">Delete</button>}
        <button disabled={!f.amount || !f.rate || !!blockMsg} onClick={() => onSave({ ...f, amount: Number(f.amount), rate: Number(f.rate) })} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium shadow-sm">Save {verb}</button>
      </div>
    </Modal>
  );
}

function DisbursementForm({ initial, presetAgreement, agreements, disbursements, currencies, parties, addParty, onClose, onSave }) {
  const [f, setF] = useState(initial || { id: uid(), agreementId: presetAgreement || "", party: "", description: "", date: new Date().toISOString().slice(0, 10), currency: "USD", amount: "", paymentStatus: "Ongoing", feePercent: "", comment: "", payments: [] });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // Rule: a disbursement linked to an agreement can only go to a party that is
  // already allocated on that agreement (allocations are set on the agreement).
  const allocatedParties = [...new Set((disbursements || []).filter((d) => d.agreementId === f.agreementId && (Number(d.amount) || 0) > 0 && d.id !== f.id).map((d) => d.party))];
  if (initial && initial.party && !allocatedParties.includes(initial.party)) allocatedParties.push(initial.party);
  allocatedParties.sort(orderPartyName);
  const agSelected = !!f.agreementId;
  const partyAllowed = !agSelected || allocatedParties.includes(f.party);
  // An allocation can't be set below what has already been paid out on this record.
  const paidOnRecord = ((initial && initial.payments) || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const amountBelowPaid = paidOnRecord > 0 && Number(f.amount || 0) < paidOnRecord - 0.005;
  return (
    <Modal title={initial ? "Edit Disbursement" : "New Disbursement"} onClose={onClose}>
      <Field label="Source Agreement (any, including past agreements)">
        <select className={inp} value={f.agreementId || ""} onChange={(e) => setF({ ...f, agreementId: e.target.value, party: "" })}>
          <option value="">— Not linked to an agreement —</option>
          {agreements.map((a) => <option key={a.id} value={a.id}>{a.ref ? a.ref + " · " : ""}{a.title} ({a.party}) {a.status !== "Ongoing" ? `[${a.status}]` : ""}</option>)}
        </select>
      </Field>
      <Field label="Disburse to Party">
        {agSelected ? (
          allocatedParties.length ? (
            <select className={inp} value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })}>
              <option value="">— Select an allocated party —</option>
              {allocatedParties.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          ) : (
            <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">No parties are allocated on this agreement yet. Add the allocation on the agreement first (Agreements → Edit → Associated Parties).</p>
          )
        ) : (
          <PartySelect value={f.party} onChange={(v) => setF({ ...f, party: v })} type="disbursement" parties={parties} addParty={addParty} />
        )}
        {agSelected && allocatedParties.length > 0 && <p className="mt-1 text-[10px] text-slate-400">Only parties allocated on this agreement appear here. To add one, edit the agreement's allocations.</p>}
      </Field>
      <Field label="Description"><input className={inp} value={f.description} onChange={set("description")} placeholder="Purpose / reference" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Date"><input type="date" className={inp} value={f.date} onChange={set("date")} /></Field>
        <Field label="Currency"><select className={inp} value={f.currency} onChange={set("currency")}>{currencies.map((c) => <option key={c.code}>{c.code}</option>)}</select></Field>
        <Field label={`Allocated Amount (${f.currency})`}><input type="number" className={inp} value={f.amount} onChange={set("amount")} /></Field>
        <Field label="Service Fee %"><input type="number" step="0.1" className={inp} value={f.feePercent} onChange={set("feePercent")} placeholder="e.g. 1.5" /></Field>
        <Field label="Payment Status"><select className={inp} value={f.paymentStatus} onChange={set("paymentStatus")}>{PAY_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Comment"><textarea className={inp} rows={2} value={f.comment || ""} onChange={set("comment")} /></Field>
      {amountBelowPaid && <p className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700">Allocated amount is below the {csym(f.currency)} {fmt(paidOnRecord)} already disbursed on this record. The allocation can't be less than what has been paid.</p>}
      <button disabled={!f.party || !f.amount || !partyAllowed || amountBelowPaid} onClick={() => onSave({ ...f, amount: Number(f.amount), feePercent: f.feePercent === "" ? 0 : Number(f.feePercent) })} className="w-full bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium shadow-sm">Save Disbursement</button>
    </Modal>
  );
}

function CellDisbForm({ agreement, receipt, party, initial, currencies, allDisb, onClose, onSave, onDelete }) {
  const cur = (initial && initial.currency) || agreement.currency;
  const rate = defaultRate(cur, currencies);
  const existingPays = (initial && initial.payments) || [];
  const manyPays = existingPays.length > 1;
  const [f, setF] = useState({
    id: (initial && initial.id) || uid(),
    agreementId: agreement.id,
    party,
    receiptId: (initial && initial.receiptId) || (receipt ? receipt.id : ""),
    description: (initial && initial.description) || "Allocation",
    date: (initial && initial.date) || (receipt ? receipt.date : new Date().toISOString().slice(0, 10)),
    currency: cur,
    amount: initial ? initial.amount : "",
    paymentStatus: (initial && initial.paymentStatus) || "Pending",
    comment: (initial && initial.comment) || "",
  });
  const [paidOut, setPaidOut] = useState(manyPays ? "" : existingPays.length ? existingPays[0].amount : "");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const amt = Number(f.amount) || 0;
  const paid = f.paymentStatus === "Paid" && !manyPays && !String(paidOut).trim() ? amt : Number(paidOut) || 0;
  const others = (allDisb || []).filter((x) => x.agreementId === agreement.id && x.party === party && x.id !== f.id);
  const otherPaid = others.reduce((s, x) => s + ((x.payments || []).length ? (x.payments || []).reduce((t, q) => t + Number(q.amount || 0), 0) : (x.paymentStatus === "Paid" ? Number(x.amount || 0) : 0)), 0);
  const otherAlloc = others.reduce((s, x) => s + Number(x.amount || 0), 0);
  // A disbursement (paid) may not exceed the party's allocation on this agreement.
  const overBy = (otherPaid + paid) - (otherAlloc + amt);
  const overAlloc = overBy > 0.005;
  const save = () => {
    if (overAlloc) return;
    let payments = existingPays;
    if (!manyPays) {
      payments = paid > 0.005
        ? [{ id: (existingPays[0] && existingPays[0].id) || uid(), date: (existingPays[0] && existingPays[0].date) || f.date, amount: paid, rate, notes: (existingPays[0] && existingPays[0].notes) || "Recorded from the agreement table" }]
        : [];
    }
    onSave({ ...f, amount: amt, payments });
  };
  return (
    <Modal title={initial ? `Edit Disbursement — ${party}` : `Disburse to ${party}`} onClose={onClose}>
      <p className="-mt-1 mb-4 text-[11px] text-slate-500">{agreement.ref ? agreement.ref + " · " : ""}{agreement.title}{receipt ? <> · against the payment of <b>{csym(agreement.currency)} {fmt(receipt.amount)}</b> received {receipt.date}</> : null}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label={`Allocated — expected (${cur})`}><input type="number" className={inp} value={f.amount} onChange={set("amount")} placeholder="0.00" /></Field>
        {!manyPays && <Field label={`Disbursed — actually paid (${cur})`}><input type="number" className={`${inp} border-rose-300 focus:border-rose-400 focus:ring-rose-100`} value={paidOut} onChange={(e) => setPaidOut(e.target.value)} placeholder={f.paymentStatus === "Paid" ? fmt(amt) : "0.00"} /></Field>}
      </div>
      <p className="-mt-1 mb-4 text-[11px] text-slate-400"><b className="text-slate-500">Allocated</b> is what {party} is owed on this payment; <b className="text-slate-500">Disbursed</b> is what has actually been paid out to them. The figure in the table is the <b>Disbursed</b> amount — edit it here.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Status">
          <select className={inp} value={f.paymentStatus} onChange={set("paymentStatus")}>
            {["Ongoing", "Hold", "Pending", "Overdue", "Paid"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" className={inp} value={f.date} onChange={set("date")} /></Field>
      </div>
      {manyPays && <p className="-mt-2 mb-4 text-[11px] text-slate-500">{existingPays.length} payments totalling {csym(cur)} {fmt(existingPays.reduce((s, q) => s + Number(q.amount || 0), 0))} are recorded against this disbursement. Edit them individually on the Disbursements tab.</p>}
      {f.paymentStatus === "Paid" && !manyPays && !String(paidOut).trim() && <p className="-mt-2 mb-4 text-[11px] text-slate-400">Marked Paid with no figure entered, so the full {csym(cur)} {fmt(amt)} counts as disbursed.</p>}

      <div className="border border-slate-200 rounded-lg mb-4 text-xs">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.14em]">Effect on {party}</div>
        <div className="px-3 py-2 flex justify-between"><span className="text-slate-500">Allocated to {party}</span><span className="tabular-nums">{csym(cur)} {fmt(otherAlloc + amt)}</span></div>
        <div className="px-3 py-2 flex justify-between border-t border-slate-100"><span className="text-slate-500">Disbursed to {party}</span><b className="tabular-nums">{csym(cur)} {fmt(otherPaid + paid)}</b></div>
        <div className={`px-3 py-2 flex justify-between border-t border-slate-100 ${otherAlloc + amt - otherPaid - paid < -0.005 ? "text-rose-600" : "text-slate-500"}`}>
          <span>{otherAlloc + amt - otherPaid - paid < -0.005 ? "Paid beyond allocation" : "Still to pay"}</span>
          <b className="tabular-nums">{csym(cur)} {fmt(Math.abs(otherAlloc + amt - otherPaid - paid))}</b>
        </div>
      </div>

      <Field label="Comment"><input className={inp} value={f.comment} onChange={set("comment")} placeholder="Reference, remarks…" /></Field>
      {overAlloc && <p className="mb-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700">Disbursed ({csym(cur)} {fmt(otherPaid + paid)}) exceeds {party}'s allocation ({csym(cur)} {fmt(otherAlloc + amt)}) by {csym(cur)} {fmt(overBy)}. Raise the <b>Allocated</b> amount above (or the agreement's allocation) before recording this much.</p>}
      <div className="flex gap-2">
        {initial && onDelete && <button onClick={onDelete} className="px-4 py-2 rounded-lg text-sm font-medium border border-rose-200 text-rose-600 hover:bg-rose-50">Delete</button>}
        <button disabled={(!amt && !paid) || overAlloc} onClick={save} className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium shadow-sm">{initial ? "Save Disbursement" : "Record Disbursement"}</button>
      </div>
    </Modal>
  );
}

function TransferForm({ initial, presetFrom, parties, accounts, currencies, addParty, addAccount, onClose, onSave }) {
  const [f, setF] = useState(initial || { id: uid(), fromParty: presetFrom || "", accountId: "", date: new Date().toISOString().slice(0, 10), currency: "USD", amount: "", rate: 1, payType: "Full", notes: "" });
  const [addingAcc, setAddingAcc] = useState(false);
  const [accName, setAccName] = useState("");
  const [accCur, setAccCur] = useState("USD");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pickAccount = (id) => {
    const acc = accounts.find((a) => a.id === id);
    const cur = acc ? acc.currency : f.currency;
    setF({ ...f, accountId: id, currency: cur, rate: defaultRate(cur, currencies) });
  };
  return (
    <Modal title={initial ? "Edit Transfer" : "New Onward Transfer"} onClose={onClose}>
      <Field label="From Party (entity holding funds)"><PartySelect value={f.fromParty} onChange={(v) => setF({ ...f, fromParty: v })} type="disbursement" parties={parties} addParty={addParty} /></Field>
      <Field label="To Account">
        {addingAcc ? (
          <div className="flex gap-2 flex-wrap">
            <input autoFocus className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[140px]" value={accName} onChange={(e) => setAccName(e.target.value)} placeholder="Account name" />
            <select className="border border-slate-300 rounded-lg px-2 py-2 text-sm" value={accCur} onChange={(e) => setAccCur(e.target.value)}>{currencies.map((c) => <option key={c.code}>{c.code}</option>)}</select>
            <button onClick={() => { const id = addAccount(accName, accCur, "", f.fromParty); if (id) { pickAccount(id); setAddingAcc(false); setAccName(""); } }} className="bg-slate-900 text-white text-xs px-3 rounded-lg">Save</button>
            <button onClick={() => setAddingAcc(false)} className="text-slate-500 text-xs px-1">✕</button>
          </div>
        ) : (
          <select className={inp} value={f.accountId || ""} onChange={(e) => { if (e.target.value === "__add__") setAddingAcc(true); else pickAccount(e.target.value); }}>
            <option value="">— Select account —</option>
            {f.fromParty && accounts.some((a) => a.party === f.fromParty) && (<optgroup label={`${f.fromParty} accounts`}>{accounts.filter((a) => a.party === f.fromParty).sort((a, b) => orderName(a.name, b.name)).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</optgroup>)}
            <optgroup label="Other accounts">{accounts.filter((a) => !f.fromParty || a.party !== f.fromParty).sort((a, b) => orderName(a.name, b.name)).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency}){a.party ? ` · ${a.party}` : ""}</option>)}</optgroup>
            <option value="__add__">＋ Add new account…</option>
          </select>
        )}
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Date"><input type="date" className={inp} value={f.date} onChange={set("date")} /></Field>
        <Field label="Partial / Full"><select className={inp} value={f.payType} onChange={set("payType")}><option>Full</option><option>Partial</option></select></Field>
        <Field label="Currency"><select className={inp} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value, rate: defaultRate(e.target.value, currencies) })}>{currencies.map((c) => <option key={c.code}>{c.code}</option>)}</select></Field>
        <Field label={`Amount (${f.currency})`}><input type="number" className={inp} value={f.amount} onChange={set("amount")} /></Field>
      </div>
      <Field label={`Rate to USD ${rateHint(f.currency)}`}><input type="number" step="0.0001" className={inp} value={f.rate} onChange={set("rate")} /></Field>
      {f.amount && f.rate && <p className="text-sm text-slate-600 mb-3">USD equivalent: <span className="font-semibold">{fmt(f.amount * f.rate)}</span></p>}
      <Field label="Comment"><input className={inp} value={f.notes} onChange={set("notes")} placeholder="Bank ref, purpose…" /></Field>
      <button disabled={!f.fromParty || !f.accountId || !f.amount || !f.rate} onClick={() => onSave({ ...f, amount: Number(f.amount), rate: Number(f.rate) })} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium shadow-sm">Save Transfer</button>
    </Modal>
  );
}

function PartyPanel({ data, save, addParty, ask, orderParty }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("disbursement");
  const [editing, setEditing] = useState(null);
  const usageCount = (pname) => data.disbursements.filter((d) => d.party === pname).length + data.transfers.filter((t) => t.fromParty === pname).length + data.accounts.filter((a) => a.party === pname).length;
  const renameParty = (oldName, newName) => {
    newName = (newName || "").trim();
    if (!newName || newName === oldName) { setEditing(null); return; }
    if (data.parties.some((p) => p.name.toLowerCase() === newName.toLowerCase() && p.name !== oldName)) return;
    save({ ...data, parties: data.parties.map((p) => (p.name === oldName ? { ...p, name: newName } : p)), disbursements: data.disbursements.map((d) => (d.party === oldName ? { ...d, party: newName } : d)), transfers: data.transfers.map((t) => (t.fromParty === oldName ? { ...t, fromParty: newName } : t)), accounts: data.accounts.map((a) => (a.party === oldName ? { ...a, party: newName } : a)) });
    setEditing(null);
  };
  return (
    <div>
      <h2 className="font-serif text-lg mb-4">Parties / Entities</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Used For</th><th className="text-right px-4 py-2">Txns</th><th></th></tr></thead>
          <tbody>
            {data.parties.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-400">No parties yet.</td></tr>}
            {[...data.parties].sort((a, b) => { const pin = (n) => (n === "O. Dev" ? 2 : /^cash/i.test(n) ? 1 : 0); return (pin(a.name) - pin(b.name)) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }); }).map((p) => {
              const used = usageCount(p.name);
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{editing && editing.id === p.id ? (<span className="flex gap-1 items-center"><input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") renameParty(p.name, editing.name); if (e.key === "Escape") setEditing(null); }} className="border border-slate-300 rounded px-2 py-1 text-sm w-32" /><button onClick={() => renameParty(p.name, editing.name)} className="text-emerald-700 text-xs">Save</button><button onClick={() => setEditing(null)} className="text-slate-400 text-xs">✕</button></span>) : <PartyName name={p.name} />}</td>
                  <td className="px-4 py-2"><select value={p.type} onChange={(e) => save({ ...data, parties: data.parties.map((x) => (x.id === p.id ? { ...x, type: e.target.value } : x)) })} className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"><option value="disbursement">Disbursements</option><option value="receivable">Clients (income)</option><option value="both">Both</option></select></td>
                  <td className="px-4 py-2 text-right text-xs text-slate-500">{used}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap"><button onClick={() => setEditing({ id: p.id, name: p.name })} className="text-blue-700 text-xs mr-3">Edit</button>{used === 0 ? (<button onClick={() => ask(`Remove "${p.name}"?`, () => save({ ...data, parties: data.parties.filter((x) => x.id !== p.id) }))} className="text-rose-600 text-xs">Remove</button>) : (<span className="text-xs text-slate-300">Remove</span>)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-semibold mb-3">Add Party</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block flex-1 min-w-[140px]"><span className="block text-xs text-slate-500 mb-1">Name</span><input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="Party name" /></label>
          <label className="block"><span className="block text-xs text-slate-500 mb-1">Used for</span><select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}><option value="disbursement">Disbursements</option><option value="receivable">Clients (income)</option><option value="both">Both</option></select></label>
          <button onClick={() => { addParty(name, type); setName(""); }} className="bg-slate-900 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg shadow-sm">Add</button>
        </div>
      </div>
    </div>
  );
}

function AccountPanel({ data, save, addAccount, ask }) {
  const [name, setName] = useState("");
  const [cur, setCur] = useState("USD");
  const [comment, setComment] = useState("");
  const [party, setParty] = useState("");
  const [editing, setEditing] = useState(null);
  const partyOpts = data.parties.filter((p) => p.type === "disbursement" || p.type === "both").map((p) => p.name).sort(orderPartyName);
  const renameAccount = (id, newName) => {
    newName = (newName || "").trim();
    if (!newName) { setEditing(null); return; }
    if (data.accounts.some((a) => a.id !== id && a.name.toLowerCase() === newName.toLowerCase())) return;
    save({ ...data, accounts: data.accounts.map((a) => (a.id === id ? { ...a, name: newName } : a)) });
    setEditing(null);
  };
  return (
    <div>
      <h2 className="font-serif text-lg mb-4">Accounts</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Account Name</th><th className="text-left px-4 py-2">Party</th><th className="text-left px-4 py-2">Currency</th><th className="text-left px-4 py-2">Comment</th><th></th></tr></thead>
          <tbody>
            {data.accounts.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-slate-400">No accounts yet.</td></tr>}
            {[...data.accounts].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })).map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{editing && editing.id === a.id ? (<span className="flex gap-1 items-center"><input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") renameAccount(a.id, editing.name); if (e.key === "Escape") setEditing(null); }} className="border border-slate-300 rounded px-2 py-1 text-sm w-40" /><button onClick={() => renameAccount(a.id, editing.name)} className="text-emerald-700 text-xs">Save</button><button onClick={() => setEditing(null)} className="text-slate-400 text-xs">✕</button></span>) : a.name}</td>
                <td className="px-4 py-2"><select value={a.party || ""} onChange={(e) => save({ ...data, accounts: data.accounts.map((x) => (x.id === a.id ? { ...x, party: e.target.value } : x)) })} className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"><option value="">— Unassigned —</option>{partyOpts.map((p) => <option key={p} value={p}>{p}</option>)}{a.party && !partyOpts.includes(a.party) && <option value={a.party}>{a.party}</option>}</select></td>
                <td className="px-4 py-2">{a.currency}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{a.comment}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap"><button onClick={() => setEditing({ id: a.id, name: a.name })} className="text-blue-700 text-xs mr-3">Edit</button><button onClick={() => ask(`Remove account "${a.name}"? Existing transfers keep their records.`, () => save({ ...data, accounts: data.accounts.filter((x) => x.id !== a.id) }))} className="text-rose-600 text-xs">Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-semibold mb-3">Add Account</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block flex-1 min-w-[140px]"><span className="block text-xs text-slate-500 mb-1">Name</span><input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ENBD USD Main" /></label>
          <label className="block"><span className="block text-xs text-slate-500 mb-1">Party</span><select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={party} onChange={(e) => setParty(e.target.value)}><option value="">— Unassigned —</option>{partyOpts.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          <label className="block"><span className="block text-xs text-slate-500 mb-1">Currency</span><select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={cur} onChange={(e) => setCur(e.target.value)}>{data.currencies.map((c) => <option key={c.code}>{c.code}</option>)}</select></label>
          <label className="block flex-1 min-w-[140px]"><span className="block text-xs text-slate-500 mb-1">Comment</span><input className={inp} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional" /></label>
          <button onClick={() => { addAccount(name, cur, comment, party); setName(""); setComment(""); setParty(""); }} className="bg-slate-900 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg shadow-sm">Add</button>
        </div>
      </div>
    </div>
  );
}

function CurrencyPanel({ data, addCurrency, save, ask }) {
  const [code, setCode] = useState("");
  const [rate, setRate] = useState("");
  return (
    <div>
      <h2 className="font-serif text-lg mb-4">Currencies (base: USD)</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Code</th><th className="text-left px-4 py-2">Rate to USD</th><th className="text-left px-4 py-2">Mode</th><th></th></tr></thead>
          <tbody>
            {data.currencies.map((c) => (
              <tr key={c.code} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{c.code}</td>
                <td className="px-4 py-2">{c.code === "USD" ? "1.00" : c.fixed && c.rate ? Number(c.rate).toFixed(4) : "Entered per transaction"}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{c.code === "USD" ? "Base currency" : c.fixed ? "Fixed default" : "Daily rate (manual)"}</td>
                <td className="px-4 py-2 text-right">{!["USD", "AED"].includes(c.code) && (<button onClick={() => ask(`Remove ${c.code}? Existing records keep it.`, () => save({ ...data, currencies: data.currencies.filter((x) => x.code !== c.code) }))} className="text-rose-600 text-xs">Remove</button>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-semibold mb-3">Add Currency</h3>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block"><span className="block text-xs text-slate-500 mb-1">Code</span><input className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-24" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SAR" /></label>
          <label className="block"><span className="block text-xs text-slate-500 mb-1">Fixed rate to USD (optional)</span><input type="number" step="0.0001" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-40" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="leave blank for daily" /></label>
          <button onClick={() => { addCurrency(code, rate); setCode(""); setRate(""); }} className="bg-slate-900 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg shadow-sm">Add</button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Currencies without a fixed rate prompt you for the day's rate to USD on each transaction.</p>
      </div>
    </div>
  );
}

function ImportPanel({ data, save, ask }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const partyOpts = data.parties.filter((p) => p.type === "disbursement" || p.type === "both").map((p) => p.name).sort(orderPartyName);
  const [imgParty, setImgParty] = useState(partyOpts[0] || "");
  const [imgFiles, setImgFiles] = useState([]);

  const xdate = (v) => {
    if (v == null || v === "") return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return isNaN(d) ? "" : d.toISOString().slice(0, 10); }
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
    return s;
  };
  const toB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = () => rej(new Error("read failed")); r.readAsDataURL(file); });

  const buildFromWorkbook = (wb) => {
    const sheet = (name) => { const ws = wb.Sheets[name]; return ws ? XLSX.utils.sheet_to_json(ws, { defval: "" }) : []; };
    const agRows = sheet("Agreements"), rcRows = sheet("Receipts"), dbRows = sheet("Disbursements"), pyRows = sheet("Disb Payments"), trRows = sheet("Transfers");
    if (!agRows.length && !dbRows.length && !trRows.length) throw new Error("No recognizable sheets (Agreements / Disbursements / Transfers) were found. Use the exported Excel as your template.");
    const agreements = [], agKey = {};
    agRows.forEach((r) => {
      const ref = String(r.Ref ?? "").trim(), title = String(r.Title ?? "").trim();
      if (!title) return;
      const id = uid(); agKey[`${ref}||${title}`] = id;
      agreements.push({ id, ref, title, party: String(r.Client || "").trim(), date: xdate(r.Date), currency: String(r.Currency || "USD").trim() || "USD", totalValue: Number(r["Total Value"]) || 0, status: String(r["Agreement Status"] || "Ongoing").trim() || "Ongoing", paymentStatus: String(r["Payment Status"] || "Ongoing").trim() || "Ongoing", comment: r.Comment || "", receipts: [], invoices: [] });
    });
    const findAg = (ref, title) => agKey[`${String(ref || "").trim()}||${String(title || "").trim()}`] || (agreements.find((a) => a.title === String(title || "").trim())?.id) || "";
    const parseSrc = (s) => { s = String(s || ""); const i = s.indexOf(" · "); return i >= 0 ? { ref: s.slice(0, i).trim(), title: s.slice(i + 3).trim() } : { ref: "", title: s.trim() }; };
    sheet("Invoices").forEach((r) => { const ag = agreements.find((a) => a.id === findAg(r.Ref, r.Agreement)); if (!ag) return; ag.invoices.push({ id: uid(), date: xdate(r["Invoice Date"]), number: String(r["Invoice #"] || ""), dueDate: xdate(r["Due Date"]), amount: Number(r.Amount) || 0, rate: Number(r["Rate to USD"]) || 1, notes: r.Comment || "" }); });
    rcRows.forEach((r) => { const ag = agreements.find((a) => a.id === findAg(r.Ref, r.Agreement)); if (!ag) return; ag.receipts.push({ id: uid(), date: xdate(r.Date), amount: Number(r.Amount) || 0, rate: Number(r["Rate to USD"]) || 1, notes: r.Comment || "" }); });
    const disbursements = [], dbKey = {};
    dbRows.forEach((r) => {
      const { ref, title } = parseSrc(r["Source Agreement"]); const agId = findAg(ref, title); const party = String(r.Party || "").trim(); if (!party) return;
      const d = { id: uid(), agreementId: agId, party, description: r.Description || "", date: xdate(r.Date), currency: String(r.Currency || "USD").trim() || "USD", amount: Number(r["Allocated Amount"]) || 0, paymentStatus: String(r["Payment Status"] || "Ongoing").trim() || "Ongoing", feePercent: 0, comment: r.Comment || "", payments: [] };
      disbursements.push(d); dbKey[`${agId}||${party}`] = d;
    });
    pyRows.forEach((r) => {
      const { ref, title } = parseSrc(r["Source Agreement"]); const agId = findAg(ref, title); const party = String(r.Party || "").trim(); if (!party) return;
      let d = dbKey[`${agId}||${party}`];
      if (!d) { d = { id: uid(), agreementId: agId, party, description: "", date: xdate(r.Date), currency: String(r.Currency || "USD").trim() || "USD", amount: 0, paymentStatus: "Paid", feePercent: 0, comment: "", payments: [] }; disbursements.push(d); dbKey[`${agId}||${party}`] = d; }
      d.payments.push({ id: uid(), date: xdate(r.Date), amount: Number(r.Amount) || 0, rate: Number(r["Rate to USD"]) || 1, notes: r.Comment || "" });
    });
    const accounts = [], accKey = {};
    const getAcc = (name, cur) => { name = String(name || "").trim(); if (!name) return ""; const k = name.toLowerCase(); if (accKey[k]) return accKey[k]; const id = uid(); accounts.push({ id, name, currency: String(cur || "USD").trim() || "USD", comment: "", party: "" }); accKey[k] = id; return id; };
    const transfers = [];
    trRows.forEach((r) => { transfers.push({ id: uid(), fromParty: String(r["From Party"] || "").trim(), accountId: getAcc(r["To Account"], r["Account Currency"]), date: xdate(r.Date), currency: String(r["Transfer Currency"] || "USD").trim() || "USD", amount: Number(r.Amount) || 0, rate: Number(r["Rate to USD"]) || 1, payType: String(r["Partial/Full"] || "Full").trim() || "Full", notes: r.Comment || "" }); });
    const names = new Set(DEFAULT_PARTIES.map((p) => p.name));
    disbursements.forEach((d) => d.party && names.add(d.party));
    transfers.forEach((t) => t.fromParty && names.add(t.fromParty));
    const parties = [...names].map((name) => ({ id: uid(), name, type: "disbursement" }));
    const seen = new Set(["USD", "AED", "EUR", "AOA", "GBP"]);
    agreements.forEach((a) => seen.add(a.currency));
    const currencies = DEFAULT_CURRENCIES.concat([...seen].filter((c) => !DEFAULT_CURRENCIES.some((x) => x.code === c)).map((c) => ({ code: c, rate: null, fixed: false })));
    return { currencies, parties, agreements, disbursements, transfers, accounts };
  };

  const onExcel = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    setErr(""); setMsg(""); setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const next = normalizeInvoices(buildFromWorkbook(wb));
      const summary = `${next.agreements.length} agreements, ${next.disbursements.length} disbursements, ${next.transfers.length} transfers, ${next.accounts.length} accounts`;
      ask(`Import will REPLACE all current data with the uploaded file (${summary}). Continue?`, () => { save(next); setMsg(`Imported ${summary}.`); });
    } catch (e2) { setErr(e2.message || "Could not read the workbook."); }
    setBusy(false);
  };

  const onImages = async () => {
    if (!imgParty) { setErr("Pick a party first."); return; }
    if (!imgFiles.length) { setErr("Choose one or more statement images."); return; }
    setErr(""); setMsg(""); setBusy(true);
    try {
      const content = [];
      for (const f of imgFiles) content.push({ type: "image", source: { type: "base64", media_type: f.type || "image/png", data: await toB64(f) } });
      content.push({ type: "text", text: `These are statement images for the party "${imgParty}". Extract EVERY transaction row. Respond with ONLY a raw JSON array — no prose, no markdown fences. Each element: {"date":"YYYY-MM-DD","description":"string","direction":"in" or "out","currency":"3-letter code","amount":number}. "in" = money received by this party; "out" = money paid out/transferred. If a date or currency is unclear, use "" for date and "USD" for currency.` });
      const resp = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content }] }) });
      const dj = await resp.json();
      const txt = (dj.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").replace(/```json|```/g, "").trim();
      const rows = JSON.parse(txt);
      if (!Array.isArray(rows) || !rows.length) throw new Error("No transactions could be read from the image(s).");
      const fx = { USD: 1, EUR: 1.08232, AED: 1 / 3.65, GBP: 1.27, AOA: 0.0011 };
      const next = { ...data };
      let parties = [...next.parties];
      if (!parties.some((p) => p.name === imgParty)) parties.push({ id: uid(), name: imgParty, type: "disbursement" });
      let disbursements = [...next.disbursements];
      let disb = disbursements.find((d) => d.party === imgParty && d.description === "Statement Import" && !d.agreementId);
      if (!disb) { disb = { id: uid(), agreementId: "", party: imgParty, description: "Statement Import", date: "", currency: "USD", amount: 0, paymentStatus: "Paid", feePercent: 0, comment: "Imported from statement image", payments: [] }; disbursements.push(disb); }
      let accounts = [...next.accounts];
      const accName = `Imported — ${imgParty}`;
      let acc = accounts.find((a) => a.name === accName);
      if (!acc) { acc = { id: uid(), name: accName, currency: "USD", comment: "From statement image", party: imgParty }; accounts.push(acc); }
      let transfers = [...next.transfers];
      let inN = 0, outN = 0;
      rows.forEach((r) => {
        const cur = String(r.currency || "USD").toUpperCase(); const rate = fx[cur] || 1; const amt = Number(r.amount) || 0; if (!amt) return;
        if (r.direction === "out") { transfers.push({ id: uid(), fromParty: imgParty, accountId: acc.id, date: xdate(r.date), currency: cur, amount: amt, rate, payType: "Full", notes: r.description || "Statement import" }); outN++; }
        else { disb.payments = [...disb.payments, { id: uid(), date: xdate(r.date), amount: amt, rate, notes: r.description || "Statement import" }]; inN++; }
      });
      disb.amount = (disb.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      disbursements = disbursements.map((d) => (d.id === disb.id ? disb : d));
      save({ ...next, parties, disbursements, accounts, transfers });
      setImgFiles([]);
      setMsg(`Imported ${inN} inflow${inN === 1 ? "" : "s"} and ${outN} outflow${outN === 1 ? "" : "s"} for ${imgParty}.`);
    } catch (e2) { setErr("Could not read the statement image(s). " + (e2.message || "")); }
    setBusy(false);
  };

  return (
    <div className="mt-6">
      <h2 className="font-serif text-lg mb-4">Import</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
        <h3 className="text-sm font-semibold mb-1">Full Database — from Excel</h3>
        <p className="text-xs text-slate-500 mb-3">Upload a filled-in copy of the exported Excel workbook. The <b>Agreements</b>, <b>Receipts</b>, <b>Disbursements</b>, <b>Disb Payments</b>, and <b>Transfers</b> sheets are read. This <b>replaces</b> all current data. Tip: use the green Report button (Excel / Both) to download the template first.</p>
        <label className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg shadow-sm cursor-pointer">
          <span>{busy ? "Working…" : "Choose Excel file"}</span>
          <input type="file" accept=".xlsx,.xls" disabled={busy} onChange={onExcel} className="hidden" />
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-semibold mb-1">Party Statement — from Image(s)</h3>
        <p className="text-xs text-slate-500 mb-3">Pick a party, then upload statement photos/scans. Transactions are read from the image and <b>added</b> to that party — inflows become received payments, outflows become onward transfers to an "Imported — {imgParty || "party"}" account.</p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="block"><span className="block text-xs text-slate-500 mb-1">Party</span>
            <select value={imgParty} onChange={(e) => setImgParty(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[160px]">
              {partyOpts.length === 0 && <option value="">No parties</option>}
              {partyOpts.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block flex-1 min-w-[180px]"><span className="block text-xs text-slate-500 mb-1">Statement image(s)</span>
            <input type="file" accept="image/*" multiple onChange={(e) => setImgFiles(Array.from(e.target.files || []))} className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:text-xs" />
          </label>
          <button disabled={busy} onClick={onImages} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg shadow-sm">{busy ? "Reading…" : "Read & Import"}</button>
        </div>
        {imgFiles.length > 0 && <p className="text-[11px] text-slate-400 mt-2">{imgFiles.length} image{imgFiles.length === 1 ? "" : "s"} selected.</p>}
      </div>

      {err && <p className="text-xs text-rose-600 mt-3">{err}</p>}
      {msg && <p className="text-xs text-emerald-700 mt-3">{msg}</p>}
      <p className="text-[10px] text-slate-400 mt-3">Image reading uses AI extraction and may need a quick review afterward — check the Agreements, Parties, and Transfers tabs for accuracy.</p>
    </div>
  );
}

// ---- mount ---------------------------------------------------------------
(function () {
  const el = document.getElementById("root");
  const root = ReactDOM.createRoot(el);
  root.render(<ErrorBoundary><App /></ErrorBoundary>);
  requestAnimationFrame(function () {
    const boot = document.getElementById("ft-boot");
    if (boot) { boot.classList.add("hide"); setTimeout(function () { boot.remove(); }, 400); }
  });
})();
