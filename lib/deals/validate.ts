// Shared validation for manual/evergreen deal input — used by the admin UI
// form AND the programmatic admin API (side-chat agent submissions).

export interface ManualDealInput {
  retailerSlug?: string;
  businessName?: string;
  title?: string;
  price?: string;
  regPrice?: string;
  category?: string;
  summary?: string;
  dealUrl?: string;
  validFrom?: string;
  validTo?: string;
  isTopPick?: boolean;
  sortOrder?: number;
}

export interface ValidatedManualDeal {
  retailerSlug: string;
  businessName?: string;
  title: string;
  price?: string;
  regPrice?: string;
  category?: string;
  summary?: string;
  dealUrl?: string;
  validFrom?: string;
  validTo?: string;
  isTopPick: boolean;
  sortOrder: number;
}

const str = (v: unknown, max: number): string | undefined => {
  if (v == null || v === "") return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  if (s.length > max) throw new Error(`Field exceeds ${max} characters.`);
  return s;
};

export function validateManualDeal(input: ManualDealInput): ValidatedManualDeal {
  const title = str(input.title, 200);
  if (!title) throw new Error("Deal title is required.");
  const retailerSlug = str(input.retailerSlug, 80);
  if (!retailerSlug) throw new Error("retailerSlug is required (e.g. \"business-deals\").");

  const dealUrl = str(input.dealUrl, 500);
  if (dealUrl && !/^https?:\/\//i.test(dealUrl)) {
    throw new Error("Deal link must be a full http(s) URL.");
  }
  for (const d of [input.validFrom, input.validTo]) {
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(String(d).trim())) {
      throw new Error("Dates must be YYYY-MM-DD.");
    }
  }

  return {
    retailerSlug,
    businessName: str(input.businessName, 120),
    title,
    price: str(input.price, 60),
    regPrice: str(input.regPrice, 60),
    category: str(input.category, 80),
    summary: str(input.summary, 2000),
    dealUrl,
    validFrom: str(input.validFrom, 10),
    validTo: str(input.validTo, 10),
    isTopPick: input.isTopPick === true,
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
  };
}
