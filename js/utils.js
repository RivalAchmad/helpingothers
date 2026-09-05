/**
 * utils.js — Helper & utilitas umum
 * Berisi: DOM query, screen switcher, media cleanup, jam real-time.
 */

/** Shortcut querySelector by ID */
const $ = id => document.getElementById(id);

/**
 * Tampilkan screen tertentu, sembunyikan yang lain.
 * @param {string} id - ID elemen section screen
 */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

/** Kembali ke halaman utama dan bersihkan semua resource */
function goHome() {
  clearTimeout(state.autoResetTimer);
  stopAllMedia();
  showScreen('screen-main');
}

/**
 * Hentikan semua track kamera/audio dan reset state media.
 * Dipanggil setelah rekaman selesai atau dibatalkan.
 */
function stopAllMedia() {
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(t => t.stop());
    state.mediaStream = null;
  }
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    try { state.mediaRecorder.stop(); } catch (_) {}
    state.mediaRecorder = null;
  }
  clearInterval(state.countdownTimer);
  state.countdownTimer = null;
  state.isCancelled    = false;
  state.recordedChunks = [];
}

/** Update jam real-time WIB di halaman utama */
function updateClock() {
  const opts = {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Jakarta',
  };
  $('current-time').textContent = new Date().toLocaleString('id-ID', opts) + ' WIB';
}