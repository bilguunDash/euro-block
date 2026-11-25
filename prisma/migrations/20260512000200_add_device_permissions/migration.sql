ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "mobileAccessAllowed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "user_devices" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "deviceType" TEXT NOT NULL DEFAULT 'unknown',
  "userAgent" TEXT,
  "platform" TEXT,
  "ipAddress" TEXT,
  "allowed" BOOLEAN NOT NULL DEFAULT false,
  "blockedReason" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_devices_userId_deviceId_key"
ON "user_devices"("userId", "deviceId");

CREATE INDEX IF NOT EXISTS "user_devices_userId_idx"
ON "user_devices"("userId");

CREATE INDEX IF NOT EXISTS "user_devices_deviceType_idx"
ON "user_devices"("deviceType");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_devices_userId_fkey'
  ) THEN
    ALTER TABLE "user_devices"
    ADD CONSTRAINT "user_devices_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
