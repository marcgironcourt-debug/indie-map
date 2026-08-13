-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "website" TEXT,
    "openingHours" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "description" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "descriptionFr" TEXT,
    "descriptionEn" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "placeId" TEXT,
    "city" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "country" TEXT,
    "sessionId" TEXT,
    "userId" TEXT,
    "locale" TEXT,
    "platform" TEXT,
    "metadata" JSONB,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "openingHours" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "photoMime" TEXT,
    "photoBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "userId" TEXT,
    "reviewToken" TEXT,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveSession" (
    "sessionId" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "platform" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActiveSession_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "DailyActiveUser" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyActiveUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySession" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "homeCity" TEXT,
    "ageRange" TEXT,
    "profileCompletedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "avatarColor" TEXT,
    "commentsVisibleToFriends" BOOLEAN NOT NULL DEFAULT false,
    "visitedPlacesVisibleToFriends" BOOLEAN NOT NULL DEFAULT false,
    "preferredLocale" TEXT NOT NULL DEFAULT 'fr',
    "lastKnownLat" DOUBLE PRECISION,
    "lastKnownLng" DOUBLE PRECISION,
    "lastKnownLocationAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "email" TEXT,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPlace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "visited" BOOLEAN NOT NULL DEFAULT false,
    "visitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceComment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedList" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedListMember" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "SharedListMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedListPlace" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedListPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceRecommendation" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "message" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subscription" TEXT,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushInstallation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "subscription" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReactivationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextualNotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "placeId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),

    CONSTRAINT "ContextualNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUpdateNotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppUpdateNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");

-- CreateIndex
CREATE INDEX "Event_createdAt_idx" ON "Event"("createdAt");

-- CreateIndex
CREATE INDEX "Event_userId_idx" ON "Event"("userId");

-- CreateIndex
CREATE INDEX "Event_sessionId_idx" ON "Event"("sessionId");

-- CreateIndex
CREATE INDEX "Event_placeId_idx" ON "Event"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_reviewToken_key" ON "Submission"("reviewToken");

-- CreateIndex
CREATE INDEX "Submission_userId_idx" ON "Submission"("userId");

-- CreateIndex
CREATE INDEX "DailyActiveUser_day_idx" ON "DailyActiveUser"("day");

-- CreateIndex
CREATE UNIQUE INDEX "DailyActiveUser_day_sessionId_key" ON "DailyActiveUser"("day", "sessionId");

-- CreateIndex
CREATE INDEX "DailySession_day_idx" ON "DailySession"("day");

-- CreateIndex
CREATE UNIQUE INDEX "DailySession_day_launchId_key" ON "DailySession"("day", "launchId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Friendship_receiverId_status_idx" ON "Friendship"("receiverId", "status");

-- CreateIndex
CREATE INDEX "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_receiverId_key" ON "Friendship"("requesterId", "receiverId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE INDEX "Invite_senderId_idx" ON "Invite"("senderId");

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- CreateIndex
CREATE INDEX "UserPlace_placeId_idx" ON "UserPlace"("placeId");

-- CreateIndex
CREATE INDEX "UserPlace_userId_visibility_idx" ON "UserPlace"("userId", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "UserPlace_userId_placeId_key" ON "UserPlace"("userId", "placeId");

-- CreateIndex
CREATE INDEX "PlaceComment_placeId_visibility_idx" ON "PlaceComment"("placeId", "visibility");

-- CreateIndex
CREATE INDEX "PlaceComment_userId_idx" ON "PlaceComment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceComment_userId_placeId_key" ON "PlaceComment"("userId", "placeId");

-- CreateIndex
CREATE INDEX "SharedList_ownerId_idx" ON "SharedList"("ownerId");

-- CreateIndex
CREATE INDEX "SharedListMember_userId_idx" ON "SharedListMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedListMember_listId_userId_key" ON "SharedListMember"("listId", "userId");

-- CreateIndex
CREATE INDEX "SharedListPlace_placeId_idx" ON "SharedListPlace"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedListPlace_listId_placeId_key" ON "SharedListPlace"("listId", "placeId");

-- CreateIndex
CREATE INDEX "PlaceRecommendation_receiverId_readAt_idx" ON "PlaceRecommendation"("receiverId", "readAt");

-- CreateIndex
CREATE INDEX "PlaceRecommendation_senderId_idx" ON "PlaceRecommendation"("senderId");

-- CreateIndex
CREATE INDEX "PlaceRecommendation_placeId_idx" ON "PlaceRecommendation"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "LoginToken_token_key" ON "LoginToken"("token");

-- CreateIndex
CREATE INDEX "LoginToken_email_idx" ON "LoginToken"("email");

-- CreateIndex
CREATE INDEX "LoginToken_expiresAt_idx" ON "LoginToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_token_key" ON "PushDevice"("token");

-- CreateIndex
CREATE INDEX "PushDevice_userId_idx" ON "PushDevice"("userId");

-- CreateIndex
CREATE INDEX "PushDevice_platform_idx" ON "PushDevice"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "PushInstallation_sessionId_key" ON "PushInstallation"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PushInstallation_token_key" ON "PushInstallation"("token");

-- CreateIndex
CREATE INDEX "PushInstallation_userId_idx" ON "PushInstallation"("userId");

-- CreateIndex
CREATE INDEX "PushInstallation_platform_idx" ON "PushInstallation"("platform");

-- CreateIndex
CREATE INDEX "PushInstallation_lastSeenAt_idx" ON "PushInstallation"("lastSeenAt");

-- CreateIndex
CREATE INDEX "PushInstallation_lastReactivationAt_idx" ON "PushInstallation"("lastReactivationAt");

-- CreateIndex
CREATE INDEX "ContextualNotificationLog_userId_sentAt_idx" ON "ContextualNotificationLog"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "ContextualNotificationLog_userId_categoryKey_sentAt_idx" ON "ContextualNotificationLog"("userId", "categoryKey", "sentAt");

-- CreateIndex
CREATE INDEX "ContextualNotificationLog_placeId_idx" ON "ContextualNotificationLog"("placeId");

-- CreateIndex
CREATE INDEX "AppUpdateNotificationLog_userId_sentAt_idx" ON "AppUpdateNotificationLog"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "AppUpdateNotificationLog_version_idx" ON "AppUpdateNotificationLog"("version");

-- CreateIndex
CREATE INDEX "AppUpdateNotificationLog_platform_idx" ON "AppUpdateNotificationLog"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "AppUpdateNotificationLog_userId_version_platform_key" ON "AppUpdateNotificationLog"("userId", "version", "platform");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPlace" ADD CONSTRAINT "UserPlace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceComment" ADD CONSTRAINT "PlaceComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedList" ADD CONSTRAINT "SharedList_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedListMember" ADD CONSTRAINT "SharedListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "SharedList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedListMember" ADD CONSTRAINT "SharedListMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedListPlace" ADD CONSTRAINT "SharedListPlace_listId_fkey" FOREIGN KEY ("listId") REFERENCES "SharedList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceRecommendation" ADD CONSTRAINT "PlaceRecommendation_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceRecommendation" ADD CONSTRAINT "PlaceRecommendation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushInstallation" ADD CONSTRAINT "PushInstallation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextualNotificationLog" ADD CONSTRAINT "ContextualNotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUpdateNotificationLog" ADD CONSTRAINT "AppUpdateNotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

