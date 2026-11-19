// Fixed scenes for screenshots, driven by the URL so every capture is
// reproducible: ?shot=cover&photo=pier&caption=Sunset%20Heist draws the
// finished cover alone; ?shot=editor shows the studio with a photo loaded.
// Optional extras: grade=sunset|neon|midnight, layout=grid|strip|stack,
// size=square|portrait|wide, tagline=.... window.__shotReady flips true
// once the scene has painted twice, so a screenshot tool can wait on it.
export async function runShotScene(query, studio) {
  const shot = query.get('shot');
  const sample = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const tagline = query.get('tagline') ?? 'One last score under a burning sky';
  const grade = query.get('grade');
  const layout = query.get('layout');
  const size = query.get('size');

  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (size) studio.setSize(size);
  if (layout) studio.setLayout(layout);
  if (grade) studio.setGrade(grade);
  studio.setCaption(caption, tagline);
  try {
    await studio.loadSample(sample);
  } catch {
    // A missing sample still leaves a painted cover behind.
  }
  if (query.get('photo2')) {
    try {
      await studio.loadSample(query.get('photo2'));
      // Mix the two photos across the panels: hero keeps the first photo,
      // the supporting panels alternate, like a poster cast.
      studio.state.panels[0] = { ...studio.state.panels[0], photo: 0 };
      studio.state.panels[1] = { ...studio.state.panels[1], photo: 1 };
      studio.state.panels[2] = { ...studio.state.panels[2], photo: 0 };
      studio.state.panels[3] = { ...studio.state.panels[3], photo: 1 };
    } catch {
      // Keep the single-photo cover.
    }
  }
  studio.repaint();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
