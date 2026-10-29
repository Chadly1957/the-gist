// Fixed apparel size set offered on products that enable size selection
// (Product.offersSizes). Deliberately a single shared constant, not
// per-product configuration: every sized product offers the same sizes.
// Client-safe (no server imports) so the public product page and the API
// routes validate against the exact same list.
export const PRODUCT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;

export type ProductSize = (typeof PRODUCT_SIZES)[number];

export function isProductSize(value: unknown): value is ProductSize {
  return typeof value === "string" && (PRODUCT_SIZES as readonly string[]).includes(value);
}
