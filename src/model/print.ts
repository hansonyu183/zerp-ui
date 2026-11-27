/** Physical clockwise rotation, around the centre of the content sheet. */
type Rotation = 0 | 90 | 180 | 270;
type PrintFont = "sans-serif" | "serif" | "monospace" | "cjk-sans";
export type PrintTextStyle = {
  font?: PrintFont;
  size?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  /** Unitless line height; default 1.2. */
  lineHeight?: number;
  /** Explicit newlines are preserved. word breaks long words; none clips a single line. */
  wrap?: "word" | "none";
};
/** 以毫米表示的位置与尺寸，相对所属打印区域。 */
export type PrintBox = {
  /** 同一打印区域内唯一。 */
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  foreground?: string;
  background?: string;
  border?: boolean;
  /** Physical stroke width in mm, including text/image borders; default 0.2. */
  lineWidth?: number;
};
export type PrintItem = PrintBox &
  (
    | ({
        kind: "text";
        text: string;
        /** Extra top inset in mm for measured font ascenders. */
        insetTop?: number;
      } & PrintTextStyle)
    | { kind: "image"; src: string; alt: string }
    | { kind: "line" | "rect" }
  );
/** Fixed output facts in millimetres. Coordinates remain in the unrotated sheet; 90/270 swap output dimensions. */
export type PrintDocument = {
  id: string;
  title: string;
  width: number;
  height: number;
  rotation?: Rotation;
  /** Library-owned overlay, clipped to the sheet, above all page content. */
  watermark?: {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: Rotation;
    opacity: number;
    foreground?: string;
  } & PrintTextStyle;
  pages: readonly { key: string; items: readonly PrintItem[] }[];
};
