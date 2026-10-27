// Reader states: one engagement label per reader, derived the same way in
// the analytics dashboard and (later) in transforming template blocks.
// Buyer status is a separate badge, not a state, so a buyer can also be
// Highly engaged, Fading, etc. Thresholds assume a near-daily send.
export type ReaderState =
  | "New"
  | "Highly engaged"
  | "Engaged"
  | "Quiet"
  | "At risk"
  | "Fading";

export function deriveReaderState(input: {
  subscribedAt: Date;
  opens30: number;
  lifetimeOpens: number;
}): ReaderState {
  const daysSinceSubscribe =
    (Date.now() - new Date(input.subscribedAt).getTime()) / 86400000;
  if (daysSinceSubscribe <= 14) return "New";
  if (input.lifetimeOpens >= 5 && input.opens30 === 0) return "Fading";
  if (input.lifetimeOpens >= 5 && input.opens30 <= 2) return "At risk";
  if (input.opens30 >= 12) return "Highly engaged";
  if (input.opens30 >= 5) return "Engaged";
  return "Quiet";
}

export const READER_STATE_ORDER: ReaderState[] = [
  "Highly engaged",
  "Engaged",
  "New",
  "Quiet",
  "At risk",
  "Fading",
];
