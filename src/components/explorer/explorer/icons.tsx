/* 1.5px line icons drawn on a 24px grid, currentColor. */

type P = { size?: number };
const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconBuilding = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M5 21V5.5L13 3v18M13 8l6 2v11M3 21h18M8 8h2M8 11.5h2M8 15h2M16 13h.01M16 16.5h.01" />
  </svg>
);

export const IconLayers = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5" />
  </svg>
);

export const IconCube = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="m12 2.8 8 4.6v9.2l-8 4.6-8-4.6V7.4l8-4.6Z" />
    <path d="M12 12v9.2M12 12l8-4.6M12 12 4 7.4" />
  </svg>
);

export const IconWalk = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="13" cy="4.5" r="1.6" />
    <path d="m9.5 21 2.2-6.2-2.6-2.3 1-4.3L14 10l2.6 1.4M11.7 14.8l3 2.2.8 4M10 8.2 7 9.6l-1 3" />
  </svg>
);

export const IconView = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M3 20h18M5 20v-7h14v7M8 13V9a4 4 0 0 1 8 0v4" />
    <path d="M12 5V3M17.5 7.5 19 6M6.5 7.5 5 6" />
  </svg>
);

export const IconGallery = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="m3 16 5-5 4 4 3-3 6 6" />
    <circle cx="15.5" cy="8.5" r="1.3" />
  </svg>
);

export const IconChevron = ({ size, dir = "up" }: P & { dir?: "up" | "down" | "left" | "right" }) => {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg {...base(size)} style={{ transform: `rotate(${rot}deg)` }}>
      <path d="m6 15 6-6 6 6" />
    </svg>
  );
};

export const IconPlus = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMinus = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M5 12h14" />
  </svg>
);

export const IconClose = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconArrowLeft = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

export const IconSun = ({ size }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
);

export const IconPhoto = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

/** Gable house (the whole-house stop of the level picker). */
export const IconHouse = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M4 20V10l8-6 8 6v10H4Z" />
    <path d="M10 20v-5h4v5" />
  </svg>
);

export const IconWhatsApp = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.3 18.6l-3.8.9Z" />
    <path d="M9.2 8.6c.2-.5.6-.5.9-.5h.4c.2 0 .4.1.5.4l.6 1.4c.1.2 0 .5-.1.6l-.4.5c-.1.1-.2.3 0 .5.5.9 1.3 1.6 2.2 2 .2.1.4.1.5 0l.6-.7c.2-.2.4-.2.6-.1l1.3.6c.3.1.4.3.4.5 0 .5-.2 1.1-.6 1.4-.5.4-1.2.6-1.9.4-2.2-.6-4.2-2.5-5-4.7-.2-.7-.2-1.6.1-2.3Z" />
  </svg>
);

export const IconPhone = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 6.9 6.9l1.3-2 4 1.6V19a1.6 1.6 0 0 1-1.6 1.6A16.6 16.6 0 0 1 3.4 5.6 1.6 1.6 0 0 1 5 4Z" />
  </svg>
);

/** Filled WhatsApp glyph (the floating button), same drawing as the home page's. */
export const IconWhatsAppFill = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91a9.85 9.85 0 0 0-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 5.83 2.42 8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.6.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.28Z" />
  </svg>
);

/** Floor plan: an outline with an inner wall and a door gap. */
export const IconPlan = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M4 4h16v16H4z" />
    <path d="M4 12h7M11 4v4M15 12h5M15 12v4" />
  </svg>
);

export const IconArrowRight = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** Share: a box with an arrow leaving it upwards. */
export const IconShare = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M12 3.5v11M8 7.5l4-4 4 4" />
    <path d="M8.5 10.5H6.5a1.5 1.5 0 0 0-1.5 1.5v7a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-2" />
  </svg>
);

/** Attic: the roof outline with a skylight (the attic stop of the level picker). */
export const IconAttic = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M3.5 17 12 6.5 20.5 17H3.5Z" />
    <path d="M10.5 13.5h3" />
  </svg>
);
