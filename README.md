# Delta-V website

Marketing site for Delta-V: a home page for software and AI companies, plus the law-firms page. It is plain HTML and CSS, with no framework and no build step, and it deploys to Cloudflare Pages.

```
public/                 everything that gets published
  index.html            home page (software and AI companies)
  home.css              home page styles; accent and statement colours are CSS variables
  law-firms/index.html  law firms page
  styles.css            law firms page styles; brand colours are CSS variables at the top
  _headers              response headers Cloudflare Pages applies
  favicon.svg
  fonts/                Inter Tight and IBM Plex Mono (latin subsets, self-hosted) + OFL licences
  img/seats.svg         the 180-seat grid on the law firms page
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

## Interest form

Both landing pages ask for a name, email, and business name. The form posts to `/api/interest`, a Pages Function in `functions/api/interest.js`. Each submission is a row in the D1 database `deltav-leads`: name, email, business, which page (`software` or `law-firms`), and the time. Prompt text and anything else is not accepted.

`npm run dev` writes those rows to `data/leads.jsonl` on this machine. That file is not committed. Production uses D1. The deploy workflow creates the database, applies `schema/leads.sql`, and binds it to the Pages project as `DB`. The API token needs **D1 Edit** in addition to Pages Edit. Until that permission is on the token, the site still publishes and the form tells the visitor to email partners@deltav.info.

To read what was saved:

```bash
npx wrangler d1 execute deltav-leads --remote --command "SELECT created_at, source, name, email, business FROM leads ORDER BY id DESC"
```

## Editing

- **Home copy:** `public/index.html`. **Home colours:** `--accent` (`#8CC3F2`) and `--statement` (`#F2968C`) at the top of `home.css`.
- **Law firms copy:** `public/law-firms/index.html`. **Law firms colours:** `--accent` (blue) and `--statement` (pink) at the top of `styles.css`. That design also tried these accent options: `#8FB0FF`, `#1C2F6B`, `#1F5C45`.
- **Industry links:** the footer of each page links to the other. Home is `/`. Law firms is `/law-firms/`.
- **Sample numbers:** both pages use illustrative data, labelled "Sample data". If you change the seat counts on the law firms page, regenerate `img/seats.svg` to match.
- **Guides:** the home page includes the two guide cards from the design. The guide articles were not in that export, so those cards and the matching footer links stay on the guides section.

## Source design

The home page follows the "DeltaV home, software and AI companies" design export. The law firms page follows the "ROIAI for Law Firms" export, with the product renamed to Delta-V. Layout, type scale, colours and copy follow each design at 1280px. Spacing is reduced on phones, and the design tool's fixed canvas heights were dropped so the pages reflow on small screens.
