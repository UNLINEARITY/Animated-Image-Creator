/// <reference types="vite/client" />

declare module 'upng-js' {
  export interface UPNG {
    encode(
      imgs: ArrayLike<number>[],
      w: number,
      h: number,
      cnum: number,
      dels?: number[]
    ): ArrayBuffer;
    decode(buffer: ArrayBuffer): any;
    toRGBA8(out: any): ArrayBuffer[];
  }
  const upng: UPNG;
  export default upng;
}
