import cardSpriteSheet from "../assets/CardSpriteSheet.png";

// ─── Sprite sheet layout ──────────────────────────────────────────────────────
// 13 cols: A  2  3  4  5  6  7  8  9  T  J  Q  K
// 5 rows:  spades | clubs | hearts | diamonds | back (row 4)
const SPRITE_W = 363;   // source px per card
const SPRITE_H = 429;
const SHEET_COLS = 13;
const SHEET_ROWS = 5;

const RANK_COL = { A:0, "2":1, "3":2, "4":3, "5":4, "6":5, "7":6, "8":7, "9":8, T:9, J:10, Q:11, K:12 };
const SUIT_ROW = { s:0, c:1, h:2, d:3 };

const SIZES = {
  sm: { w: 32, h: 46 },
  md: { w: 48, h: 68 },
  lg: { w: 62, h: 88 },
};

// ─── Card component ───────────────────────────────────────────────────────────
// code: e.g. "Ah", "Td", "2c" — rank char + suit char
// faceDown: show card back sprite (row 4, col 0)
export default function Card({ code, size = "md", highlight = false, faceDown = false }) {
  const s = SIZES[size] ?? SIZES.md;

  // Scale so one source card maps exactly to display size
  // sheet pixel dimensions at display scale:
  const sheetW = s.w * SHEET_COLS;   // SPRITE_W * SHEET_COLS * (s.w / SPRITE_W)
  const sheetH = s.h * SHEET_ROWS;

  let col, row;

  if (faceDown || !code || code === "X") {
    // Back sprite lives at row 4, col 0
    col = 0;
    row = 4;
  } else {
    const rank = code.slice(0, -1);
    const suit = code.slice(-1);
    col = RANK_COL[rank] ?? 0;
    row = SUIT_ROW[suit] ?? 0;
  }

  // Each card is exactly s.w × s.h at display scale
  const offsetX = -(col * s.w);
  const offsetY = -(row * s.h);

  return (
    <div
      className={`card${highlight ? " card-highlight" : ""}`}
      style={{
        width:               s.w,
        height:              s.h,
        backgroundImage:     `url(${cardSpriteSheet})`,
        backgroundSize:      `${sheetW}px ${sheetH}px`,
        backgroundPosition:  `${offsetX}px ${offsetY}px`,
        backgroundRepeat:    "no-repeat",
        borderRadius:        5,
        flexShrink:          0,
        display:             "inline-block",
      }}
    />
  );
}
