"use client";

import React from "react";

type Props = { locale: "fr" | "en" };

export default function ContributeForm({ locale }: Props) {
  const isFr = locale === "fr";
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [openingHours, setOpeningHours] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "ok" | "err">("idle");

  const canSend = name.trim().length >= 2 && website.trim().length >= 5 && status !== "sending";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;

    setStatus("sending");
    try {
      const fd = new FormData();
      fd.set("locale", locale);
      fd.set("name", name);
      fd.set("address", address);
      if (openingHours.trim()) fd.set("openingHours", openingHours);
      if (phone.trim()) fd.set("phone", phone);
      if (website.trim()) fd.set("website", website);

      const res = await fetch("/api/v1/submissions", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !json?.ok) throw new Error("not_ok");

      setStatus("ok");
      setName("");
      setAddress("");
      setOpeningHours("");
      setPhone("");
      setWebsite("");
    } catch {
      setStatus("err");
    }
  }

  const t = {
    title: isFr ? "Contribuer" : "Contribute",
    intro: isFr
      ? "Propose un lieu à ajouter. Les infos sont relues manuellement. Nom et site web uniquement."
      : "Suggest a place to add. Submissions are reviewed manually. Only name and website are required.",
    name: isFr ? "Nom du lieu *" : "Place name *",
    address: isFr ? "Adresse du lieu (optionnel)" : "Place address (optional)",
    openingHours: isFr ? "Horaires (optionnel)" : "Opening hours (optional)",
    phone: isFr ? "Téléphone (optionnel)" : "Phone (optional)",
    website: isFr ? "Site web *" : "Website *",
    send: isFr ? "Envoyer" : "Send",
    sending: isFr ? "Envoi..." : "Sending...",
    okTitle: isFr ? "Merci !" : "Thank you!",
    okText: isFr ? "Ta suggestion a bien été envoyée. Nous l’examinerons avant de l’ajouter à Indie Map." : "Your suggestion has been sent. We will review it before adding it to Indie Map.",
    err: isFr ? "Erreur. Réessaie." : "Error. Try again.",
    required: isFr ? "* obligatoire" : "* required",
  } as const;

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-2xl font-semibold text-white">{t.title}</h1>
      <p className="mt-2 text-white/80">{t.intro}</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-white/80">{t.name}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-2xl bg-white/10 px-3 py-3 text-white placeholder:text-white/40 outline-none ring-1 ring-white/10"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-white/80">{t.address}</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-2xl bg-white/10 px-3 py-3 text-white placeholder:text-white/40 outline-none ring-1 ring-white/10"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-white/80">{t.openingHours}</label>
          <input
            value={openingHours}
            onChange={(e) => setOpeningHours(e.target.value)}
            className="w-full rounded-2xl bg-white/10 px-3 py-3 text-white placeholder:text-white/40 outline-none ring-1 ring-white/10"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-white/80">{t.phone}</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-2xl bg-white/10 px-3 py-3 text-white placeholder:text-white/40 outline-none ring-1 ring-white/10"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-white/80">{t.website}</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full rounded-2xl bg-white/10 px-3 py-3 text-white placeholder:text-white/40 outline-none ring-1 ring-white/10"
          />
        </div>


        <button
          type="submit"
          disabled={!canSend}
          className="w-full rounded-2xl bg-[hsl(var(--brand))] px-5 py-3 font-medium text-white hover:bg-[hsl(var(--brand-600))] disabled:opacity-60"
        >
          {status === "sending" ? t.sending : t.send}
        </button>

        <p className="text-xs text-white/60">{t.required}</p>
        {status === "ok" ? <div className="text-sm text-white/80"><p className="font-semibold">{t.okTitle}</p><p className="mt-1">{t.okText}</p></div> : null}
        {status === "err" ? <p className="text-sm text-white/80">{t.err}</p> : null}
      </form>
    </div>
  );
}
