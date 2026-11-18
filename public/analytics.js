// Site analytics (PostHog). Loaded on every page with:
//   <script src="/analytics.js" defer></script>
//
// The project token is found in PostHog under Project settings. It is public
// by design, so it is safe to commit. If it is empty, nothing loads.
// Every page, including the law-firm pages, uses the same capture: autocapture,
// session replay with inputs masked, and the funnel events below.

(function () {
  const PROJECT_TOKEN = "phc_qoV2gvEbFK8KiyuVPGoTeVd8xdpTfbj8hqH92e9cKnmW";
  const API_HOST = "https://us.i.posthog.com"; // EU projects: https://eu.i.posthog.com
  const LIVE_HOSTS = ["deltav.info", "www.deltav.info"];

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

  const path = window.location.pathname;
  const live = LIVE_HOSTS.includes(window.location.hostname);
  if (!PROJECT_TOKEN || !live) return;

  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = API_HOST.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js";
  script.onload = function () {
    if (!window.posthog || !window.posthog.init) return;
    window.posthog.init(PROJECT_TOKEN, {
      api_host: API_HOST,
      defaults: "2026-08-30",
      person_profiles: "identified_only",
      autocapture: true,
      session_recording: { maskAllInputs: true },
    });
    ready = true;
    queue.splice(0).forEach((call) => call(window.posthog));
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
