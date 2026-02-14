const fs = require("fs");

const src = "data/places.json";
const out = "tmp/places.city-sanitized.preview.json";

const d = JSON.parse(fs.readFileSync(src, "utf8"));

function fix(s) {
  let x = String(s ?? "");
  x = x.replace(/\u00A0/g, " ");
  x = x.normalize("NFC");
  x = x.replace(/[’‘]/g, "'");
  x = x.replace(/[–—]/g, "-");
  x = x.replace(/\s+/g, " ").trim();
  return x;
}

let changed = 0;
const examples = [];

for (const x of d) {
  if (!x) continue;
  const before = x.city;
  const after = fix(before);
  if (String(before ?? "") !== after) {
    x.city = after;
    changed++;
    if (examples.length < 20) {
      examples.push({ before, after, name: x.name, id: x.id });
    }
  }
}

fs.writeFileSync(out, JSON.stringify(d, null, 2) + "\n");

console.log("WROTE:", out);
console.log("CHANGED city fields:", changed);
if (examples.length) {
  console.log("\nEXAMPLES:");
  for (const e of examples) {
    console.log("-", JSON.stringify(e.before), "->", JSON.stringify(e.after), "|", e.name);
  }
}
