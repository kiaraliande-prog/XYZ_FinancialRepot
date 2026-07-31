// Fetch daily exchange rates and merge them into rates.json as
// "USD per 1 unit of currency" (the app's base is USD).
//
// TWO sources, because no single one covers every currency the app uses:
//
//  1. UAE Central Bank (CBUAE) — the primary source for most currencies.
//     CBUAE publishes rates as AED per 1 foreign-currency unit, so we convert:
//         usdPerUnit(cur) = aedPerUnit(cur) / aedPerUnit(USD)
//     where aedPerUnit(USD) is the USD/AED peg (~3.6725).
//     The CBUAE retired its JSON endpoint; it now returns a rendered HTML
//     table whose currency names are in ARABIC (the English page is
//     bot-protected / 403). So we scrape that fragment and map the Arabic
//     names to ISO codes via ARABIC2CODE below.
//
//  2. Xe.com — used for the Angolan Kwanza (AOA), which the CBUAE does NOT
//     publish. The Xe converter page embeds a USD-based rates map in its
//     Next.js __NEXT_DATA__ payload (1 USD = N units), so:
//         usdPerUnit(cur) = 1 / rates[cur]
//
// The app only ever reads rates.json (a same-origin file); this script is the
// single place that talks to the outside world. Each source is independent:
// if one is unreachable or its page shape changes, the other still updates,
// and any currency that can't be fetched keeps its last (editable) value in
// rates.json. If BOTH fail, the file is left untouched so a bad fetch never
// overwrites good data.
import { readFileSync, writeFileSync } from "node:fs";

const CBUAE_ENDPOINT = "https://www.centralbank.ae/umbraco/Surface/Exchange/GetExchangeRateAllCurrency";
const XE_ENDPOINT = "https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=EUR";
const XE_CURRENCIES = ["AOA"]; // currencies the CBUAE doesn't publish, sourced from Xe

// Arabic currency name (as rendered by the CBUAE fragment) -> ISO 4217 code.
// Extend this map to track more currencies; only codes present here are read.
const ARABIC2CODE = {
  "دولار امريكي": "USD",
  "يورو": "EUR",
  "جنيه استرليني": "GBP",
  "درهم اماراتي": "AED",
  "دولار كندي": "CAD",
  "فرنك سويسري": "CHF",
  "ين ياباني": "JPY",
  "دولار استرالي": "AUD",
  "دولار سنغافوري": "SGD",
  "دولار هونج كونج": "HKD",
  "روبية هندية": "INR",
  "راند جنوب أفريقي": "ZAR",
  "كرونة سويدية": "SEK",
  "كرون نرويجي": "NOK",
  "كرون دانماركي": "DKK",
  "ريال سعودي": "SAR",
  "ريال قطري": "QAR",
  "دينار كويتي": "KWD",
  "دينار بحريني": "BHD",
  "ريال عماني": "OMR",
};

const round = (v) => Number(Number(v).toPrecision(8)); // trim float noise, keep FX precision
const strip = (s) =>
  String(s || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// Return { usdAed, day: { CODE: usdPerUnit } } parsed from the CBUAE fragment.
async function fetchCbuae() {
  const res = await fetch(CBUAE_ENDPOINT, {
    headers: { Accept: "text/html, */*", "User-Agent": "Mozilla/5.0 (rates-bot)" },
  });
  if (!res.ok) throw new Error("CBUAE HTTP " + res.status);
  const html = await res.text();
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const aedPerUnit = {};
  for (const row of rows) {
    const tds = row.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
    if (tds.length < 3) continue;
    const code = ARABIC2CODE[strip(tds[1])];
    const rate = Number(strip(tds[2]));
    if (code && isFinite(rate) && rate > 0) aedPerUnit[code] = rate;
  }
  const usdAed = aedPerUnit.USD;
  if (!usdAed) throw new Error("CBUAE fragment parsed but USD/AED peg not found (page shape changed?)");
  const day = {};
  for (const code of Object.keys(aedPerUnit)) {
    if (code === "USD") continue; // USD is the base (1.00), not stored per-unit
    day[code] = round(aedPerUnit[code] / usdAed); // USD per 1 unit
  }
  day.AED = round(1 / usdAed); // AED per-unit in USD, from the peg
  return { usdAed, day };
}

// Return { CODE: usdPerUnit } for the requested codes, from Xe.com's converter.
// Xe embeds a USD-based rates map (1 USD = N units) in __NEXT_DATA__.
async function fetchXe(codes) {
  const res = await fetch(XE_ENDPOINT, {
    headers: { Accept: "text/html, */*", "User-Agent": "Mozilla/5.0 (rates-bot)" },
  });
  if (!res.ok) throw new Error("Xe HTTP " + res.status);
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Xe __NEXT_DATA__ not found (page shape changed?)");
  const rates = JSON.parse(m[1])?.props?.pageProps?.initialRatesData?.rates;
  if (!rates || typeof rates !== "object") throw new Error("Xe rates map not found");
  const day = {};
  for (const code of codes) {
    const unitsPerUsd = Number(rates[code]);
    if (isFinite(unitsPerUsd) && unitsPerUsd > 0) day[code] = round(1 / unitsPerUsd);
  }
  if (Object.keys(day).length === 0) throw new Error("Xe returned none of: " + codes.join(","));
  return day;
}

async function main() {
  const file = new URL("../../rates.json", import.meta.url);
  const current = JSON.parse(readFileSync(file, "utf8"));

  const day = {};
  let usdAed = current.usdAed || 3.6725;

  try {
    const cb = await fetchCbuae();
    usdAed = cb.usdAed;
    Object.assign(day, cb.day);
    console.log("CBUAE ok:", Object.keys(cb.day).length, "currencies");
  } catch (e) {
    console.log("CBUAE fetch/parse failed:", e.message);
  }

  try {
    const xe = await fetchXe(XE_CURRENCIES);
    Object.assign(day, xe);
    console.log("Xe ok:", xe);
  } catch (e) {
    console.log("Xe fetch/parse failed:", e.message);
  }

  if (Object.keys(day).length === 0) {
    console.log("No rates fetched from any source; leaving rates.json unchanged.");
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const next = {
    base: "USD",
    source: "UAE Central Bank; Angolan Kwanza (AOA) via Xe.com",
    updated: today,
    usdAed,
    latest: { ...(current.latest || {}), ...day },
    byDate: { ...(current.byDate || {}), [today]: { ...(current.byDate?.[today] || {}), ...day } },
  };
  writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  console.log("Updated rates for", today, day);
}

main();
