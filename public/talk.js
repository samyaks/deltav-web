// The /talk form: validate, post to /api/leads, show the result.

import { isGmailOrYahoo, WORK_EMAIL_ERROR } from "./email-domain.js";

(function () {
  const form = document.getElementById("talk-form");
  if (!form) return;

  const submit = document.getElementById("talk-submit");
  const formError = document.getElementById("form-error");
  const done = document.getElementById("talk-done");
  const required = ["email", "name", "company", "role", "team_size"];
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const field = (name) => form.elements[name];
  const errorNode = (name) => document.getElementById(name + "-error");

  function setError(name, message) {
    const node = errorNode(name);
    if (node) node.textContent = message || "";
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
        node.textContent = errors[key];
        const input = field(key);
        if (input && input.setAttribute) input.setAttribute("aria-invalid", "true");
        if (!first) first = input || node;
      } else {
        formError.textContent = errors[key];
      }
    });
    if (first && first.focus) first.focus();
    else formError.focus && formError.focus();
  }

  function validate() {
    const errors = {};
    required.forEach((name) => {
      if (!field(name).value.trim()) errors[name] = name === "role" || name === "team_size" ? "Choose an option." : "Required.";
    });
    const email = field("email").value.trim();
    if (email && (email.length > 254 || !EMAIL.test(email))) errors.email = "Enter a valid email address.";
    else if (email && isGmailOrYahoo(email)) errors.email = WORK_EMAIL_ERROR;
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
      role: field("role").value,
      team_size: field("team_size").value,
      ai_tools: tools,
      monthly_spend: field("monthly_spend").value,
      question: field("question").value,
      website: field("website").value,
      source: from === "talk-to-us" || from === "book-20-minutes" ? from : "",
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
      return;
    }

    submit.disabled = true;
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await response.json().catch(() => null);

      if (response.ok && data && data.ok) {
        form.hidden = true;
        done.hidden = false;
        done.setAttribute("tabindex", "-1");
        done.focus();
        return;
      }

      if (data && data.errors) showErrors(data.errors);
      else formError.textContent = "Something went wrong. Try again in a minute.";
    } catch {
      formError.textContent = "Something went wrong. Try again in a minute.";
    }

    if (window.turnstile) window.turnstile.reset();
    submit.disabled = false;
  });
})();
