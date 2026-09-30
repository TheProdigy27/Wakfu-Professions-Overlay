// Pictogrammes des boutons, en SVG : un caractère (←, ⚙, ✕…) se place selon la police de secours et tombe à côté du centre.
const PATHS = {
  back: <path d="M13 8H3M7 4 3 8l4 4" />,
  settings: (
    <path
      className="filled"
      fillRule="evenodd"
      d="M6.74 2.95L7.03 1.07L8.97 1.07L9.26 2.95L10.68 3.54L12.21 2.41L13.59 3.79L12.46 5.32L13.05 6.74L14.93 7.03L14.93 8.97L13.05 9.26L12.46 10.68L13.59 12.21L12.21 13.59L10.68 12.46L9.26 13.05L8.97 14.93L7.03 14.93L6.74 13.05L5.32 12.46L3.79 13.59L2.41 12.21L3.54 10.68L2.95 9.26L1.07 8.97L1.07 7.03L2.95 6.74L3.54 5.32L2.41 3.79L3.79 2.41L5.32 3.54ZM8 5.6A2.4 2.4 0 1 0 8 10.4A2.4 2.4 0 1 0 8 5.6Z"
    />
  ),
  compact: <rect x="2" y="5" width="12" height="6" rx="1" />,
  normal: <rect x="3" y="3" width="10" height="10" rx="1" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  expand: <path className="filled" d="M6 4l4 4-4 4z" />,
  collapse: <path className="filled" d="M4 6l4 4 4-4z" />,
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M5.5 10.5H4A1.5 1.5 0 0 1 2.5 9V4A1.5 1.5 0 0 1 4 2.5H9A1.5 1.5 0 0 1 10.5 4V5.5" />
    </>
  ),
  check: <path d="M3 8.5l3 3 7-7" />,
  update: <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13.5h10" />,
};

export type GlyphName = keyof typeof PATHS;

export function Glyph({ name }: { name: GlyphName }) {
  return (
    <svg className="glyph" viewBox="0 0 16 16" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
