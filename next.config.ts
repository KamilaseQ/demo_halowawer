import type { NextConfig } from "next";

const IMMUTABLE = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];

const nextConfig: NextConfig = {
  // a second dev server (the 3D explorer) runs with NEXT_DIST_DIR=.next-3d so the two never share a build dir
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 90],
  },
  async headers() {
    // production only: in development a changed file must show up under the same URL
    if (process.env.NODE_ENV !== "production") return [];
    return [
      // film, kreator renders and 3D assets never change under the same name (rename to update)
      { source: "/media/:path*", headers: IMMUTABLE },
      { source: "/kreator/wnetrza/:path*", headers: IMMUTABLE },
      { source: "/explorer/:path*", headers: IMMUTABLE },
    ];
  },
};

export default nextConfig;
