// Demo access gate on the home page and /demo-access/.
// Posts to the same /api/leads handler as /talk. No second table.
// /demo/ does not collect an email. It only checks dv_demo_access.
//
// The access email is not sent yet. There is no mail provider in this repo.
// The "we'll email you a link" line stays out until that is chosen.

(function () {
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const ACCESS = "dv_demo_access";
  // Same Turnstile widget as /talk ("deltav-talk", hostname deltav.info).
  // interaction-only keeps the form to one field unless a challenge is required.
  // For local testing use Cloudflare's invisible test key, 1x00000000000000000000BB.
  const SITEKEY = "0x4AAAAAAGF6D1ikfjk7EimB";
  const CONTACT = "partners@deltav.info";
  const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  const analytics = () => window.deltavAnalytics || { track() {}, identify() {} };

  function hasAccess() {
    try {
      return localStorage.getItem(ACCESS) === "1";
    } catch {
      return false;
    }
  }

  function grant() {
    try {
      localStorage.setItem(ACCESS, "1");
    } catch {
      /* private mode */
    }
  }

  // Same lookup as /talk, which reads the code analytics.js stored for /<Code>.
  function outreachCode() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("outreach_code") || params.get("utm_content") || "";
    if (fromUrl) return fromUrl;
    try {
      return sessionStorage.getItem("outreach_code") || "";
    } catch {
      return "";
    }
  }

  function campaign() {
    const params = new URLSearchParams(window.location.search);
    let stored = {};
    try {
      stored = JSON.parse(sessionStorage.getItem("dv_utm") || "{}") || {};
    } catch {
      stored = {};
    }
    const out = {};
    UTM_KEYS.forEach((key) => {
      out[key] = params.get(key) || stored[key] || "";
    });
    return out;
  }

  const widgets = new WeakMap();
  const slots = new WeakMap();

  function settle(el, ok, value) {
    const slot = slots.get(el);
    if (!slot || slot.done) return;
    slot.done = true;
    slots.delete(el);
    window.clearTimeout(slot.timer);
    if (ok) slot.resolve(value);
    else slot.reject(value);
  }

  function ensureWidget(el) {
    const existing = widgets.get(el);
    if (existing != null) return existing;
    const id = window.turnstile.render(el, {
      sitekey: SITEKEY,
      theme: "dark",
      appearance: "interaction-only",
      execution: "execute",
      callback(token) {
        settle(el, true, token);
      },
      "error-callback"() {
        settle(el, false, new Error("turnstile"));
      },
      "timeout-callback"() {
        settle(el, false, new Error("turnstile"));
      },
    });
    widgets.set(el, id);
    return id;
  }

  function requestToken(el) {
    if (!el) return Promise.reject(new Error("turnstile"));
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const slot = { resolve, reject, done: false, timer: 0 };
      slot.timer = window.setTimeout(() => settle(el, false, new Error("timeout")), 60000);
      slots.set(el, slot);

      const boot = () => {
        if (!window.turnstile) {
          if (Date.now() - started > 8000) settle(el, false, new Error("turnstile"));
          else window.setTimeout(boot, 40);
          return;
        }
        const fresh = !widgets.has(el);
        const id = ensureWidget(el);
        if (!fresh) window.turnstile.reset(id);
        try {
          const pending = window.turnstile.execute(id);
          if (pending && typeof pending.then === "function") {
            pending.then((token) => settle(el, true, token)).catch(() => settle(el, false, new Error("turnstile")));
          }
        } catch (err) {
          settle(el, false, err);
        }
      };

      boot();
    });
  }

  function saveError(source, reason) {
    analytics().track("demo_gate_error", { source, reason });
  }

  async function submit(options) {
    const email = (options.email || "").trim();
    const source = options.source === "demo_ad" ? "demo_ad" : "demo";
    const website = options.website || "";
    const tags = campaign();
    analytics().track("demo_gate_submit", { source });

    let turnstileToken = "";
    try {
      turnstileToken = await requestToken(options.turnstile);
    } catch {
      saveError(source, "turnstile");
      return { ok: false, reason: "turnstile" };
    }

    const body = {
      email,
      source,
      goal: "demo_access",
      team_size: "unknown",
      outreach_code: outreachCode(),
      referrer_path: window.location.pathname,
      website,
      turnstileToken,
      utm_source: tags.utm_source,
      utm_medium: tags.utm_medium,
      utm_campaign: tags.utm_campaign,
      utm_content: tags.utm_content,
      utm_term: tags.utm_term,
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data && data.ok) {
        if (!website) {
          analytics().identify(email.toLowerCase(), {
            source,
            outreach_code: body.outreach_code,
          });
          analytics().track("demo_gate_success", { source });
        }
        grant();
        return { ok: true };
      }
      const reason = data && data.errors && data.errors.email ? "invalid_email" : "save";
      saveError(source, reason);
      return { ok: false, reason };
    } catch {
      saveError(source, "save");
      return { ok: false, reason: "save" };
    }
  }

  function fillError(node) {
    node.replaceChildren();
    node.append("That didn't go through. Try again, or email ");
    const link = document.createElement("a");
    link.href = "mailto:" + CONTACT;
    link.textContent = CONTACT;
    node.append(link, ".");
  }

  function initForm(form) {
    const source = form.getAttribute("data-demo-source") === "demo_ad" ? "demo_ad" : "demo";
    const section = form.closest(".demo-gate") || form.parentElement;
    const email = form.querySelector('input[type="email"]');
    const error = form.querySelector('[role="alert"]');
    const button = form.querySelector('button[type="submit"]');
    const ok = section.querySelector("[data-demo-success]");
    const back = section.querySelector("[data-demo-returning]");
    const turnstile = form.querySelector("[data-turnstile]");
    const website = form.querySelector('input[name="website"]');
    const open = hasAccess();

    if (open) {
      form.hidden = true;
      if (back) back.hidden = false;
    }
    analytics().track("demo_gate_view", { source, state: open ? "returning" : "form" });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const value = email.value.trim();
      if (value.length > 254 || !EMAIL.test(value)) {
        error.textContent = "Enter a valid work email.";
        email.classList.add("bad");
        email.setAttribute("aria-invalid", "true");
        button.disabled = false;
        button.textContent = "Open the demo";
        email.focus();
        saveError(source, "invalid_email");
        return;
      }

      error.textContent = "";
      email.classList.remove("bad");
      email.removeAttribute("aria-invalid");
      button.disabled = true;
      button.textContent = "Opening…";

      const result = await submit({
        email: value,
        source,
        website: website ? website.value : "",
        turnstile,
      });

      if (result.ok) {
        form.hidden = true;
        if (back) back.hidden = true;
        if (ok) ok.hidden = false;
        window.setTimeout(() => {
          window.location.href = "/demo/" + window.location.search;
        }, 1000);
        return;
      }

      button.disabled = false;
      if (result.reason === "invalid_email") {
        error.textContent = "Enter a valid work email.";
        email.classList.add("bad");
        email.setAttribute("aria-invalid", "true");
        button.textContent = "Open the demo";
        email.focus();
        return;
      }
      fillError(error);
      button.textContent = "Try again";
      button.focus();
    });
  }

  document.querySelectorAll("[data-demo-gate]").forEach(initForm);

  const open = hasAccess();
  document.querySelectorAll("[data-demo-cta]").forEach((link) => {
    if (open) link.href = "/demo/" + window.location.search;
    link.addEventListener("click", () => {
      analytics().track("demo_cta_click", {
        position: link.getAttribute("data-demo-cta") || "",
      });
    });
  });

  window.deltavDemoLead = {
    hasAccess,
    grant,
    submit,
    contact: CONTACT,
    track(name, properties) {
      analytics().track(name, properties);
    },
  };
})();
