"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __IM_REGISTER_WEB_PUSH__?: () => Promise<boolean>;
    __IM_REQUEST_WEB_PUSH_PERMISSION__?: () => Promise<boolean>;
  }
}

function getPushPlatform(): "android" | "web" {
  if (/Android/i.test(navigator.userAgent || "")) return "android";
  return "web";
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}

async function requestWebPushPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return registerWebPush();
  if (Notification.permission === "denied") return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  return registerWebPush();
}

async function registerWebPush() {
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  if (!publicKey) return false;

  const registration = await navigator.serviceWorker.ready;

  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const res = await fetch("/api/v1/me/push-devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform: getPushPlatform(),
      subscription: subscription.toJSON(),
    }),
  });

  if (res.status === 401) return false;
  return res.ok;
}

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        window.__IM_REGISTER_WEB_PUSH__ = registerWebPush;
        window.__IM_REQUEST_WEB_PUSH_PERMISSION__ = requestWebPushPermission;
        registerWebPush().catch(() => false);
      })
      .catch(() => {});

    return () => {
      delete window.__IM_REGISTER_WEB_PUSH__;
      delete window.__IM_REQUEST_WEB_PUSH_PERMISSION__;
    };
  }, []);

  return null;
}
