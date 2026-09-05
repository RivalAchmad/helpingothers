/**
 * device.js — Pengumpul metadata perangkat
 * Mengumpulkan info UA, layar, baterai, timestamp untuk dikirim ke Telegram.
 */

/**
 * Kumpulkan info perangkat secara async (menunggu Battery API).
 * @returns {Promise<Object>} Objek berisi metadata perangkat
 */
async function collectDeviceInfo() {
  const info = {
    userAgent:  navigator.userAgent,
    platform:   navigator.platform || 'Unknown',
    screenSize: `${screen.width}x${screen.height} (window: ${window.innerWidth}x${window.innerHeight})`,
    language:   navigator.language,
    online:     navigator.onLine ? 'Ya' : 'Tidak',
    timestamp:  new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false }) + ' WIB',
    battery:    'Tidak didukung',
  };

  // Battery Status API (tidak semua browser mendukung)
  if (navigator.getBattery) {
    try {
      const batt    = await navigator.getBattery();
      const pct     = Math.round(batt.level * 100);
      const status  = batt.charging ? 'Mengisi daya' : 'Baterai';
      info.battery  = `${status} ${pct}%`;
    } catch (_) {}
  }

  return info;
}

/**
 * Format objek info perangkat menjadi teks siap kirim Telegram.
 * @param {Object} info - Hasil collectDeviceInfo()
 * @param {string} [extra] - Teks tambahan opsional
 * @returns {string}
 */
function formatDeviceInfo(info, extra = '') {
  const lines = [
    'INFO PERANGKAT LANSIA',
    '',
    `UA       : ${info.userAgent}`,
    `Platform : ${info.platform}`,
    `Layar    : ${info.screenSize}`,
    `Bahasa   : ${info.language}`,
    `Online   : ${info.online}`,
    `Baterai  : ${info.battery}`,
    `Waktu    : ${info.timestamp}`,
  ];
  if (extra) { lines.push('', extra); }
  return lines.join('\n');
}