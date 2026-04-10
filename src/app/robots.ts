import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aigenda.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/sign-in",
          "/sign-up",
          "/sso-callback",
          "/dashboard",
          "/today",
          "/schedule",
          "/setup",
          "/account",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
