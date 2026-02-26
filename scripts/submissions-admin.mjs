import http from "node:http";
import { URL } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PORT = 4546;

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

function htmlPage(rows) {
  const items = rows
    .map((r) => {
      const photoSrc =
        r.photoMime && r.photoBase64 ? `data:${r.photoMime};base64,${r.photoBase64}` : "";
      const status = r.status || "pending";
      const reviewed = r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : "";
      return `
        <div class="card" data-id="${esc(r.id)}">
          <div class="top">
            <div class="main">
              <div class="row">
                <div class="name">${esc(r.name)}</div>
                <span class="pill ${esc(status)}">${esc(status)}</span>
              </div>
              <div class="addr">${esc(r.address)}</div>
              <div class="meta">${esc(new Date(r.createdAt).toLocaleString())} · ${esc(r.locale)} · ${esc(r.id)}${reviewed ? ` · reviewed: ${esc(reviewed)}` : ""}</div>
            </div>
            ${photoSrc ? `<img class="photo" src="${photoSrc}" alt="">` : ""}
          </div>

          <div class="grid">
            ${r.openingHours ? `<div><span class="k">Horaires</span><div class="v">${esc(r.openingHours)}</div></div>` : ""}
            ${r.phone ? `<div><span class="k">Téléphone</span><div class="v">${esc(r.phone)}</div></div>` : ""}
          </div>

          <div class="actions">
            <button class="btn" data-act="status" data-status="pending">Pending</button>
            <button class="btn" data-act="status" data-status="validated">Valider</button>
            <button class="btn" data-act="status" data-status="rejected">Rejeter</button>
            <button class="btn danger" data-act="delete">Supprimer</button>
          </div>
        </div>
      `;
    })
    .join("\n");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Indie Map – Soumissions (local)</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0b0b0c;color:#fff;margin:0}
  .wrap{max-width:1050px;margin:0 auto;padding:24px}
  h1{margin:0 0 6px;font-size:22px}
  .sub{color:rgba(255,255,255,.7);margin:0 0 18px}
  .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px;margin:12px 0}
  .top{display:flex;gap:14px;align-items:flex-start;justify-content:space-between}
  .row{display:flex;gap:10px;align-items:center}
  .name{font-weight:700;font-size:16px}
  .pill{font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.85)}
  .pill.pending{background:rgba(255,255,255,.06)}
  .pill.validated{background:rgba(0,200,120,.18)}
  .pill.rejected{background:rgba(240,80,80,.18)}
  .addr{color:rgba(255,255,255,.75);margin-top:4px}
  .meta{color:rgba(255,255,255,.55);margin-top:10px;font-size:12px;word-break:break-all}
  .photo{width:96px;height:96px;object-fit:cover;border-radius:14px;border:1px solid rgba(255,255,255,.12)}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
  .k{display:block;color:rgba(255,255,255,.55);font-size:12px;margin-bottom:4px}
  .v{color:rgba(255,255,255,.85);font-size:14px;white-space:pre-wrap}
  .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
  .btn{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;border-radius:999px;padding:8px 12px;font-weight:600;cursor:pointer}
  .btn:hover{background:rgba(255,255,255,.10)}
  .btn.danger{border-color:rgba(240,80,80,.35);background:rgba(240,80,80,.18)}
  .btn.danger:hover{background:rgba(240,80,80,.25)}
  @media (max-width:720px){.grid{grid-template-columns:1fr}.photo{width:84px;height:84px}}
</style>
</head>
<body>
  <div class="wrap">
    <h1>Soumissions (local)</h1>
    <p class="sub">${rows.length} éléments (max 1000)</p>
    ${rows.length ? items : `<div class="card">Aucune soumission.</div>`}
  </div>

<script>
async function postJSON(url, body){
  const r = await fetch(url, {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(body)});
  const j = await r.json().catch(()=>null);
  if(!r.ok || !j || !j.ok) throw new Error("request_failed");
  return j;
}

document.addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-act]");
  if(!b) return;
  const card = b.closest(".card");
  const id = card && card.getAttribute("data-id");
  if(!id) return;

  const act = b.getAttribute("data-act");
  try {
    if(act === "delete"){
      if(!confirm("Supprimer cette soumission ?")) return;
      await postJSON("/api/delete", { id });
      card.remove();
      return;
    }
    if(act === "status"){
      const status = b.getAttribute("data-status");
      await postJSON("/api/status", { id, status });
      location.reload();
      return;
    }
  } catch {
    alert("Erreur. Réessaie.");
  }
});
</script>

</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url || "/", `http://localhost:${PORT}`);
    if (req.method === "GET" && u.pathname === "/") {
      const rows = await prisma.submission.findMany({
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(htmlPage(rows));
      return;
    }

    if (req.method === "POST" && u.pathname === "/api/delete") {
      const raw = await new Promise((resolve) => {
        let d = "";
        req.on("data", (c) => (d += c));
        req.on("end", () => resolve(d));
      });
      const body = JSON.parse(String(raw || "{}"));
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return json(res, 400, { ok: false });
      await prisma.submission.delete({ where: { id } });
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && u.pathname === "/api/status") {
      const raw = await new Promise((resolve) => {
        let d = "";
        req.on("data", (c) => (d += c));
        req.on("end", () => resolve(d));
      });
      const body = JSON.parse(String(raw || "{}"));
      const id = typeof body.id === "string" ? body.id : "";
      const status = typeof body.status === "string" ? body.status : "";
      if (!id) return json(res, 400, { ok: false });
      if (!["pending", "validated", "rejected"].includes(status)) return json(res, 400, { ok: false });
      await prisma.submission.update({
        where: { id },
        data: { status, reviewedAt: new Date() },
      });
      return json(res, 200, { ok: true });
    }

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  } catch {
    json(res, 500, { ok: false });
  }
});

server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
