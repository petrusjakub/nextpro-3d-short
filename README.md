# NextPro 3D Short — Manulife NextPro (vertical, Bahasa Indonesia)

Video short 3D vertikal tentang NextPro: Raka, karyawan yang gajinya habis
tiap bulan, jadi partner agen NextPro Manulife — penghasilan tambahan sambil
membantu keluarga terproteksi. Naskah orisinal, fakta terverifikasi di
`SCRIPT.md`. CTA end card: pastijaga.biz.id + WA 0877-8189-6087.

## File final

- `NextProShort.mp4` — **540x960, 30 fps, 67,5 dtk, h264 + AAC** (narasi 66,1 dtk) — v1 (visual kerumunan townsfolk)
- `NextProShort-v2.mp4` — **540x960, 30 fps, 67,5 dtk, 2025 frame, h264 + AAC, 19 MB** — v2 (25 Nov 2026, revisi atas komplain user): hero Raka konsisten (jaket teal, rambut hitam) di semua beat, subtitle burned-in dari `voice/words.json` (23 cue, maks 2 baris), teks brand di spot berbeda (@pasti.jaga f30–300, pastijaga.biz.id f824–1094 + kartu 3 jalur, WA 087781896087 f1633–1875), adegan malam baru (preset `night`), end card 5 dtk dipertahankan (kini opaque penuh). QA: `scripts/short_qa.py` → black [], white tak terencana [], frozen ≥12f [], loudness −25,5 LUFS; laporan di `out/v2/qa/report.md`. Render 5 chunk `out/v2/part1–5.mp4` (22 menit/chunk, total ~1 jam 52 menit), skrip `scripts/render_v2.sh`.
- `SCRIPT.md` — naskah + fakta terverifikasi + sumber
- `voice/` — narasi TTS suara 7 (`avocado_v2:vg_id_m44`), `words.json`, transkrip
- `qa/` — hasil `scripts/short_qa.py` (contact sheet + laporan)

## Cara render ulang

Proyek Remotion 4.0.547 + three.js (React Three Fiber). Komposisi
`NextProShort` (1080x1920, 30 fps, 2025 frame) di `src/Root.tsx`.

```console
npm ci            # atau pakai node_modules yang sudah ada
# render per chunk (hemat memori, tahan reboot VM), scale 0.5 = 540x960:
FRAMES=0-404 CONCURRENCY=1 MUTED=1 node scripts/render.mjs out/full/part1.mp4 0.5
# ... lanjutkan chunk sampai frame 2024, lalu gabung + mux narasi:
ffmpeg -f concat -safe 0 -i out/full/concat.txt -i voice/narration.mp3 \
  -map 0:v:0 -map 1:a:0 -vf eq=saturation=1.08 -c:v libx264 -crf 20 \
  -c:a aac -b:a 128k -movflags +faststart NextProShort.mp4
```

`scripts/stills.mjs` untuk cek look per frame sebelum render.

## Catatan build (jujur)

- Render penuh 1080x1920 di VM ini ~8 jam (SwiftShader, CPU 1,5 core);
  versi final dirender 540x960 (scale 0.5) dalam 8 chunk — total ~6 jam
  render, diselingi 3x reboot VM (chunk yang kena reboot diulang).
- Rantai post-processing (ink / DOF / bloom / grade) dari template bridge
  tidak jalan di VM ini (EffectComposer = canvas kosong di SwiftShader),
  jadi di-bypass; grade ringan (saturasi 1.08) diterapkan di ffmpeg.
- Shadow map dimatikan (hemat ~10% waktu); bayangan kontak blob tetap ada.
- File GLB kit Kenney tidak ada di paket skill — `loadKit()` gagal 404 dan
  dilompati (pohon/semak/gerobak dari kit tidak muncul).
- Audio hanya narasi (voice-only); musik/SFX belum dibuat.
- Visual memakai kerumunan townsfolk (bukan satu tokoh hero Raka) dan
  ayunan taman golden-hour sebagai gambaran analogi "keran kedua".
- Nomor WA di narasi sudah diverifikasi benar (faster-whisper large-v3
  pada klip ekor): 0877-8189-6087.
- TIDAK diposting ke mana pun (tidak ada koneksi posting di akun ini).

## Struktur

- `src/videos/nextpro/` — komponen 3D + adaptasi cerita NextPro
  (`story.ts`, `cast.ts`, `world.ts`, `NextPro.tsx`)
- `src/Root.tsx` — registrasi komposisi `NextProShort`
- `scripts/` — `render.mjs`, `stills.mjs`, `short_qa.py`, dll.
- `public/voice/narration.mp3` — salinan narasi untuk komposisi
- `out/` — stills, video tes, dan 8 chunk render final
