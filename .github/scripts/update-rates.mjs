// Fetch the UAE Central Bank daily exchange rates and merge them into
// rates.json as "USD per 1 unit of currency" (the app's base is USD).
//
// CBUAE publishes rates as AED per 1 foreign-currency unit. We convert:
//   usdPerUnit(cur) = aedPerUnit(cur) / aedPerUnit(USD)
// where aedPerUnit(USD) is the USD/AED peg (~3.6725).
//
// NOTE on the data source: the CBUAE used to expose a JSON endpoint, but it
// now returns a rendered HTML table fragment whose currency names are in
// ARABIC (the English page is bot-protected / 403). So we scrape that
// fragment and map the Arabic names to ISO codes below. Angola Kwanza (AOA)
// is NOT published by the CBUAE, so it is never updated here — its value in
// rates.json stays at whatever was last seeded/edited.
//
// The app only ever reads rates.json (a same-origin file); this script is the
// single place that talks to the CBUAE. If the CBUAE is unreachable or the
// page shape changes so nothing parses, the script exits WITHOUT changing the
// file, so a bad fetch never overwrites good data. All values remain editable
// in the app regardless.
import { readFileSync, writeFileSync } from "node:fs";

const ENDPOINT = "https://www.centralbank.ae/umbraco/Surface/Exchange/GetExchangeRateAllCurrency";

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

const strip = (s) =>
  String(s || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// Return { CODE: aedPerUnit } parsed from the CBUAE HTML fragment.
async function fetchCbuae() {
  const res = await fetch(ENDPOINT, {
    headers: {
      Accept: "text/html, */*",
      "User-Agent": "Mozilla/5.0 (rates-bot)",
    },
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
  if (!aedPerUnit.USD) throw new Error("CBUAE fragment parsed but USD/AED peg not found (page shape changed?)");
  return aedPerUnit;
}

async function main() {
  const file = new URL("../../rates.json", import.meta.url);
  const current = JSON.parse(readFileSync(file, "utf8"));

  let aedPerUnit;
  try {
    aedPerUnit = await fetchCbuae();
  } catch (e) {
    console.log("CBUAE fetch/parse failed, leaving rates.json unchanged:", e.message);
    return;
  }

  const round = (v) => Number(Number(v).toPrecision(8)); // trim float noise, keep FX precision
  const usdAed = aedPerUnit.USD; // guaranteed present by fetchCbuae()
  const day = {};
  for (const code of Object.keys(aedPerUnit)) {
    if (code === "USD") continue; // USD is the base (1.00), not stored per-unit
    day[code] = round(aedPerUnit[code] / usdAed); // USD per 1 unit
  }
  day.AED = round(1 / usdAed); // AED per-unit in USD, from the peg

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
    byDate: { ...(current.byDate || {}), [today]: { ...(current.byDate?.[today] || {}), ...day } },
  };
  writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  console.log("Updated rates for", today, day);
}

main();
