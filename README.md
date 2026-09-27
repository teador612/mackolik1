# Mackolik İddaa Bülteni

Bu proje GitHub Pages üzerinde çalışan statik bir maç tablosudur.

## Çalışma mantığı

- GitHub Actions her 15 dakikada bir Mackolik servisinden bülteni çeker.
- Yeni maç kodları ilk görüldükleri anda açılış oranlarıyla kaydedilir.
- Daha sonraki çalıştırmalarda yalnızca skor, devre skoru ve maç durumu güncellenir.
- Güncel oranlar okunmaz ve açılış oranlarının üzerine yazılmaz.
- Site `data/matches.json` dosyasını okur.

## GitHub kurulumu

1. Bu klasörü GitHub deposuna yükleyin.
2. Actions sekmesinden `Mackolik skor güncelleme` iş akışını bir kez `Run workflow` ile çalıştırın.
3. Repository Settings → Pages bölümünde kaynak olarak `GitHub Actions` seçin.
4. GitHub Pages adresini açın.

`GitHub Pages yayınlama` iş akışı siteyi otomatik yayınlar. Skor güncelleme iş akışının oluşturduğu commit de yeni veriyi otomatik olarak yayına alır.

İş akışının zaman aralığı `.github/workflows/update-mackolik.yml` içindeki cron satırından değiştirilebilir. GitHub cron saatleri UTC'dir.
