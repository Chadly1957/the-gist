-- Add quantity (inventory cap) to Product; null means unlimited.
ALTER TABLE "Product" ADD COLUMN "quantity" INTEGER;
