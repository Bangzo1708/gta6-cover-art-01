// Vice Cover Studio — page wiring: photos in, caption edits, drag/zoom per
// panel, export. The cover itself is painted by ./cover.js; this file only
// owns the controls and the photo tray. Shot scenes live in ./shots.js.
import { EXPORT_SIZES, drawCoverArt, freshState, makePanelState, panelAt } from './cover.js';
import { runShotScene } from './shots.js';

const canvas = document.getElementById('coverCanvas');
const statusLine = document.getElementById('status');
const titleInput = document.getElementById('titleInput');
const taglineInput = document.getElementById('taglineInput');
const zoomRange = document.getElementById('zoomRange');
const tray = document.getElementById('tray');

const state = freshState();
let activePhoto = 0;
let dragging = null;

export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not read ${file.name}`));
    img.src = URL.createObjectURL(file);
  });
}

export function readImageUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function repaint() {
  drawCoverArt(canvas, state);
}

function applySize() {
  const size = EXPORT_SIZES[state.size];
  canvas.width = size.width;
  canvas.height = size.height;
  repaint();
}

function syncZoomSlider() {
  const slot = state.panels[state.selected];
  zoomRange.value = String(Math.round((slot?.zoom ?? 1) * 100));
}

function renderTray() {
  tray.innerHTML = '';
  if (state.photos.length === 0) {
    const note = document.createElement('span');
    note.className = 'empty';
    note.textContent = 'No photos yet — try a sample below, or drop your own in.';
    tray.appendChild(note);
    return;
  }
  state.photos.forEach((img, i) => {
    const thumb = document.createElement('img');
    thumb.src = img.src;
    thumb.alt = `Photo ${i + 1}`;
    thumb.classList.toggle('active', i === activePhoto);
    thumb.addEventListener('click', () => {
      activePhoto = i;
      renderTray();
      statusLine.textContent = `Photo ${i + 1} picked — click a panel to place it.`;
    });
    tray.appendChild(thumb);
  });
}

async function addFiles(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (list.length === 0) {
    statusLine.textContent = 'That was not an image file — try a JPG or PNG.';
    return;
  }
  for (const file of list) {
    try {
      const img = await readImageFile(file);
      state.photos.push(img);
      activePhoto = state.photos.length - 1;
    } catch {
      statusLine.textContent = `Could not read ${file.name}.`;
    }
  }
  renderTray();
  repaint();
  statusLine.textContent = `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} loaded. Click a panel to place the picked one.`;
}

function placeActivePhoto(panelIndex) {
  if (state.photos.length === 0) return;
  state.panels[panelIndex] = { ...state.panels[panelIndex], photo: activePhoto, zoom: 1, dx: 0, dy: 0 };
  state.selected = panelIndex;
  syncZoomSlider();
  repaint();
}

function markChoice(rowId, attr, value) {
  document.querySelectorAll(`#${rowId} .choice`).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset[attr] === value);
  });
}

function canvasPoint(event) {
  const box = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * canvas.width,
    y: ((event.clientY - box.top) / box.height) * canvas.height,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  const p = canvasPoint(event);
  const hit = panelAt(state, canvas.width, canvas.height, p.x, p.y);
  if (hit < 0) return;
  if (state.photos.length > 0 && state.panels[hit].photo == null) {
    placeActivePhoto(hit);
    return;
  }
  state.selected = hit;
  syncZoomSlider();
  dragging = { panel: hit, lastX: p.x, lastY: p.y, moved: false };
  canvas.setPointerCapture(event.pointerId);
  repaint();
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const p = canvasPoint(event);
  const slot = state.panels[dragging.panel];
  if (!slot || slot.photo == null) return;
  slot.dx += (p.x - dragging.lastX) / canvas.width;
  slot.dy += (p.y - dragging.lastY) / canvas.height;
  slot.dx = Math.max(-0.6, Math.min(0.6, slot.dx));
  slot.dy = Math.max(-0.6, Math.min(0.6, slot.dy));
  dragging.lastX = p.x;
  dragging.lastY = p.y;
  dragging.moved = true;
  repaint();
});

canvas.addEventListener('pointerup', () => {
  if (dragging && !dragging.moved && state.photos.length > 0) {
    placeActivePhoto(dragging.panel);
  }
  dragging = null;
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const slot = state.panels[state.selected];
  if (!slot) return;
  const next = slot.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12);
  slot.zoom = Math.max(1, Math.min(3, next));
  syncZoomSlider();
  repaint();
}, { passive: false });

zoomRange.addEventListener('input', () => {
  const slot = state.panels[state.selected];
  if (!slot) return;
  slot.zoom = Number(zoomRange.value) / 100;
  repaint();
});

document.getElementById('photoInput').addEventListener('change', (event) => {
  addFiles(event.target.files);
  event.target.value = '';
});

const dropZone = document.getElementById('dropZone');
['dragover', 'dragenter'].forEach((name) => dropZone.addEventListener(name, (event) => {
  event.preventDefault();
  dropZone.classList.add('over');
}));
['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => {
  event.preventDefault();
  dropZone.classList.remove('over');
}));
dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));
canvas.addEventListener('dragover', (event) => event.preventDefault());
canvas.addEventListener('drop', (event) => {
  event.preventDefault();
  addFiles(event.dataTransfer.files);
});

async function loadSample(name) {
  const img = await readImageUrl(`samples/${name}.jpg`);
  state.photos.push(img);
  activePhoto = state.photos.length - 1;
  state.panels = state.panels.map(() => makePanelState(activePhoto));
  renderTray();
  repaint();
}

document.getElementById('sampleBoulevard').addEventListener('click', () => loadSample('boulevard'));
document.getElementById('samplePier').addEventListener('click', () => loadSample('pier'));
document.getElementById('fillAll').addEventListener('click', () => {
  if (state.photos.length === 0) {
    statusLine.textContent = 'Load a photo first — try a sample.';
    return;
  }
  state.panels = state.panels.map((slot) => ({ ...slot, photo: activePhoto }));
  repaint();
  statusLine.textContent = 'Every panel now shows the picked photo.';
});

document.getElementById('layoutRow').addEventListener('click', (event) => {
  const layout = event.target.dataset?.layout;
  if (!layout) return;
  state.layout = layout;
  markChoice('layoutRow', 'layout', layout);
  repaint();
});

document.getElementById('gradeRow').addEventListener('click', (event) => {
  const grade = event.target.dataset?.grade;
  if (!grade) return;
  state.grade = grade;
  markChoice('gradeRow', 'grade', grade);
  repaint();
});

document.getElementById('sizeRow').addEventListener('click', (event) => {
  const size = event.target.dataset?.size;
  if (!size) return;
  state.size = size;
  markChoice('sizeRow', 'size', size);
  applySize();
  statusLine.textContent = `Export size ${EXPORT_SIZES[size].label}.`;
});

titleInput.addEventListener('input', () => {
  state.title = titleInput.value;
  repaint();
});
taglineInput.addEventListener('input', () => {
  state.tagline = taglineInput.value;
  repaint();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const size = EXPORT_SIZES[state.size];
  canvas.toBlob((blob) => {
    if (!blob) {
      statusLine.textContent = 'Export failed — try again.';
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vice-cover-${size.width}x${size.height}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
    statusLine.textContent = `Saved vice-cover-${size.width}x${size.height}.png`;
  }, 'image/png');
});

// The studio's public hooks for fixed screenshot scenes.
export const studioApi = {
  state,
  repaint,
  applySize,
  loadSample,
  markChoice,
  renderTray,
  setCaption(title, tagline) {
    state.title = title;
    state.tagline = tagline;
    titleInput.value = title;
    taglineInput.value = tagline;
    repaint();
  },
  setLayout(layout) {
    state.layout = layout;
    markChoice('layoutRow', 'layout', layout);
    repaint();
  },
  setGrade(grade) {
    state.grade = grade;
    markChoice('gradeRow', 'grade', grade);
    repaint();
  },
  setSize(size) {
    state.size = size;
    markChoice('sizeRow', 'size', size);
    applySize();
  },
};

const query = new URLSearchParams(location.search);
if (query.get('shot')) {
  runShotScene(query, studioApi);
} else {
  renderTray();
  applySize();
}
