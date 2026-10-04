/* Screen flow configuration. Change the artwork here without touching the engine. */
const ENTRY_CONFIG = Object.freeze({
  levelCount: 6,
  buttonArtwork: "assets/level-button-3d.png",
  minimumLoadingMs: 1800,
  logo: 'assets/logo.png',
  room: 'assets/room.png',
  loadingBackground: 'assets/loading-garden-v2.png',
  catArtwork: 'assets/calico-cat.png',
  lobbyProgress: Object.freeze({ value: 0, maximum: 6 }), // Display only; no game-state connection.
  lobbyCounters: Object.freeze({ heart: 5, diamond: 0, coin: 0 }), // Visual placeholders, not an economy.
  messages: ['Loading treats…', 'Untangling yarn…', 'Chasing mice…']
});

if (ENTRY_CONFIG.catArtwork) {
  document.querySelectorAll('.cat-art').forEach(function(slot) {
    const image = new Image();
    image.src = ENTRY_CONFIG.catArtwork;
    image.alt = slot.getAttribute('aria-label');
    slot.replaceChildren(image);
  });
}
const lobbyProgress = document.querySelector('.lobby-progress');
Object.entries(ENTRY_CONFIG.lobbyCounters).forEach(function([key, value]) {
  document.getElementById(key + 'Value').textContent = value;
});
const progressMaximum = Math.max(1, ENTRY_CONFIG.lobbyProgress.maximum);
const progressValue = Math.max(0, Math.min(progressMaximum, ENTRY_CONFIG.lobbyProgress.value));
lobbyProgress.setAttribute('aria-valuemax', progressMaximum);
lobbyProgress.setAttribute('aria-valuenow', progressValue);
lobbyProgress.querySelector('.lobby-progress-label').textContent = progressValue + '/' + progressMaximum;
lobbyProgress.querySelector('.lobby-progress-fill').style.width = (progressValue / progressMaximum * 100) + '%';
function lobbyLevelIndex() {
  const saved = Number.parseInt(localStorage.getItem('fm_maxlevel') || '0', 10);
  return Math.max(0, Math.min(ENTRY_CONFIG.levelCount - 1, Number.isFinite(saved) ? saved : 0));
}
function allAvailableLevelsComplete() {
  return Boolean(levelProgress[ENTRY_CONFIG.levelCount - 1]?.stars);
}
function refreshLobbyLevel() {
  const button = document.getElementById('levelButton');
  const complete = allAvailableLevelsComplete();
  button.disabled = complete;
  button.classList.toggle('coming-soon', complete);
  if (complete) button.textContent = 'Coming Soon';
  else {
    button.replaceChildren(document.createTextNode('Level '));
    const number = document.createElement('span');
    number.id = 'lobbyLevel';
    number.textContent = lobbyLevelIndex() + 1;
    button.appendChild(number);
  }
}
refreshLobbyLevel();
document.getElementById('levelButton').onclick = function() {
  if (document.body.dataset.state !== 'LOBBY' || busy || allAvailableLevelsComplete()) return;
  initAudio();
  startLevel(lobbyLevelIndex());
};
document.getElementById('gameLobbyBtn').onclick = function() {
  // Let an in-flight swap/cascade finish before leaving or rebuilding the board.
  if (busy) return;
  drag = null;
  clearSelection();
  showScreen('lobby');
};
document.getElementById('endMenuBtn').onclick = function() { showScreen('lobby'); };
document.getElementById('endCloseBtn').onclick = function() { showScreen('lobby'); };
document.addEventListener('keydown', function(event) {
  if (document.body.dataset.screen !== 'endScreen') return;
  if (event.key === 'Escape') showScreen('lobby');
  if (event.key === 'Tab') {
    const buttons = Array.from(document.querySelectorAll('#endScreen button'));
    const current = buttons.indexOf(document.activeElement);
    const next = (current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next].focus();
  }
});
document.addEventListener('touchmove', function(event) { event.preventDefault(); }, { passive: false });

async function bootEntryScreens() {
  showScreen('loading');
  const started = performance.now();
  const progress = document.getElementById('loadingProgress');
  const fill = document.getElementById('loadingFill');
  const message = document.getElementById('loadingMessage');
  const urls = [...new Set([ENTRY_CONFIG.logo, ENTRY_CONFIG.room, ENTRY_CONFIG.loadingBackground, ENTRY_CONFIG.catArtwork,
    ENTRY_CONFIG.buttonArtwork, ...Object.values(SPECIAL_ART), ...ICONS, ...Array.from(document.images, image => image.src)].filter(Boolean))];
  let ready = 0;
  const update = setInterval(function() {
    const elapsed = performance.now() - started;
    // Progress reaches 100 only after BOTH assets and minimum presentation time.
    const value = Math.floor(Math.min(ready / urls.length, elapsed / ENTRY_CONFIG.minimumLoadingMs) * 100);
    fill.style.width = value + '%';
    progress.setAttribute('aria-valuenow', value);
    const text = ENTRY_CONFIG.messages[Math.floor(elapsed / 650) % ENTRY_CONFIG.messages.length];
    if (message.textContent !== text) message.textContent = text;
  }, 80);
  try {
    await Promise.all(urls.map(async function(url) {
      const image = new Image();
      image.src = url;
      await image.decode();
      ready++;
    }));
    await sleep(Math.max(0, ENTRY_CONFIG.minimumLoadingMs - (performance.now() - started)));
    fill.style.width = '100%';
    progress.setAttribute('aria-valuenow', '100');
    await sleep(200);
    showScreen('lobby');
  } catch (error) {
    message.textContent = 'Couldn’t load the artwork. Please reload.';
    console.error('FurrMatch asset preload failed:', error);
  } finally {
    clearInterval(update);
  }
}
bootEntryScreens();
