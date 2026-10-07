-- Distinguish item-level deal URLs from weekly-ad URLs so the UI can label links honestly.

ALTER TABLE "Deal" ADD COLUMN "isItemUrl" BOOLEAN NOT NULL DEFAULT false;
