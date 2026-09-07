/**
 * config.js — Konfigurasi Aplikasi
 *
 * CATATAN KEAMANAN:
 * TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID telah dipindahkan ke
 * Vercel Environment Variables. Token tidak lagi disimpan di sini
 * agar tidak terekspos ke browser atau GitHub.
 *
 * Cara set token: Vercel Dashboard → Project → Settings → Environment Variables
 *   - TELEGRAM_BOT_TOKEN = (token dari @BotFather)
 *   - TELEGRAM_CHAT_ID   = (chat ID tujuan)
 */
const CONFIG = {
  /** Durasi rekaman video konfirmasi obat (detik) */
  VIDEO_DURATION_SEC: 5,
};