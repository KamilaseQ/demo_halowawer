import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Diagonal arrow (↗) used on every outbound or forward link. */
export function ArrowIcon(props: IconProps) {
  return (
    <svg
      className="icon-arrow"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3.5 12.5l9-9M5.5 3.5h7v7" />
    </svg>
  );
}

/** Two gables: the Halo Wawer glyph. `door` adds the door stroke of the nav version. */
export function BrandGlyph({ door = false, ...props }: IconProps & { door?: boolean }) {
  return (
    <svg viewBox="0 0 28 27" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M2 26V12.5L9 5l7 7.5V26" />
      <path d="M12 26V12.5L19 5l7 7.5V26" />
      {door && <path d="M9 26v-7h0" />}
    </svg>
  );
}

export function WhatsAppIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91a9.85 9.85 0 0 0-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 5.83 2.42 8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48a.92.92 0 0 0-.66.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.6.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 6.9 6.9l1.3-2 4 1.6V19a1.6 1.6 0 0 1-1.6 1.6A16.6 16.6 0 0 1 3.4 5.6 1.6 1.6 0 0 1 5 4Z" />
    </svg>
  );
}
