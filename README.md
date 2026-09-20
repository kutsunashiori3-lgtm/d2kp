# Face Recognition Pegawai (Sistem Presensi & Pengenalan Wajah Lokal)

Aplikasi web pengenalan wajah pegawai berbasis biometrik lokal yang menghubungkan database foto berkas dengan data kepegawaian Excel menggunakan primary key **Nomor Induk / NIP**.

---

## 🚀 Fitur Utama
1. **100% Offline & Lokal (IndexedDB)**: Foto dan vektor embedding biometrik 128-d diproses dan disimpan langsung di browser pengguna tanpa pengiriman ke cloud.
2. **Import Excel Otomatis**: Membaca file `.xlsx` / `.xls` dengan proteksi pembacaan string murni agar Nomor Induk/NIP tidak terpotong atau terkonversi ke notasi ilmiah (`1.98E+17`).
3. **Import Folder Foto**: Membaca folder foto pegawai (`webkitdirectory`), nama file foto otomatis dijadikan Nomor Induk (`198701012010011001.jpg` -> `198701012010011001`).
4. **Halaman Validasi Database**: Mendeteksi kelengkapan relasi foto vs data Excel secara visual.
5. **Real-time Live Recognition**: Pencocokan wajah otomatis melalui webcam dengan stabilisasi temporal (*multi-frame confirmation*) untuk mencegah *false positive*.
6. **Riwayat Presensi & Ekspor**: Pencatatan log kehadiran otomatis dengan fitur unduh rekap ke file Excel.

---

## 📦 Cara Ekspor Project dari Google AI Studio

1. Di pojok kanan atas layar Google AI Studio, klik menu **Settings / Opsi (ikon titik tiga atau gerigi)**.
2. Pilih:
   - **Download as ZIP**: Untuk mengunduh seluruh source code ke komputer Anda.
   - **Export to GitHub**: Untuk menyinkronkan repositori langsung ke akun GitHub Anda.

---

## 🛠️ Persyaratan Server
- **Node.js**: Versi 18 atau lebih baru.
- **NPM** atau **Yarn** / **PNPM**.
- **Protokol HTTPS / Localhost (PENTING)**: Browser modern (Chrome, Edge, Firefox, Safari) **hanya mengizinkan akses kamera (`getUserMedia`) pada origin yang aman**:
  - `http://localhost:3000` (atau `http://127.0.0.1`)
  - Atau menggunakan domain ber-**HTTPS** jika diakses dari perangkat / komputer lain dalam jaringan LAN/kantor.

---

## 💻 Panduan Instalasi & Menjalankan di Server

### Opsi 1: Mode Production (Rekomendasi Nginx / Static Web Server)

1. **Ekstrak file project** di server Anda:
   ```bash
   cd face-recognition-pegawai
   ```

2. **Install dependensi**:
   ```bash
   npm install
   ```

3. **Build aplikasi ke static bundle**:
   ```bash
   npm run build
   ```
   Folder `dist/` akan terbentuk dengan file HTML, JS, CSS, dan model AI wajah di dalamnya.

4. **Serve menggunakan Nginx**:
   Contoh konfigurasi Nginx (`/etc/nginx/sites-available/face-recognition`):
   ```nginx
   server {
       listen 80;
       server_name absensi.kantor.local;
       return 301 https://$host$request_uri; # Wajib HTTPS untuk izin kamera
   }

   server {
       listen 443 ssl;
       server_name absensi.kantor.local;

       ssl_certificate /path/to/certificate.crt;
       ssl_certificate_key /path/to/private.key;

       root /var/www/face-recognition-pegawai/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

---

### Opsi 2: Menggunakan Node.js / PM2 di Server

1. Install dependensi dan jalankan build:
   ```bash
   npm install
   npm run build
   ```

2. Jalankan server preview lokal:
   ```bash
   npm run preview -- --port 3000 --host 0.0.0.0
   ```

3. Atau gunakan PM2 untuk menjalankan di background:
   ```bash
   npm install -g pm2 serve
   pm2 start "serve -s dist -l 3000" --name "face-recognition"
   ```

---

### Opsi 3: Menggunakan Docker

Buat file `Dockerfile` di root folder:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build dan jalankan:
```bash
docker build -t face-recognition-pegawai .
docker run -d -p 8080:80 --name absensi-wajah face-recognition-pegawai
```

---

## 🔒 Catatan Keamanan & Privasi
- Seluruh model jaringan saraf tiruan (SSD MobileNet V1, Tiny Face Detector, Landmark 68, dan ResNet Face Recognition) tersimpan di folder `public/models/`.
- Tidak ada data wajah pegawai yang dikirim ke internet; seluruh komputasi biometrik dilakukan di sisi browser klien (Edge Computing).
