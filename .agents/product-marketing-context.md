## Site context

### What type of site? (SaaS, e-commerce, blog, etc.)

**Productivity SaaS (web application).** AiGenda is an authenticated app: users sign in with Clerk, data lives in Convex, and the product covers task/availability setup, a recovery-style dashboard, AI-assisted plan generation (Agent API), today/checklist, optional Canvas ICS sync, and daily summaries via cron. It is **not** a content or e-commerce site in its current shape.

### What’s the primary business goal for SEO?

**Not explicitly defined in the codebase.** Given the current implementation, the **primary growth lever is likely in-product** (retention, referrals) rather than organic landing pages: the root route **`/` redirects unauthenticated visitors to `/sign-in`**, so there is **no public marketing homepage** to rank today.

If SEO becomes a goal, a plausible primary objective would be: **capture non-branded and branded search for intelligent planning / calendar / student workload tools** and **drive sign-ups**—but that would require **public marketing URLs** (landing pages, docs, blog) that do not exist yet in this repo snapshot.

### What keywords/topics are priorities?

**No keyword list is checked into the project.** Inferred topic areas that match the product (for future SEO work, not current targeting):

| Theme | Example intent (illustrative) |
|--------|-------------------------------|
| Product / brand | “AiGenda”, “Aigenda” (note naming consistency in UI vs metadata) |
| Productivity & planning | AI study plan, weekly availability, task overload |
| Integrations | Canvas calendar ICS, Google Calendar (if exposed in copy) |
| Audience | Students, knowledge workers juggling deadlines (only if positioning says so) |

**Action:** Decide positioning and run keyword research outside the repo; align `metadata` titles/descriptions and any future landing copy with that list.

---

## Current state

### Any known issues or concerns?

From **implementation** (not Search Console):

1. **SEO surface area is minimal** — Root `page.tsx` redirects anonymous users to **`/sign-in`**; there is no indexable marketing home.
2. **Global `metadata`** in `src/app/layout.tsx` is a single **title + description**; no `openGraph`, `twitter`, `robots`, or `canonical` tuned per route.
3. **`dynamic = "force-dynamic"`** on the root layout — appropriate for auth-heavy apps but worth reviewing for any route that could be static/marketing later.
4. **Authenticated app routes** (dashboard, today, setup, etc.) are typically poor SEO targets unless intentionally public; consider `noindex` for private areas if they ever leak to crawlers without auth.
5. **Naming consistency** — Product is referred to as AiGenda / Aigenda in different places; pick one spelling for brand + SEO.

### Current organic traffic level?

Have not deployed

### Recent changes or migrations?

**Per project docs:** the app is described as an integrated **Convex + Clerk** stack with an **Agent API** for planning features; specs are referenced under `frontend_mvp/docs/`. **No traffic or SEO migration history** is recorded here—fill in from your team (e.g. domain change, rebranding to AiGenda).

---

## Scope

### Full site audit or specific pages?

**Recommend starting narrow**, given the product is mostly behind login:

- **Phase 1:** Decide what should be **public and indexable** (e.g. future marketing site, pricing, legal). Audit those plus global metadata, `robots.txt`, and sitemap once public pages exist.
- **Phase 2:** **Technical** crawl (Core Web Vitals, redirects, canonicals, structured data) on the deployed domain.
- **Phase 3:** **On-page** only for URLs that should rank.

If the question is “audit everything in the repo today,” the meaningful scope is **small** unless you add marketing routes.

### Technical + on-page, or one focus area?

**Suggested order:**

1. **Product / IA** — What should be public vs `noindex`?
2. **Technical** — Metadata, sitemap/robots, canonical, OG tags for any public pages, performance.
3. **On-page** — Titles, descriptions, H1, internal links on public pages only.

### Access to Search Console / analytics?

**Not indicated in the repo.** You will need:

- **Google Search Console** (or Bing Webmaster) for the production domain  
- **Analytics** (e.g. GA4, Plausible, Vercel Analytics) for traffic and conversions  

Without these, “current state” for organic traffic and queries cannot be answered from code alone.

Last but not the least NEVER MAKE CHANGES thats destructive to layout of the site
