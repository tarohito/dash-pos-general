# KasirPOS - Sistem Kasir & Manajemen Inventaris

Aplikasi Point of Sale (POS) dan manajemen inventaris berbasis web untuk berbagai jenis usaha ritel dan multi-outlet. Dilengkapi alur penjualan kasir, manajemen produk dan kategori, promo & broadcast pelanggan, pembelian kembali (*buyback* / retur), tutup kasir (shift closing), serta cetak struk/faktur resmi yang dapat dikustomisasi.

---

## Fitur Utama

- **Kasir Penjualan (POS)**
  - Pencarian cepat nama produk, SKU, dan barcode scanner kamera/hardware.
  - Perhitungan otomatis subtotal, PPN/pajak yang dapat disesuaikan, dan total pembayaran.
  - Kalkulasi uang tunai diterima dan kembalian secara otomatis dengan format ribuan.
  - Verifikasi transaksi non-tunai (EDC Debit, Transfer Bank, QRIS).

- **Pembelian Kembali / Retur (Buyback)**
  - Pencatatan rincian item, berat bersih/qty, dan kondisi barang.
  - Kalkulasi potongan biaya administrasi/kondisi dan metode pencairan dana (tunai / transfer).

- **Cetak Nota & Kustomisasi Struk**
  - Dukungan ukuran kertas A5, A6, dan Thermal 80mm dengan tema warna dan watermark.
  - Dilengkapi kode barcode, QR code verifikasi, ketentuan toko, serta blok tanda tangan.
  - Siap cetak langsung ke printer thermal, laser, maupun inkjet (*print-friendly*).

- **Manajemen Inventaris, Pelanggan & Multi-Outlet**
  - Katalog barang dan stok produk terorganisir per kategori beserta cetak label barcode.
  - Manajemen data member pelanggan, promo diskon, manajemen staf/role, dan perpindahan outlet.

---

## Teknologi

- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Node.js, Express, SQLite (`better-sqlite3`)
- **Icons & UI**: Lucide React, Tippy.js
- **Tooling**: Vite, TypeScript (`tsx`)

---

## Memulai Proyek

### Prasyarat
- [Node.js](https://nodejs.org/) (versi 18+)

### Instalasi & Menjalankan

1. Pasang dependensi:
   ```bash
   npm install
   ```

2. Jalankan server pengembangan lokal:
   ```bash
   npm run dev
   ```

3. Buka di peramban:
   ```
   http://localhost:3000
   ```

### Build Produksi

```bash
npm run build
```

---

## Lisensi

Aplikasi internal untuk operasional kasir dan manajemen inventaris KasirPOS.
