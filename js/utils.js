/**
 * utils.js — Helper & utilitas umum
 */

/** Shortcut querySelector by ID */
const $ = id => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

function goHome() {
  clearTimeout(state.autoResetTimer);
  stopAllMedia();
  showScreen('screen-main');
}

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

function updateClock() {
  const opts = {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Jakarta',
  };
  $('current-time').textContent = new Date().toLocaleString('id-ID', opts) + ' WIB';
}

/**
 * Inisialisasi penyadap tombol Back hardware.
 * Mencegah web tertutup saat user menekan Back di luar screen-main.
 * Harus dipanggil sekali di DOMContentLoaded.
 */
function initBackHandler() {
  history.pushState({ lansiaApp: true }, '');
  window.addEventListener('popstate', () => {
    history.pushState({ lansiaApp: true }, '');
    _handleBackPress();
  });
}

/** Logika internal: apa yang dilakukan saat Back ditekan */
function _handleBackPress() {
  const activeScreen = document.querySelector('.screen.active');
  if (!activeScreen || activeScreen.id === 'screen-main') return;

  const id = activeScreen.id;

  // ── Layar Kamera (Obat) ──
  if (id === 'screen-camera') {
    const cameraPhase = document.getElementById('med-camera-phase');
    const isRecording = cameraPhase && cameraPhase.style.display !== 'none';

    if (isRecording && state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      // Hentikan rekaman → onstop akan fire → handleVideoReady kirim video seadanya
      // Tandai agar handleVideoReady TIDAK tampilkan layar analisis
      state.backPressedDuringRecording = true;
      state.isCancelled = false; // pastikan video tetap dikirim
      state.mediaRecorder.stop();
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    } else {
      // Belum rekam, bersihkan saja
      state.backPressedDuringRecording = false;
      stopAllMedia();
    }
    // Kembali ke layar awal minum obat
    startMedication(null);
    return;
  }

  // ── Layar Lokasi ──
  if (id === 'screen-prep-lokasi') {
    // Tandai agar callback GPS diabaikan jika masih pending
    state.locCancelled = true;
    startLocation(null);
    return;
  }

  // ── Layar lain (result, analysis, medicine-list) ──
  goHome();
}