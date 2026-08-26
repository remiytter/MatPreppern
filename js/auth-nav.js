import { getCurrentUser, onAuthStateChange } from "./supabase.js";

function initializeMobileNavigation() {
  document.querySelectorAll(".navbar").forEach((navbar) => {
    const toggle = navbar.querySelector("[data-nav-toggle]");
    const menu = navbar.querySelector("[data-nav-menu]");
    if (!toggle || !menu) return;

    const setOpen = (isOpen, returnFocus = false) => {
      menu.classList.toggle("nav-links--open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", isOpen ? "Lukk meny" : "Åpne meny");
      if (returnFocus) toggle.focus();
    };

    navbar.classList.add("nav-ready");
    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("click", (event) => {
      if (!navbar.contains(event.target)) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false, true);
      }
    });

    const desktopView = window.matchMedia("(min-width: 761px)");
    desktopView.addEventListener("change", (event) => {
      if (event.matches) setOpen(false);
    });
  });
}

function updateNavigation(user) {
  document.querySelectorAll("[data-auth-label]").forEach((link) => {
    link.textContent = user ? "Min konto" : "Logg inn";
  });

  document.querySelectorAll("[data-auth-only]").forEach((element) => {
    element.classList.toggle("hidden", !user);
  });

  document.querySelectorAll("[data-guest-only]").forEach((element) => {
    element.classList.toggle("hidden", Boolean(user));
  });

  document.dispatchEvent(
    new CustomEvent("matpreppern-auth-changed", { detail: { user } })
  );
}

initializeMobileNavigation();

getCurrentUser()
  .then(updateNavigation)
  .catch((error) => console.error("Kunne ikke lese innloggingsstatus:", error));

onAuthStateChange((_event, session) => {
  window.setTimeout(() => updateNavigation(session?.user ?? null), 0);
});
