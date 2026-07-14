import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 18,
  height: 18,
};

export const IconDashboard = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const IconTag = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82Z" />
    <circle cx="7" cy="7" r="1.6" />
  </svg>
);

export const IconFolder = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.3c.5 0 1 .2 1.4.6L11.8 6h6.7A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5Z" />
  </svg>
);

export const IconShoe = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 15v2.5A2.5 2.5 0 0 0 5.5 20h13a2.5 2.5 0 0 0 2.5-2.5v-.7c0-1.1-.7-2-1.8-2.3l-6-1.7c-.5-.1-.9-.4-1.1-.8L10.2 9.4c-.4-.6-1-1-1.7-1H6.5A3.5 3.5 0 0 0 3 11.9Z" />
    <path d="M7 12h1.5M11 14.5h1.5M15 16h2" />
  </svg>
);

export const IconBox = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3.3 7.5 12 3l8.7 4.5v9L12 21l-8.7-4.5Z" />
    <path d="M3.3 7.5 12 12m0 0 8.7-4.5M12 12v9" />
  </svg>
);

export const IconUsers = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c.8-3 3.4-4.5 6-4.5s5.2 1.5 6 4.5" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M15.5 14.2c2 .3 3.8 1.5 4.5 3.8" />
  </svg>
);

export const IconUser = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4 20c1-3.5 4.4-5.2 8-5.2s7 1.7 8 5.2" />
  </svg>
);

export const IconTruck = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
    <circle cx="7" cy="18" r="1.8" />
    <circle cx="17" cy="18" r="1.8" />
  </svg>
);

export const IconPin = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);

export const IconCart = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 4h2l2.4 12.1a2 2 0 0 0 2 1.6h8.3a2 2 0 0 0 2-1.5L21 8H6" />
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
  </svg>
);

export const IconSwap = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 8h14l-3-3m3 11H3l3 3" />
  </svg>
);

export const IconArrows = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" />
  </svg>
);

export const IconActivity = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 12h4l3-8 4 16 3-8h4" />
  </svg>
);

export const IconSearch = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconPlus = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconEdit = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M14 4.5 19.5 10 9 20.5H3.5V15Z" />
    <path d="m14 4.5 5.5 5.5" />
  </svg>
);

export const IconTrash = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </svg>
);

export const IconEye = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconEyeOff = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
    <path d="M9.9 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.1" />
    <path d="M6.1 6.1C3.7 7.8 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.3-1" />
  </svg>
);

export const IconFileText = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h6" />
  </svg>
);

export const IconArrowUpRight = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

export const IconMoreVertical = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const IconChevronLeft = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const IconChevronRight = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IconMenu = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const IconX = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconLogout = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9" />
  </svg>
);

export const IconSettings = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.7-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.7.3l-.1.1A2 2 0 1 1 4.6 17l.1-.1a1.6 1.6 0 0 0 .3-1.7 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.7l-.1-.1A2 2 0 1 1 7 4.6l.1.1a1.6 1.6 0 0 0 1.7.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.7-.3l.1-.1A2 2 0 1 1 19.4 7l-.1.1a1.6 1.6 0 0 0-.3 1.7V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
);

export const IconSparkles = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </svg>
);

export const IconFilter = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 5h18l-7 9v5l-4 2v-7Z" />
  </svg>
);

export const IconRefresh = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5" />
  </svg>
);

export const IconImage = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m4 18 5-5 4 4 3-3 4 4" />
  </svg>
);

export const IconList = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="4" cy="6" r="1" />
    <circle cx="4" cy="12" r="1" />
    <circle cx="4" cy="18" r="1" />
  </svg>
);

export const IconCheck = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M5 12.5 9.5 17 19 7" />
  </svg>
);

export const IconCalendar = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v3M16 3v3" />
  </svg>
);

export const IconPrinter = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M7 3h10v4H7zM6 9h12a2 2 0 0 1 2 2v5h-3v4H7v-4H4v-5a2 2 0 0 1 2-2z" />
    <path d="M9 14h6v5H9z" />
  </svg>
);
