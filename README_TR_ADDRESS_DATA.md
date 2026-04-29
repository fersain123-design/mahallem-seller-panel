# Türkiye İl / İlçe / Mahalle Dataset (Seller Panel)

Bu proje satıcı panelinde manuel adres yazımı yerine **İl → İlçe → Mahalle** seçimli bir yapı kullanır.

## 1) Dataset önerisi (kamuya açık / açık kaynak)

Resmi standart **NVI/MAKS** (Adres Kayıt Sistemi) yapısına en yakın kaynaklar genelde MAKS'ten türetilmiş açık dataset'lerdir; ancak MAKS verisi doğrudan her zaman açık yayınlanmaz.

Pratik ve yaygın açık kaynak alternatifler:

- İl/İlçe listesi: `ozdemirburak/turkish-cities` (GitHub) gibi projeler (il/ilçe düzeyi)
- Mahalle listesi: GitHub'da "turkiye mahalle json" isimli dataset repo'ları (mahalle düzeyi)
- Alternatif: açık bir API'den (örn. topluluk kaynaklı) periyodik çekip JSON'a dönüştürme

Not: Dataset seçerken mutlaka **lisans (MIT/Apache/CC0)** ve güncellik (son güncelleme tarihi) kontrol edilmelidir.

## 2) Bu panelin beklediği JSON formatı

`public/data/tr-address.min.json` dosyası şu şemada olmalı:

- `provinces: [{ id, name, plate? }]`
- `districts: [{ id, provinceId, name }]`
- `neighborhoods: [{ id, districtId, name, type? }]`
- `districtIdsByProvinceId: { [provinceId]: districtId[] }`
- `neighborhoodIdsByDistrictId: { [districtId]: neighborhoodId[] }`

Bu repo'da `public/data/tr-address.min.json` altında **hazır (tam Türkiye)** dataset bulunur.

## 3) Kullanım

Satıcı panelinde adres ekranında kullanılan bileşen:

- `src/components/TrAddressSelect.tsx`

Dataset'i yeniden üretmek isterseniz (opsiyonel):

- Script: `scripts/generate-tr-address-data.mjs`
- Gerekli dev dependency'ler:
	- `turkey-neighbourhoods`
	- `@tsconfig/strictest`, `@tsconfig/node20` (paketin kendi tsconfig `extends` zinciri için)

## 4) Performans notları

- Mahalle sayısı çok yüksek olabilir (binlerce/10bin+). Büyük JSON'u tek parça bundle'a gömmek yerine `public/` altından `fetch` ile yüklemek daha sağlıklıdır.
- Çok büyük datasetlerde ilçe/mahalle option render maliyetli olabilir; gerekirse arama kutusu + sanallaştırma (virtualized list) ekleyin.

## 5) Edge-case notları

- İsim değişiklikleri / birleşmeler: En doğru yaklaşım isim yerine **ID** saklamak ve UI'da isim göstermek.
- Özel karakterler: Türkçe karakter normalizasyonu için `src/lib/trAddress/normalizeTr.ts` kullanılır.
- Aynı isimli mahalleler: Farklı ilçelerde aynı mahalle adı olabilir. Bu yüzden (il, ilçe, mahalle) hiyerarşisi şart.
