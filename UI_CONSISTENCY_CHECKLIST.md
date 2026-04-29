# Seller Panel UI Consistency Checklist

Bu dosya, seller panelde eklenen/yenilenen tüm ekranların aynı tasarım dilinde kalması için kısa kontrol listesidir.

## 1) Sayfa Başlığı ve Üst Alan

- Sayfa başlığı için `seller-page-title` kullan.
- Alt açıklama için `seller-page-subtitle` kullan.
- Üst aksiyon butonları kompakt olmalı (`py-2` veya `py-2.5`).
- Sayfa ana kapsayıcıları `space-y-5` / `pb-6` standardına yakın olmalı.

## 2) Kart ve Yüzeyler

- Ana kartlarda `rounded-xl` kullan (gerekmedikçe `rounded-2xl` kullanma).
- Kart gölgeleri hafif olmalı (`shadow-sm`), ağır gölgelerden kaçın.
- İç boşluklar kompakt kalmalı (`p-4` / `p-5`).
- Aşırı gradient/dekoratif arka plan yerine sade yüzey tercih et.

## 3) Buton Standardı

- Birincil buton: `seller-btn-primary`.
- İkincil/ghost buton: `seller-btn-ghost` veya `seller-btn-outline`.
- Buton yükseklikleri tutarlı olmalı (`py-2` veya `py-2.5`).
- Aynı alandaki butonlar farklı yükseklikte olmamalı.

## 4) Form Alanları

- Input için `seller-input`, textarea için `seller-textarea` kullan.
- Label-boyutları: `text-sm` + `font-medium`.
- Form bölümleri arasında ritim korunmalı (`space-y-4` / `space-y-5`).
- Uyarı/mesaj kutuları sade ve kısa metinli olmalı.

## 5) Tablo Standardı

- Header hücreleri: `px-4 py-2.5`.
- Body hücreleri: `px-4 py-3`.
- Başlıklar `text-xs uppercase` ritminde tutarlı olmalı.
- Tablo satırlarında hover etkisi hafif olmalı.

## 6) Modal Standardı

- Modal kartı: `rounded-xl`, hafif border/gölge.
- Modal header padding: `p-5`.
- Modal başlık boyutu: `text-lg font-bold`.
- Modal aksiyon butonları da kompakt standardı takip etmeli.

## 7) Metin ve İkon Kullanımı

- Dekoratif emoji kullanma (gerekirse fonksiyonel ikon bileşeni kullan).
- Başarı/hata metinleri net ve kısa olmalı.
- Konsol loglarında da emoji yerine düz metin tercih et.

## 8) Son Kontrol (PR öncesi)

- Değişen dosyalarda `Problems` paneli temiz mi?
- Yeni eklenen UI bu checklist ile çelişiyor mu?
- Eski büyük padding/radius değerleri tekrar geri geldi mi?
- Aynı sayfadaki kart/buton/tablo tipografisi hizalı mı?

---

Öneri: Yeni sayfa geliştirmelerinde bu dosyayı PR self-check listesine ekleyin.