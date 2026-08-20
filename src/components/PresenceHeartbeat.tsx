"use client";

import React from "react";
import { usePathname } from "next/navigation";
import {
  getAnalyticsHeaders,
} from "@/lib/analytics";

export default function PresenceHeartbeat() {
  const pathname = usePathname();

  React.useEffect(() => {
    const isAnalyticsPage =
      pathname === "/indie-analytics" ||
      pathname.startsWith(
        "/indie-analytics/",
      );

    if (isAnalyticsPage) return;

    const headers =
      getAnalyticsHeaders();

    const launchId =
      headers["x-launch-id"];

    const heartbeatLockKey =
      "im_presence_heartbeat_at";

    const launchHeartbeatKey =
      "im_launch_heartbeat_sent";

    const heartbeatLockMs =
      60_000;

    let inFlight = false;

    const reserveHeartbeat = () => {
      const now = Date.now();

      try {
        const previous =
          Number(
            window.localStorage.getItem(
              heartbeatLockKey,
            ) || "0",
          );

        if (
          Number.isFinite(previous) &&
          now - previous <
            heartbeatLockMs
        ) {
          return false;
        }

        window.localStorage.setItem(
          heartbeatLockKey,
          String(now),
        );

        return true;
      } catch {
        return true;
      }
    };

    const launchAlreadySent = () => {
      try {
        return (
          window.sessionStorage.getItem(
            launchHeartbeatKey,
          ) === launchId
        );
      } catch {
        return false;
      }
    };

    const rememberLaunchSent = () => {
      try {
        window.sessionStorage.setItem(
          launchHeartbeatKey,
          launchId,
        );
      } catch {}
    };

    const send = (
      forceForLaunch = false,
    ) => {
      if (inFlight) return;

      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }

      if (
        !forceForLaunch &&
        !reserveHeartbeat()
      ) {
        return;
      }

      inFlight = true;

      try {
        fetch(
          "/api/presence/heartbeat",
          {
            method: "POST",
            headers,
            keepalive: true,
            cache: "no-store",
          },
        )
          .then((response) => {
            if (
              response.ok &&
              forceForLaunch
            ) {
              rememberLaunchSent();
            }
          })
          .catch(() => {})
          .finally(() => {
            inFlight = false;
          });
      } catch {
        inFlight = false;
      }
    };

    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          send(false);
        }
      };

    /*
     * Chaque launchId doit envoyer au moins
     * un heartbeat. Les changements de page
     * suivants restent protégés par le verrou.
     */
    send(!launchAlreadySent());

    const intervalId =
      window.setInterval(
        () => send(false),
        90_000,
      );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.clearInterval(
        intervalId,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [pathname]);

  return null;
}
