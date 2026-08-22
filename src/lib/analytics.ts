
import { rememberRecentViewedPlace } from "@/lib/recentViewedPlaces";

import {
  getAnalyticsDeviceContext,
  getClientTimeZone,
  getOrCreateInstallationSessionId,
  getOrCreateLaunchId,
  getUtcOffsetMinutes,
  readRecentAnalyticsLocation,
} from "@/lib/installationSession";

export type IndieEventType =
  | "click_explore_world"
  | "click_recent_additions"
  | "click_discovery_of_day"
  | "search_ai_used"
  | "search_result_impression"
  | "click_search_result_detail"
  | "click_search_results_map"
  | "click_mini_immersion"
  | "click_mini_more_info"
  | "save_place"
  | "unsave_place"
  | "open_shared_list_picker"
  | "add_place_to_shared_list"
  | "create_shared_list"
  | "click_detail_website"
  | "click_detail_itinerary"
  | "click_detail_copy_address"
  | "click_detail_share"
  | "click_detail_view_on_map"
  | "click_detail_phone"
  | "view_place_detail"
  | "mark_place_visited"
  | "unmark_place_visited";

type TrackEventPayload = {
  eventType: IndieEventType;
  placeId?: string | null;
  city?: string | null;
  country?: string | null;
  category?: string | null;
  searchId?: string | null;
  searchRank?: number | null;
  locale?: string | null;
  platform?: string | null;
  metadata?: Record<string, unknown>;
};

function getPlatform() {
  if (typeof navigator === "undefined") return "web";

  const ua = navigator.userAgent || "";

  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";

  return "web";
}

export function getAnalyticsContext() {
  const device =
    getAnalyticsDeviceContext();

  return {
    sessionId:
      getOrCreateInstallationSessionId(),
    launchId:
      getOrCreateLaunchId(),
    clientTimeZone:
      getClientTimeZone(),
    utcOffsetMinutes:
      getUtcOffsetMinutes(),
    ...device,
  };
}

export function getAnalyticsHeaders() {
  const context = getAnalyticsContext();

  const locale =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/en")
      ? "en"
      : "fr";

  return {
    "x-session-id": context.sessionId,
    "x-launch-id": context.launchId,
    "x-client-time-zone": context.clientTimeZone,
    "x-utc-offset-minutes":
      String(context.utcOffsetMinutes),
    "x-platform": context.platform,
    "x-device-type": context.deviceType,
    "x-device-os": context.os,
    "x-device-browser": context.browser,
    "x-locale": locale,
  };
}

export function trackEvent(
  payload: TrackEventPayload,
) {
  if (typeof window === "undefined") return;

  if (
    payload.eventType === "view_place_detail" &&
    payload.placeId
  ) {
    rememberRecentViewedPlace(
      payload.placeId,
    );
  }

  try {
    const context = getAnalyticsContext();

    const locale =
      payload.locale ||
      (window.location.pathname.startsWith("/en")
        ? "en"
        : "fr");

    const platform =
      payload.platform || context.platform;

    const viewerLocation =
      readRecentAnalyticsLocation();

    const body = {
      ...payload,
      ...context,
      locale,
      platform,
      viewerLocation:
        viewerLocation
          ? {
              lat:
                viewerLocation.lat,
              lng:
                viewerLocation.lng,
            }
          : undefined,
    };

    fetch("/api/v1/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": context.sessionId,
        "x-launch-id": context.launchId,
        "x-client-time-zone":
          context.clientTimeZone,
        "x-utc-offset-minutes":
          String(context.utcOffsetMinutes),
        "x-locale": locale,
        "x-platform": platform,
        "x-device-type":
          context.deviceType,
        "x-device-os":
          context.os,
        "x-device-browser":
          context.browser,
      },
      body: JSON.stringify(body),
      keepalive: true,
      cache: "no-store",
    }).catch(() => {});
  } catch {}
}
