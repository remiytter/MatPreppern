import { getCurrentUser, onAuthStateChange } from "./supabase.js";

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

getCurrentUser()
  .then(updateNavigation)
  .catch((error) => console.error("Kunne ikke lese innloggingsstatus:", error));

onAuthStateChange((_event, session) => {
  window.setTimeout(() => updateNavigation(session?.user ?? null), 0);
});
