# Delta-V website

Marketing page for Delta-V: one static landing page for law firms, with an optional email sign-up for the free two-week audit.

It is plain HTML, CSS and a little JavaScript, with no framework and no build step. It runs on any static host.

```
public/
  index.html          the landing page
  styles.css          all styles; brand colours are CSS variables at the top
  main.js             sign-up form submission (progressive enhancement)
  thanks/index.html   confirmation page for submissions made without JavaScript
  favicon.svg
  fonts/              Inter Tight (latin subset, self-hosted) + its OFL licence
  img/seats.svg       the 180-seat grid in step 1
scripts/dev.mjs       local preview server (no dependencies)
netlify.toml          Netlify config: publish public/, security headers
```

## Run it locally

Requires Node 18 or later.

```bash
npm run dev
```

Open http://localhost:8080. The dev server serves `public/`. Form submissions are printed to the terminal instead of being stored, so you can test the sign-up end to end.

## Deploy

### Netlify (recommended: email capture with no backend)

1. Push this repo to GitHub and import it in Netlify (**Add new site → Import an existing project**). `netlify.toml` already sets the publish directory, and there is no build command.
2. In the site's **Forms** tab, click **Enable form detection**, then redeploy. Netlify finds the `audit` form in `index.html`.
3. Sign-ups appear under **Forms → audit**. Turn on email notifications there if you want each one in your inbox.

Spam protection comes from a honeypot field (`company`). For a second layer, turn on Netlify's built-in spam filtering.

### Any other static host (Vercel, Cloudflare Pages, GitHub Pages, S3)

Deploy the `public/` folder as-is. Netlify Forms won't exist there, so either:

- **Keep collecting emails:** create a form on [Formspree](https://formspree.io) (or Basin, Getform, etc.) and set the form's `action` in `public/index.html` to its endpoint URL, for example `action="https://formspree.io/f/abcd1234"`. `main.js` posts to whatever `action` says.
- **Or skip email capture for now:** see below.

If the form can't reach its backend, visitors see an error that points them to partners@deltav.info.

## Turning email capture off

The design itself used a "Get my free audit" button that opens an email to partners@deltav.info. To go back to that, replace the `<form …>` block and the `signup-status` line in `public/index.html` with:

```html
<a class="btn btn--lg" href="mailto:partners@deltav.info?subject=Delta-V%20free%20audit">Get my free audit</a>
```

## Editing

- **Copy:** all text lives in `public/index.html`.
- **Colours:** `--accent` (blue) and `--statement` (pink) at the top of `styles.css`. The design also tried these accent options: `#8FB0FF`, `#1C2F6B`, `#1F5C45`.
- **Sample numbers:** the product preview and steps use illustrative data, labelled "Sample data" on the page. If you change the seat counts, regenerate `img/seats.svg` to match.

## Source design

Built from the "ROIAI for Law Firms" design export, with the product renamed to Delta-V. Layout, type scale, colours and copy follow the design at 1280px. Mobile spacing is reduced, and the email field is new. The fixed canvas heights from the design tool were dropped so the page reflows on small screens.
