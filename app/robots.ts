import type { MetadataRoute } from "next";

/**
 * Only the app host serves this — a paste origin 404s everything but `/`, so a
 * published page is crawled on its own terms and cannot be told otherwise here.
 *
 * ponytail: no `sitemap.ts`. The app has exactly one public page a crawler
 * could not already reach from the home page; `/p/[token]` pages are unlisted
 * by design, and enumerating them would be publishing the index that the random
 * token exists to avoid. Add one when there are real public pages to list.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in surfaces and machine endpoints. None of them is reachable
      // without a credential; keeping them out of the index keeps a crawler
      // from spending its budget collecting redirects and 401s.
      disallow: ["/dashboard/", "/api/", "/mcp", "/sign-in", "/sign-up"],
    },
  };
}
