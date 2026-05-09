# DRAK-GPT Composer Stable Fix

Perbaikan ini hanya menyentuh posisi composer/input dan stabilitas layout chat.

## Yang diperbaiki

- Root app memakai `100dvh` dan `overflow: hidden` agar halaman utama tidak ikut scroll.
- `messages-panel` menjadi area scroll utama.
- `input-shell` dibuat `position: fixed` di bawah viewport, bukan ikut alur konten chat.
- Tinggi composer dibaca via `ResizeObserver` dan disimpan ke CSS variable `--composer-height`.
- Saat keyboard mobile muncul, `visualViewport` dipakai untuk menjaga composer tetap terlihat tanpa bergantung pada tinggi isi chat.
- Command chip tetap satu baris dan bisa horizontal scroll di layar kecil.
- Textarea auto-resize tetap ada, tapi dibatasi `max-height`.
- Code block diberi horizontal scroll sendiri agar tidak mendorong layout melebar.

## File yang diubah

- `src/styles.css`
- `src/components/ChatInput.jsx`

Tidak ada dependency baru.
