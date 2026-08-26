import {
  fetchMyReports,
  getCurrentUser,
  markReportUpdatesSeen,
  onAuthStateChange,
} from "./supabase.js";
import { escapeHtml } from "./recipe-utils.js";

const status = document.querySelector("#reportsStatus");
const guest = document.querySelector("#reportsGuest");
const signedIn = document.querySelector("#reportsSignedIn");
const filter = document.querySelector("#reportFilter");
const count = document.querySelector("#reportCount");
const list = document.querySelector("#myReportList");
let reports = [];
let renderRequest = 0;

const statusLabels = {
  open: "Åpen",
  reviewed: "Vurdert",
  closed: "Lukket / arkivert",
};

const reasonLabels = {
  spam: "Spam eller reklame",
  stotende: "Støtende innhold",
  feil: "Alvorlig feilinformasjon",
  annet: "Annet",
};

function formatDate(value) {
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function hasUnseenUpdate(report) {
  if (report.status === "open" && !report.adminNote) return false;
  return !report.seenAt || new Date(report.updatedAt) > new Date(report.seenAt);
}

function renderReports() {
  const selectedStatus = filter.value;
  const visible = reports.filter((report) => selectedStatus === "all" || report.status === selectedStatus);
  count.textContent = `${visible.length} av ${reports.length} rapporter vises.`;
  list.setAttribute("aria-busy", "false");

  if (visible.length === 0) {
    list.innerHTML = '<div class="empty-planner-state"><h3>Ingen rapporter her</h3><p>Du har ingen rapporter som passer dette filteret.</p></div>';
    return;
  }

  list.innerHTML = visible.map((report) => {
    const unseen = hasUnseenUpdate(report);
    const recipeTitle = escapeHtml(report.recipeTitle);
    return `
      <article class="report-card${unseen ? " report-card--unseen" : ""}">
        <div class="report-card-heading">
          <div>
            ${unseen ? '<p class="report-update-label">Nytt svar</p>' : ""}
            <p class="report-status report-status--${escapeHtml(report.status)}">${escapeHtml(statusLabels[report.status] ?? report.status)}</p>
            <h3>${report.recipeId ? `<a href="recipe.html?id=${report.recipeId}">${recipeTitle}</a>` : recipeTitle}</h3>
          </div>
          <time datetime="${escapeHtml(report.createdAt)}">Sendt ${escapeHtml(formatDate(report.createdAt))}</time>
        </div>
        <p><strong>Årsak:</strong> ${escapeHtml(reasonLabels[report.reason] ?? report.reason)}</p>
        ${report.details ? `<p class="report-details">${escapeHtml(report.details)}</p>` : ""}
        ${report.adminNote ? `<div class="admin-response"><h4>Svar fra MatPreppern</h4><p>${escapeHtml(report.adminNote)}</p><p class="field-help">Oppdatert ${escapeHtml(formatDate(report.updatedAt))}</p></div>` : ""}
      </article>`;
  }).join("");
}

async function renderAuthState(user) {
  const request = ++renderRequest;
  guest.classList.toggle("hidden", Boolean(user));
  signedIn.classList.toggle("hidden", !user);

  if (!user) {
    status.textContent = "";
    reports = [];
    return;
  }

  list.setAttribute("aria-busy", "true");
  status.textContent = "Henter rapporter …";
  try {
    reports = await fetchMyReports();
    if (request !== renderRequest) return;
    renderReports();
    status.textContent = "";

    const unseenIds = reports.filter(hasUnseenUpdate).map((report) => report.id);
    if (unseenIds.length > 0) {
      await markReportUpdatesSeen(unseenIds);
      const seenAt = new Date().toISOString();
      reports = reports.map((report) => unseenIds.includes(report.id) ? { ...report, seenAt } : report);
    }
  } catch (error) {
    console.error("Kunne ikke hente rapportene:", error);
    status.textContent = error.message || "Kunne ikke hente rapportene.";
    status.classList.add("data-status--error");
    list.setAttribute("aria-busy", "false");
  }
}

filter.addEventListener("change", renderReports);
onAuthStateChange((_event, session) => {
  window.setTimeout(() => renderAuthState(session?.user ?? null), 0);
});

await renderAuthState(await getCurrentUser());
