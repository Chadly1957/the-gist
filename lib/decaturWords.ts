// Curated word bank for Decatur Wordy — words tied to Decatur, IL history,
// businesses, landmarks, and nearby communities. Each entry is 3–8 letters,
// A–Z only (matches the WordyWord validation in the words API route).
//
// Add more entries here any time; the autofill logic (lib/wordyAutofill.ts)
// picks from this list automatically and avoids repeating a word for
// ~6 months.
export const DECATUR_WORD_BANK: string[] = [
  // Businesses & industry
  "STALEY",    // A.E. Staley Manufacturing, founded in Decatur
  "MUELLER",   // Mueller Co., water valve maker founded in Decatur
  "TATE",      // Tate & Lyle, current owner of the former Staley plant
  "ADM",       // Archer Daniels Midland, longtime Decatur employer
  "WABASH",    // Wabash Railroad, historic rail hub through Decatur

  // Education & institutions
  "MILLIKIN",  // Millikin University
  "KIRKLAND",  // Kirkland Fine Arts Center at Millikin
  "RICHLAND",  // Richland Community College

  // History & namesakes
  "STEPHEN",   // Stephen Decatur, the city's naval-hero namesake
  "DECATUR",
  "LINCOLN",   // Abraham Lincoln's first Illinois home was near Decatur
  "MACON",     // Macon County, of which Decatur is the seat
  "SANGAMON",  // Sangamon River, dammed to form Lake Decatur
  "TRANSFER",  // Transfer House, landmark gift from James Millikin
  "CENTRAL",   // Central Park, home of the Transfer House
  "HERALD",    // Herald & Review, Decatur's newspaper

  // Parks & landmarks
  "SCOVILL",   // Scovill Park & Zoo
  "NELSON",    // Nelson Park
  "FAIRVIEW",  // Fairview Park
  "HICKORY",   // Hickory Point Park & Mall
  "PERSHING",  // Pershing Road, named for Gen. John Pershing

  // Nearby towns & villages in Macon County
  "MAROA",
  "ARGENTA",
  "FORSYTH",
  "OREANA",
  "NIANTIC",
  "CISCO",
  "BOODY",

  // Regional identity
  "PRAIRIE",   // Illinois prairie land surrounding Decatur
  "SOYBEAN",   // Decatur's "Soybean Capital of the World" nickname
];
