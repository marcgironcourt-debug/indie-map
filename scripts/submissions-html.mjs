import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const rows = await prisma.submission.findMany({
  orderBy: { createdAt: "desc" },
  take: 1000,
});

const items = rows
  .map((r) => {
    const photoSrc =
      r.photoMime && r.photoBase64 ? `data:${r.photoMime};base64,${r.photoBase64}` : "";
    return `
      <div class="card">
        <div class="top">
          <div class="main">
            <div class="name">${esc(r.name)}</div>
            <div class="addr">${esc(r.address)}</div>
            <div class="meta">${esc(new Date(r.createdAt).toLocaleString())} · ${esc(r.locale)} · ${esc(r.id)}</div>
          </div>
          ${photoSrc ? `<img class="photo" src="${photoSrc}" alt="">` : ""}
        </div>
        <div class="grid">
          ${r.openingHours ? `<div><span class="k">Horaires</span><div class="v">${esc(r.openingHours)}</div></div>` : ""}
          ${r.phone ? `<div><span class="k">Téléphone</span><div class="v">${esc(r.phone)}</div></div>` : ""}
        </div>
      </div>
    `;
  })
  .join("\n");

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Indie Map – Soumissions (local)</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0b0b0c;color:#fff;margin:0}
  .wrap{max-width:1000px;margin:0 auto;padding:24px}
  h1{margin:0 0 6px;font-size:22px}
  .sub{color:rgba(255,255,255,.7);margin:0 0 18px}
  .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px;margin:12px 0}
  .top{display:flex;gap:14px;align-items:flex-start;justify-content:space-between}
  .name{font-weight:700;font-size:16px}
  .addr{color:rgba(255,255,255,.75);margin-top:4px}
  .meta{color:rgba(255,255,255,.55);margin-top:10px;font-size:12px;word-break:break-all}
  .photo{width:96px;height:96px;object-fit:cover;border-radius:14px;border:1px solid rgba(255,255,255,.12)}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
  .k{display:block;color:rgba(255,255,255,.55);font-size:12px;margin-bottom:4px}
  .v{color:rgba(255,255,255,.85);font-size:14px;white-space:pre-wrap}
  @media (max-width:720px){.grid{grid-template-columns:1fr}.photo{width:84px;height:84px}}
</style>
</head>
<body>
  <div class="wrap">
    <h1>Soumissions (local)</h1>
    <p class="sub">${rows.length} éléments (max 1000)</p>
    ${rows.length ? items : `<div class="card">Aucune soumission.</div>`}
  </div>
</body>
</html>`;

const out = path.resolve(".tmp/submissions.html");
fs.writeFileSync(out, html, "utf-8");

await prisma.$disconnect();

console.log(out);
