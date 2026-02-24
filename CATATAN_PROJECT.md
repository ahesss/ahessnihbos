# Catatan Project: XT Pro Auto-Registration Bot (ahessnihbos)
**Terakhir Diperbarui:** 24 Februari 2026

## Deskripsi Project
Ini adalah aplikasi web untuk melakukan auto-registrasi akun web XT Pro menggunakan email *dot-trick* dari Gmail. Aplikasi dibuat dengan React (Vite) di frontend (`Index.tsx`) dan Node.js/Express di backend (`server.js`).

## Fitur Utama yang Sudah Selesai:
1. **Pendeteksi IP Klien Asli:** URL fetch ke `api.ipify.org` di klien, untuk mengatasi limitasi IP server (Railway/VPS).
2. **Eksekusi API di Klien (Bypass CORS):** Semua API XT (Fetch Captcha, Validate, Send OTP, Reg, Apply Event, Lucky Draw) dieksekusi langsung dari browser user meminjam ekstensi "Allow CORS" (Kiwi Browser).
3. **IMAP OTP Otomatis:** Menarik OTP XT Pro dari Gmail menggunakan Node.js backend (`imapflow`), dibantu App Password.
4. **Enkripsi RSA:** Mengenkripsi password user ke public key XT melalui helper backend `/api/encrypt`.
5. **Anti-Duplikat Email:** Local storage browser (`xt_used_emails`) mengingat akun yang sukses agar tidak digenerate ulang oleh sistem dot-trick.
6. **Multi-Profil Konfigurasi:** Mampu menyimpan banyak kombinasi Gmail, Pass XT, App Pass, dan Referral Code secara tak terbatas (`xt_saved_configs`). Dilengkapi fitur "Eye Toggle" untuk melihat App Pass.
7. **Auto-Save & Auto-Queue (Batch Processing):** Sistem batch antrean otomatis yang akan lanjut ke akun pending berikutnya setiap 2 detik setelah selesai (sukses/gagal). Tidak perlu klik manual berulang kali.
8. **Auto-Join Event & Draw List:** Segera setelah register sukses (`/uaapi/user/v2/reg`), bot langsung mengirim request ke `/acapi/general/activity/apply` dan lucky draw.

## Deployment:
- **Repo:** GitHub (`ahesss/ahessnihbos`)
- **Hosting:** Railway (Auto deploy ketika file ditaruh ke GitHub API)

## Cara Melanjutkan (Prompt untuk AI):
Jika ingin melanjutkan project ini di sesi/percakapan baru, cukup beritahu AI:
> "Tolong lanjutkan project XT Register Bot (ahessnihbos). Baca CATATAN_PROJECT.md dan ingat riwayat kita sebelumnya."
