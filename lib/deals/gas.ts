// Current gas prices for the Deals Book bento box.
//
// WIRING POINT: this is a stub. When the daily gas-price source is ready
// (automatic API or manual entry), implement fetchGasPrices() below and set
// live: true. The portal bento box and types already handle both states.

export interface GasStationPrice {
  name: string;
  regular: number | null; // dollars per gallon
  updatedAt: string; // ISO timestamp
}

export interface GasPriceData {
  live: boolean;
  stations: GasStationPrice[];
  updatedAt: string | null;
}

export async function getGasPrices(_workspaceId: string): Promise<GasPriceData> {
  // TODO: wire up the daily gas price source here.
  // Options: GasBuddy API, AAA feed, or workspace settings pasted by Chad.
  // Return { live: true, stations: [...], updatedAt } once wired.
  return { live: false, stations: [], updatedAt: null };
}
