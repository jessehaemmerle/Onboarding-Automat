import { useEffect } from "react";

// Official production domain — used for canonical URLs and absolute OG links.
export const SITE_URL = "https://welkora.net";

/**
 * Lightweight SEO helper (no extra dependency).
 * Sets <title>, meta tags, canonical link and injects JSON-LD structured data.
 * Tags are upserted on mount and JSON-LD is cleaned up on unmount so each
 * route controls its own structured data.
 */
export default function Seo({
  title,
  description,
  path = "/",
  image = `${SITE_URL}/og-image.png`,
  keywords,
  jsonLd,
}) {
  useEffect(() => {
    const canonical = `${SITE_URL}${path}`;

    if (title) document.title = title;

    const upsertMeta = (selector, attr, key, content) => {
      if (!content) return;
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta('meta[name="keywords"]', "name", "keywords", keywords);

    // Open Graph
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[property="og:type"]', "property", "og:type", "website");
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonical);
    upsertMeta('meta[property="og:image"]', "property", "og:image", image);
    upsertMeta('meta[property="og:site_name"]', "property", "og:site_name", "Welkora");

    // Twitter
    upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", image);

    // Canonical link
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", canonical);

    // JSON-LD structured data
    const scripts = [];
    if (jsonLd) {
      const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      blocks.forEach((block) => {
        const s = document.createElement("script");
        s.type = "application/ld+json";
        s.setAttribute("data-seo", "true");
        s.text = JSON.stringify(block);
        document.head.appendChild(s);
        scripts.push(s);
      });
    }

    return () => {
      scripts.forEach((s) => s.remove());
    };
  }, [title, description, path, image, keywords, jsonLd]);

  return null;
}
