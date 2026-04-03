import type { MetadataRoute } from "next"

const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:2001"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: "/api/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
