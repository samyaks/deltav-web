# Delta-V website

Marketing site for Delta-V: a home page for software and AI companies, plus the law-firms page. It is plain HTML and CSS, with no framework and no build step, and it deploys to Cloudflare Pages.

```
public/                 everything that gets published
  index.html            home page (software and AI companies)
  home.css              home page styles; accent and statement colours are CSS variables
  white-paper/          white paper: the AI question software companies can't answer yet
  guides/               the two guides linked from the home page
  article.css           shared styles for the white paper and the guides
  talk/index.html       design partner intake form; every call to action links here
  talk.css, talk.js     styles and client logic for that form
  law-firms/index.html  law firms page
  law-firms/insights/   sample month dashboard (static)
  law-firms/intake/     CSV intake UI → org / user / matter rollups
  styles.css            law firms page styles; brand colours are CSS variables at the top
  integrations/         browser copy of the CSV mappers (synced from integrations/)
  _headers              response headers Cloudflare Pages applies
  favicon.svg
  fonts/                Inter Tight and IBM Plex Mono (latin subsets, self-hosted) + OFL licences
  img/seats.svg         the 180-seat grid on the law firms page
integrations/           Node CSV parsers, ingest rollups, and tests (not the marketing site)
functions/api/leads.js  POST /api/leads: validates an intake and writes it to D1
migrations/             D1 schema for the leads table
scripts/dev.mjs         local preview server
scripts/ingest.mjs      CLI: CSV paths → org / user / matter JSON
scripts/sync-integrations.mjs
                        copies integrations/*.mjs + examples into public/integrations/
scripts/leads-csv.mjs   exports the leads table to leads.csv
wrangler.toml           Pages project name, output directory, and D1 configuration
.github/workflows/deploy.yml
                        deploys public/ to Cloudflare Pages on every push to main
```

## Run it locally

From this folder:

```bash
python3 -m http.server 8080 --directory public
```

Or, with Node 18 or later, `npm run dev`. Then open http://localhost:8080. Edit files in `public/` and refresh the browser to see changes.

## CSV intake (Harvey, Legora, Everlaw, Clio)

The `integrations/` library maps privacy-safe CSV uploads into usage rows, then `ingestFeeds` rolls them up to the firm, each person, and each matter number. Clio time is hours and billed value; it stays separate from AI spend.

```bash
npm test
npm run ingest -- --demo
npm run ingest -- path/to/harvey-usage.csv path/to/clio-time.csv
```

In the browser, open `/law-firms/intake/`, load the sample month, or drop CSVs. Files stay in the browser. Known feeds:

| Feed | Headers |
|------|---------|
| Harvey usage | `user,at,matter_number,product,action,id` |
| Harvey matters | `matter_number,users,queries,id` |
| Legora credits | `member,feature,project,credits,at` |
| Legora audit | `member,action,at` |
| Everlaw usage | `user,at,matter_number,action,docs,id` |
| Everlaw projects | `matter_number,users,docs,id` |
| Clio time | `user,at,matter_number,hours,rate,id` |
| Clio matters | `matter_number,status,id` |

Prompts, answers, documents, notes, descriptions, and client names are refused.

## Running the design partner form locally

That server only serves static files. To run `/talk` and its endpoint, use Wrangler instead:

```bash
npm install
npx wrangler d1 migrations apply deltav_leads --local
echo 'TURNSTILE_SECRET="1x0000000000000000000000000000000AA"' > .dev.vars
npx wrangler pages dev public --port 8788
```

Then open http://127.0.0.1:8788/talk. That secret and the `data-sitekey` in `public/talk/index.html` are Cloudflare's Turnstile test keys, which always pass and show a "for testing only" notice on the widget. Read what the local form stored with `npx wrangler d1 execute deltav_leads --local --command "SELECT * FROM leads"`.

## The design partner form

`/talk` is the only place the site collects an email. Every "Talk to us" and "Book 20 minutes" button links to it with `?from=talk-to-us` or `?from=book-20-minutes`, which is stored as the lead's source along with the referring path and any `utm_source`, `utm_medium` and `utm_campaign`.

`functions/api/leads.js` validates every field again on the server, verifies the Turnstile token, and inserts with prepared statements. It never logs personal data. The D1 database is `deltav_leads`, bound as `DB` in `wrangler.toml`.

Read the leads with `npm run leads`, or `npm run leads:csv` to write `leads.csv` (gitignored).

### One-time setup

The database already exists. Create the table in the D1 console from `migrations/0001_create_leads.sql`. Then set the Turnstile secret:

```bash
npx wrangler pages secret put TURNSTILE_SECRET --project-name deltav-web
```

Create the Turnstile widget for `deltav.info` at https://dash.cloudflare.com/?to=/:account/turnstile, then put its site key in the `data-sitekey` attribute in `public/talk/index.html` and its secret key into the command above. D1 and Turnstile both stay within Cloudflare's free plan.

## Hosting on Cloudflare Pages

Pushes to `main` upload `public/` as-is to the Pages project `deltav-web`. Production is [deltav.info](https://deltav.info). [deltav-web.pages.dev](https://deltav-web.pages.dev) stays as the Pages hostname.

Deploys go out through GitHub Actions (direct upload). Keep using this workflow for the project. A direct-upload Pages project stays on direct upload, so Cloudflare's **Connect to Git** flow is a different project, not a later switch.

### One-time setup

1. In the Cloudflare dashboard, create an API token with the **Cloudflare Pages — Edit** permission. Copy the account ID from the Workers & Pages overview.
2. In the GitHub repo, go to **Settings → Secrets and variables → Actions** and add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. Push to `main`, or run **Deploy to Cloudflare Pages** from the Actions tab.

The first run creates the project with `main` as the production branch, then uploads the site. Later pushes to `main` only upload.

### Custom domain

Each deploy attaches `deltav.info` to the `deltav-web` Pages project if it is not already attached. The zone is on Cloudflare, so Pages creates the DNS record. That hostname is the main page for this site.

## Adding an email sign-up form

For now the "Get my free audit" button opens an email to partners@deltav.info, as in the design. To collect emails on the page instead, there are two options:

- **Hosted form service:** create a free form on [Formspree](https://formspree.io) and point a form's `action` at its endpoint. The repo's first commit has a styled sign-up form and its script (`public/main.js`) you can bring back.
- **On Cloudflare itself:** a small Pages Function can receive the form and store sign-ups in Cloudflare D1 or KV, with no third-party service.

## Editing

- **Home copy:** `public/index.html`. **Home colours:** `--accent` (`#8CC3F2`) and `--statement` (`#F2968C`) at the top of `home.css`.
- **Law firms copy:** `public/law-firms/index.html`. **Law firms colours:** `--accent` (blue) and `--statement` (pink) at the top of `styles.css`. That design also tried these accent options: `#8FB0FF`, `#1C2F6B`, `#1F5C45`.
- **Industry links:** the footer of each page links to the other. Home is `/`. Law firms is `/law-firms/`.
- **Sample numbers:** both pages use illustrative data, labelled "Sample data". If you change the seat counts on the law firms page, regenerate `img/seats.svg` to match.
- **Guides and white paper:** the home page cards link to `/guides/return-on-ai-coding-tools/`, `/guides/track-ai-spend/` and `/white-paper/`. Those pages share `article.css`.
- **Wording on the software side:** the product is DeltaV, and copy says "return", not "ROI". Source titles that contain "ROI" stay as published. No em dashes.

## Source design

The home page follows the "DeltaV home, software and AI companies" design export. The law firms page follows the "ROIAI for Law Firms" export, with the product renamed to Delta-V. Layout, type scale, colours and copy follow each design at 1280px. Spacing is reduced on phones, and the design tool's fixed canvas heights were dropped so the pages reflow on small screens.
