/**
 * Types for oklch-to-srgb.mjs, which stays plain ESM so the verification script
 * can run under Node without a loader.
 */

export interface Srgb {
  /** 0-255 */
  r: number;
  /** 0-255 */
  g: number;
  /** 0-255 */
  b: number;
  /** 0-1 */
  a: number;
}

export declare function oklchToSrgb(L: number, C: number, Hdeg: number, alpha?: number): Srgb;
export declare function isInSrgbGamut(L: number, C: number, Hdeg: number): boolean;
export declare function convertOklchFunction(match: string, L: string, C: string, H: string, alpha?: string): string;
export declare function convertOklchInCss(css: string): string | null;
export declare function oklchToSrgbPlugin(): {
  name: string;
  apply: 'build';
  enforce: 'post';
  generateBundle(options: unknown, bundle: Record<string, { type: string; fileName: string; source: string | Uint8Array }>): void;
};
