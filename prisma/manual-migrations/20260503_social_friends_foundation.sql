CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE,
  "username" TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Friendship" (
  "id" TEXT PRIMARY KEY,
  "requesterId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Friendship_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Invite" (
  "id" TEXT PRIMARY KEY,
  "senderId" TEXT NOT NULL,
  "email" TEXT,
  "token" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  CONSTRAINT "Invite_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "UserPlace" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "visited" BOOLEAN NOT NULL DEFAULT false,
  "visitedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPlace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PlaceComment" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SharedList" (
  "id" TEXT PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SharedList_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SharedListMember" (
  "id" TEXT PRIMARY KEY,
  "listId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SharedListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "SharedList"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SharedListMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SharedListPlace" (
  "id" TEXT PRIMARY KEY,
  "listId" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "addedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SharedListPlace_listId_fkey" FOREIGN KEY ("listId") REFERENCES "SharedList"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PlaceRecommendation" (
  "id" TEXT PRIMARY KEY,
  "senderId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "placeId" TEXT NOT NULL,
  "message" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlaceRecommendation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlaceRecommendation_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_requesterId_receiverId_key" ON "Friendship"("requesterId", "receiverId");
CREATE INDEX IF NOT EXISTS "Friendship_receiverId_status_idx" ON "Friendship"("receiverId", "status");
CREATE INDEX IF NOT EXISTS "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");

CREATE INDEX IF NOT EXISTS "Invite_senderId_idx" ON "Invite"("senderId");
CREATE INDEX IF NOT EXISTS "Invite_email_idx" ON "Invite"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "UserPlace_userId_placeId_key" ON "UserPlace"("userId", "placeId");
CREATE INDEX IF NOT EXISTS "UserPlace_placeId_idx" ON "UserPlace"("placeId");
CREATE INDEX IF NOT EXISTS "UserPlace_userId_visibility_idx" ON "UserPlace"("userId", "visibility");

CREATE INDEX IF NOT EXISTS "PlaceComment_placeId_visibility_idx" ON "PlaceComment"("placeId", "visibility");
CREATE INDEX IF NOT EXISTS "PlaceComment_userId_idx" ON "PlaceComment"("userId");

CREATE INDEX IF NOT EXISTS "SharedList_ownerId_idx" ON "SharedList"("ownerId");

CREATE UNIQUE INDEX IF NOT EXISTS "SharedListMember_listId_userId_key" ON "SharedListMember"("listId", "userId");
CREATE INDEX IF NOT EXISTS "SharedListMember_userId_idx" ON "SharedListMember"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "SharedListPlace_listId_placeId_key" ON "SharedListPlace"("listId", "placeId");
CREATE INDEX IF NOT EXISTS "SharedListPlace_placeId_idx" ON "SharedListPlace"("placeId");

CREATE INDEX IF NOT EXISTS "PlaceRecommendation_receiverId_readAt_idx" ON "PlaceRecommendation"("receiverId", "readAt");
CREATE INDEX IF NOT EXISTS "PlaceRecommendation_senderId_idx" ON "PlaceRecommendation"("senderId");
CREATE INDEX IF NOT EXISTS "PlaceRecommendation_placeId_idx" ON "PlaceRecommendation"("placeId");
