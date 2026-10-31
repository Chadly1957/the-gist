-- Community Partner directory categories (2026-10-31): an optional
-- category on SpotlightListing so the public /partners page can group
-- listings into a real community directory. New signups pick their own
-- category; the UPDATEs below backfill every listing live on
-- 2026-10-31, classified from each business's own name and listing
-- description and matched by listing id. Additive only: existing rows
-- keep category = null until their UPDATE runs, and null renders in a
-- trailing More Community Partners section, never hidden.
ALTER TABLE "SpotlightListing" ADD COLUMN "category" TEXT;

-- Nothing Tame Wildlife Nuisance Removal (decatur)
UPDATE "SpotlightListing" SET "category" = 'home-services' WHERE "id" = 'cmqh20k6h000312d3wuepur22';
-- The Sewing Center (decatur)
UPDATE "SpotlightListing" SET "category" = 'shopping-retail' WHERE "id" = 'cmqh24a0x000512d3yj0927on';
-- Rainbow Youth Circle (decatur)
UPDATE "SpotlightListing" SET "category" = 'nonprofits-community' WHERE "id" = 'cmqhcu8h700026zwul4mudhg1';
-- Decatur Illinois Pride (decatur)
UPDATE "SpotlightListing" SET "category" = 'nonprofits-community' WHERE "id" = 'cmqhd1w5y00066zwup8t419d5';
-- Democratic Women of Macon County (decatur)
UPDATE "SpotlightListing" SET "category" = 'nonprofits-community' WHERE "id" = 'cmqhd725g000a6zwunpy4pomj';
-- Magickal Candles & Goodies by Ashley (decatur)
UPDATE "SpotlightListing" SET "category" = 'shopping-retail' WHERE "id" = 'cmqpn8c6o0003b7cwljg9fpp1';
-- DW’s Precision Lawn Care (decatur)
UPDATE "SpotlightListing" SET "category" = 'home-services' WHERE "id" = 'cmqq8enht00011tarc6rfquox';
-- Special Little Whiskers Sanctuary (decatur)
UPDATE "SpotlightListing" SET "category" = 'nonprofits-community' WHERE "id" = 'cmqsd1ybd0007106ankl0b4gs';
-- Lincoln Square Theater (decatur)
UPDATE "SpotlightListing" SET "category" = 'entertainment-recreation' WHERE "id" = 'cmqzjt67l0001ux44xn5q8a6q';
-- Foundation sports performance (decatur)
UPDATE "SpotlightListing" SET "category" = 'health-wellness' WHERE "id" = 'cmr0r5rwu000314iglvp8f4m5';
-- Bryan Smith for Macon County Clerk (decatur)
UPDATE "SpotlightListing" SET "category" = 'government-civic' WHERE "id" = 'cmr0yzolj0006cxw1wgs273p3';
-- Sharonsweb autism foundation (decatur)
UPDATE "SpotlightListing" SET "category" = 'nonprofits-community' WHERE "id" = 'cmr3uefa5000313gujuzx0ypr';
-- Chad Mitchell Photography, LLC (decatur)
UPDATE "SpotlightListing" SET "category" = 'professional-services' WHERE "id" = 'cmrbpmiog0003k7w9ehp7z2jh';
-- Capelli’s Studio & Spa (decatur)
UPDATE "SpotlightListing" SET "category" = 'health-wellness' WHERE "id" = 'cmrdydwrf0005aqhnzwb243yl';
-- 217 Law LLC (decatur)
UPDATE "SpotlightListing" SET "category" = 'professional-services' WHERE "id" = 'cmrjgbwjs000plbo3gryo8ccv';
-- Green Gen Ag LLC (decatur)
UPDATE "SpotlightListing" SET "category" = 'farms-agriculture' WHERE "id" = 'cmrm84qio000710nlgnzvcxeq';
-- Dan's Professional Pressure washing (decatur)
UPDATE "SpotlightListing" SET "category" = 'home-services' WHERE "id" = 'cmrw9pwl7000dm77rwo8ack60';
-- Sunset Farmstead LLC (decatur)
UPDATE "SpotlightListing" SET "category" = 'farms-agriculture' WHERE "id" = 'cmrxujsss000w40d0sb8ee4ya';
-- Margaret Faye (decatur)
UPDATE "SpotlightListing" SET "category" = 'entertainment-recreation' WHERE "id" = 'cms68vh6z00192shp3ogio9lq';
-- Birth to Five Illinois (decatur)
UPDATE "SpotlightListing" SET "category" = 'nonprofits-community' WHERE "id" = 'cms7xg6e9000h7jhuzens535y';
-- Golden Fox Brewing LLC (decatur)
UPDATE "SpotlightListing" SET "category" = 'food-drink' WHERE "id" = 'cms940grt000lbgun5i489ucx';
-- Steph’s Massage (decatur)
UPDATE "SpotlightListing" SET "category" = 'health-wellness' WHERE "id" = 'cmsneq3bh002110nygi9d6rjj';
-- Hernandez Renovation (decatur)
UPDATE "SpotlightListing" SET "category" = 'home-services' WHERE "id" = 'cmt3pbamc000dgy8z3kqxv10h';
-- BIG H Recreations LLC (decatur)
UPDATE "SpotlightListing" SET "category" = 'entertainment-recreation' WHERE "id" = 'cmtq9w8g200058sic2ugmry42';
-- Decatur Underground Theater (decatur)
UPDATE "SpotlightListing" SET "category" = 'entertainment-recreation' WHERE "id" = 'cmtva4tyd0003119e5dbcnn73';
-- Job's Daughters Decatur, IL Chapter (decatur)
UPDATE "SpotlightListing" SET "category" = 'nonprofits-community' WHERE "id" = 'cmtw1b3ig0006yfufk5df23gm';
-- 1912 Barn (decatur)
UPDATE "SpotlightListing" SET "category" = 'events-venues' WHERE "id" = 'cmud82xwg0009qy18lykqpzlk';
-- Urban Roots Home Solutions (decatur)
UPDATE "SpotlightListing" SET "category" = 'home-services' WHERE "id" = 'cmvh183ne0003m9tli2kdyixn';
-- The Gist Decatur (effingham)
UPDATE "SpotlightListing" SET "category" = 'from-the-gist' WHERE "id" = 'cmuocamkb000rkjoixzuxrte6';
-- Family Life Center (effingham)
UPDATE "SpotlightListing" SET "category" = 'health-wellness' WHERE "id" = 'cmuoe0f2o000j9bona2rqexbv';
-- Silk Purse Thrift (effingham)
UPDATE "SpotlightListing" SET "category" = 'shopping-retail' WHERE "id" = 'cmuoe49ak000vk9cr9n96djn7';
-- The Gist Deals (effingham)
UPDATE "SpotlightListing" SET "category" = 'from-the-gist' WHERE "id" = 'cmv6sway1000f14jmqkixt7av';
