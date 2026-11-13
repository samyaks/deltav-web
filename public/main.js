// Email capture for the "free audit" form.
//
// Posts the form to whatever its `action` attribute points at, URL-encoded,
// asking for JSON back. That works with Netlify Forms (the default, see
// netlify.toml) and with hosted form backends such as Formspree or Basin.
// Without JavaScript the form still submits natively and lands on /thanks/.

(() => {
  const form = document.querySelector("[data-signup]");
  const status = document.querySelector("[data-signup-status]");
  if (!form || !status || !window.fetch) return;

  const button = form.querySelector('button[type="submit"]');
  const buttonLabel = button.textContent;

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    // Honeypot: bots fill every field. Pretend it worked.
    if (form.elements.company && form.elements.company.value) {
      form.hidden = true;
      setStatus("Thanks. We'll be in touch within two business days.");
      return;
    }

    button.disabled = true;
    button.textContent = "Sending…";
    setStatus("");

    try {
      const res = await fetch(form.getAttribute("action") || "/", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      form.hidden = true;
      setStatus("Thanks. We'll be in touch within two business days.");
    } catch (err) {
      console.error("Sign-up failed:", err);
      button.disabled = false;
      button.textContent = buttonLabel;
      setStatus("That didn't go through. Please try again, or email partners@deltav.info.", true);
    }
  });
})();
