# Delta-V website

Marketing page for Delta-V: one static landing page for law firms. It is plain HTML and CSS, with no framework and no build step, and it is hosted on GitHub Pages.

```
public/                     everything that gets published
  index.html                the landing page
  styles.css                all styles; brand colours are CSS variables at the top
  favicon.svg
  fonts/                    Inter Tight (latin subset, self-hosted) + its OFL licence
  img/seats.svg             the 180-seat grid in step 1
scripts/dev.mjs             local preview server (no dependencies)
.github/workflows/pages.yml deploys public/ to GitHub Pages on every push to main
```

## Run it locally

You need [Node.js](https://nodejs.org) 18 or later. Nothing to install beyond that.

```bash
git clone https://github.com/<owner>/deltav-web.git
cd deltav-web
npm run dev
```

Then open http://localhost:8080. Edit files in `public/` and refresh the browser to see changes.

No Node? Any static file server works, for example `python3 -m http.server 8080 --directory public`.

## Hosting on GitHub Pages

One-time setup, after the repo is on GitHub:

1. In the repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main`, or re-run the workflow under the **Actions** tab.

The site goes live at `https://<owner>.github.io/deltav-web/`. Every later push to `main` redeploys it in about a minute.

GitHub Pages is free for public repositories. A private repo needs a paid GitHub plan for Pages.

### Using your own domain (e.g. deltav.info)

In **Settings → Pages → Custom domain**, enter the domain and follow GitHub's DNS instructions, then tick **Enforce HTTPS**. All links in the site are relative, so it works at either address.

## Adding an email sign-up form

GitHub Pages only serves files, so it can't receive form submissions itself. For now the "Get my free audit" button opens an email to partners@deltav.info, as in the design.

To collect emails on the page:

1. Create a free form on [Formspree](https://formspree.io) and copy its endpoint, e.g. `https://formspree.io/f/abcd1234`.
2. The repo's first commit has a styled sign-up form and its script (`public/main.js`). Bring those back, set the form's `action` to the Formspree endpoint, and remove `data-netlify` and the `/thanks/` page reference.

## Editing

- **Copy:** all text lives in `public/index.html`.
- **Colours:** `--accent` (blue) and `--statement` (pink) at the top of `styles.css`. The design also tried these accent options: `#8FB0FF`, `#1C2F6B`, `#1F5C45`.
- **Sample numbers:** the product preview and steps use illustrative data, labelled "Sample data" on the page. If you change the seat counts, regenerate `img/seats.svg` to match.

## Source design

Built from the "ROIAI for Law Firms" design export, with the product renamed to Delta-V. Layout, type scale, colours and copy follow the design at 1280px. Spacing is reduced on phones, and the design tool's fixed canvas heights were dropped so the page reflows on small screens.
