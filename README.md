# Angkringan Van Java

Kasir dan pantauan owner untuk dua lapak: Simpang Bangkal dan Simpang Sebabi.

Situs: https://angkringan-van-java.vercel.app

Sekali saja, buka Supabase → SQL Editor, tempel isi `supabase/002_operational.sql`, lalu Run.
Itu membuat stok per lapak, nama pelanggan, jam WIB, menu awal, dan 30 tusuk di tiap lapak.

Lalu jalankan juga `supabase/003_unit_catatan.sql`.
Itu menambah satuan menu (tusuk, gelas, porsi, dan lain-lain) serta kolom catatan di pesanan.

Lalu jalankan `supabase/004_akun_kasir.sql`.
Sesudah itu owner bisa menambah kasir dan reset password dari halaman Akun kasir.

Lalu jalankan `supabase/005_nama_struk.sql`.
Itu menambah nama kasir dan menulis nama itu di setiap nota.
