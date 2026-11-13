# Delta-V website

Marketing page for Delta-V: one static landing page for law firms. It is plain HTML and CSS, with no framework and no build step, and it deploys to Cloudflare Pages.

```
public/                 everything that gets published
  index.html            the landing page
  styles.css            all styles; brand colours are CSS variables at the top
  _headers              response headers Cloudflare Pages applies
  favicon.svg
  fonts/                Inter Tight (latin subset, self-hosted) + its OFL licence
  img/seats.svg         the 180-seat grid in step 1
scripts/dev.mjs         local preview server (no dependencies)
wrangler.toml           Pages project name and output directory
.github/workflows/deploy.yml
                        deploys public/ to Cloudflare Pages on every push to main
```

## Run it locally

From this folder:

```bash
python3 -m http.server 8080 --directory public
```

Or, with Node 18 or later, `npm run dev`. Then open http://localhost:8080. Edit files in `public/` and refresh the browser to see changes.

## Hosting on Cloudflare Pages

Pushes to `main` upload `public/` as-is to the Pages project `deltav-web`. The production site is [deltav-web.pages.dev](https://deltav-web.pages.dev).

Deploys go out through GitHub Actions (direct upload). Keep using this workflow for the project. A direct-upload Pages project stays on direct upload, so Cloudflare's **Connect to Git** flow is a different project, not a later switch.

### One-time setup

1. In the Cloudflare dashboard, create an API token with the **Cloudflare Pages — Edit** permission. Copy the account ID from the Workers & Pages overview.
2. In the GitHub repo, go to **Settings → Secrets and variables → Actions** and add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. Push to `main`, or run **Deploy to Cloudflare Pages** from the Actions tab.

The first run creates the project with `main` as the production branch, then uploads the site. Later pushes to `main` only upload.

### Custom domain

`deltav.info` already resolves to Cloudflare and currently serves a different site (the AI spend control plane). Attaching that hostname here replaces what is live there.

When you want this page on that domain, open the `deltav-web` project, go to **Custom domains → Set up a custom domain**, and add `deltav.info` (and `www.deltav.info` if you want it). DNS is already on Cloudflare, so Pages can create the records.

## Adding an email sign-up form

For now the "Get my free audit" button opens an email to partners@deltav.info, as in the design. To collect emails on the page instead, there are two options:

- **Hosted form service:** create a free form on [Formspree](https://formspree.io) and point a form's `action` at its endpoint. The repo's first commit has a styled sign-up form and its script (`public/main.js`) you can bring back.
- **On Cloudflare itself:** a small Pages Function can receive the form and store sign-ups in Cloudflare D1 or KV, with no third-party service.

## Editing

- **Copy:** all text lives in `public/index.html`.
- **Colours:** `--accent` (blue) and `--statement` (pink) at the top of `styles.css`. The design also tried these accent options: `#8FB0FF`, `#1C2F6B`, `#1F5C45`.
- **Sample numbers:** the product preview and steps use illustrative data, labelled "Sample data" on the page. If you change the seat counts, regenerate `img/seats.svg` to match.

## Source design

Built from the "ROIAI for Law Firms" design export, with the product renamed to Delta-V. Layout, type scale, colours and copy follow the design at 1280px. Spacing is reduced on phones, and the design tool's fixed canvas heights were dropped so the page reflows on small screens.
