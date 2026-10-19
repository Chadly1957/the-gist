-- AlterTable: add ad creative profile fields to PresentingPartnership
ALTER TABLE "PresentingPartnership" ADD COLUMN "sponsorProfileId" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "headline" TEXT,
ADD COLUMN "body" TEXT,
ADD COLUMN "ctaLabel" TEXT,
ADD COLUMN "ctaUrl" TEXT,
ADD COLUMN "imageUrl" TEXT;

-- AlterTable: add logoUrl to SponsorProfile
ALTER TABLE "SponsorProfile" ADD COLUMN "logoUrl" TEXT;
