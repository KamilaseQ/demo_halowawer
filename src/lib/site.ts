/**
 * Public address of the site, for absolute URLs in metadata (og:image,
 * canonical) that link previews (WhatsApp, Messenger, e-mail) fetch.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://halowawer.pl); on
 * Vercel the project's production domain is used when it is not set.
 * Metadata of static pages is resolved at build time: set it before `next build`.
 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL(`http://localhost:${process.env.PORT ?? 3141}`);
}

export const SITE_NAME = "Halo Wawer";
