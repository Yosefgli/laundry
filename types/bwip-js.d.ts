declare module "bwip-js" {
  export interface ToCanvasOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    includetext?: boolean;
    backgroundcolor?: string;
    [key: string]: unknown;
  }

  export function toCanvas(canvas: HTMLCanvasElement, options: ToCanvasOptions): void;
}
