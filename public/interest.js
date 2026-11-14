for (const form of document.querySelectorAll("form.interest")) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    const status = form.querySelector(".interest-status");
    const fields = form.querySelector(".interest-fields");
    button.disabled = true;
    status.hidden = false;
    status.removeAttribute("data-error");
    status.textContent = "Sending…";
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        status.setAttribute("data-error", "");
        status.textContent = body.error || "Something went wrong. Email partners@deltav.info.";
        button.disabled = false;
        return;
      }
      fields.hidden = true;
      button.hidden = true;
      status.textContent = "Thanks. We have your details and will be in touch.";
    } catch {
      status.setAttribute("data-error", "");
      status.textContent = "Something went wrong. Email partners@deltav.info.";
      button.disabled = false;
    }
  });
}
