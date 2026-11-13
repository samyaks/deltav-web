# Delta-V website

Marketing page for Delta-V at [deltav.info](https://deltav.info): one static landing page for law firms. It is plain HTML and CSS, with no framework and no build step, hosted on Cloudflare Pages.

```
public/                 everything that gets published
  index.html            the landing page
  styles.css            all styles; brand colours are CSS variables at the top
  favicon.svg
  fonts/                Inter Tight (latin subset, self-hosted) + its OFL licence
  img/seats.svg         the 180-seat grid in step 1
scripts/dev.mjs         local preview server (no dependencies)
```

## Run it locally

From this folder:

```bash
python3 -m http.server 8080 --directory public
```

Or, with Node 18 or later, `npm run dev`. Then open http://localhost:8080. Edit files in `public/` and refresh the browser to see changes.

## Hosting on Cloudflare Pages

One-time setup:

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and pick `samyaks/deltav-web`.
2. Build settings:
   - **Framework preset:** None
   - **Build command:** leave empty (if the form insists on one, use `exit 0`)
   - **Build output directory:** `public`
3. Save and deploy. The site appears at `deltav-web.pages.dev`.
4. In the project, open **Custom domains → Set up a custom domain** and add `deltav.info`, plus `www.deltav.info` if you want it. If deltav.info's DNS is on Cloudflare, the records are created for you.

After that, every push to `main` redeploys the site, and pushes to other branches get their own preview URLs.

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
