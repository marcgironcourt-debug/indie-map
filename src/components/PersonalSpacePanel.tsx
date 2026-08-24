"use client";

import React from "react";
import { trackEvent } from "@/lib/analytics";

export type PersonalSpacePanelMode = "dashboard" | "profile" | "friends" | "sharedLists";

export type PersonalSpaceAuthMode = "signup" | "login" | "resetRequest" | "resetConfirm";

export type PersonalSpaceAuthProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  profileCompleted: boolean;
  contributionRank?: number | null;
};

type FriendPublicUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  contributionRank?: number | null;
};

type FriendEntry = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  user: FriendPublicUser;
};

type FriendsPayload = {
  friends: FriendEntry[];
  incomingRequests: FriendEntry[];
  outgoingRequests: FriendEntry[];
};

type SharedListMember = {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  seenAt: string | null;
  user: FriendPublicUser;
};

type SharedListPlace = {
  id: string;
  placeId: string;
  addedById: string | null;
  createdAt: string;
};

type SharedList = {
  id: string;
  title: string;
  ownerId: string;
  owner: FriendPublicUser;
  createdAt: string;
  updatedAt: string;
  members: SharedListMember[];
  places: SharedListPlace[];
};

type ContributionEntry = {
  placeId: string;
  approvedAt: string | null;
};

type PlaceSummary = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  category?: string;
  miniText?: string;
  website?: string;
  phone?: string;
  openingHours?: string;
  timeZone?: string;
  lat?: number;
  lng?: number;
  panoramaImage?: string | null;
};

type FriendVisitedPlace = {
  placeId: string;
  visitedAt: string | null;
  updatedAt: string;
};

type FriendProfilePayload = {
  friend: FriendPublicUser & {
    visitedPlacesVisibleToFriends: boolean;
    commentsVisibleToFriends: boolean;
  };
  visitedPlaces: FriendVisitedPlace[];
};

type PersonalSpacePanelProps = {
  isFr: boolean;
  places: PlaceSummary[];
  mode: PersonalSpacePanelMode;
  initialSharedListId?: string | null;
  incomingFriendRequestCount?: number;
  unseenSharedListCount?: number;
  authLoading: boolean;
  authProfile: PersonalSpaceAuthProfile | null;
  authMode: PersonalSpaceAuthMode;
  authEmail: string;
  authUsername: string;
  authPassword: string;
  authSending: boolean;
  authResetDone: boolean;
  authError: string;
  profileUsername: string;
  profileAvatarColor: string;
  profileHomeCity: string;
  profileAgeRange: string;
  profileLocale: "fr" | "en";
  commentsVisibleToFriends: boolean;
  visitedPlacesVisibleToFriends: boolean;
  profileSaving: boolean;
  profileSuccess: string;
  profileError: string;
  savedPlacesCount: number;
  savedPlaceIds: string[];
  visitedSavedPlaceIds: string[];
  visitedCitiesCount: number;
  visitedThisMonthCount: number;
  contributionsCount: number;
  onModeChange: (mode: PersonalSpacePanelMode) => void;
  onOpenSavedPlaces: () => void;
  onToggleSavedPlaceVisited: (placeId: string) => void;
  onOpenPlace?: (place: PlaceSummary, source?: string) => void;
  onSwitchLocale: (nextLocale: "fr" | "en") => void;
  onSetAuthMode: (mode: PersonalSpaceAuthMode) => void;
  onSetAuthEmail: (value: string) => void;
  onSetAuthUsername: (value: string) => void;
  onSetAuthPassword: (value: string) => void;
  onSetAuthError: (value: string) => void;
  onSetAuthResetDone: (value: boolean) => void;
  onSetAuthForceForm: (value: boolean) => void;
  onSetAuthResetToken: (value: string) => void;
  onSetProfileUsername: (value: string) => void;
  onSetProfileAvatarColor: (value: string) => void;
  onSetProfileHomeCity: (value: string) => void;
  onSetProfileAgeRange: (value: string) => void;
  onSetProfileLocale: (value: "fr" | "en") => void;
  onSetCommentsVisibleToFriends: (value: boolean) => void;
  onSetVisitedPlacesVisibleToFriends: (value: boolean) => void;
  onSubmitAuth: () => void;
  onRequestPasswordReset: () => void;
  onConfirmPasswordReset: () => void;
  onSaveProfile: () => void;
  onSharedListsSeen?: () => void;
  hasProfessionalAccess?: boolean;
  onOpenProfessionalSpace?: () => void;
  onLogout: () => void;
};

const AVATAR_COLORS = ["#F97316", "#84A98C", "#2563EB", "#A855F7", "#EAB308", "#EC4899"];

function ContributorRankBadge({
  rank,
  compact = false,
}: {
  rank?: number | null;
  compact?: boolean;
}) {
  if (!rank || rank < 1) return null;

  return (
    <span
      className={`absolute -right-1 -top-1 z-20 flex items-center justify-center rounded-full border border-white/20 bg-[#202020] font-bold shadow-[0_4px_12px_rgba(0,0,0,0.4)] ${
        compact
          ? "h-5 min-w-5 px-1 text-[8px]"
          : "h-6 min-w-6 px-1 text-[9px]"
      }`}
      aria-label={`Contribution rank ${rank}`}
      title={`#${rank}`}
    >
      {rank === 1 ? (
        <svg
          viewBox="0 0 24 24"
          className={compact ? "h-3 w-3" : "h-3.5 w-3.5"}
          fill="currentColor"
          aria-hidden="true"
          style={{ color: "#EAB308" }}
        >
          <path d="M3.2 7.2 7.4 11l4.6-7 4.6 7 4.2-3.8-2 10.8H5.2L3.2 7.2Zm2.6 12.1h12.4v1.8H5.8v-1.8Z" />
        </svg>
      ) : (
        <span className="text-white">
          #{rank}
        </span>
      )}
    </span>
  );
}

let sharedListsInflight: Promise<SharedList[]> | null = null;
let sharedListsCache: { at: number; lists: SharedList[] } | null = null;

function clearSharedListsCache() {
  sharedListsCache = null;
  sharedListsInflight = null;
}

async function fetchSharedListsOnce(force = false, markSeen = false) {
  const now = Date.now();

  if (!markSeen && !force && sharedListsCache && now - sharedListsCache.at < 10000) {
    return sharedListsCache.lists;
  }

  if (!sharedListsInflight) {
    const url = markSeen ? "/api/v1/me/shared-lists?markSeen=1" : "/api/v1/me/shared-lists";
    sharedListsInflight = fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          throw new Error("shared_lists_load_failed");
        }

        const lists = Array.isArray(data.lists) ? data.lists : [];
        sharedListsCache = { at: Date.now(), lists };
        return lists;
      })
      .finally(() => {
        sharedListsInflight = null;
      });
  }

  return sharedListsInflight;
}

export default function PersonalSpacePanel({
  isFr,
  places,
  mode,
  initialSharedListId,
  incomingFriendRequestCount = 0,
  unseenSharedListCount = 0,
  authLoading,
  authProfile,
  authMode,
  authEmail,
  authUsername,
  authPassword,
  authSending,
  authResetDone,
  authError,
  profileUsername,
  profileAvatarColor,
  profileHomeCity,
  profileAgeRange,
  profileLocale,
  commentsVisibleToFriends,
  visitedPlacesVisibleToFriends,
  profileSaving,
  profileSuccess,
  profileError,
  savedPlacesCount,
  savedPlaceIds,
  visitedSavedPlaceIds,
  visitedCitiesCount,
  visitedThisMonthCount,
  contributionsCount,
  onModeChange,
  onOpenSavedPlaces,
  onToggleSavedPlaceVisited,
  onOpenPlace,
  onSwitchLocale,
  onSetAuthMode,
  onSetAuthEmail,
  onSetAuthUsername,
  onSetAuthPassword,
  onSetAuthError,
  onSetAuthResetDone,
  onSetAuthForceForm,
  onSetAuthResetToken,
  onSetProfileUsername,
  onSetProfileAvatarColor,
  onSetProfileHomeCity,
  onSetProfileAgeRange,
  onSetProfileLocale,
  onSetCommentsVisibleToFriends,
  onSetVisitedPlacesVisibleToFriends,
  onSubmitAuth,
  onRequestPasswordReset,
  onConfirmPasswordReset,
  onSaveProfile,
  onSharedListsSeen,
  hasProfessionalAccess,
  onOpenProfessionalSpace,
  onLogout,
}: PersonalSpacePanelProps) {
  const locale = isFr ? "fr" : "en";
  const [friendsLoading, setFriendsLoading] = React.useState(false);
  const [friendsError, setFriendsError] = React.useState("");
  const [friendsPayload, setFriendsPayload] = React.useState<FriendsPayload>({
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
  });
  const [friendSearchQuery, setFriendSearchQuery] = React.useState("");
  const [friendSearchLoading, setFriendSearchLoading] = React.useState(false);
  const [friendSearchError, setFriendSearchError] = React.useState("");
  const [friendSearchUsers, setFriendSearchUsers] = React.useState<FriendPublicUser[]>([]);
  const [friendRequestSendingId, setFriendRequestSendingId] = React.useState<string | null>(null);
  const [friendRequestMessage, setFriendRequestMessage] = React.useState("");
  const [friendResponseSendingId, setFriendResponseSendingId] = React.useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = React.useState<FriendPublicUser | null>(null);
  const [friendProfileLoading, setFriendProfileLoading] = React.useState(false);
  const [friendProfileError, setFriendProfileError] = React.useState("");
  const [friendProfilePayload, setFriendProfilePayload] = React.useState<FriendProfilePayload | null>(null);
  const [pendingDeleteFriendId, setPendingDeleteFriendId] = React.useState("");
  const [sharedListsLoading, setSharedListsLoading] = React.useState(false);
  const [sharedListsError, setSharedListsError] = React.useState("");
  const [sharedLists, setSharedLists] = React.useState<SharedList[]>([]);
  const [selectedSharedListId, setSelectedSharedListId] = React.useState<string | null>(initialSharedListId || null);
  const [newSharedListTitle, setNewSharedListTitle] = React.useState("");
  const [sharedListSaving, setSharedListSaving] = React.useState(false);
  const [sharedListMessage, setSharedListMessage] = React.useState("");
  const [sharedListRenameOpen, setSharedListRenameOpen] = React.useState(false);
  const [sharedListRenameTitle, setSharedListRenameTitle] = React.useState("");
  const [pendingDeleteSharedListId, setPendingDeleteSharedListId] = React.useState("");
  const [selectedSharedFriendId, setSelectedSharedFriendId] = React.useState("");
  const [sharedPlaceQuery, setSharedPlaceQuery] = React.useState("");
  const [showContributions, setShowContributions] = React.useState(false);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [suggestionText, setSuggestionText] = React.useState("");
  const [suggestionSending, setSuggestionSending] = React.useState(false);
  const [suggestionMessage, setSuggestionMessage] = React.useState("");
  const [suggestionError, setSuggestionError] = React.useState("");
  const [contributionsLoading, setContributionsLoading] = React.useState(false);
  const [contributionsError, setContributionsError] = React.useState("");
  const [contributions, setContributions] = React.useState<ContributionEntry[]>([]);
  const [rewardPointsBalance, setRewardPointsBalance] = React.useState(0);
  const [rewardPointsLoading, setRewardPointsLoading] = React.useState(false);
  const [referralInstallPoints, setReferralInstallPoints] = React.useState(50);
  const [referralSignupPoints, setReferralSignupPoints] = React.useState(50);
  const [referralShareUrl, setReferralShareUrl] = React.useState("");
  const [referralLinkLoading, setReferralLinkLoading] = React.useState(false);
  const [referralMessage, setReferralMessage] = React.useState("");
  const [referralQrOpen, setReferralQrOpen] = React.useState(false);
  const [referralQrDataUrl, setReferralQrDataUrl] = React.useState("");
  const [referralQrLoading, setReferralQrLoading] = React.useState(false);
  const friendsLoadingRef = React.useRef(false);
  const sharedListsLoadingRef = React.useRef(false);
  const onSharedListsSeenRef = React.useRef(onSharedListsSeen);

  React.useEffect(() => {
    onSharedListsSeenRef.current = onSharedListsSeen;
  }, [onSharedListsSeen]);

  async function submitSuggestion() {
    const message =
      suggestionText.trim();

    if (
      message.length < 3 ||
      message.length > 1000 ||
      suggestionSending
    ) {
      return;
    }

    setSuggestionSending(true);
    setSuggestionMessage("");
    setSuggestionError("");

    try {
      const response =
        await fetch(
          "/api/v1/me/suggestions",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                message,
                locale,
              }),
          },
        );

      const data =
        await response
          .json()
          .catch(() => null);

      if (
        !response.ok ||
        !data?.ok
      ) {
        throw new Error(
          data?.error ||
            "suggestion_send_failed",
        );
      }

      setSuggestionText("");

      setSuggestionMessage(
        isFr
          ? "Merci ! Ta suggestion a bien été envoyée."
          : "Thank you! Your suggestion has been sent.",
      );
    } catch {
      setSuggestionError(
        isFr
          ? "Impossible d’envoyer ta suggestion pour le moment."
          : "Unable to send your suggestion right now.",
      );
    } finally {
      setSuggestionSending(false);
    }
  }

  function findPlace(placeId: string) {
    return places.find((place) => String(place.id) === String(placeId)) ?? null;
  }

  function normalizeSearchText(value: unknown) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  const savedPlacesPreview = React.useMemo(() => {
    const placeById = new Map(
      places.map((place) => [String(place.id), place]),
    );

    return savedPlaceIds
      .map((id) => placeById.get(String(id)))
      .filter((place): place is PlaceSummary => Boolean(place))
      .slice(0, 6);
  }, [places, savedPlaceIds]);

  const selectedSharedList = sharedLists.find((list) => list.id === selectedSharedListId) ?? null;

  React.useEffect(() => {
    setSharedListRenameOpen(false);
    setSharedListRenameTitle("");
  }, [selectedSharedListId]);

  function isUnseenSharedList(list: SharedList) {
    if (!authProfile) return false;
    if (list.ownerId === authProfile.id) return false;
    return list.members.some((member) => member.userId === authProfile.id && member.role !== "owner" && !member.seenAt);
  }

  React.useEffect(() => {
    if (mode !== "sharedLists") return;
    if (!initialSharedListId) return;
    setSelectedSharedListId(initialSharedListId);
  }, [mode, initialSharedListId]);

  const sharedPlaceResults = React.useMemo(() => {
    const sortByName = (items: PlaceSummary[]) =>
      [...items].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), locale, { sensitivity: "base" }));

    const q = normalizeSearchText(sharedPlaceQuery);
    if (!q) return sortByName(places);

    const cityMatches = places.filter((place) => normalizeSearchText(place.city) === q);

    if (cityMatches.length > 0) {
      return sortByName(cityMatches);
    }

    return sortByName(
      places.filter((place) => {
        const haystack = normalizeSearchText([place.name, place.city, place.address, place.category].join(" "));
        return haystack.includes(q);
      })
    );
  }, [places, sharedPlaceQuery, locale]);

  const reloadSharedLists = React.useCallback(async (force = false) => {
    const currentUserId = authProfile?.id;
    if (!currentUserId) return;
    if (sharedListsLoadingRef.current) return;

    sharedListsLoadingRef.current = true;
    setSharedListsLoading(sharedListsCache === null);
    setSharedListsError("");

    try {
      const markSeen = mode === "sharedLists";
      const nextLists = await fetchSharedListsOnce(force || markSeen, markSeen);
      const normalizedLists = markSeen
        ? nextLists.map((list: SharedList) => ({
            ...list,
            members: list.members.map((member) =>
              member.userId === currentUserId && member.role !== "owner" && !member.seenAt
                ? { ...member, seenAt: new Date().toISOString() }
                : member
            ),
          }))
        : nextLists;

      setSharedLists(normalizedLists);

      if (markSeen) {
        onSharedListsSeenRef.current?.();
      }

      setSelectedSharedListId((current) =>
        current && !normalizedLists.some((list: SharedList) => list.id === current) ? null : current
      );
    } catch {
      setSharedListsError(
        isFr
          ? "Impossible de charger tes listes partagées pour le moment."
          : "Unable to load your shared lists right now."
      );
    } finally {
      sharedListsLoadingRef.current = false;
      setSharedListsLoading(false);
    }
  }, [authProfile?.id, isFr, mode]);

  async function createSharedList() {
    const title = newSharedListTitle.trim();

    if (!title) {
      setSharedListMessage(isFr ? "Donne un titre à ta liste." : "Give your list a title.");
      return;
    }

    setSharedListSaving(true);
    setSharedListMessage("");

    try {
      const res = await fetch("/api/v1/me/shared-lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error("shared_list_create_failed");
      }

      trackEvent({
        eventType: "create_shared_list",
        metadata: {
          listId: typeof data.listId === "string" ? data.listId : null,
          title,
          source: "personal_space"
        }
      });

      setNewSharedListTitle("");
      setSelectedSharedListId(typeof data.listId === "string" ? data.listId : null);
      setSharedListMessage(isFr ? "Liste créée." : "List created.");
      await reloadSharedLists(true);
    } catch {
      setSharedListMessage(isFr ? "Impossible de créer cette liste." : "Unable to create this list.");
    } finally {
      setSharedListSaving(false);
    }
  }

  async function addFriendToSharedList() {
    if (!selectedSharedList || !selectedSharedFriendId) return;

    const listId = selectedSharedList.id;
    const addedUserId = selectedSharedFriendId;

    setSharedListSaving(true);
    setSharedListMessage("");

    try {
      const res = await fetch(`/api/v1/me/shared-lists/${encodeURIComponent(listId)}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: addedUserId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error("shared_list_member_failed");
      }

      const addedFriend = friendsPayload.friends.find((entry) => entry.user.id === addedUserId)?.user;

      clearSharedListsCache();

      if (addedFriend) {
        const now = new Date().toISOString();
        const memberId = typeof data.memberId === "string" ? data.memberId : `${listId}:${addedUserId}`;

        setSharedLists((current) =>
          current.map((list) => {
            if (list.id !== listId) return list;

            if (list.members.some((member) => member.userId === addedUserId)) {
              return list;
            }

            return {
              ...list,
              members: [
                ...list.members,
                {
                  id: memberId,
                  userId: addedUserId,
                  role: addedUserId === authProfile?.id ? "owner" : "member",
                  createdAt: now,
                  seenAt: addedUserId === authProfile?.id ? now : null,
                  user: addedFriend,
                },
              ],
            };
          })
        );
      } else {
        await reloadSharedLists(true);
      }

      setSelectedSharedFriendId("");
      setSharedListMessage(isFr ? "Ami ajouté à la liste." : "Friend added to the list.");
    } catch {
      setSharedListMessage(isFr ? "Impossible d’ajouter cet ami." : "Unable to add this friend.");
    } finally {
      setSharedListSaving(false);
    }
  }

  async function addPlaceToSharedList(placeId: string) {
    if (!selectedSharedList) return;

    setSharedListSaving(true);
    setSharedListMessage("");

    try {
      const res = await fetch(`/api/v1/me/shared-lists/${encodeURIComponent(selectedSharedList.id)}/places`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ placeId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error("shared_list_place_failed");
      }

      trackEvent({
        eventType: "add_place_to_shared_list",
        placeId,
        metadata: {
          listId: selectedSharedList.id,
          listTitle: selectedSharedList.title,
          source: "personal_space"
        }
      });

      setSharedPlaceQuery("");
      setSharedListMessage(isFr ? "Lieu ajouté à la liste." : "Place added to the list.");
      await reloadSharedLists(true);
    } catch {
      setSharedListMessage(isFr ? "Impossible d’ajouter ce lieu." : "Unable to add this place.");
    } finally {
      setSharedListSaving(false);
    }
  }

  async function removePlaceFromSharedList(placeId: string) {
    if (!selectedSharedList) return;

    setSharedListSaving(true);
    setSharedListMessage("");

    try {
      const res = await fetch(`/api/v1/me/shared-lists/${encodeURIComponent(selectedSharedList.id)}/places`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ placeId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error("shared_list_place_remove_failed");
      }

      setSharedListMessage(isFr ? "Lieu retiré de la liste." : "Place removed from the list.");
      await reloadSharedLists(true);
    } catch {
      setSharedListMessage(isFr ? "Impossible de retirer ce lieu." : "Unable to remove this place.");
    } finally {
      setSharedListSaving(false);
    }
  }

  async function deleteSelectedFriend() {
    if (!selectedFriend) return;

    if (pendingDeleteFriendId !== selectedFriend.id) {
      setPendingDeleteFriendId(selectedFriend.id);
      setFriendProfileError("");
      return;
    }

    setPendingDeleteFriendId("");
    setFriendsLoading(true);
    setFriendsError("");

    try {
      const res = await fetch("/api/v1/me/friends", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          friendId: selectedFriend.id,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error("friend_delete_failed");
      }

      setSelectedFriend(null);
      setPendingDeleteFriendId("");
      setFriendProfilePayload(null);
      setFriendProfileError("");
      await reloadFriends();
    } catch {
      setFriendsError(isFr ? "Impossible de supprimer cet ami." : "Unable to remove this friend.");
    } finally {
      setFriendsLoading(false);
    }
  }

  async function renameSharedList() {
    if (!selectedSharedList || !authProfile) return;
    if (selectedSharedList.ownerId !== authProfile.id) return;

    const listId = selectedSharedList.id;
    const title = sharedListRenameTitle.trim();

    if (!title) {
      setSharedListMessage(
        isFr ? "Le titre de la liste ne peut pas être vide." : "The list title cannot be empty."
      );
      return;
    }

    if (title === selectedSharedList.title) {
      setSharedListRenameOpen(false);
      setSharedListRenameTitle("");
      return;
    }

    setSharedListSaving(true);
    setSharedListMessage("");

    try {
      const res = await fetch(
        `/api/v1/me/shared-lists/${encodeURIComponent(listId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok || typeof data.title !== "string") {
        throw new Error("shared_list_rename_failed");
      }

      clearSharedListsCache();

      setSharedLists((current) =>
        current.map((list) =>
          list.id === listId
            ? {
                ...list,
                title: data.title,
                updatedAt:
                  typeof data.updatedAt === "string"
                    ? data.updatedAt
                    : list.updatedAt,
              }
            : list
        )
      );

      setSharedListRenameOpen(false);
      setSharedListRenameTitle("");
      setSharedListMessage(
        isFr ? "Liste renommée." : "List renamed."
      );
    } catch {
      setSharedListMessage(
        isFr
          ? "Impossible de renommer cette liste."
          : "Unable to rename this list."
      );
    } finally {
      setSharedListSaving(false);
    }
  }

  async function deleteSharedList() {
    if (!selectedSharedList) return;

    if (pendingDeleteSharedListId !== selectedSharedList.id) {
      setPendingDeleteSharedListId(selectedSharedList.id);
      setSharedListMessage(isFr ? "Appuie encore pour confirmer la suppression." : "Tap again to confirm deletion.");
      return;
    }

    setPendingDeleteSharedListId("");
    setSharedListSaving(true);
    setSharedListMessage("");

    try {
      const res = await fetch(`/api/v1/me/shared-lists/${encodeURIComponent(selectedSharedList.id)}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error("shared_list_delete_failed");
      }

      const deletedListId = selectedSharedList.id;

      clearSharedListsCache();
      sharedListsLoadingRef.current = false;
      setSharedListsLoading(false);
      setSharedLists((current) => current.filter((list) => list.id !== deletedListId));
      setSelectedSharedListId(null);
      setPendingDeleteSharedListId("");
      setSelectedSharedFriendId("");
      setSharedPlaceQuery("");
      setSharedListMessage(isFr ? "Liste supprimée." : "List deleted.");
    } catch {
      setSharedListMessage(isFr ? "Impossible de supprimer cette liste." : "Unable to delete this list.");
    } finally {
      setSharedListSaving(false);
    }
  }

  async function prepareReferralLink() {
    if (!authProfile) {
      setReferralShareUrl("");
      return;
    }

    setReferralLinkLoading(true);

    try {
      const res = await fetch(
        "/api/v1/me/referrals",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            locale,
          }),
        },
      );

      const data =
        await res.json().catch(
          () => null,
        );

      if (
        !res.ok ||
        !data?.ok ||
        typeof data.shareUrl !== "string"
      ) {
        throw new Error(
          "referral_link_failed",
        );
      }

      setReferralShareUrl(
        data.shareUrl,
      );
    } catch {
      setReferralShareUrl("");
    } finally {
      setReferralLinkLoading(false);
    }
  }

  async function inviteFriend() {
    if (!referralShareUrl) {
      setReferralMessage(
        isFr
          ? "Le lien est en cours de préparation."
          : "Your link is being prepared.",
      );

      return;
    }

    setReferralMessage("");

    const nav =
      navigator as Navigator & {
        share?: (data: {
          title?: string;
          text?: string;
          url?: string;
        }) => Promise<void>;
        clipboard?: {
          writeText?: (
            text: string,
          ) => Promise<void>;
        };
      };

    const shareData = {
      title: "Indie Map",
      text: isFr
        ? "Je te recommande Indie Map, la carte des lieux locaux et indépendants."
        : "I recommend Indie Map, the map of local and independent places.",
      url: referralShareUrl,
    };

    /*
     * Le lien existe déjà AVANT le clic :
     * navigator.share() reste donc directement
     * lié au geste utilisateur et ouvre la
     * feuille native iOS / Android.
     */
    if (typeof nav.share === "function") {
      try {
        await nav.share(
          shareData,
        );

        setReferralMessage(
          isFr
            ? "Lien partagé."
            : "Link shared.",
        );

        /*
         * Le prochain partage recevra
         * son propre token.
         */
        void prepareReferralLink();

        return;
      } catch (error) {
        if (
          (error as {
            name?: string;
          })?.name === "AbortError"
        ) {
          return;
        }
      }
    }

    try {
      if (
        typeof nav.clipboard?.writeText !==
        "function"
      ) {
        throw new Error(
          "clipboard_unavailable",
        );
      }

      await nav.clipboard.writeText(
        referralShareUrl,
      );

      setReferralMessage(
        isFr
          ? "Lien copié."
          : "Link copied.",
      );

      void prepareReferralLink();
    } catch {
      setReferralMessage(
        isFr
          ? "Impossible de partager le lien pour le moment."
          : "Unable to share the link right now.",
      );
    }
  }

  async function openReferralQrCode() {
    if (!referralShareUrl || referralQrLoading) {
      return;
    }

    setReferralQrLoading(true);
    setReferralMessage("");

    try {
      const QRCode = await import("qrcode");

      const dataUrl = await QRCode.toDataURL(
        referralShareUrl,
        {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "M",
        },
      );

      setReferralQrDataUrl(dataUrl);
      setReferralQrOpen(true);
    } catch {
      setReferralMessage(
        isFr
          ? "Impossible d’afficher le QR code pour le moment."
          : "Unable to display the QR code right now.",
      );
    } finally {
      setReferralQrLoading(false);
    }
  }

  async function openFriendProfile(user: FriendPublicUser) {
    setSelectedFriend(user);
    setFriendProfileLoading(true);
    setFriendProfileError("");
    setFriendProfilePayload(null);

    try {
      const res = await fetch(`/api/v1/me/friends/${encodeURIComponent(user.id)}/profile`, { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error("friend_profile_failed");
      }

      setFriendProfilePayload({
        friend: data.friend,
        visitedPlaces: Array.isArray(data.visitedPlaces) ? data.visitedPlaces : [],

      });
    } catch {
      setFriendProfileError(isFr ? "Impossible de charger le profil de cet ami pour le moment." : "Unable to load this friend profile right now.");
    } finally {
      setFriendProfileLoading(false);
    }
  }

  const reloadFriends = React.useCallback(async () => {
    if (!authProfile) return;
    if (friendsLoadingRef.current) return;

    friendsLoadingRef.current = true;
    setFriendsLoading(true);
    setFriendsError("");

    try {
      const res = await fetch("/api/v1/me/friends", { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error("friends_load_failed");
      }

      setFriendsPayload({
        friends: Array.isArray(data.friends) ? data.friends : [],
        incomingRequests: Array.isArray(data.incomingRequests) ? data.incomingRequests : [],
        outgoingRequests: Array.isArray(data.outgoingRequests) ? data.outgoingRequests : [],
      });
    } catch {
      setFriendsError(isFr ? "Impossible de charger tes amis pour le moment." : "Unable to load your friends right now.");
    } finally {
      friendsLoadingRef.current = false;
      setFriendsLoading(false);
    }
  }, [authProfile?.id, isFr]);

  React.useEffect(() => {
    if (!authProfile) return;
    if (mode === "friends" || mode === "dashboard") {
      reloadFriends();
      return;
    }
    if (mode === "sharedLists" && selectedSharedListId) {
      reloadFriends();
    }
  }, [mode, authProfile?.id, selectedSharedListId, reloadFriends]);

  React.useEffect(() => {
    if ((mode !== "sharedLists" && mode !== "dashboard") || !authProfile) return;
    reloadSharedLists();
  }, [mode, authProfile?.id, reloadSharedLists]);

  React.useEffect(() => {
    if (!authProfile) {
      setRewardPointsBalance(0);
      return;
    }

    let cancelled = false;

    setRewardPointsLoading(true);

    fetch("/api/v1/me/rewards", {
      cache: "no-store",
    })
      .then(async (res) => {
        const data =
          await res.json().catch(
            () => null,
          );

        if (
          !res.ok ||
          !data?.ok
        ) {
          throw new Error(
            "reward_points_load_failed",
          );
        }

        if (cancelled) {
          return;
        }

        const balance =
          Number(data.balance);

        const installPoints =
          Number(
            data.referral?.installPoints,
          );

        const signupPoints =
          Number(
            data.referral?.signupPoints,
          );

        setRewardPointsBalance(
          Number.isFinite(balance)
            ? balance
            : 0,
        );

        if (
          Number.isFinite(
            installPoints,
          )
        ) {
          setReferralInstallPoints(
            installPoints,
          );
        }

        if (
          Number.isFinite(
            signupPoints,
          )
        ) {
          setReferralSignupPoints(
            signupPoints,
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRewardPointsBalance(0);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRewardPointsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authProfile?.id]);

  React.useEffect(() => {
    if (!authProfile) {
      setReferralShareUrl("");
      return;
    }

    void prepareReferralLink();
  }, [authProfile?.id, locale]);

  React.useEffect(() => {
    if (!showContributions || !authProfile) return;

    let cancelled = false;

    setContributionsLoading(true);
    setContributionsError("");

    fetch("/api/v1/me/contributions", {
      cache: "no-store",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          throw new Error("contributions_load_failed");
        }

        if (cancelled) return;

        setContributions(
          Array.isArray(data.contributions)
            ? data.contributions
                .map((entry: unknown) => {
                  if (
                    !entry ||
                    typeof entry !== "object" ||
                    Array.isArray(entry)
                  ) {
                    return null;
                  }

                  const value = entry as {
                    placeId?: unknown;
                    approvedAt?: unknown;
                  };

                  const placeId =
                    typeof value.placeId === "string"
                      ? value.placeId.trim()
                      : "";

                  if (!placeId) {
                    return null;
                  }

                  return {
                    placeId,
                    approvedAt:
                      typeof value.approvedAt === "string"
                        ? value.approvedAt
                        : null,
                  };
                })
                .filter(
                  (
                    entry: ContributionEntry | null,
                  ): entry is ContributionEntry =>
                    Boolean(entry),
                )
            : [],
        );
      })
      .catch(() => {
        if (cancelled) return;

        setContributions([]);

        setContributionsError(
          isFr
            ? "Impossible de charger tes contributions pour le moment."
            : "Unable to load your contributions right now.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setContributionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    showContributions,
    authProfile?.id,
    isFr,
  ]);

  React.useEffect(() => {
    if (mode !== "friends" || !authProfile) return;

    const q = friendSearchQuery.trim();

    if (q.length < 2) {
      setFriendSearchUsers([]);
      setFriendSearchError("");
      setFriendSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setFriendSearchLoading(true);
      setFriendSearchError("");

      try {
        const res = await fetch(`/api/v1/users/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok) {
          throw new Error("friend_search_failed");
        }

        if (!cancelled) {
          setFriendSearchUsers(Array.isArray(data.users) ? data.users : []);
        }
      } catch {
        if (!cancelled) {
          setFriendSearchUsers([]);
          setFriendSearchError(isFr ? "Recherche impossible pour le moment." : "Search unavailable right now.");
        }
      } finally {
        if (!cancelled) {
          setFriendSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, authProfile, friendSearchQuery, isFr]);

  async function sendFriendRequest(receiverId: string) {
    setFriendRequestSendingId(receiverId);
    setFriendRequestMessage("");

    try {
      const res = await fetch("/api/v1/me/friends/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ receiverId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error("friend_request_failed");
      }

      setFriendRequestMessage(isFr ? "Demande envoyée." : "Request sent.");
      await reloadFriends();
    } catch {
      setFriendRequestMessage(isFr ? "Impossible d’envoyer la demande." : "Unable to send request.");
    } finally {
      setFriendRequestSendingId(null);
    }
  }

  async function respondToFriendRequest(friendshipId: string, action: "accept" | "decline") {
    setFriendResponseSendingId(friendshipId);
    setFriendRequestMessage("");

    try {
      const res = await fetch("/api/v1/me/friends/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friendshipId, action }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error("friend_response_failed");
      }

      setFriendRequestMessage(action === "accept" ? (isFr ? "Demande acceptée." : "Request accepted.") : (isFr ? "Demande refusée." : "Request declined."));
      await reloadFriends();
    } catch {
      setFriendRequestMessage(isFr ? "Impossible de répondre à la demande." : "Unable to respond to the request.");
    } finally {
      setFriendResponseSendingId(null);
    }
  }

  const legalLinks = (
    <section className="mt-6 px-1">
      <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30">
        {isFr ? "Aide et sécurité" : "Help and safety"}
      </p>
      <div className="space-y-1">
        <a
          href={`/${locale}/privacy`}
          onClick={(event) => {
            event.preventDefault();
            window.location.href = `/${locale}/privacy`;
          }}
          className="block py-0 text-[11px] font-medium text-white/60 no-underline hover:text-white/85"
        >
          {isFr ? "Confidentialité" : "Privacy"}
        </a>
        <a
          href={`/${locale}/support`}
          onClick={(event) => {
            event.preventDefault();
            window.location.href = `/${locale}/support`;
          }}
          className="block py-0 text-[11px] font-medium text-white/60 no-underline hover:text-white/85"
        >
          Support
        </a>
        <a
          href="mailto:contact@indie-map.com"
          className="block py-0 text-[11px] font-medium text-white/60 no-underline hover:text-white/85"
        >
          Contact
        </a>
      </div>
    </section>
  );

  if (authLoading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
          {isFr ? "Espace perso" : "Personal space"}
        </p>
        <h2 className="mt-2 font-serif text-[24px] font-semibold leading-tight text-white">
          {isFr ? "Chargement..." : "Loading..."}
        </h2>
      </div>
    );
  }

  if (!authProfile || authMode === "resetConfirm") {
    return (
      <>
        <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
            {isFr ? "Espace perso" : "Personal space"}
          </p>
          <button
            type="button"
            onClick={() => onSwitchLocale(isFr ? "en" : "fr")}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 px-2 text-[15px] hover:bg-white/12"
            aria-label={isFr ? "Switch to English" : "Passer en français"}
          >
            {isFr ? "🇬🇧" : "🇫🇷"}
          </button>
        </div>
        <h2 className="mt-2 font-serif text-[25px] font-semibold leading-tight text-white">
          {authMode === "signup"
            ? (isFr ? "Créer un compte" : "Create an account")
            : authMode === "login"
              ? (isFr ? "Se connecter" : "Sign in")
              : authMode === "resetRequest"
                ? (isFr ? "Mot de passe oublié" : "Forgot password")
                : (isFr ? "Nouveau mot de passe" : "New password")}
        </h2>

        {authMode === "resetRequest" || authMode === "resetConfirm" ? null : (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onSetAuthMode("signup");
                onSetAuthError("");
                onSetAuthResetDone(false);
              }}
              className={`rounded-2xl border px-3 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] ${authMode === "signup" ? "border-white/25 bg-white text-black" : "border-white/10 bg-white/8 text-white/65"}`}
            >
              {isFr ? "Créer un compte" : "Create account"}
            </button>
            <button
              type="button"
              onClick={() => {
                onSetAuthMode("login");
                onSetAuthError("");
                onSetAuthResetDone(false);
              }}
              className={`rounded-2xl border px-3 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] ${authMode === "login" ? "border-white/25 bg-white text-black" : "border-white/10 bg-white/8 text-white/65"}`}
            >
              {isFr ? "Se connecter" : "Sign in"}
            </button>
          </div>
        )}

        <p className="mt-3 text-[14px] leading-relaxed text-white/65">
          {authMode === "signup"
            ? (isFr ? "Crée ton espace personnel avec un email, un pseudo et un mot de passe." : "Create your personal space with an email, a username, and a password.")
            : authMode === "login"
              ? (isFr ? "Connecte-toi avec ton email ou ton pseudo, puis ton mot de passe." : "Sign in with your email or username, then your password.")
              : authMode === "resetRequest"
                ? (isFr ? "Entre ton email. Indie Map t’enverra un lien sécurisé et te rappellera ton pseudo." : "Enter your email. Indie Map will send you a secure link and remind you of your username.")
                : (isFr ? "Choisis un nouveau mot de passe pour ton compte Indie Map." : "Choose a new password for your Indie Map account.")}
        </p>

        <div className="mt-5 space-y-3">
          {authMode === "signup" || authMode === "resetRequest" ? (
            <input
              type="email"
              value={authEmail}
              onChange={(e) => onSetAuthEmail(e.target.value)}
              placeholder={isFr ? "Email" : "Email"}
              className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
            />
          ) : null}

          {authMode === "signup" || authMode === "login" ? (
            <input
              type="text"
              value={authUsername}
              onChange={(e) => onSetAuthUsername(e.target.value)}
              placeholder={authMode === "signup" ? (isFr ? "Pseudo" : "Username") : (isFr ? "Email ou pseudo" : "Email or username")}
              className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
            />
          ) : null}

          {authMode === "signup" || authMode === "login" || authMode === "resetConfirm" ? (
            <input
              type="password"
              value={authPassword}
              onChange={(e) => onSetAuthPassword(e.target.value)}
              placeholder={authMode === "resetConfirm" ? (isFr ? "Nouveau mot de passe" : "New password") : (isFr ? "Mot de passe" : "Password")}
              className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
            />
          ) : null}

          <button
            type="button"
            onClick={authMode === "resetRequest" ? onRequestPasswordReset : authMode === "resetConfirm" ? onConfirmPasswordReset : onSubmitAuth}
            disabled={authSending}
            className="w-full rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-60"
          >
            {authSending
              ? (isFr ? "Patiente..." : "Please wait...")
              : authMode === "signup"
                ? (isFr ? "Créer mon compte" : "Create my account")
                : authMode === "login"
                  ? (isFr ? "Me connecter" : "Sign in")
                  : authMode === "resetRequest"
                    ? (isFr ? "Recevoir le lien" : "Send link")
                    : (isFr ? "Changer mon mot de passe" : "Change my password")}
          </button>

          {authMode === "signup" || authMode === "login" ? (
            <button
              type="button"
              onClick={() => {
                onSetAuthMode("resetRequest");
                onSetAuthError("");
                onSetAuthResetDone(false);
                onSetAuthForceForm(true);
                onSetAuthPassword("");
              }}
              className="w-full text-center text-[13px] font-medium text-white/55 underline underline-offset-4 hover:text-white/80"
            >
              {isFr ? "Mot de passe / pseudo oublié ?" : "Forgot password / username?"}
            </button>
          ) : null}

          {authMode === "resetRequest" || authMode === "resetConfirm" ? (
            <button
              type="button"
              onClick={() => {
                onSetAuthMode("login");
                onSetAuthError("");
                onSetAuthResetDone(false);
                onSetAuthForceForm(true);
                onSetAuthPassword("");
                onSetAuthResetToken("");

                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.delete("resetPasswordToken");
                  window.history.replaceState({}, "", url.toString());
                }
              }}
              className="w-full text-center text-[13px] font-medium text-white/55 underline underline-offset-4 hover:text-white/80"
            >
              {isFr ? "Retour à la connexion" : "Back to sign in"}
            </button>
          ) : null}

          {authResetDone ? (
            <p className="text-[13px] leading-relaxed text-emerald-200">
              {authMode === "login"
                ? (isFr ? "Mot de passe modifié. Ton pseudo est prérempli si le compte en avait un." : "Password updated. Your username is prefilled if the account had one.")
                : (isFr ? "Si un compte existe avec cet email, un lien vient d’être envoyé." : "If an account exists with that email, a link has been sent.")}
            </p>
          ) : null}

          {authError ? (
            <p className="text-[13px] leading-relaxed text-red-200">{authError}</p>
          ) : null}
        </div>
        </div>
        {legalLinks}
      </>
    );
  }

  if (!authProfile.profileCompleted) {
    return (
      <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">
          {isFr ? "Profil" : "Profile"}
        </p>
        <h2 className="mt-2 font-serif text-[25px] font-semibold leading-tight text-white">
          {isFr ? "Finalise ton profil" : "Complete your profile"}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-white/65">
          {isFr ? "Seul le pseudo est obligatoire. Les autres informations pourront être modifiées plus tard." : "Only the username is required. The other details can be changed later."}
        </p>
        <div className="mt-5 space-y-3">
          <input
            type="text"
            value={profileUsername}
            onChange={(e) => onSetProfileUsername(e.target.value)}
            placeholder={isFr ? "Pseudo obligatoire" : "Required username"}
            className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
          />
          <input
            type="text"
            value={profileHomeCity}
            onChange={(e) => onSetProfileHomeCity(e.target.value)}
            placeholder={isFr ? "Ville de résidence optionnelle" : "Optional home city"}
            className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-white/25"
          />
          <select
            value={profileAgeRange}
            onChange={(e) => onSetProfileAgeRange(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-[15px] text-white outline-none focus:border-white/25"
          >
            <option value="">{isFr ? "Tranche d’âge optionnelle" : "Optional age range"}</option>
            <option value="18_24">18–24</option>
            <option value="25_34">25–34</option>
            <option value="35_44">35–44</option>
            <option value="45_54">45–54</option>
            <option value="55_64">55–64</option>
            <option value="65_plus">65+</option>
            <option value="prefer_not_to_say">{isFr ? "Préfère ne pas répondre" : "Prefer not to say"}</option>
          </select>

          <label className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-left text-[15px] text-white">
            <span>{isFr ? "Langue" : "Language"}</span>
            <select
              value={profileLocale}
              onChange={(event) => onSetProfileLocale(event.target.value as "fr" | "en")}
              className="w-[128px] shrink-0 bg-transparent text-right text-[15px] font-semibold text-white/70 outline-none"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </label>

          {legalLinks}

          <button
            type="button"
            onClick={onSaveProfile}
            disabled={profileSaving}
            className="w-full rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-60"
          >
            {profileSaving ? (isFr ? "Enregistrement..." : "Saving...") : (isFr ? "Entrer dans mon espace" : "Enter my space")}
          </button>
          {profileError ? (
            <p className="text-[13px] leading-relaxed text-red-200">{profileError}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (showSuggestions) {
    return (
      <>
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setShowSuggestions(false);
              setSuggestionMessage("");
              setSuggestionError("");
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-[18px] text-white/75 hover:bg-white/12 active:bg-white/16"
            aria-label={isFr ? "Retour" : "Back"}
          >
            ←
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
              {isFr ? "Mon espace" : "My space"}
            </p>

            <h2 className="mt-0.5 font-serif text-[23px] font-semibold leading-tight text-white">
              Suggestions
            </h2>
          </div>

          <div className="h-10 w-10" />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-5">
          <p className="text-[14px] font-semibold text-white/90">
            {isFr
              ? "Une idée pour améliorer Indie Map ?"
              : "Have an idea to improve Indie Map?"}
          </p>

          <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">
            {isFr
              ? "Partage une amélioration, une idée de fonctionnalité ou simplement ton avis."
              : "Share an improvement, a feature idea, or simply your feedback."}
          </p>

          <textarea
            value={suggestionText}
            maxLength={1000}
            rows={8}
            onChange={(event) => {
              setSuggestionText(
                event.target.value,
              );
              setSuggestionMessage("");
              setSuggestionError("");
            }}
            placeholder={
              isFr
                ? "Écris ta suggestion ici…"
                : "Write your suggestion here…"
            }
            className="mt-5 box-border w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-[14px] leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-white/25"
          />

          <div className="mt-2 text-right text-[11px] tabular-nums text-white/35">
            {suggestionText.length} / 1000
          </div>

          <button
            type="button"
            onClick={submitSuggestion}
            disabled={
              suggestionSending ||
              suggestionText.trim().length < 3
            }
            className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.15em] text-black disabled:opacity-40"
          >
            {suggestionSending
              ? isFr
                ? "Envoi..."
                : "Sending..."
              : isFr
                ? "Envoyer"
                : "Send"}
          </button>

          {suggestionMessage ? (
            <p className="mt-3 text-[13px] leading-relaxed text-[#C7D6AD]">
              {suggestionMessage}
            </p>
          ) : null}

          {suggestionError ? (
            <p className="mt-3 text-[13px] leading-relaxed text-red-200">
              {suggestionError}
            </p>
          ) : null}
        </div>
      </>
    );
  }

  if (showContributions) {
    return (
      <>
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowContributions(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-[18px] text-white/75 hover:bg-white/12 active:bg-white/16"
            aria-label={isFr ? "Retour" : "Back"}
          >
            ←
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
              {isFr ? "Mon espace" : "My space"}
            </p>

            <h2 className="mt-0.5 font-serif text-[23px] font-semibold leading-tight text-white">
              {isFr
                ? "Mes contributions"
                : "My contributions"}
            </h2>
          </div>

          <div className="h-10 w-10" />
        </div>

        {contributionsLoading ? (
          <p className="px-1 text-[13px] leading-relaxed text-white/45">
            {isFr ? "Chargement..." : "Loading..."}
          </p>
        ) : contributionsError ? (
          <p className="px-1 text-[13px] leading-relaxed text-red-200">
            {contributionsError}
          </p>
        ) : contributions.length > 0 ? (
          <div className="grid grid-cols-2 gap-5">
            {contributions.map((entry) => {
              const place = findPlace(entry.placeId);

              if (!place) return null;

              return (
                <button
                  key={entry.placeId}
                  type="button"
                  onClick={() =>
                    onOpenPlace?.(
                      place,
                      "personal_space_contribution",
                    )
                  }
                  className="relative w-full overflow-hidden rounded-xl bg-white/10 text-left"
                  style={{
                    minHeight: "130px",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -6px 14px rgba(0,0,0,0.16), 0 14px 30px rgba(0,0,0,0.20), 0 40px 90px rgba(0,0,0,0.14)",
                  }}
                >
                  {place.panoramaImage ? (
                    <img
                      src={place.panoramaImage}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}

                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.68) 100%)",
                    }}
                  />

                  <div className="absolute inset-0 z-10 flex flex-col justify-end p-3">
                    <p className="font-serif text-[8px] font-medium leading-tight tracking-[0.01em] text-white">
                      {place.name}
                    </p>

                    <p className="mt-1 truncate text-[11px] text-white/90 opacity-90">
                      {[
                        place.category,
                        place.city,
                      ]
                        .filter(Boolean)
                        .join(" · ") ||
                        place.address ||
                        "Indie Map"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
            <p className="text-[14px] font-semibold text-white/90">
              {isFr
                ? "Aucune contribution validée"
                : "No approved contributions"}
            </p>

            <p className="mt-0.5 text-[12px] leading-snug text-white/45">
              {isFr
                ? "Les lieux que tu proposes apparaissent ici une fois ajoutés à Indie Map."
                : "Places you suggest appear here once they are added to Indie Map."}
            </p>
          </div>
        )}
      </>
    );
  }

  if (mode === "profile") {
    return (
      <>
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onModeChange("dashboard")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-[18px] text-white/75 hover:bg-white/12 active:bg-white/16"
            aria-label={isFr ? "Retour" : "Back"}
          >
            ←
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
              {isFr ? "Réglages" : "Settings"}
            </p>
            <h2 className="mt-0.5 font-serif text-[23px] font-semibold leading-tight text-white">
              {isFr ? "Mon profil" : "My profile"}
            </h2>
          </div>
          <div className="h-10 w-10" />
        </div>

        <div className="space-y-6">
          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {isFr ? "Profil" : "Profile"}
            </p>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/8">
              <div className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-white/90">
                    {isFr ? "Avatar" : "Avatar"}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/45">
                    {isFr ? "Couleur affichée sur ton profil." : "Color shown on your profile."}
                  </p>
                </div>
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[16px] font-semibold uppercase text-white shadow-[0_10px_24px_rgba(0,0,0,0.25)]"
                  style={{ backgroundColor: profileAvatarColor }}
                >
                  {(profileUsername || "?").slice(0, 1)}
                </span>
              </div>

              <div className="border-t border-white/10 px-4 py-3">
                <div className="flex flex-wrap justify-end gap-2">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onSetProfileAvatarColor(color)}
                      aria-label={color}
                      className={profileAvatarColor === color ? "h-8 w-8 rounded-full border-2 border-white shadow-[0_0_0_3px_rgba(255,255,255,0.18)]" : "h-8 w-8 rounded-full border border-white/15"}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-white/10 px-4 py-3">
                <span className="shrink-0 text-[14px] font-medium text-white/85">
                  {isFr ? "Mon pseudo" : "My username"}
                </span>
                <span className="min-w-0 flex-1 truncate text-right text-[14px] font-semibold text-white">
                  {profileUsername || "—"}
                </span>
              </div>

              <label className="flex items-center justify-between gap-4 border-t border-white/10 px-4 py-3">
                <span className="shrink-0 text-[14px] font-medium text-white/85">
                  {isFr ? "Ville" : "City"}
                </span>
                <input
                  value={profileHomeCity}
                  onChange={(event) => onSetProfileHomeCity(event.target.value)}
                  placeholder={isFr ? "Optionnel" : "Optional"}
                  className="min-w-0 flex-1 bg-transparent text-right text-[14px] text-white outline-none placeholder:text-white/30"
                />
              </label>

              <label className="flex items-center justify-between gap-4 border-t border-white/10 px-4 py-3">
                <span className="shrink-0 text-[14px] font-medium text-white/85">
                  {isFr ? "Tranche d’âge" : "Age range"}
                </span>
                <select
                  value={profileAgeRange}
                  onChange={(event) => onSetProfileAgeRange(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-right text-[14px] text-white outline-none"
                >
                  <option value="">{isFr ? "Optionnel" : "Optional"}</option>
                  <option value="18_24">18–24</option>
                  <option value="25_34">25–34</option>
                  <option value="35_44">35–44</option>
                  <option value="45_54">45–54</option>
                  <option value="55_64">55–64</option>
                  <option value="65_plus">65+</option>
                  <option value="prefer_not_to_say">{isFr ? "Préfère ne pas répondre" : "Prefer not to say"}</option>
                </select>
              </label>

              <label className="flex w-full items-center justify-between gap-4 border-t border-white/10 px-4 py-3 text-left">
                <span className="shrink-0 text-[14px] font-medium text-white/85">
                  {isFr ? "Langue" : "Language"}
                </span>
                <select
                  value={profileLocale}
                  onChange={(event) => onSetProfileLocale(event.target.value as "fr" | "en")}
                  className="w-[118px] shrink-0 bg-transparent text-right text-[14px] font-medium text-white/70 outline-none"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
          </section>

          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {isFr ? "Confidentialité" : "Privacy"}
            </p>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/8">
              <button
                type="button"
                onClick={() => onSetCommentsVisibleToFriends(!commentsVisibleToFriends)}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-white/90">
                    {isFr ? "Commentaires visibles par mes amis" : "Comments visible to friends"}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/45">
                    {isFr ? "Tes amis verront les commentaires que tu choisis de partager." : "Friends will see comments you choose to share."}
                  </p>
                </div>
                <span className={commentsVisibleToFriends ? "flex h-7 w-12 shrink-0 items-center rounded-full bg-[#84A98C] p-1" : "flex h-7 w-12 shrink-0 items-center rounded-full bg-white/15 p-1"}>
                  <span className={commentsVisibleToFriends ? "h-5 w-5 translate-x-5 rounded-full bg-white transition-transform" : "h-5 w-5 rounded-full bg-white transition-transform"} />
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSetVisitedPlacesVisibleToFriends(!visitedPlacesVisibleToFriends)}
                className="flex w-full items-center justify-between gap-4 border-t border-white/10 px-4 py-4 text-left"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-white/90">
                    {isFr ? "Lieux visités visibles par mes amis" : "Visited places visible to friends"}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/45">
                    {isFr ? "Tes amis verront les lieux que tu marques comme visités." : "Friends will see places you mark as visited."}
                  </p>
                </div>
                <span className={visitedPlacesVisibleToFriends ? "flex h-7 w-12 shrink-0 items-center rounded-full bg-[#84A98C] p-1" : "flex h-7 w-12 shrink-0 items-center rounded-full bg-white/15 p-1"}>
                  <span className={visitedPlacesVisibleToFriends ? "h-5 w-5 translate-x-5 rounded-full bg-white transition-transform" : "h-5 w-5 rounded-full bg-white transition-transform"} />
                </span>
              </button>
            </div>
          </section>

          <button
            type="button"
            onClick={onSaveProfile}
            disabled={profileSaving}
            className="w-full rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-60"
          >
            {profileSaving ? (isFr ? "Enregistrement..." : "Saving...") : (isFr ? "Enregistrer" : "Save")}
          </button>

          {profileSuccess ? (
            <p className="text-[13px] leading-relaxed text-emerald-200">{profileSuccess}</p>
          ) : null}
          {profileError ? (
            <p className="text-[13px] leading-relaxed text-red-200">{profileError}</p>
          ) : null}

          {legalLinks}
        </div>
      </>
    );
  }

  if (mode === "sharedLists") {
    const formatSharedListStats = (list: SharedList) => {
      const memberLabel = list.members.length > 1 ? "participants" : "participant";
      const placeLabel = isFr
        ? list.places.length > 1 ? "lieux" : "lieu"
        : list.places.length > 1 ? "places" : "place";

      return `${list.members.length} ${memberLabel} · ${list.places.length} ${placeLabel}`;
    };

    return (
      <>
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (selectedSharedList) {
                setSelectedSharedListId(null);
                setSharedListMessage("");
                return;
              }

              onModeChange("dashboard");
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-[18px] text-white/75 hover:bg-white/12 active:bg-white/16"
            aria-label={isFr ? "Retour" : "Back"}
          >
            ←
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
              {isFr ? "Avec mes amis" : "With friends"}
            </p>
            {selectedSharedList && authProfile?.id === selectedSharedList.ownerId ? (
              sharedListRenameOpen ? (
                <div className="mt-1 flex items-center justify-center gap-2">
                  <input
                    autoFocus
                    value={sharedListRenameTitle}
                    onChange={(event) => setSharedListRenameTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        renameSharedList();
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        setSharedListRenameOpen(false);
                        setSharedListRenameTitle("");
                        setSharedListMessage("");
                      }
                    }}
                    disabled={sharedListSaving}
                    className="min-w-0 max-w-[220px] flex-1 rounded-xl border border-white/15 bg-black/35 px-3 py-1.5 text-center font-serif text-[19px] font-semibold text-white outline-none focus:border-white/35 disabled:opacity-50"
                    aria-label={isFr ? "Nouveau nom de la liste" : "New list name"}
                  />

                  <button
                    type="button"
                    onClick={renameSharedList}
                    disabled={sharedListSaving}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[15px] font-bold text-black disabled:opacity-50"
                    aria-label={isFr ? "Enregistrer le nouveau nom" : "Save new name"}
                  >
                    ✓
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSharedListRenameOpen(false);
                      setSharedListRenameTitle("");
                      setSharedListMessage("");
                    }}
                    disabled={sharedListSaving}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[15px] text-white/75 disabled:opacity-50"
                    aria-label={isFr ? "Annuler" : "Cancel"}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="mt-0.5 flex min-w-0 items-center justify-center gap-2">
                  <h2 className="min-w-0 truncate font-serif text-[23px] font-semibold leading-tight text-white">
                    {selectedSharedList.title}
                  </h2>

                  <button
                    type="button"
                    onClick={() => {
                      setSharedListRenameTitle(selectedSharedList.title);
                      setSharedListRenameOpen(true);
                      setSharedListMessage("");
                    }}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/45 transition hover:bg-white/8 hover:text-white/80 active:bg-white/12"
                    aria-label={isFr ? "Renommer la liste" : "Rename list"}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                    </svg>
                  </button>
                </div>
              )
            ) : (
              <h2 className="mt-0.5 truncate font-serif text-[23px] font-semibold leading-tight text-white">
                {selectedSharedList ? selectedSharedList.title : (isFr ? "Listes partagées" : "Shared lists")}
              </h2>
            )}
          </div>
          <div className="h-10 w-10" />
        </div>

        {selectedSharedList ? (
          <div className="space-y-6">
            <section>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                {isFr ? "Participants" : "Participants"}
              </p>

              <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                {selectedSharedList.members.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {selectedSharedList.members.map((member) => (
                      <div key={member.id} className="flex items-center gap-2 rounded-full bg-black/25 py-1 pl-1 pr-3">
                        {member.user.avatarUrl ? (
                          <img src={member.user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold uppercase text-white"
                            style={{ backgroundColor: member.user.avatarColor || "#F97316" }}
                          >
                            {(member.user.displayName || member.user.username || "?").slice(0, 1)}
                          </span>
                        )}
                        <span className="max-w-[120px] truncate text-[12px] font-semibold text-white/85">
                          {member.user.displayName || member.user.username}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex gap-2">
                  <select
                    value={selectedSharedFriendId}
                    onChange={(event) => setSelectedSharedFriendId(event.target.value)}
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-[13px] text-white outline-none"
                  >
                    <option value="">{isFr ? "Ajouter un ami" : "Add a friend"}</option>
                    {friendsPayload.friends
                      .filter((entry) => !selectedSharedList.members.some((member) => member.userId === entry.user.id))
                      .map((entry) => (
                        <option key={entry.user.id} value={entry.user.id}>
                          {entry.user.displayName || entry.user.username}
                        </option>
                      ))}
                  </select>

                  <button
                    type="button"
                    onClick={addFriendToSharedList}
                    disabled={sharedListSaving || !selectedSharedFriendId}
                    className="shrink-0 rounded-2xl bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-50"
                  >
                    {isFr ? "Ajouter" : "Add"}
                  </button>
                </div>
              </div>
            </section>

            <section>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                {isFr ? "Lieux de la liste" : "Places in this list"}
              </p>

              {selectedSharedList.places.length > 0 ? (
                <div className="grid grid-cols-2 gap-5">
                  {selectedSharedList.places.map((item) => {
                    const place = findPlace(item.placeId);
                    if (!place) return null;

                    return (
                      <div key={item.id} className="relative">
                        <button
                          type="button"
                          onClick={() => onOpenPlace?.(place, "shared_list")}
                          className="relative w-full overflow-hidden rounded-xl bg-white/10 text-left"
                          style={{
                            minHeight: "130px",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -6px 14px rgba(0,0,0,0.16), 0 14px 30px rgba(0,0,0,0.20), 0 40px 90px rgba(0,0,0,0.14)"
                          }}
                        >
                          {place.panoramaImage ? (
                            <img src={place.panoramaImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
                          ) : null}

                          <div
                            className="absolute inset-0"
                            style={{
                              background: "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.64) 100%)"
                            }}
                          />

                          <div className="absolute inset-0 z-10 flex flex-col justify-end p-3">
                            <p className="font-serif text-[15px] font-medium leading-tight tracking-[0.01em] text-white">
                              {place.name}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-white/90 opacity-90">
                              {place.address || place.city || "Indie Map"}
                            </p>
                          </div>
                        </button>

                                                <button
                          type="button"
                          onClick={() => removePlaceFromSharedList(place.id)}
                          disabled={sharedListSaving}
                          className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white/85 backdrop-blur-md disabled:opacity-50"
                          aria-label={isFr ? "Retirer ce lieu" : "Remove this place"}
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M6 6l12 12" />
                            <path d="M18 6L6 18" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                  <p className="text-[14px] font-semibold text-white/90">
                    {isFr ? "Aucun lieu dans cette liste" : "No places in this list"}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/45">
                    {isFr ? "Ajoute des adresses pour préparer cette liste avec tes amis." : "Add places to prepare this list with your friends."}
                  </p>
                </div>
              )}
            </section>

            <section>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                {isFr ? "Ajouter un lieu" : "Add a place"}
              </p>

              <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                <input
                  value={sharedPlaceQuery}
                  onChange={(event) => setSharedPlaceQuery(event.target.value)}
                  placeholder={isFr ? "Chercher un lieu" : "Search a place"}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/30"
                />

                <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto pr-1">
                  {sharedPlaceResults.map((place) => {
                    const alreadyAdded = selectedSharedList.places.some((item) => item.placeId === place.id);

                    return (
                      <div
                        key={place.id}
                        className="flex w-full items-center gap-3 rounded-2xl bg-black/25 p-2 text-left"
                      >
                        <button
                          type="button"
                          onClick={() => onOpenPlace?.(place, "shared_list_search")}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          {place.panoramaImage ? (
                            <img src={place.panoramaImage} alt="" className="h-12 w-12 rounded-xl object-cover" />
                          ) : (
                            <span className="h-12 w-12 rounded-xl bg-white/10" />
                          )}

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-white/90">
                              {place.name}
                            </span>
                            <span className="block truncate text-[11px] text-white/40">
                              {place.city || place.address || "Indie Map"}
                            </span>
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => alreadyAdded ? undefined : addPlaceToSharedList(place.id)}
                          disabled={sharedListSaving || alreadyAdded}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[20px] font-semibold leading-none text-black disabled:bg-white/10 disabled:text-white/35"
                          aria-label={alreadyAdded ? (isFr ? "Déjà ajouté" : "Already added") : (isFr ? "Ajouter à la liste" : "Add to list")}
                        >
                          {alreadyAdded ? "✓" : "+"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {authProfile?.id === selectedSharedList.ownerId ? (
              <button
                type="button"
                onClick={deleteSharedList}
                disabled={sharedListSaving}
                className="w-full rounded-3xl border border-red-300/20 bg-red-500/10 px-4 py-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-red-100 disabled:opacity-50"
              >
                {pendingDeleteSharedListId === selectedSharedList.id ? (isFr ? "Confirmer la suppression" : "Confirm deletion") : (isFr ? "Supprimer la liste" : "Delete list")}
              </button>
            ) : null}

            {sharedListMessage ? (
              <p className="px-1 text-[13px] leading-relaxed text-white/55">{sharedListMessage}</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                {isFr ? "Créer une liste" : "Create a list"}
              </p>

              <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                <p className="text-[12px] leading-snug text-white/45">
                  {isFr ? "Prépare une liste de lieux avec tes amis : sorties, cafés, restaurants, voyage ou adresses à tester." : "Prepare a list of places with friends: outings, cafés, restaurants, trips, or places to try."}
                </p>

                <div className="mt-4 flex gap-2">
                  <input
                    value={newSharedListTitle}
                    onChange={(event) => setNewSharedListTitle(event.target.value)}
                    placeholder={isFr ? "Titre de la liste" : "List title"}
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/30"
                  />

                  <button
                    type="button"
                    onClick={createSharedList}
                    disabled={sharedListSaving}
                    className="shrink-0 rounded-2xl bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-50"
                  >
                    {isFr ? "Créer" : "Create"}
                  </button>
                </div>

                {sharedListMessage ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-white/55">{sharedListMessage}</p>
                ) : null}
              </div>
            </section>

            <section>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                {isFr ? "Mes listes" : "My lists"}
              </p>

              {sharedListsLoading ? (
                <p className="px-1 text-[13px] leading-relaxed text-white/45">
                  {isFr ? "Chargement..." : "Loading..."}
                </p>
              ) : sharedListsError ? (
                <p className="px-1 text-[13px] leading-relaxed text-red-200">
                  {sharedListsError}
                </p>
              ) : sharedLists.length > 0 ? (
                <div className="space-y-3">
                  {sharedLists.map((list) => (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => {
                        setSelectedSharedListId(list.id);
                        setSharedListMessage("");
                      }}
                      className="flex w-full items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/8 px-4 py-4 text-left hover:bg-white/12 active:bg-white/16"
                    >
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2">
                          {isUnseenSharedList(list) ? (
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#F97316]" />
                          ) : null}
                          <span className="block truncate font-serif text-[19px] font-semibold text-white">
                            {list.title}
                          </span>
                        </span>
                        <span className="mt-1 block text-[12px] leading-snug text-white/45">
                          {formatSharedListStats(list)}
                        </span>
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[18px] text-white/75">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                  <p className="text-[14px] font-semibold text-white/90">
                    {isFr ? "Aucune liste partagée" : "No shared lists"}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/45">
                    {isFr ? "Crée ta première liste pour préparer des lieux avec tes amis." : "Create your first list to prepare places with friends."}
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </>
    );
  }

  if (mode === "friends") {
    if (selectedFriend) {
      const visibleVisitedPlaces = friendProfilePayload?.visitedPlaces ?? [];

      return (
        <>
          <div className="mb-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedFriend(null);
                setFriendProfilePayload(null);
                setFriendProfileError("");
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-[18px] text-white/75 hover:bg-white/12 active:bg-white/16"
              aria-label={isFr ? "Retour" : "Back"}
            >
              ←
            </button>

            <div className="min-w-0 flex-1 text-center">
              <span className="relative mx-auto block h-14 w-14">
                {selectedFriend.avatarUrl ? (
                  <img src={selectedFriend.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover shadow-[0_10px_24px_rgba(0,0,0,0.22)]" />
                ) : (
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-semibold uppercase text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
                    style={{ backgroundColor: selectedFriend.avatarColor || "#F97316" }}
                  >
                    {(selectedFriend.displayName || selectedFriend.username || "?").slice(0, 1)}
                  </span>
                )}

                <ContributorRankBadge
                  rank={selectedFriend.contributionRank}
                />
              </span>

              <h2 className="mt-2 truncate font-serif text-[23px] font-semibold leading-tight text-white">
                {selectedFriend.displayName || selectedFriend.username}
              </h2>
            </div>

            <div className="h-10 w-10" />
          </div>

          <div className="space-y-6">
            {friendProfileLoading ? (
              <p className="px-1 text-[13px] leading-relaxed text-white/45">
                {isFr ? "Chargement..." : "Loading..."}
              </p>
            ) : friendProfileError ? (
              <p className="px-1 text-[13px] leading-relaxed text-red-200">
                {friendProfileError}
              </p>
            ) : (
              <>
                <section>
                  <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    {isFr ? "Lieux visités" : "Visited places"}
                  </p>

                  {visibleVisitedPlaces.length > 0 ? (
                    <div className="grid grid-cols-2 gap-5">
                      {visibleVisitedPlaces.map((item) => {
                        const place = findPlace(item.placeId);
                        if (!place) return null;

                        return (
                          <div key={item.placeId} className="relative">
                            <button
                              type="button"
                              onClick={() => onOpenPlace?.(place, "friend_visited_place")}
                              className="relative w-full overflow-hidden rounded-xl bg-white/10 text-left"
                              style={{
                                minHeight: "130px",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -6px 14px rgba(0,0,0,0.16), 0 14px 30px rgba(0,0,0,0.20), 0 40px 90px rgba(0,0,0,0.14)"
                              }}
                            >
                              {place.panoramaImage ? (
                                <img
                                  src={place.panoramaImage}
                                  alt=""
                                  className="absolute inset-0 h-full w-full object-cover"
                                />
                              ) : null}

                              <div
                                className="absolute inset-0"
                                style={{
                                  background: "linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.18) 40%, rgba(0,0,0,0.64) 100%)"
                                }}
                              />

                              <div className="absolute inset-0 z-10 flex flex-col justify-end p-3">
                                <div>
                                  <p className="font-serif text-[15px] font-medium leading-tight tracking-[0.01em] text-white">
                                    {place.name}
                                  </p>

                                  <p className="mt-1 truncate text-[11px] text-white/90 opacity-90">
                                    {place.address || place.city || "Indie Map"}
                                  </p>
                                </div>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-1">
                      <p className="text-[14px] font-semibold text-white/90">
                        {isFr ? "Aucun lieu partagé" : "No shared places"}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-snug text-white/45">
                        {isFr ? "Cet ami ne partage pas encore ses lieux visités." : "This friend is not sharing visited places yet."}
                      </p>
                    </div>
                  )}
                </section>

                {!friendProfileLoading && !friendProfileError ? (
                  <button
                    type="button"
                    onClick={deleteSelectedFriend}
                    disabled={friendsLoading}
                    className="w-full rounded-3xl border border-red-300/20 bg-red-500/10 px-4 py-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-red-100 disabled:opacity-50"
                  >
                    {pendingDeleteFriendId === selectedFriend.id ? (isFr ? "Confirmer la suppression" : "Confirm deletion") : (isFr ? "Supprimer l’ami" : "Remove friend")}
                  </button>
                ) : null}

              </>
            )}
          </div>
        </>
      );
    }

    return (
      <>
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onModeChange("dashboard")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/8 text-[18px] text-white/75 hover:bg-white/12 active:bg-white/16"
            aria-label={isFr ? "Retour" : "Back"}
          >
            ←
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="h-8" />
          </div>
          <div className="h-10 w-10" />
        </div>

        <div className="space-y-6">
          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {isFr ? "Ajouter des amis" : "Add friends"}
            </p>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/8">
              <div className="px-4 py-4">
                <p className="text-[12px] leading-snug text-white/45">
                  {isFr ? "Recherche une personne par son pseudo Indie Map." : "Search for someone by their Indie Map username."}
                </p>

                <input
                  value={friendSearchQuery}
                  onChange={(event) => setFriendSearchQuery(event.target.value)}
                  placeholder={isFr ? "Pseudo, ex. marcos" : "Username, e.g. marcos"}
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/30"
                />

                {friendSearchLoading ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-white/45">
                    {isFr ? "Recherche..." : "Searching..."}
                  </p>
                ) : friendSearchError ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-red-200">
                    {friendSearchError}
                  </p>
                ) : friendSearchQuery.trim().length >= 2 && friendSearchUsers.length === 0 ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-white/45">
                    {isFr ? "Aucun utilisateur trouvé." : "No user found."}
                  </p>
                ) : null}

                {friendRequestMessage ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-white/55">
                    {friendRequestMessage}
                  </p>
                ) : null}
              </div>

              {friendSearchUsers.length > 0 ? (
                <div className="border-t border-white/10">
                  {friendSearchUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 border-t border-white/10 px-4 py-3 first:border-t-0">
                      <span className="relative h-10 w-10 shrink-0">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <span
                            className="flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-semibold uppercase text-white"
                            style={{ backgroundColor: user.avatarColor || "#F97316" }}
                          >
                            {(user.displayName || user.username || "?").slice(0, 1)}
                          </span>
                        )}

                        <ContributorRankBadge
                          rank={user.contributionRank}
                          compact
                        />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-white/90">
                          {user.displayName || user.username}
                        </span>
                        <span className="block truncate text-[12px] text-white/40">
                          @{user.username}
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={() => sendFriendRequest(user.id)}
                        disabled={friendRequestSendingId === user.id}
                        className="shrink-0 rounded-full bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-60"
                      >
                        {friendRequestSendingId === user.id ? "..." : (isFr ? "Ajouter" : "Add")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <button
              type="button"
              onClick={inviteFriend}
              className="flex w-full items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white px-5 py-4 text-left text-black shadow-[0_18px_42px_rgba(0,0,0,0.22)] active:scale-[0.99]"
            >
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold">
                  {isFr ? "Inviter un ami" : "Invite a friend"}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-black/55">
                  {isFr ? "Partager Indie Map avec quelqu’un." : "Share Indie Map with someone."}
                </span>
              </span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-[18px] text-white">
                ↗
              </span>
            </button>
          </section>

          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {isFr ? "Mes amis" : "My friends"}
            </p>

            {friendsLoading ? (
              <p className="px-1 text-[13px] leading-relaxed text-white/45">
                {isFr ? "Chargement..." : "Loading..."}
              </p>
            ) : friendsError ? (
              <p className="px-1 text-[13px] leading-relaxed text-red-200">
                {friendsError}
              </p>
            ) : friendsPayload.friends.length > 0 ? (
              <div className="flex flex-wrap gap-x-5 gap-y-5 px-1">
                {friendsPayload.friends.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => openFriendProfile(entry.user)}
                    className="flex w-[72px] flex-col items-center text-center"
                  >
                    <span className="relative h-14 w-14 shrink-0">
                      {entry.user.avatarUrl ? (
                        <img src={entry.user.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover shadow-[0_10px_24px_rgba(0,0,0,0.22)]" />
                      ) : (
                        <span
                          className="flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-semibold uppercase text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
                          style={{ backgroundColor: entry.user.avatarColor || "#F97316" }}
                        >
                          {(entry.user.displayName || entry.user.username || "?").slice(0, 1)}
                        </span>
                      )}

                      <ContributorRankBadge
                        rank={entry.user.contributionRank}
                      />
                    </span>

                    <span className="mt-2 block w-full truncate text-[12px] font-semibold leading-tight text-white/85">
                      {entry.user.displayName || entry.user.username}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-1">
                <p className="text-[14px] font-semibold text-white/90">
                  {isFr ? "Aucun ami pour le moment" : "No friends yet"}
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-white/45">
                  {isFr ? "Tes amis apparaîtront ici après acceptation." : "Your friends will appear here once accepted."}
                </p>
              </div>
            )}
          </section>

          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {isFr ? "Demandes reçues" : "Incoming requests"}
            </p>

            {friendsPayload.incomingRequests.length > 0 ? (
              <div className="space-y-3 px-1">
                {friendsPayload.incomingRequests.map((entry) => (
                  <div key={entry.id} className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="relative h-10 w-10 shrink-0">
                        {entry.user.avatarUrl ? (
                          <img src={entry.user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <span
                            className="flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-semibold uppercase text-white"
                            style={{ backgroundColor: entry.user.avatarColor || "#F97316" }}
                          >
                            {(entry.user.displayName || entry.user.username || "?").slice(0, 1)}
                          </span>
                        )}

                        <ContributorRankBadge
                          rank={entry.user.contributionRank}
                          compact
                        />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-white/90">
                          {entry.user.displayName || entry.user.username}
                        </span>
                        <span className="block truncate text-[12px] text-white/40">
                          @{entry.user.username}
                        </span>
                      </span>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => respondToFriendRequest(entry.id, "accept")}
                        disabled={friendResponseSendingId === entry.id}
                        className="flex-1 rounded-full bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-60"
                      >
                        {isFr ? "Accepter" : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={() => respondToFriendRequest(entry.id, "decline")}
                        disabled={friendResponseSendingId === entry.id}
                        className="flex-1 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70 disabled:opacity-60"
                      >
                        {isFr ? "Refuser" : "Decline"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-1">
                <p className="text-[14px] font-semibold text-white/90">
                  {isFr ? "Aucune demande reçue" : "No incoming requests"}
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-white/45">
                  {isFr ? "Les nouvelles demandes d’amis apparaîtront ici." : "New friend requests will appear here."}
                </p>
              </div>
            )}
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-5 flex w-full items-center gap-4 px-1">
        <button
          type="button"
          onClick={() => onModeChange("profile")}
          className="relative h-14 w-14 shrink-0 rounded-full"
          aria-label={
            isFr
              ? "Voir mon profil"
              : "View my profile"
          }
        >
          {authProfile.avatarUrl ? (
            <img
              src={authProfile.avatarUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-semibold uppercase text-white"
              style={{
                backgroundColor:
                  authProfile.avatarColor ||
                  "#F97316",
              }}
            >
              {(authProfile.displayName ||
                authProfile.username ||
                "?").slice(0, 1)}
            </span>
          )}

          <ContributorRankBadge
            rank={authProfile.contributionRank}
          />
        </button>

        <div className="min-w-0 flex-1">
          <p className="font-serif text-[25px] font-semibold leading-tight text-white">
            {authProfile.displayName ||
              authProfile.username}
          </p>

          <button
            type="button"
            onClick={() => onModeChange("profile")}
            className="mt-1 block text-left text-[12px] font-medium text-white/45 hover:text-white/70 active:text-white"
          >
            {isFr
              ? "Voir et modifier mon profil"
              : "View and edit my profile"}
          </button>
        </div>
      </div>

      <div className="mb-2 grid relative grid-cols-[36px_minmax(0,1fr)_92px] items-center gap-2.5 overflow-hidden rounded-2xl border border-[#EAB308]/20 bg-[linear-gradient(135deg,rgba(234,179,8,0.14),rgba(255,255,255,0.05)_55%,rgba(92,110,59,0.10))] px-4 py-2">
        <span className="pointer-events-none absolute -right-5 top-1/2 -translate-y-1/2 text-[#EAB308]/[0.07]"><svg viewBox="0 0 24 24" className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v9H4v-9"/><path d="M2 7h20v5H2z"/><path d="M12 7v14"/><path d="M12 7H7.5A2.5 2.5 0 1 1 10 4.5L12 7Zm0 0h4.5A2.5 2.5 0 1 0 14 4.5L12 7Z"/></svg></span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EAB308]/25 bg-[#EAB308]/10 text-[#EAB308]"><svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg></span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-tight text-white">
            {isFr
              ? "Mes points"
              : "My points"}
          </p>

          <p className="mt-0.5 text-[10.5px] leading-snug text-white/35">
            {isFr
              ? "Gagne 100 points par contribution. Ils pourront être utilisés dans un avenir proche."
              : "Earn 100 points per contribution. They will be usable in the near future."}
          </p>
        </div>

        <div className="flex min-w-[108px] items-baseline justify-end gap-1.5 whitespace-nowrap">
          <span className="font-serif text-[20px] font-semibold leading-none tabular-nums text-[#EAB308]">
            {rewardPointsLoading
              ? "…"
              : rewardPointsBalance}
          </span>

          <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/30">
            pts
          </span>
        </div>
      </div>

      <div
        className="relative mb-4 overflow-hidden rounded-[22px] border border-[#789044]/40 shadow-[0_14px_34px_rgba(0,0,0,0.22)]"
        style={{
          background:
            "linear-gradient(145deg, rgba(73,89,46,0.62), rgba(49,63,38,0.58) 50%, rgba(34,44,29,0.72))",
        }}
      >
        <div className="px-4 pb-3 pt-3">
          <div className="relative z-10 flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#B8D16A]/35 bg-[#B8D16A]/15 text-[#B8D16A]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-4 2.5-6 5.5-6s5 2 5.5 6"/><path d="M18 8v6"/><path d="M15 11h6"/></svg>
            </span>

            <div className="min-w-0 pt-0.5">
              <p className="text-[14px] font-semibold leading-tight text-white">
                {isFr ? "Parrainage d’amis" : "Friend referrals"}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-white/65">
                {isFr
                  ? "Fais découvrir Indie Map et gagne jusqu’à 100 points par parrainage."
                  : "Share Indie Map and earn up to 100 points."}
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-2.5 grid grid-cols-2 divide-x divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-black/[0.24]">
            <div className="px-2.5 py-2">
              <p className="font-serif text-[18px] font-semibold leading-none text-[#B8D16A]">
                +{referralInstallPoints} <span className="text-[9px] font-semibold">PTS</span>
              </p>
              <p className="mt-1 text-[9px] font-medium leading-snug text-white/75">
                {isFr ? "Téléchargement réel de l’app" : "Real app download"}
              </p>
            </div>

            <div className="px-2.5 py-2">
              <p className="font-serif text-[18px] font-semibold leading-none text-[#B8D16A]">
                +{referralSignupPoints} <span className="text-[9px] font-semibold">PTS</span>
              </p>
              <p className="mt-1 text-[9px] font-medium leading-snug text-white/75">
                {isFr ? "Création du compte" : "Account creation"}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openReferralQrCode}
          disabled={referralLinkLoading || referralQrLoading || !referralShareUrl}
          className="relative z-10 mx-3 mb-1.5 flex w-[calc(100%-1.5rem)] items-center justify-between gap-2 rounded-lg border border-[#D8E4B8]/30 bg-[#C9D9A0] px-3 py-1 text-left text-[10.5px] font-semibold text-[#1E2519] shadow-[0_4px_12px_rgba(0,0,0,0.12)] active:bg-[#B9CD86] disabled:opacity-55"
        >
          <span>
            {referralQrLoading
              ? isFr
                ? "Préparation du QR code..."
                : "Preparing QR code..."
              : isFr
                ? "Partager avec mon QR code"
                : "Share with my QR code"}
          </span>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 rounded-full bg-[#344526] p-1 text-white" fill="currentColor" aria-hidden="true">
            <path d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm9-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 14h7v7H3v-7Zm2 2v3h3v-3H5Zm9-2h3v3h-3v-3Zm4 0h3v3h-3v-3Zm-4 4h3v3h-3v-3Zm4 1h3v2h-3v-2Z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={inviteFriend}
          disabled={referralLinkLoading || !referralShareUrl}
          className="relative z-10 mx-3 mb-3 flex w-[calc(100%-1.5rem)] items-center justify-between gap-2 rounded-lg border border-[#D8E4B8]/30 bg-[#C9D9A0] px-3 py-1 text-left text-[10.5px] font-semibold text-[#1E2519] shadow-[0_4px_12px_rgba(0,0,0,0.12)] active:bg-[#B9CD86] disabled:opacity-55"
        >
          <span>
            {referralLinkLoading
              ? isFr
                ? "Préparation du lien..."
                : "Preparing link..."
              : isFr
                ? "Partager mon lien"
                : "Share my link"}
          </span>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#344526] text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15V3" />
              <path d="m8 7 4-4 4 4" />
              <path d="M5 11v7.2A2.8 2.8 0 0 0 7.8 21h8.4a2.8 2.8 0 0 0 2.8-2.8V11" />
            </svg>
          </span>
        </button>

        {referralMessage ? (
          <p className="border-t border-white/10 bg-black/15 px-4 py-2 text-[10px] text-white/60">
            {referralMessage}
          </p>
        ) : null}
      </div>

      {referralQrOpen ? (
        <div className="fixed inset-0 z-[2600] flex items-center justify-center bg-black/80 px-5 backdrop-blur-md">
          <div className="relative w-full max-w-[340px] rounded-[28px] border border-white/10 bg-[#F3EFE5] px-6 pb-6 pt-7 text-center text-[#171813] shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <button
              type="button"
              onClick={() => setReferralQrOpen(false)}
              aria-label={isFr ? "Fermer" : "Close"}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/10 text-[22px] leading-none text-black/70 active:bg-black/20"
            >
              ×
            </button>

            <p className="pr-8 text-left font-serif text-[21px] font-semibold">
              {isFr
                ? "Mon QR code de parrainage"
                : "My referral QR code"}
            </p>

            <p className="mt-1.5 text-left text-[11px] leading-snug text-black/50">
              {isFr
                ? "Fais scanner ce QR code pour partager ton lien Indie Map."
                : "Have someone scan this QR code to share your Indie Map link."}
            </p>

            <div className="mx-auto mt-5 flex aspect-square w-full max-w-[280px] items-center justify-center rounded-2xl bg-white p-3 shadow-sm">
              {referralQrDataUrl ? (
                <img
                  src={referralQrDataUrl}
                  alt={
                    isFr
                      ? "QR code de parrainage Indie Map"
                      : "Indie Map referral QR code"
                  }
                  className="h-full w-full object-contain"
                />
              ) : null}
            </div>

            <p className="mt-4 text-[10px] leading-relaxed text-black/45">
              {isFr
                ? "Le scan utilise le même lien personnel que le bouton de partage. Aucun point n’est attribué au simple scan."
                : "The scan uses the same personal link as the share button. Scanning alone does not award points."}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-4 justify-items-center gap-1.5 px-2">
        <div className="grid aspect-square w-full max-w-[68px] grid-rows-[20px_22px_20px] content-center items-center justify-items-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.09] via-white/[0.05] to-white/[0.025] px-1 py-2 text-center shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
          <span className="flex h-[20px] items-center justify-center text-[18px] leading-none text-[#9CBF52]">♡</span>
          <p className="flex h-[22px] items-center justify-center text-[16px] font-semibold leading-none text-white">{savedPlacesCount}</p>
          <p className="flex h-[20px] max-w-full items-start justify-center text-center text-[6.2px] font-semibold uppercase leading-[1.15] tracking-[0.035em] text-white/35">
            {isFr ? "Favoris" : "Favorites"}
          </p>
        </div>
        <div className="grid aspect-square w-full max-w-[68px] grid-rows-[20px_22px_20px] content-center items-center justify-items-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.09] via-white/[0.05] to-white/[0.025] px-1 py-2 text-center shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
          <span className="flex h-[20px] items-center justify-center text-[#9CBF52]"><svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-4 2.5-6 5.5-6s5 2 5.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14c2.8.2 4.4 1.8 5 5"/></svg></span>
          <p className="flex h-[22px] items-center justify-center text-[16px] font-semibold leading-none text-white">{friendsPayload.friends.length}</p>
          <p className="flex h-[20px] max-w-full items-start justify-center text-center text-[6.2px] font-semibold uppercase leading-[1.15] tracking-[0.035em] text-white/35">
            {isFr ? "Amis" : "Friends"}
          </p>
        </div>
        <div className="grid aspect-square w-full max-w-[68px] grid-rows-[20px_22px_20px] content-center items-center justify-items-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.09] via-white/[0.05] to-white/[0.025] px-1 py-2 text-center shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
          <span className="flex h-[20px] items-center justify-center text-[#9CBF52]"><svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg></span>
          <p className="flex h-[22px] items-center justify-center text-[16px] font-semibold leading-none text-white">{sharedLists.length}</p>
          <p className="flex h-[20px] max-w-full items-start justify-center text-center text-[6.2px] font-semibold uppercase leading-[1.15] tracking-[0.035em] text-white/35">
            {isFr ? "Listes partagées" : "Shared lists"}
          </p>
        </div>
        <div className="grid aspect-square w-full max-w-[68px] grid-rows-[20px_22px_20px] content-center items-center justify-items-center rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.09] via-white/[0.05] to-white/[0.025] px-1 py-2 text-center shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
          <span className="flex h-[20px] items-center justify-center text-[#9CBF52]"><svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 4c-7 0-12 3.5-12 9a5 5 0 0 0 5 5c5.5 0 7-6 7-14Z"/><path d="M4 20c2-5 6-8 12-10"/></svg></span>
          <p className="flex h-[22px] items-center justify-center text-[16px] font-semibold leading-none text-white">{contributionsCount}</p>
          <p className="flex h-[20px] max-w-full items-start justify-center text-center text-[6.2px] font-semibold uppercase leading-[1.15] tracking-[0.035em] text-white/35">
            {isFr ? "Contributions" : "Contributions"}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-baseline gap-1.5">
          <p className="font-serif text-[15px] font-medium whitespace-nowrap tracking-[0.01em] text-white">
            {isFr ? "Mes lieux" : "My places"}
          </p>

          <button
            type="button"
            onClick={onOpenSavedPlaces}
            className="inline-flex items-baseline gap-0.5 text-[10px] leading-none text-white/55 transition-opacity active:opacity-60"
          >
            <span>{isFr ? "Tout afficher" : "View all"}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>

        {savedPlacesPreview.length > 0 ? (
          <div className="im-home-scroll flex gap-2.5 overflow-x-auto pb-2">
            {savedPlacesPreview.map((place) => {
              const placeId = String(place.id);
              const isVisited = visitedSavedPlaceIds.includes(placeId);

              return (
                <button
                  key={placeId}
                  type="button"
                  onClick={() =>
                    onOpenPlace?.(
                      place,
                      "personal_space_saved_place",
                    )
                  }
                  className="flex w-[124px] min-w-[124px] shrink-0 flex-col self-start overflow-hidden rounded-xl border border-white/10 bg-white/10 text-left active:opacity-80"
                >
                  <div className="relative h-[90px] w-full shrink-0 overflow-hidden bg-white/10">
                    <img
                      src={place.panoramaImage || "/explorer-bg.png?v=3"}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />

                    <div
                      role="button"
                      tabIndex={0}
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleSavedPlaceVisited(placeId);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" && e.key !== " ") return;
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleSavedPlaceVisited(placeId);
                      }}
                      className={
                        isVisited
                          ? "absolute left-1.5 top-1.5 z-20 rounded-full bg-yellow-400 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.06em] text-black shadow"
                          : "absolute left-1.5 top-1.5 z-20 rounded-full border border-white/35 bg-black/45 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.06em] text-white/90 backdrop-blur-sm"
                      }
                    >
                      {isVisited
                        ? isFr
                          ? "Visité"
                          : "Visited"
                        : isFr
                          ? "À visiter"
                          : "To visit"}
                    </div>
                  </div>

                  <div className="flex h-[34px] w-full items-center bg-black/45 px-2 backdrop-blur-[2px]">
                    <p className="line-clamp-2 font-serif text-[8.5px] font-medium leading-[1.1] text-white/95">
                      {place.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-white/8 bg-white/[0.04] px-4 py-4">
            <p className="text-[11px] text-white/45">
              {isFr
                ? "Tes lieux enregistrés apparaîtront ici."
                : "Your saved places will appear here."}
            </p>
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center gap-1.5">
          <p className="font-serif text-[15px] font-medium whitespace-nowrap tracking-[0.01em] text-white">
            {isFr ? "Listes partagées" : "Shared lists"}
          </p>

          {unseenSharedListCount > 0 ? (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F97316]"
              aria-label={isFr ? "Nouvelle liste partagée" : "New shared list"}
            />
          ) : null}

          <button
            type="button"
            onClick={() => {
              setSelectedSharedListId(null);
              onModeChange("sharedLists");
            }}
            className="inline-flex items-baseline gap-0.5 text-[10px] leading-none text-white/55 transition-opacity active:opacity-60"
          >
            <span>{isFr ? "Tout afficher" : "View all"}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>

        {sharedLists.length > 0 ? (
          <div className="im-home-scroll flex gap-2.5 overflow-x-auto pb-2">
            {sharedLists.slice(0, 6).map((list) => {
              const coverPlace = list.places
                .map((item) => findPlace(item.placeId))
                .find((place): place is PlaceSummary => Boolean(place));

              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => {
                    setSelectedSharedListId(list.id);
                    onModeChange("sharedLists");
                  }}
                  className="flex w-[124px] min-w-[124px] shrink-0 flex-col self-start overflow-hidden rounded-xl border border-white/10 bg-white/10 text-left active:opacity-80"
                >
                  <div className="relative h-[90px] w-full shrink-0 overflow-hidden bg-white/10">
                    <img
                      src={coverPlace?.panoramaImage || "/explorer-bg.png?v=3"}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>

                  <div className="flex h-[34px] w-full items-center bg-black/45 px-2 backdrop-blur-[2px]">
                    <div className="min-w-0">
                      <p className="truncate font-serif text-[8.5px] font-medium leading-[1.1] text-white/95">
                        {list.title}
                      </p>

                      <p className="mt-0.5 flex items-center gap-1 text-[7px] leading-none text-white/60">
                        <span>
                          {list.places.length}{" "}
                          {isFr
                            ? list.places.length > 1
                              ? "lieux"
                              : "lieu"
                            : list.places.length > 1
                              ? "places"
                              : "place"}
                        </span>

                        <svg
                          viewBox="0 0 24 24"
                          className="h-2.5 w-2.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="9" cy="8" r="3" />
                          <path d="M3.5 19c.5-4 2.5-6 5.5-6s5 2 5.5 6" />
                          <circle cx="17" cy="9" r="2.5" />
                          <path d="M15.5 14c2.8.2 4.4 1.8 5 5" />
                        </svg>
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-white/8 bg-white/[0.04] px-4 py-4">
            <p className="text-[11px] text-white/45">
              {isFr
                ? "Tes listes partagées apparaîtront ici."
                : "Your shared lists will appear here."}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onModeChange("friends")}
          className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-[#9CBF52]/20 bg-[linear-gradient(145deg,rgba(92,110,59,0.24),rgba(156,191,82,0.07),rgba(255,255,255,0.03))] p-4 text-left hover:brightness-110 active:brightness-105"
        >
          <span className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#9CBF52]/30 bg-[#9CBF52]/10 text-[#9CBF52]"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-4 2.5-6 5.5-6s5 2 5.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14c2.8.2 4.4 1.8 5 5"/></svg></span>
            <span className="min-w-0 text-[10px] font-semibold uppercase leading-[1.25] tracking-[0.11em] text-white/55">
              {isFr ? "Mes amis" : "Friends"}
            </span>

            {incomingFriendRequestCount > 0 ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[#F97316]"
                aria-label={
                  isFr
                    ? "Nouvelle demande d’ami"
                    : "New friend request"
                }
              />
            ) : null}
          </span>

          <span className="block text-[11px] leading-snug text-white/30">
            {isFr
              ? "Social privé."
              : "Private social."}
          </span>
        </button>



        <button
          type="button"
          onClick={() => setShowContributions(true)}
          className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-[#EAB308]/15 bg-[linear-gradient(145deg,rgba(234,179,8,0.16),rgba(92,110,59,0.10),rgba(255,255,255,0.025))] p-4 text-left hover:brightness-110 active:brightness-105"
        >
          <span className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#EAB308]/30 bg-[#EAB308]/10 text-[#EAB308]"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 4c-7 0-12 3.5-12 9a5 5 0 0 0 5 5c5.5 0 7-6 7-14Z"/><path d="M4 20c2-5 6-8 12-10"/></svg></span>
            <span className="min-w-0 text-[10px] font-semibold uppercase leading-[1.25] tracking-[0.11em] text-white/55">
              {isFr ? "Mes contributions" : "My contributions"}
            </span>
          </span>

          <span className="block text-[11px] leading-snug text-white/30">
            {isFr
              ? "Lieux ajoutés à Indie Map."
              : "Places added to Indie Map."}
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          setShowSuggestions(true);
          setSuggestionMessage("");
          setSuggestionError("");
        }}
        className="mt-3 flex w-full items-center justify-between rounded-2xl border border-[#71864A]/20 bg-[linear-gradient(135deg,rgba(60,75,43,0.22),rgba(92,110,59,0.10),rgba(255,255,255,0.025))] px-4 py-3 text-left hover:brightness-110 active:brightness-105"
      >
        <span>
          <span className="min-w-0 text-[10px] font-semibold uppercase leading-[1.25] tracking-[0.11em] text-white/55">
            Suggestions
          </span>

          <span className="mt-0.5 block text-[10px] text-white/30">
            {isFr
              ? "Partage tes idées pour améliorer Indie Map."
              : "Share your ideas to improve Indie Map."}
          </span>
        </span>

        <span className="text-[17px] text-white/35">
          →
        </span>
      </button>

      <div className="mt-5 border-t border-white/[0.07] pt-5">
        {hasProfessionalAccess && onOpenProfessionalSpace ? (
          <button
            type="button"
            onClick={onOpenProfessionalSpace}
            className="mb-2 flex w-full items-center justify-between rounded-2xl border border-[#5C6E3B]/25 bg-[#5C6E3B]/10 px-4 py-2 text-left hover:bg-[#5C6E3B]/15"
          >
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#B8C69F]">
                {isFr
                  ? "Espace professionnel"
                  : "Professional space"}
              </span>

              <span className="mt-1 block text-[10px] text-white/35">
                {isFr
                  ? "Basculer vers mon espace pro"
                  : "Switch to professional space"}
              </span>
            </span>

            <span className="text-[17px] text-[#9AAA7D]">
              ⇄
            </span>
          </button>
        ) : null}

        <button
        type="button"
        onClick={onLogout}
        disabled={authSending}
        className="mt-5 w-full rounded-2xl border border-red-300/20 bg-red-500/12 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-red-100/85 hover:bg-red-500/18 active:bg-red-500/24 disabled:opacity-60"
      >
        {authSending ? (isFr ? "Déconnexion..." : "Signing out...") : (isFr ? "Déconnexion" : "Sign out")}
      </button>
        </div>
    </>
  );

}
