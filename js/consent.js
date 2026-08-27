const CONSENT_STORAGE_KEY = "matpreppern_consent";
const CONSENT_VERSION = 1;
const GOOGLE_ANALYTICS_ID = "G-13M0W90GNB";
const GOOGLE_TAG_MANAGER_ID = "GTM-TXG48DXB";
const CONTENTSQUARE_TAG_ID = "1f63737166e68";

// Statistikkskript lastes bare på sider uten konto-, rapport- eller kladdeinnhold.
const TRACKED_PUBLIC_PAGES = new Set([
  "index.html",
  "recipe.html",
  "community-notes.html",
  "profile.html",
]);

let trackingLoaded = false;
let settingsOpener = null;

window.dataLayer = window.dataLayer || [];

function gtag() {
  window.dataLayer.push(arguments);
}

function setDefaultConsent() {
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500,
  });
  gtag("set", "ads_data_redaction", true);
  gtag("set", "url_passthrough", false);
}

function readConsent() {
  try {
    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY));
    if (
      stored?.version === CONSENT_VERSION &&
      ["granted", "denied"].includes(stored?.analytics)
    ) {
      return stored;
    }
  } catch {
    // Banneret vises på nytt hvis nettleseren blokkerer eller har ugyldig lagring.
  }

  return null;
}

function storeConsent(analytics) {
  const consent = {
    version: CONSENT_VERSION,
    analytics,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Valget gjelder fortsatt for denne sidevisningen selv om det ikke kan huskes.
  }

  return consent;
}

function getCurrentPageName() {
  if (window.location.pathname.endsWith("/")) return "index.html";
  return window.location.pathname.split("/").filter(Boolean).pop() || "index.html";
}

function isPublicTrackingPage() {
  return TRACKED_PUBLIC_PAGES.has(getCurrentPageName());
}

function loadGoogleAnalytics() {
  if (document.querySelector("script[data-matpreppern-ga]")) return;

  const pageLocation = `${window.location.origin}${window.location.pathname}`;
  let pageReferrer = "";
  try {
    const referrerUrl = new URL(document.referrer);
    pageReferrer = `${referrerUrl.origin}${referrerUrl.pathname}`;
  } catch {
    // Tom eller ugyldig henviser sendes ikke videre.
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
    GOOGLE_ANALYTICS_ID
  )}`;
  script.dataset.matpreppernGa = "true";
  document.head.appendChild(script);

  gtag("js", new Date());
  gtag("config", GOOGLE_ANALYTICS_ID, {
    allow_ad_personalization_signals: false,
    allow_google_signals: false,
    cookie_expires: 7_776_000,
    cookie_update: false,
    page_location: pageLocation,
    page_path: window.location.pathname,
    ...(pageReferrer ? { page_referrer: pageReferrer } : {}),
    send_page_view: true,
  });
}

function loadGoogleTagManager() {
  if (document.querySelector("script[data-matpreppern-gtm]")) return;

  window.dataLayer.push({
    "gtm.start": Date.now(),
    event: "gtm.js",
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(
    GOOGLE_TAG_MANAGER_ID
  )}`;
  script.dataset.matpreppernGtm = "true";
  document.head.appendChild(script);
}

function loadContentsquareExperienceAnalytics() {
  if (document.querySelector("script[data-matpreppern-contentsquare]")) return;

  window._uxa = window._uxa || [];
  // Del bare sidebanen. Spørringsparametere og parametere i henvisende URL fjernes.
  window._uxa.push(["setPath", window.location.pathname]);
  window._uxa.push(["setQuery", ""]);
  window._uxa.push(["referrer:removeQueryString"]);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://t.contentsquare.net/uxa/${encodeURIComponent(
    CONTENTSQUARE_TAG_ID
  )}.js`;
  script.dataset.matpreppernContentsquare = "true";
  document.head.appendChild(script);
}

function enableStatistics() {
  gtag("consent", "update", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  });

  if (!isPublicTrackingPage()) return;

  trackingLoaded = true;
  loadGoogleAnalytics();
  loadContentsquareExperienceAnalytics();
  loadGoogleTagManager();
}

function expireCookie(name, path, domain = "") {
  const domainAttribute = domain ? `; Domain=${domain}` : "";
  document.cookie = `${name}=; Max-Age=0; Path=${path}${domainAttribute}; SameSite=Lax`;
}

function clearStatisticsStorage() {
  const projectPath = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : window.location.pathname.slice(0, window.location.pathname.lastIndexOf("/") + 1);
  const paths = new Set(["/", projectPath]);
  const hostname = window.location.hostname;
  const domains = ["", hostname, hostname ? `.${hostname}` : ""].filter(
    (domain, index, values) => values.indexOf(domain) === index
  );

  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (!name || !/^(?:_ga|_gid|_gat|_hj|_cs)/i.test(name)) return;

    paths.forEach((path) => {
      domains.forEach((domain) => expireCookie(name, path, domain));
    });
  });

  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      Object.keys(storage)
        .filter((key) => /^(?:_hj|_cs|cs_)/i.test(key))
        .forEach((key) => storage.removeItem(key));
    } catch {
      // Enkelte personverninnstillinger kan blokkere lesing av nettleserlagring.
    }
  }
}

function disableStatistics() {
  gtag("consent", "update", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  clearStatisticsStorage();
}

function getStatusRegion() {
  let status = document.querySelector("#consentStatus");
  if (status) return status;

  status = document.createElement("p");
  status.id = "consentStatus";
  status.className = "visually-hidden";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  document.body.appendChild(status);
  return status;
}

function announce(message) {
  const status = getStatusRegion();
  status.textContent = "";
  window.setTimeout(() => {
    status.textContent = message;
  }, 10);
}

function closeBanner() {
  document.querySelector("#consentBanner")?.remove();
  if (settingsOpener instanceof HTMLElement) settingsOpener.focus();
  settingsOpener = null;
}

function applyChoice(choice) {
  const previousChoice = readConsent()?.analytics;
  storeConsent(choice);

  if (choice === "granted") {
    enableStatistics();
    closeBanner();
    announce("Statistikk er aktivert. Du kan endre valget fra lenken i bunnteksten.");
    return;
  }

  disableStatistics();
  closeBanner();
  announce("Valgfri statistikk er avslått.");

  // Et lastet tredjepartsskript kan ikke avlastes. En oppfriskning stopper videre sporing.
  if (trackingLoaded || previousChoice === "granted") {
    window.setTimeout(() => window.location.reload(), 150);
  }
}

function showConsentBanner({ focus = false, showDetails = false } = {}) {
  const existing = document.querySelector("#consentBanner");
  if (existing) {
    if (showDetails) existing.querySelector("[data-consent-customize]")?.click();
    if (focus) existing.querySelector("h2")?.focus();
    return;
  }

  const storedChoice = readConsent()?.analytics;
  const banner = document.createElement("section");
  banner.id = "consentBanner";
  banner.className = "consent-banner";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-labelledby", "consentTitle");
  banner.setAttribute("aria-describedby", "consentDescription");
  banner.innerHTML = `
    <div class="consent-banner__content">
      <div>
        <p class="eyebrow">Ditt personvern</p>
        <h2 id="consentTitle" tabindex="-1">Velg om du vil dele bruksstatistikk</h2>
        <p id="consentDescription">
          MatPreppern bruker bare nødvendig nettleserlagring uten samtykke. Hvis du godtar
          statistikk, kan Google Analytics og Hotjar/Contentsquare brukes på offentlige sider for å
          forbedre tjenesten. Ingen statistikk lastes før du velger å godta.
          <a href="legal.html#analytics">Les mer om personvern og statistikk</a>.
        </p>
      </div>

      <div class="consent-banner__choices" aria-label="Samtykkevalg">
        <button class="consent-choice-button" type="button" data-consent-reject>
          Avvis statistikk
        </button>
        <button class="consent-choice-button" type="button" data-consent-accept>
          Godta statistikk
        </button>
      </div>

      <button
        class="consent-customize-button"
        type="button"
        aria-expanded="false"
        aria-controls="consentDetails"
        data-consent-customize
      >
        Tilpass valget
      </button>

      <div class="consent-details" id="consentDetails" hidden>
        <fieldset>
          <legend>Hvilken lagring tillater du?</legend>
          <label>
            <input type="checkbox" checked disabled />
            <span><strong>Nødvendig</strong><small>Innlogging, sikkerhet, offline-funksjoner og selve samtykkevalget.</small></span>
          </label>
          <label>
            <input type="checkbox" data-consent-statistics />
            <span><strong>Statistikk</strong><small>Google Analytics og Hotjar/Contentsquare-måling på offentlige sider.</small></span>
          </label>
        </fieldset>
        <button class="secondary-button" type="button" data-consent-save>Lagre valget</button>
      </div>
    </div>`;

  const details = banner.querySelector("#consentDetails");
  const customizeButton = banner.querySelector("[data-consent-customize]");
  const statisticsCheckbox = banner.querySelector("[data-consent-statistics]");
  statisticsCheckbox.checked = storedChoice === "granted";

  customizeButton.addEventListener("click", () => {
    const willOpen = details.hidden;
    details.hidden = !willOpen;
    customizeButton.setAttribute("aria-expanded", String(willOpen));
    customizeButton.textContent = willOpen ? "Skjul tilpasning" : "Tilpass valget";
    if (willOpen) statisticsCheckbox.focus();
  });
  banner.querySelector("[data-consent-reject]").addEventListener("click", () => applyChoice("denied"));
  banner.querySelector("[data-consent-accept]").addEventListener("click", () => applyChoice("granted"));
  banner.querySelector("[data-consent-save]").addEventListener("click", () => {
    applyChoice(statisticsCheckbox.checked ? "granted" : "denied");
  });

  document.body.appendChild(banner);

  if (showDetails) customizeButton.click();
  else if (focus) banner.querySelector("h2")?.focus();
}

function addSettingsControls() {
  const footerNav = document.querySelector(".site-footer nav");
  if (footerNav && !footerNav.querySelector("[data-open-cookie-settings]")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "footer-consent-button";
    button.dataset.openCookieSettings = "true";
    button.textContent = "Endre samtykke";
    footerNav.appendChild(button);
  }

  document.querySelectorAll("[data-open-cookie-settings]").forEach((button) => {
    if (button.dataset.consentListener === "true") return;
    button.dataset.consentListener = "true";
    button.addEventListener("click", () => {
      settingsOpener = button;
      showConsentBanner({ focus: true, showDetails: true });
    });
  });
}

function initializeConsent() {
  setDefaultConsent();
  addSettingsControls();

  const stored = readConsent();
  if (stored?.analytics === "granted") {
    enableStatistics();
    return;
  }

  if (stored?.analytics === "denied") {
    disableStatistics();
    return;
  }

  showConsentBanner();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeConsent, { once: true });
} else {
  initializeConsent();
}
