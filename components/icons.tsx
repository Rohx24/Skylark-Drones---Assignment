// Small inline cartographic/aerial icons. Stroke-based, 1.6 weight, currentColor.
import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const AskIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h10M4 18h7" />
    <circle cx="18" cy="16" r="3" />
    <path d="M20.5 18.5 22 20" />
  </svg>
);

export const ReasonIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 19 9 8l4 6 3-4 4 9" />
    <circle cx="4" cy="19" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="9" cy="8" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="13" cy="14" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="16" cy="10" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const DataIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 20V10M9 20V4M14 20v-7M19 20V8" />
  </svg>
);

export const WaypointIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3 20 21 12 17 4 21 12 3Z" />
  </svg>
);

export const DroneIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="2.2" />
    <path d="M12 9.8V6M12 14.2V18M9.8 12H6M14.2 12H18" />
    <circle cx="5" cy="5" r="2" />
    <circle cx="19" cy="5" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
  </svg>
);

export const CopyIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="9" y="9" width="11" height="11" rx="1.5" />
    <path d="M5 15V5a1 1 0 0 1 1-1h9" />
  </svg>
);

export const SendIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 12.5 10 17l9-10" />
  </svg>
);

export const LayersIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="M3 13l9 5 9-5M3 16.5l9 5 9-5" />
  </svg>
);

export const SignalIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 18a10 10 0 0 1 14 0" />
    <path d="M8 15a6 6 0 0 1 8 0" />
    <circle cx="12" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const HelpIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.3 9.2a2.7 2.7 0 1 1 3.8 2.5c-1 .45-1.6 1.1-1.6 2.3" />
    <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);
