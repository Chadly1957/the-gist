// Minimal ambient types for the "opentype.js" package, covering only
// the API the media kit composer uses (parse, Font#getAdvanceWidth,
// Font#getPath, Path#toPathData). Declared locally because the
// upstream @types package ships a malformed tarball on some registries
// (zero-byte files), and the composer must build deterministically.
declare module "opentype.js" {
  export interface RenderOptions {
    kerning?: boolean;
    tracking?: number;
  }

  export class Path {
    toPathData(decimalPlaces?: number): string;
  }

  export class Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    getAdvanceWidth(text: string, fontSize?: number, options?: RenderOptions): number;
    getPath(text: string, x: number, y: number, fontSize: number, options?: RenderOptions): Path;
  }

  export function parse(buffer: ArrayBuffer, lowMemory?: boolean): Font;
}
