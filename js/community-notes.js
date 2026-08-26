import {
  createCommunityNote,
  deleteCommunityNote,
  fetchCommunityNotes,
  getCurrentUser,
  isCurrentUserAdmin,
  onAuthStateChange,
  updateCommunityNote,
} from "./supabase.js";
import { escapeHtml } from "./recipe-utils.js";

const notesStatus = document.querySelector("#notesStatus");
const noteEditor = document.querySelector("#note-editor");
const noteEditorTitle = document.querySelector("#noteEditorTitle");
const noteForm = document.querySelector("#communityNoteForm");
const noteTitleInput = document.querySelector("#noteTitleInput");
const noteBodyInput = document.querySelector("#noteBodyInput");
const notePublishedInput = document.querySelector("#notePublishedInput");
const saveNoteButton = document.querySelector("#saveNoteButton");
const cancelNoteEdit = document.querySelector("#cancelNoteEdit");
const noteFormMessage = document.querySelector("#noteFormMessage");
const noteList = document.querySelector("#communityNoteList");
const noteCount = document.querySelector("#communityNoteCount");

let notes = [];
let currentUserIsAdmin = false;
let editingNoteId = null;
let loadRequest = 0;

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ukjent dato";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function setStatus(message, type = "") {
  notesStatus.textContent = message;
  notesStatus.className = `data-status notes-status${type ? ` data-status--${type}` : ""}`;
}

function renderNotes() {
  noteList.setAttribute("aria-busy", "false");
  noteCount.textContent = notes.length === 1 ? "1 notat" : `${notes.length} notater`;

  if (notes.length === 0) {
    noteList.innerHTML = '<div class="empty-planner-state"><h3>Ingen Community Notes ennå</h3><p>Publiserte notater fra MatPreppern-teamet vises her.</p></div>';
    return;
  }

  noteList.innerHTML = notes.map((note) => `
    <article class="community-note-card${note.isPublished ? "" : " community-note-card--draft"}">
      <div class="community-note-heading">
        <div>
          ${currentUserIsAdmin ? `<p class="note-state">${note.isPublished ? "Publisert" : "Kladd"}</p>` : ""}
          <h3>${escapeHtml(note.title)}</h3>
        </div>
        <time datetime="${escapeHtml(note.updatedAt)}">${escapeHtml(formatDate(note.updatedAt))}</time>
      </div>
      <p class="community-note-body">${escapeHtml(note.body)}</p>
      ${currentUserIsAdmin ? `
        <div class="item-actions">
          <button class="secondary-button" type="button" data-edit-note="${note.id}">Rediger</button>
          <button class="danger-button" type="button" data-delete-note="${note.id}">Slett</button>
        </div>` : ""}
    </article>
  `).join("");
}

function resetEditor() {
  editingNoteId = null;
  noteForm.reset();
  noteEditorTitle.textContent = "Skriv en Community Note";
  saveNoteButton.textContent = "Lagre Community Note";
  cancelNoteEdit.classList.add("hidden");
  noteFormMessage.textContent = "";
}

function editNote(note) {
  editingNoteId = note.id;
  noteTitleInput.value = note.title;
  noteBodyInput.value = note.body;
  notePublishedInput.checked = note.isPublished;
  noteEditorTitle.textContent = "Rediger Community Note";
  saveNoteButton.textContent = "Lagre endringer";
  cancelNoteEdit.classList.remove("hidden");
  noteFormMessage.textContent = "";
  noteTitleInput.focus();
  noteEditor.scrollIntoView({ block: "start" });
}

async function loadNotesPage() {
  const request = ++loadRequest;
  noteList.setAttribute("aria-busy", "true");
  setStatus("Henter Community Notes …");

  try {
    const user = await getCurrentUser();
    const isAdmin = user ? await isCurrentUserAdmin() : false;
    const loadedNotes = await fetchCommunityNotes();
    if (request !== loadRequest) return;

    currentUserIsAdmin = isAdmin;
    notes = loadedNotes;
    noteEditor.classList.toggle("hidden", !isAdmin);
    if (!isAdmin) resetEditor();
    renderNotes();
    setStatus("");
    if (isAdmin && window.location.hash === "#note-editor") {
      window.requestAnimationFrame(() => noteEditor.scrollIntoView({ block: "start" }));
    }
  } catch (error) {
    console.error("Kunne ikke hente Community Notes:", error);
    noteList.setAttribute("aria-busy", "false");
    setStatus(error.message || "Kunne ikke hente Community Notes.", "error");
  }
}

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!noteForm.checkValidity()) {
    noteForm.reportValidity();
    return;
  }

  const note = {
    title: noteTitleInput.value,
    body: noteBodyInput.value,
    isPublished: notePublishedInput.checked,
  };
  saveNoteButton.disabled = true;
  noteForm.setAttribute("aria-busy", "true");
  noteFormMessage.textContent = "Lagrer …";

  try {
    if (editingNoteId) await updateCommunityNote(editingNoteId, note);
    else await createCommunityNote(note);
    resetEditor();
    await loadNotesPage();
    setStatus(note.isPublished ? "Community Note ble publisert." : "Community Note ble lagret som kladd.");
  } catch (error) {
    noteFormMessage.textContent = error.message || "Kunne ikke lagre notatet.";
  } finally {
    saveNoteButton.disabled = false;
    noteForm.removeAttribute("aria-busy");
  }
});

cancelNoteEdit.addEventListener("click", () => {
  resetEditor();
  noteTitleInput.focus();
});

noteList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-note]");
  const deleteButton = event.target.closest("[data-delete-note]");

  if (editButton) {
    const note = notes.find((item) => item.id === Number(editButton.dataset.editNote));
    if (note) editNote(note);
    return;
  }

  if (!deleteButton || !window.confirm("Vil du slette denne Community Note permanent?")) return;
  deleteButton.disabled = true;
  try {
    await deleteCommunityNote(Number(deleteButton.dataset.deleteNote));
    if (editingNoteId === Number(deleteButton.dataset.deleteNote)) resetEditor();
    await loadNotesPage();
    setStatus("Community Note ble slettet.");
  } catch (error) {
    setStatus(error.message || "Kunne ikke slette notatet.", "error");
    deleteButton.disabled = false;
  }
});

onAuthStateChange(() => window.setTimeout(loadNotesPage, 0));
await loadNotesPage();
