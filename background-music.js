export function initBackgroundMusic() {
  const audio = document.getElementById('background-music');
  const button = document.getElementById('music-toggle');
  const preferenceKey = 'sportszone-music-enabled';
  let enabled = true;
  let pending = false;
  try { enabled = localStorage.getItem(preferenceKey) !== 'false'; } catch { /* Storage is optional. */ }

  audio.volume = .3;
  button.hidden = false;
  const events = new AbortController();
  const gestures = new AbortController();
  function updateControl() {
    const playing = !audio.paused && !audio.muted;
    button.textContent = playing ? 'Music on' : 'Music off';
    button.setAttribute('aria-label', playing ? 'Mute background music' : 'Play background music');
    button.title = playing ? 'Mute background music' : 'Play background music';
  }
  function rememberPreference() {
    try { localStorage.setItem(preferenceKey, String(enabled)); } catch { /* Private browsing can disable storage. */ }
  }
  async function play() {
    if (!enabled || pending) return;
    pending = true;
    try {
      await audio.play();
      if (!enabled) audio.pause();
      else gestures.abort();
    } catch (error) {
      // Audible autoplay can be denied. A real user gesture retries playback.
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        gestures.abort();
        button.textContent = 'Music unavailable';
        button.setAttribute('aria-label', 'Background music unavailable');
        button.disabled = true;
        return;
      }
    } finally {
      pending = false;
    }
    updateControl();
  }
  function retryFromGesture(event) {
    if (button.contains(event.target)) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    void play();
  }
  document.addEventListener('click', retryFromGesture, { signal: gestures.signal });
  document.addEventListener('keydown', retryFromGesture, { signal: gestures.signal });
  button.addEventListener('click', () => {
    gestures.abort();
    if (!audio.paused || pending) {
      enabled = false;
      audio.pause();
      updateControl();
    } else {
      enabled = true;
      void play();
    }
    rememberPreference();
  }, { signal: events.signal });
  ['playing', 'pause', 'volumechange'].forEach(name => audio.addEventListener(name, updateControl, { signal: events.signal }));
  updateControl();
  if (enabled) void play();
  else gestures.abort();

  if (import.meta.hot) import.meta.hot.dispose(() => {
    enabled = false;
    events.abort();
    gestures.abort();
    audio.pause();
  });
}
