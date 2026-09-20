/// <reference types="vite/client" />

declare module 'upng-js' {
  export interface UPNGImage {
    width: number;
    height: number;
    frames?: { delay: number }[];
  }
  export interface UPNG {
    encode(
      imgs: ArrayBuffer[],
      w: number,
      h: number,
      cnum: number,
      dels?: number[]
    ): ArrayBuffer;
    decode(buffer: ArrayBuffer): UPNGImage;
    toRGBA8(out: UPNGImage): ArrayBuffer[];
  }
  const upng: UPNG;
  export default upng;
}