# Mackolik ML – ayrı tahmin modeli

Bu paket, mevcut `dna.js`, `rna.js`, `v2.js`, `app.js` ve mevcut iş akışlarını değiştirmez. Sadece yeni dosyalar ekler.

## Eklenecek dosyalar
- `ml.html`
- `ml.js`
- `requirements-ml.txt`
- `scripts/train_ml.py`
- `.github/workflows/ml-train.yml`

## Nasıl çalışır?
- Eğitim: `data/v2-data.json` içindeki tamamlanmış skorlar ve açılış oranları.
- Tahmin: `data/matches.json` içindeki henüz tamamlanmamış maçlar.
- Çıktı: `outputs/ml-predictions.json`.
- Model: scikit-learn RandomForest; hedefler MS1/X/2, KG, 2.5 Üst ve İY 1.5 Üst.
- Harici/ücretli API yoktur.
- Doğrulama: maç tarih sırasına göre son %20 ayırarak ölçülür; geleceğe ait sonuçlar eğitim özelliklerine katılmaz.

## GitHub'a ekleme
1. Depodaki dosyaları aynı göreli yollarla yükle; mevcut dosyaların üzerine yazma.
2. GitHub → Actions → `Mackolik ML eğitim ve tahmin` → `Run workflow` ile ilk çalıştırmayı başlat.
3. İş akışı `outputs/ml-predictions.json` dosyasını commit eder.
4. Pages zaten GitHub Actions ile bütün depoyu yayımlıyorsa `ml.html` adresi `https://teador612.github.io/mackolik1/ml.html` olur. Pages yapılandırmanız farklıysa yayınlama iş akışının bu dosyaları dışlamadığını kontrol edin.
5. Ana menüye isterseniz ayrı bir bağlantı ekleyin: `<a href="./ml.html">ML Analiz</a>`.

## Önemli veri notu
Kod yaygın alan adlarını ve iç içe `openingOdds` / `odds` nesnelerini destekler. Gerçek veride skor ya da oran alanlarının farklı adlandırılması halinde eğitim raporundaki örnek sayısı düşük kalabilir. İlk Actions çalıştırmasının logunu ve `outputs/ml-predictions.json` içindeki `validation` bölümünü kontrol edin. Veri yetersizse tahmin üretmek için uydurma veri kullanmaz.

Bu model deneysel bir olasılık modelidir; bahis veya kâr garantisi değildir.
