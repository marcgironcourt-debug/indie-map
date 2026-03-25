import fs from "fs";

const data = JSON.parse(fs.readFileSync("data/places.json", "utf8"));

function getEnMiniText(x) {
  const tr = x && typeof x.translations === "object" && x.translations ? x.translations : null;
  if (!tr) return "";

  const tObj = tr.en;
  if (tObj && typeof tObj === "object") {
    const t = tObj.miniText;
    if (typeof t === "string" && t.trim()) return t.trim();
  }

  const mt = tr.miniText;
  if (mt && typeof mt === "object") {
    const t2 = mt.en;
    if (typeof t2 === "string" && t2.trim()) return t2.trim();
  }

  return "";
}

const bad = data
  .filter(x => {
    const base = typeof x.miniText === "string" ? x.miniText.trim() : "";
    const en = getEnMiniText(x);
    return base && !en;
  })
  .map(x => `${x.name} — ${x.city}`);

if (bad.length) {
  console.log("Missing English miniText:");
  for (const line of bad) console.log(`- ${line}`);
  process.exit(1);
}

console.log("OK: all places with miniText also have an English miniText translation.");
