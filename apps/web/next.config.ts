import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
  async redirects() {
    return [
      // The Markdown resume draft page was retired by US-059 (decision 0019);
      // old bookmarks land on the Tailored CV instead of a 404.
      {
        source: "/matches/:matchId/resume-draft",
        destination: "/matches/:matchId/draft-cv",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
