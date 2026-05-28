import cardSpriteSheet from "../assets/CardSpriteSheet.png";

const SUIT_SYM = { s: "♠", h: "♥", d: "♦", c: "♣" };

const SIZES = {
  sm: { w: 32,  h: 46,  cf: 9,  sf: 16 },
  md: { w: 48,  h: 68,  cf: 12, sf: 24 },
  lg: { w: 62,  h: 88,  cf: 14, sf: 30 },
};

// Sprite sheet layout: 13 cols (A,2-10,J,Q,K) × 4 rows (spades,clubs,hearts,diamonds)
const SPRITE_W = 363;   // px per card on sheet
const SPRITE_H = 429;

const RANK_INDEX = { A:0, 2:1, 3:2, 4:3, 5:4, 6:5, 7:6, 8:7, 9:8, T:9, J:10, Q:11, K:12 };
const SUIT_INDEX = { s:0, c:1, h:2, d:3 };

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ code, size = "md", highlight = false, faceDown = false }) {
  const sizes = {
    sm: { w:32, h:46, cf:9,  sf:16 },
    md: { w:48, h:68, cf:12, sf:24 },
    lg: { w:62, h:88, cf:14, sf:30 },
  };
  const s = sizes[size];

  if (faceDown || !code || code === "X") {
    return (
      <div className="card card-back" style={{ width:s.w, height:s.h }}>
        <div className="card-back-pattern" />
      </div>
    );
  }
  const rank = code.slice(0,-1);
  const suit = code.slice(-1);
  const display = rank === "T" ? "10" : rank;
  const red = suit === "d" || suit === "h";

  const offsetX = -(RANK_INDEX[rank] * SPRITE_W * scaleX);
  const offsetY = -(SUIT_INDEX[suit] * SPRITE_H * scaleY);

  return (
    <div
      className={`card ${highlight ? "card-highlight" : ""}`}
      style={{
        width: s.w,
        height: s.h,
        backgroundImage: `url(${cardSpriteSheet})`,
        backgroundSize: `${SPRITE_W * 13 * scaleX}px ${SPRITE_H * 4 * scaleY}px`,
        backgroundPosition: `${offsetX}px ${offsetY}px`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}