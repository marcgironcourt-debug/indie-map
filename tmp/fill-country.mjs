import fs from "fs";

const p="data/places.json";
const d=JSON.parse(fs.readFileSync(p,"utf8"));

const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const normCountry=(v)=>{
  const s=String(v??"").trim();
  if(!s) return "";
  if(/^undefined$/i.test(s)) return "";
  if(/^canada$/i.test(s)) return "CA";
  if(/^france$/i.test(s)) return "FR";
  if(s.length===2) return s.toUpperCase();
  return s;
};

let changed=0;
let missing=0;

for(const x of d){
  if(!x) continue;
  x.country = normCountry(x.country);
  if(!x.country) missing++;
}

const limit = Number(process.argv[2] || 20);
let done=0;

for(const x of d){
  if(!x) continue;
  if(x.country) continue;
  if(done>=limit) break;

  const lat=Number(x.lat);
  const lon=Number(x.lng);
  if(!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

  const url=new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format","jsonv2");
  url.searchParams.set("lat",String(lat));
  url.searchParams.set("lon",String(lon));
  url.searchParams.set("zoom","18");
  url.searchParams.set("addressdetails","1");

  const res=await fetch(url, {headers: {"User-Agent":"indie-map/geo-audit (contact: local dev)" }});
  if(!res.ok){
    console.error("HTTP",res.status,"for",x.id,x.name);
    await sleep(1200);
    continue;
  }
  const j=await res.json();
  const cc = String(j?.address?.country_code ?? "").trim().toUpperCase();
  if(cc && cc.length===2){
    x.country = cc;
    changed++;
    done++;
    console.log("SET",cc,"-",x.city,"|",x.name,"|",x.id);
  }else{
    console.log("NOCOUNTRY -",x.city,"|",x.name,"|",x.id);
    done++;
  }

  await sleep(1200);
}

fs.writeFileSync("tmp/places.with-country.preview.json", JSON.stringify(d,null,2)+"\n");
console.log("\nWROTE tmp/places.with-country.preview.json");
console.log("CHANGED (filled by reverse):",changed);
console.log("MISSING BEFORE (after simple normalize):",missing);
