// Vice Cover Studio — the cover engine.
//
// A cover is four photo panels arranged by a layout, washed in one colour
// grade, dressed with a painted sun, a skyline and palm silhouettes, and
// finished with a heavy outlined title and a tagline. Everything is drawn on
// one 2D canvas, deterministically: the grain uses a fixed-seed generator, so
// the same state always paints the same pixels.

export const EXPORT_SIZES = {
  square: { width: 1080, height: 1080, label: '1080 × 1080' },
  portrait: { width: 1080, height: 1350, label: '1080 × 1350' },
  wide: { width: 1920, height: 1080, label: '1920 × 1080' },
};

export const GRADES = {
  sunset: {
    washTop: 'rgba(255, 122, 47, 0.10)',
    washBottom: 'rgba(214, 32, 120, 0.42)',
    accent: '#ff2e88',
    accent2: '#ffc44d',
    sky: ['#ffd76e', '#ff7a2f', '#e01e7a', '#5b1b8a'],
    photoFilter: 'saturate(1.18) contrast(1.04)',
  },
  neon: {
    washTop: 'rgba(46, 230, 255, 0.16)',
    washBottom: 'rgba(255, 46, 200, 0.46)',
    accent: '#2ee6ff',
    accent2: '#ff2ed1',
    sky: ['#2ee6ff', '#7b2fff', '#ff2ed1', '#120a2e'],
    photoFilter: 'saturate(1.45) contrast(1.08)',
  },
  midnight: {
    washTop: 'rgba(90, 120, 255, 0.14)',
    washBottom: 'rgba(10, 8, 40, 0.55)',
    accent: '#8fb0ff',
    accent2: '#ffd76e',
    sky: ['#8fb0ff', '#3d2a8a', '#160f38', '#0a0620'],
    photoFilter: 'saturate(0.9) contrast(1.06) brightness(0.96)',
  },
};

// Panel rectangles as fractions of the cover [x, y, w, h]. Panel 0 is the
// hero; panels 1..3 are the supporting shots.
export const LAYOUTS = {
  grid: [
    [0, 0, 1, 0.58],
    [0, 0.58, 1 / 3, 0.42],
    [1 / 3, 0.58, 1 / 3, 0.42],
    [2 / 3, 0.58, 1 / 3, 0.42],
  ],
  strip: [
    [0, 0, 1, 1],
    [0.05, 0.66, 0.28, 0.26],
    [0.36, 0.66, 0.28, 0.26],
    [0.67, 0.66, 0.28, 0.26],
  ],
  stack: [
    [0, 0, 0.6, 1],
    [0.6, 0, 0.4, 1 / 3],
    [0.6, 1 / 3, 0.4, 1 / 3],
    [0.6, 2 / 3, 0.4, 1 / 3],
  ],
};

export const GUTTER = 0.008; // white gap between panels, as a fraction of width

export function makePanelState(photoIndex) {
  return { photo: photoIndex, zoom: 1, dx: 0, dy: 0 };
}

export function freshState() {
  return {
    layout: 'grid',
    grade: 'sunset',
    size: 'portrait',
    title: 'Sunset Heist',
    tagline: 'One last score under a burning sky',
    photos: [],
    panels: [makePanelState(0), makePanelState(0), makePanelState(0), makePanelState(0)],
    selected: 0,
  };
}

export function layoutRects(layout, width, height) {
  return LAYOUTS[layout].map(([fx, fy, fw, fh]) => ({
    x: fx * width,
    y: fy * height,
    w: fw * width,
    h: fh * height,
  }));
}

// A tiny deterministic generator, so the grain never changes between runs.
function seededStream(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function paintPhotoInto(ctx, img, rect, panel, filter) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (!img) {
    const shade = ctx.createLinearGradient(x, y, x + w, y + h);
    shade.addColorStop(0, '#3a2350');
    shade.addColorStop(1, '#180d26');
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 ${Math.round(h * 0.055)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('ADD A PHOTO', x + w / 2, y + h / 2);
    ctx.restore();
    return;
  }
  const base = Math.max(w / img.naturalWidth, h / img.naturalHeight) * panel.zoom;
  const dw = img.naturalWidth * base;
  const dh = img.naturalHeight * base;
  const dx = x + (w - dw) / 2 + panel.dx * w;
  const dy = y + (h - dh) / 2 + panel.dy * h;
  if (filter) ctx.filter = filter;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
}

function paintSun(ctx, cx, cy, r, grade) {
  const glow = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 2.1);
  glow.addColorStop(0, 'rgba(255, 214, 110, 0.85)');
  glow.addColorStop(0.45, 'rgba(255, 122, 47, 0.35)');
  glow.addColorStop(1, 'rgba(255, 122, 47, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2.1, cy - r * 2.1, r * 4.2, r * 4.2);
  const disc = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  disc.addColorStop(0, grade.sky[0]);
  disc.addColorStop(0.55, grade.sky[1]);
  disc.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Sun rays, short dashes ringing the whole disc.
  ctx.strokeStyle = 'rgba(255, 214, 110, 0.55)';
  ctx.lineWidth = Math.max(2, r * 0.04);
  for (let i = 0; i < 16; i += 1) {
    const a = (Math.PI * 2 * i) / 16;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 1.18, cy + Math.sin(a) * r * 1.18);
    ctx.lineTo(cx + Math.cos(a) * r * 1.48, cy + Math.sin(a) * r * 1.48);
    ctx.stroke();
  }
}

function paintSkyline(ctx, x, baseY, w, h, alpha) {
  ctx.fillStyle = `rgba(8, 4, 18, ${alpha})`;
  const next = seededStream(77);
  let px = x;
  while (px < x + w) {
    const bw = w * (0.05 + next() * 0.07);
    const bh = h * (0.25 + next() * 0.6);
    ctx.fillRect(px, baseY - bh, bw, bh);
    if (next() > 0.72) {
      ctx.fillRect(px + bw * 0.3, baseY - bh - h * 0.14, bw * 0.14, h * 0.14);
    }
    px += bw + w * 0.012;
  }
}

function paintPalm(ctx, x, y, size, lean, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(size, size);
  ctx.strokeStyle = `rgba(8, 4, 18, ${alpha})`;
  ctx.fillStyle = `rgba(8, 4, 18, ${alpha})`;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  // A gently leaning trunk.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(10, -60, 4, -118);
  ctx.stroke();
  // Six fronds: each arcs up from the crown, then droops down past it,
  // fanning left and right like a real palm crown.
  for (let i = 0; i < 6; i += 1) {
    const t = i / 5;
    const spread = Math.PI * (0.92 - t * 0.84);
    const tipX = Math.cos(spread) * 78;
    const tipY = -118 + Math.sin(spread) * 46 + 26;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(4, -118);
    ctx.quadraticCurveTo(4 + tipX * 0.5, -118 - 34, 4 + tipX, tipY);
    ctx.stroke();
  }
  ctx.restore();
}

function paintTitleBlock(ctx, state, grade, width, height, zone) {
  const { x, y, w, h } = zone;
  const title = state.title.trim().toUpperCase();
  const tag = state.tagline.trim();
  if (!title && !tag) return;
  // A dark ribbon so the lettering reads over any photo.
  const ribbon = ctx.createLinearGradient(x, y, x, y + h);
  ribbon.addColorStop(0, 'rgba(10, 4, 20, 0)');
  ribbon.addColorStop(0.35, 'rgba(10, 4, 20, 0.62)');
  ribbon.addColorStop(1, 'rgba(10, 4, 20, 0.82)');
  ctx.fillStyle = ribbon;
  ctx.fillRect(x, y, w, h);
  let cursorY = y + h * 0.30;
  if (tag) {
    const tagSize = Math.max(14, height * 0.016);
    ctx.font = `700 ${tagSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = grade.accent2;
    const tw = ctx.measureText(tag.toUpperCase()).width;
    const gap = Math.min(w * 0.08, 70);
    ctx.fillText('—', x + w / 2 - tw / 2 - gap * 0.55, cursorY);
    ctx.fillText('—', x + w / 2 + tw / 2 + gap * 0.55, cursorY);
    ctx.fillText(tag.toUpperCase(), x + w / 2, cursorY);
    cursorY += h * 0.16;
  }
  if (title) {
    let size = height * 0.085;
    const family = `'Arial Black', 'Segoe UI', system-ui, sans-serif`;
    ctx.font = `900 italic ${size}px ${family}`;
    while (ctx.measureText(title).width > w * 0.92 && size > 18) {
      size -= 3;
      ctx.font = `900 italic ${size}px ${family}`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const cy = cursorY + size * 0.72;
    // Neon echo, then a hard black outline, then the white face.
    ctx.fillStyle = grade.accent;
    ctx.fillText(title, x + w / 2 + size * 0.055, cy + size * 0.055);
    ctx.lineWidth = Math.max(3, size * 0.14);
    ctx.strokeStyle = '#0a0414';
    ctx.lineJoin = 'round';
    ctx.strokeText(title, x + w / 2, cy);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, x + w / 2, cy);
    // A thin accent underline under the title.
    const tw = ctx.measureText(title).width;
    ctx.fillStyle = grade.accent;
    ctx.fillRect(x + (w - tw) / 2, cy + size * 0.22, tw, Math.max(3, size * 0.05));
  }
}

function paintGrain(ctx, width, height) {
  const next = seededStream(20261119);
  const dots = Math.floor((width * height) / 1400);
  for (let i = 0; i < dots; i += 1) {
    const px = next() * width;
    const py = next() * height;
    ctx.fillStyle = next() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(px, py, 1.6, 1.6);
  }
}

function paintVignette(ctx, width, height) {
  const g = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.42,
    width / 2, height / 2, Math.max(width, height) * 0.78,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(5,2,12,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

// Title zones per layout: where the caption block sits.
function titleZone(layout, width, height) {
  if (layout === 'strip') return { x: 0, y: height * 0.04, w: width, h: height * 0.30 };
  if (layout === 'stack') return { x: 0, y: height * 0.68, w: width * 0.6, h: height * 0.30 };
  return { x: 0, y: height * 0.70, w: width, h: height * 0.28 };
}

export function panelAt(state, width, height, px, py) {
  const rects = layoutRects(state.layout, width, height);
  for (let i = rects.length - 1; i >= 0; i -= 1) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

// Paints the whole cover for `state` onto `canvas` at its own pixel size.
export function drawCoverArt(canvas, state) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const rects = layoutRects(state.layout, width, height);
  const gutter = GUTTER * width;

  ctx.fillStyle = '#f7f2fa';
  ctx.fillRect(0, 0, width, height);

  rects.forEach((rect, i) => {
    const inner = {
      x: rect.x + (i === 0 || state.layout === 'grid' ? gutter / 2 : 0),
      y: rect.y + gutter / 2,
      w: rect.w - gutter,
      h: rect.h - gutter,
    };
    if (state.layout === 'strip' && i > 0) {
      inner.x = rect.x;
      inner.y = rect.y;
      inner.w = rect.w;
      inner.h = rect.h;
    }
    const slot = state.panels[i] ?? makePanelState(0);
    const img = slot.photo == null ? null : state.photos[slot.photo] ?? null;
    paintPhotoInto(ctx, img, inner, slot, grade.photoFilter);
    // Grade wash over each panel.
    const wash = ctx.createLinearGradient(inner.x, inner.y, inner.x, inner.y + inner.h);
    wash.addColorStop(0, grade.washTop);
    wash.addColorStop(1, grade.washBottom);
    ctx.fillStyle = wash;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    // White frame + thin dark edge, and a gold ring on the selected panel.
    ctx.lineWidth = Math.max(2, width * 0.004);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
    if (i === state.selected) {
      ctx.lineWidth = Math.max(3, width * 0.006);
      ctx.strokeStyle = grade.accent2;
      ctx.strokeRect(inner.x + 2, inner.y + 2, inner.w - 4, inner.h - 4);
    }
  });

  // Painted scenery over the hero panel: sun, skyline, palms.
  const hero = rects[0];
  const sunR = Math.min(hero.w, hero.h) * 0.13;
  // In the strip layout the title ribbon covers the top third, so the sun
  // sits lower, in the open sky between the title and the photo strip.
  const sunY = state.layout === 'strip' ? hero.y + hero.h * 0.50 : hero.y + hero.h * 0.30;
  paintSun(ctx, hero.x + hero.w * 0.78, sunY, sunR, grade);
  paintSkyline(ctx, hero.x + gutter, hero.y + hero.h - gutter, hero.w - gutter * 2, hero.h * 0.16, 0.85);
  paintPalm(ctx, hero.x + hero.w * 0.07, hero.y + hero.h - gutter, Math.min(hero.w, hero.h) * 0.0019, -0.10, 0.9);
  paintPalm(ctx, hero.x + hero.w * 0.93, hero.y + hero.h - gutter, Math.min(hero.w, hero.h) * 0.0016, 0.12, 0.85);

  paintTitleBlock(ctx, state, grade, width, height, titleZone(state.layout, width, height));

  // A small corner badge, hand-drawn, no borrowed marks.
  const badgeR = Math.max(20, width * 0.032);
  const bx = width - badgeR * 1.6;
  const by = badgeR * 1.6;
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(-0.12);
  ctx.fillStyle = grade.accent;
  ctx.beginPath();
  ctx.arc(0, 0, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, badgeR * 0.08);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${badgeR * 0.52}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', 0, badgeR * 0.04);
  ctx.restore();

  paintGrain(ctx, width, height);
  paintVignette(ctx, width, height);

  // Outer poster frame.
  ctx.lineWidth = Math.max(4, width * 0.008);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(0, 0, width, height);
}
