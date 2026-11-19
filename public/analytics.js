// Site analytics (PostHog). Loaded on every page with:
//   <script src="/analytics.js" defer></script>
//
// The project token is found in PostHog under Project settings. It is public
// by design, so it is safe to commit. If it is empty, nothing loads.
// Every page, including the law-firm pages, uses the same capture: autocapture,
// session replay with inputs masked, and the funnel events below.
//
// Do not add a public/404.html. Cloudflare Pages serves the home page for
// unknown top-level paths and leaves the path in the address bar; that is what
// makes personal outreach links like /KyleA work without per-person redirects.
// Law-firm outreach uses /law-firms/:code via functions/_middleware.js.

(function () {
  const PROJECT_TOKEN = "phc_qoV2gvEbFK8KiyuVPGoTeVd8xdpTfbj8hqH92e9cKnmW";
  const API_HOST = "https://us.i.posthog.com"; // EU projects: https://eu.i.posthog.com
  const LIVE_HOSTS = ["deltav.info", "www.deltav.info"];
  const PATH_CODE = /^\/([A-Za-z0-9]{2,40})\/?$/;
  const LAW_PATH_CODE = /^\/law-firms\/([A-Za-z0-9]{2,40})\/?$/;
  const LAW_RESERVED = { talk: 1, insights: 1, intake: 1, notes: 1 };

  const queue = [];
  let ready = false;

  function run(call) {
    if (ready) call(window.posthog);
    else queue.push(call);
  }

  // Public API for page scripts. Safe to call whether or not PostHog loaded.
  window.deltavAnalytics = {
    track(name, properties) {
      run((posthog) => posthog.capture(name, properties || {}));
    },
    identify(id, properties) {
      run((posthog) => posthog.identify(id, properties || {}));
    },
  };

  function readStoredOutreach() {
    try {
      return sessionStorage.getItem("outreach_code") || "";
    } catch {
      return "";
    }
  }

  function saveOutreach(code) {
    try {
      sessionStorage.setItem("outreach_code", code);
    } catch {
      /* sessionStorage may be blocked */
    }
  }

  function pathOutreachCode(pathname, page) {
    if (page === "home") {
      const match = pathname.match(PATH_CODE);
      return match ? match[1] : "";
    }
    if (page === "law-firms") {
      const match = pathname.match(LAW_PATH_CODE);
      if (!match) return "";
      const code = match[1];
      return LAW_RESERVED[code.toLowerCase()] ? "" : code;
    }
    return "";
  }

  // Personal outreach: /KyleA → home, /law-firms/KyleA → law firms.
  // Prefer ?utm_content= when present; otherwise take the path segment as typed.
  const path = window.location.pathname;
  const utmContent = new URLSearchParams(window.location.search).get("utm_content");
  const page = document.body && document.body.getAttribute("data-page");
  const pathCode = pathOutreachCode(path, page);
  const outreachCode = utmContent || pathCode || "";

  if (outreachCode) saveOutreach(outreachCode);

  if (pathCode) {
    window.deltavAnalytics.track("outreach_link_opened", {
      outreach_code: outreachCode,
      page: page || "",
    });
  }

  const registerCode = outreachCode || readStoredOutreach();

  const live = LIVE_HOSTS.includes(window.location.hostname);
  if (!PROJECT_TOKEN || !live) return;

  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = API_HOST.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js";
  script.onload = function () {
    if (!window.posthog || !window.posthog.init) return;

    function markReady() {
      ready = true;
      queue.splice(0).forEach((call) => call(window.posthog));
    }

    const options = {
      api_host: API_HOST,
      defaults: "2026-08-30",
      person_profiles: "identified_only",
      autocapture: true,
      session_recording: { maskAllInputs: true },
    };

    // Register before the first pageview so outreach_code is on that event too.
    if (registerCode) {
      options.capture_pageview = false;
      options.loaded = function (posthog) {
        posthog.register({ outreach_code: registerCode });
        posthog.capture("$pageview");
        markReady();
      };
      window.posthog.init(PROJECT_TOKEN, options);
      return;
    }

    window.posthog.init(PROJECT_TOKEN, options);
    markReady();
  };
  document.head.appendChild(script);

  // Funnel clicks. One listener for the whole page.
  document.addEventListener("click", function (event) {
    const link = event.target.closest && event.target.closest("a[href]");
    if (!link) return;

    let url;
    try {
      url = new URL(link.getAttribute("href"), window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;

    const here = path.replace(/\/+$/, "");
    const target = url.pathname.replace(/\/+$/, "");
    if (target === here) return;

    if (target === "/talk" || target === "/law-firms/talk") {
      const from = url.searchParams.get("from");
      const known = from === "talk-to-us" || from === "book-20-minutes" || from === "free-audit";
      window.deltavAnalytics.track("cta_clicked", {
        label: known ? from : "other",
        page: path,
      });
    } else if (target.startsWith("/guides/")) {
      window.deltavAnalytics.track("guide_card_clicked", { guide: target.split("/")[2], page: path });
    } else if (target === "/white-paper") {
      window.deltavAnalytics.track("white_paper_clicked", { paper: "software-companies", page: path });
    } else if (target === "/law-firms/insights") {
      window.deltavAnalytics.track("insights_clicked", { page: path });
    } else if (target.startsWith("/law-firms/notes/")) {
      window.deltavAnalytics.track("note_clicked", { note: target.split("/").pop(), page: path });
    }
  });
})();
