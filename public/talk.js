// The /talk form: validate, post to /api/leads, show the result.

(function () {
  const form = document.getElementById("talk-form");
  if (!form) return;

  const submit = document.getElementById("talk-submit");
  const formError = document.getElementById("form-error");
  const done = document.getElementById("talk-done");
  const intro = document.getElementById("talk-intro");
  const required = ["email", "name", "company", "role"];
  const sources = ["talk-to-us", "book-20-minutes", "free-audit"];
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const field = (name) => form.elements[name];
  // Soft /talk uses radio chips; /law-firms/talk/ uses selects for the same names.
  const checked = (name) => form.querySelector('input[name="' + name + '"]:checked');
  const choice = (name) => {
    const radio = checked(name);
    if (radio) return radio.value;
    const input = field(name);
    if (input && typeof input.value === "string") return input.value.trim();
    return "";
  };

  // Analytics. Events carry no name, email, company or free text.
  const analytics = window.deltavAnalytics || { track() {}, identify() {} };
  const source = () => {
    const from = new URLSearchParams(window.location.search).get("from");
    if (sources.includes(from)) return from;
    return sources.includes(form.dataset.source) ? form.dataset.source : "";
  };
  form.addEventListener("focusin", () => analytics.track("lead_form_started", { source: source() }), { once: true });
  const errorNode = (name) => document.getElementById(name + "-error");

  function setError(name, message) {
    const node = errorNode(name);
    if (node) node.textContent = message || "";
    if (name === "role") {
      const radios = form.querySelectorAll('input[name="role"]');
      if (radios.length) {
        radios.forEach((input) => {
          if (message) input.setAttribute("aria-invalid", "true");
          else input.removeAttribute("aria-invalid");
        });
        return;
      }
    }
    const input = field(name);
    if (input && input.setAttribute) {
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  function clearErrors() {
    formError.textContent = "";
    required.forEach((name) => setError(name, ""));
    setError("question", "");
    const turnstileError = document.getElementById("turnstile-error");
    if (turnstileError) turnstileError.textContent = "";
  }

  function showErrors(errors) {
    let first = null;
    Object.keys(errors).forEach((key) => {
      const node = errorNode(key);
      if (node) {
        setError(key, errors[key]);
        if (!first) {
          if (key === "role") {
            first = form.querySelector('input[name="role"]') || field("role") || node;
          } else first = field(key) || node;
        }
      } else {
        formError.textContent = errors[key];
      }
    });
    if (first && first.focus) first.focus();
    else formError.focus && formError.focus();
  }

  function validate() {
    const errors = {};
    ["email", "name", "company"].forEach((name) => {
      if (!field(name).value.trim()) errors[name] = "Required.";
    });
    if (!choice("role")) errors.role = "Choose an option.";
    const email = field("email").value.trim();
    if (email && (email.length > 254 || !EMAIL.test(email))) errors.email = "Enter a valid email address.";
    return errors;
  }

  function samePathReferrer() {
    if (!document.referrer) return "";
    try {
      const url = new URL(document.referrer);
      return url.origin === window.location.origin ? url.pathname : "";
    } catch {
      return "";
    }
  }

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

  function payload() {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const tools = Array.prototype.slice
      .call(form.querySelectorAll('input[name="ai_tools"]:checked'))
      .map((input) => input.value);
    return {
      email: field("email").value,
      name: field("name").value,
      company: field("company").value,
      role: choice("role"),
      team_size: choice("team_size"),
      goal: choice("goal"),
      ai_tools: tools,
      monthly_spend: choice("monthly_spend"),
      question: field("question").value,
      outreach_code: outreachCode(),
      website: field("website").value,
      source: sources.includes(from) ? from : (sources.includes(form.dataset.source) ? form.dataset.source : ""),
      referrer_path: samePathReferrer(),
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      turnstileToken: window.turnstile ? window.turnstile.getResponse() || "" : "",
    };
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      showErrors(errors);
      analytics.track("lead_form_error", { fields: Object.keys(errors) });
      return;
    }

    submit.disabled = true;
    try {
      const sent = payload();
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sent),
      });
      const data = await response.json().catch(() => null);

      if (response.ok && data && data.ok) {
        // Skip the honeypot case: the server stores nothing for it.
        if (!sent.website) {
          analytics.identify(sent.email.trim().toLowerCase(), {
            company: sent.company.trim(),
            role: sent.role,
            outreach_code: sent.outreach_code,
          });
          analytics.track("lead_form_submitted", {
            source: sent.source,
            role: sent.role,
            goal: sent.goal,
            monthly_spend: sent.monthly_spend,
            ai_tools: sent.ai_tools,
          });
        }
        form.hidden = true;
        if (intro) intro.hidden = true;
        done.hidden = false;
        done.setAttribute("tabindex", "-1");
        done.focus();
        return;
      }

      if (data && data.errors) {
        showErrors(data.errors);
        analytics.track("lead_form_error", { fields: Object.keys(data.errors) });
      }
      else formError.textContent = "Something went wrong. Try again in a minute.";
    } catch {
      formError.textContent = "Something went wrong. Try again in a minute.";
    }

    if (window.turnstile) window.turnstile.reset();
    submit.disabled = false;
  });
})();
