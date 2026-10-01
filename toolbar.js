/**
 * toolbar.js — Toolbar Controls, Zoom & Pan
 * ---------------------------------------------------------------------------
 * Per jsPrompt.md §8, with zoom/pan now delegated to canvas.js, which owns
 * the JointJS Paper (`paper.scale()` / `paper.translate()`):
 *   - The zoom slider and +/- buttons zoom toward the CENTER of the
 *     viewport (no cursor position to aim at); the mouse wheel — wired up
 *     in canvas.js — zooms toward the cursor instead. Both go through the
 *     same `Canvas.zoomTo()` / 10%-step logic, so they always agree.
 *   - #btn-select / #btn-pan just set which tool a drag on empty canvas
 *     means (canvas.js's `beginPan` is what actually moves the paper);
 *     dragging empty space pans with either tool, same as before.
 */
import * as App from './app.js';
import * as Logic from './logic.js';
import * as Popups from './popups.js';
import * as Canvas from './canvas.js';

const host = document.getElementById('paper-host');

// ---------------- Zoom ----------------

const zoomSlider = document.getElementById('zoom-slider');

const syncSlider = () => { zoomSlider.value = String(Canvas.getZoomPercent()); };

zoomSlider.addEventListener('input', () => Canvas.zoomToPercent(parseInt(zoomSlider.value, 10)));
document.getElementById('btn-zoom-in').addEventListener('click', () => { Canvas.zoomInStep(); syncSlider(); });
document.getElementById('btn-zoom-out').addEventListener('click', () => { Canvas.zoomOutStep(); syncSlider(); });
App.events.addEventListener('zoom:change', syncSlider);

/** Size and center the initial view. Called once by main.js. */
export const initViewport = () => {
    Canvas.initViewport();
    syncSlider();
};

// ---------------- Select / Pan tool ----------------

const selectButton = document.getElementById('btn-select');
const panButton = document.getElementById('btn-pan');

export const getActiveTool = () => Canvas.getPanTool();

// Correction: give the active tool a persistent, visible cursor cue until
// the user presses Escape, right-clicks, or picks a different tool — a
// plain `host.style.cursor` (the old approach) only ever set the cursor on
// #paper-host itself, which every control's OWN `cursor` CSS rule (move,
// pointer, etc.) then silently overrode the instant the mouse was actually
// over one — the pan tool's "grab" cursor, for instance, never showed up
// while hovering a gate. A class on host plus `#paper-host.tool-pan *` in
// style.css (higher specificity than any individual control's own cursor
// rule) fixes that: the tool's cursor now wins everywhere inside the canvas,
// control or not.
const setTool = (tool) => {
    App.emit('tool:cancel'); // picking an explicit tool also clears the multiselect/note overlays
    Canvas.setPanTool(tool);
    selectButton.classList.toggle('selected', tool === 'select');
    panButton.classList.toggle('selected', tool === 'pan');
    host.classList.toggle('tool-pan', tool === 'pan');
    host.classList.toggle('tool-select', tool === 'select');
};

selectButton.addEventListener('click', () => setTool('select'));
panButton.addEventListener('click', () => setTool('pan'));
setTool('select');

// Escape or a right-click anywhere reverts to the select tool and clears
// any armed overlay (multiselect, the note/pencil tool) — 'tool:cancel' is
// shared with selection.js and popups.js, which each listen for it to
// disarm themselves; this listener additionally handles reverting pan back
// to select, since that part is this file's own responsibility.
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    App.emit('tool:cancel');
    if (Canvas.getPanTool() === 'pan') setTool('select');
});
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    App.emit('tool:cancel');
    if (Canvas.getPanTool() === 'pan') setTool('select');
});

// ---------------- Print ----------------
// Save, and Back/Forward (the "<"/">" buttons, repurposed per the owner's
// simpler single-save-point design — not a conventional undo/redo stack),
// are wired up in saveLoad.js instead: they need App, Canvas, Shapes,
// CustomGates and localStorage all together, which belongs in its own file
// rather than growing toolbar.js's already-broad "misc button bindings"
// role further.

document.getElementById('btn-print').addEventListener('click', () => window.print());

// ---------------- Grid toggle ----------------
// The dot grid is a CSS background on #paper-host (see style.css) rather
// than a JointJS-rendered grid, so it keeps the exact original look
// (including the dark-mode color token) — toggling it is just a class.

const gridButton = document.getElementById('btn-grid');
let gridOn = true;

gridButton.addEventListener('click', () => {
    gridOn = !gridOn;
    host.classList.toggle('grid-hidden', !gridOn);
    gridButton.classList.toggle('selected', !gridOn);
});

// ---------------- Clear All ----------------

document.getElementById('btn-clear-all').addEventListener('click', () => Popups.openClearAllConfirm());

// ---------------- Play / Stop ----------------

document.getElementById('btn-play').addEventListener('click', () => Logic.play());
document.getElementById('btn-stop').addEventListener('click', () => Logic.stop());

// ---------------- Help ----------------

document.getElementById('btn-help').addEventListener('click', () => {
    alert('Drag controls and gates from the left panel onto the canvas, wire them together from output to input nodes, ' +
        'and use the toolbar to select, edit and simulate your circuit. Drag empty space (or use the pan tool) to move around. ' +
        'Scroll the mouse wheel over the canvas to zoom toward the cursor.');
});

// ---------------- Theme (dark mode) ----------------
// Folded in from what used to be a separate theme.js: like the toolbar
// bindings above, this is just "a status-bar control's click handler plus
// where its state is kept" — #dark-mode-toggle lives in the same
// #status-bar as the zoom controls this file already owns, and it shares
// no state or graph/paper access with anything else, so it didn't need its
// own file.
//
// Toggles `.dark-mode` on <body>; every color in style.css already reads
// from custom properties, so this one class swap re-themes the entire app.
// Persisted under the localStorage key "darkMode", read back inside
// try/catch in case storage is unavailable (private browsing, etc.).

const THEME_STORAGE_KEY = 'darkMode';
const darkModeToggle = document.getElementById('dark-mode-toggle');

const applyTheme = (isDark) => document.body.classList.toggle('dark-mode', isDark);

darkModeToggle.addEventListener('change', () => {
    applyTheme(darkModeToggle.checked);
    try {
        localStorage.setItem(THEME_STORAGE_KEY, darkModeToggle.checked ? '1' : '0');
    } catch (error) {
        // Storage unavailable: the choice just won't survive a reload.
    }
});

try {
    if (localStorage.getItem(THEME_STORAGE_KEY) === '1') {
        darkModeToggle.checked = true;
        applyTheme(true);
    }
} catch (error) {
    // Storage unavailable: default to light mode.
}
