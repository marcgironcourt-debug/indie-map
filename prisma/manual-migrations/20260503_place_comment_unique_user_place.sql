CREATE UNIQUE INDEX IF NOT EXISTS "PlaceComment_userId_placeId_key" ON "PlaceComment"("userId", "placeId");
