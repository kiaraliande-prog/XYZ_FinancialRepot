// Fetch the UAE Central Bank daily exchange rates and merge them into
// rates.json as "USD per 1 unit of currency" (the app's base is USD).
//
// CBUAE publishes rates as AED per 1 foreign-currency unit. We convert:
//   usdPerUnit(cur) = aedPerUnit(cur) / aedPerUnit(USD)
// where aedPerUnit(USD) is the USD/AED peg (~3.6725).
//
// The app only ever reads rates.json (a same-origin file); this script is the
// single place that talks to the CBUAE. If the CBUAE is unreachable, the
// script exits without changing the file so a bad fetch never overwrites good
// data. All values remain editable in the app regardless.
import { readFileSync, writeFileSync } from "node:fs";

const CURRENCIES = ["EUR", "GBP", "AOA", "AED"]; // extend as needed
const ENDPOINT = "https://www.centralbank.ae/umbraco/Surface/Exchange/GetExchangeRateAllCurrency";

const norm = (s) => String(s || "").trim().toUpperCase();
// CBUAE may report ISO codes ("USD") or names ("US Dollar"); resolve both.
const NAME2CODE = {
  "US DOLLAR": "USD", "US DOLLARS": "USD",
  "EURO": "EUR", "EUROS": "EUR",
  "POUND STERLING": "GBP", "GB POUND": "GBP", "GREAT BRITAIN POUND": "GBP", "BRITISH POUND": "GBP",
  "ANGOLA KWANZA": "AOA", "ANGOLAN KWANZA": "AOA", "KWANZA": "AOA",
  "UAE DIRHAM": "AED",
};
const resolveCode = (raw) => { const u = norm(raw); return /^[A-Z]{3}$/.test(u) ? u : (NAME2CODE[u] || u); };

async function fetchCbuae() {
  const res = await fetch(ENDPOINT, {
    headers: { Accept: "application/json, text/plain, */*", "User-Agent": "Mozilla/5.0 (rates-bot)" },
  });
  if (!res.ok) throw new Error("CBUAE HTTP " + res.status);
  const data = await res.json();
  // The payload is an array of { code/currencyCode, rate }. Be liberal in
  // reading the field names since the CMS shape has varied over time.
  const list = Array.isArray(data) ? data : data.rates || data.data || [];
  const aedPerUnit = {};
  for (const row of list) {
    const code = resolveCode(row.code || row.currencyCode || row.currency || row.Currency || row.currencyName || row.CurrencyName || row.currencyeng || row.currencyEng);
    const rate = Number(row.rate ?? row.Rate ?? row.value ?? row.Value ?? row.exchangeRate);
    if (/^[A-Z]{3}$/.test(code) && isFinite(rate) && rate > 0) aedPerUnit[code] = rate;
  }
  return aedPerUnit;
}

async function main() {
  const file = new URL("../../rates.json", import.meta.url);
  const current = JSON.parse(readFileSync(file, "utf8"));

  let aedPerUnit;
  try {
    aedPerUnit = await fetchCbuae();
  } catch (e) {
    console.log("CBUAE fetch failed, leaving rates.json unchanged:", e.message);
    return;
  }

  // USD/AED peg: prefer the CBUAE USD figure, else keep the stored peg.
  const usdAed = aedPerUnit.USD || current.usdAed || 3.6725;
  const day = {};
  for (const cur of CURRENCIES) {
    if (cur === "AED") { day.AED = 1 / usdAed; continue; }
    if (aedPerUnit[cur]) day[cur] = aedPerUnit[cur] / usdAed; // USD per 1 unit
  }
  if (Object.keys(day).length === 0) {
    console.log("No usable currencies parsed from CBUAE; leaving file unchanged.");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const next = {
    base: "USD",
    source: "UAE Central Bank",
    updated: today,
    usdAed,
    latest: { ...(current.latest || {}), ...day },
    byDate: { ...(current.byDate || {}), [today]: day },
  };
  writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  console.log("Updated rates for", today, day);
}

main();
