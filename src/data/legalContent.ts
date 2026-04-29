export type LegalSectionId =
  | 'kullanim-kosullari'
  | 'gizlilik-politikasi'
  | 'kvkk-aydinlatma'
  | 'satici-sozlesmesi'
  | 'iletisim';

export type LegalSection = {
  id: LegalSectionId;
  title: string;
  buttonLabel: string;
  content: string[];
};

export const LEGAL_SECTIONS: LegalSection[] = [
  {
    id: 'kullanim-kosullari',
    title: 'Kullanim Kosullari',
    buttonLabel: 'Kullanim Kosullari',
    content: [
      '1. Taraflar',
      'Bu uygulama (Mahallem), Ferhat Sahin tarafindan sunulmaktadir.',
      '',
      '2. Hizmet Tanimi',
      'Mahallem uygulamasi, kullanicilarin bulunduklari konumdaki yerel esnaflardan urun ve hizmet siparisi vermelerini saglayan bir platformdur.',
      '',
      '3. Kullanici Yukumlulukleri',
      'Kullanici, uygulamayi yalnizca hukuka uygun amaclarla kullanacagini kabul eder. Yaniltici, sahte, baskasina ait bilgilerle islem yapmak yasaktir.',
      '',
      '4. Hesap Guvenligi',
      'Kullanici, hesap bilgilerinin guvenliginden kendisi sorumludur. Google ile giris yapan kullanicilar, ilgili hesabin guvenliginden sorumludur.',
      '',
      '5. Siparis ve Hizmet Sorumlulugu',
      'Uygulama uzerinden verilen siparislerde urun ve hizmetin sorumlulugu ilgili esnafa aittir. Mahallem, yalnizca araci platformdur.',
      '',
      '6. Odeme',
      'Uygulama uzerinden kapida odeme ve online odeme secenekleri sunulabilir. Online odemelerde ucuncu taraf odeme altyapilari kullanilabilir.',
      '',
      '7. Hizmet Degisiklikleri',
      'Mahallem, uygulama uzerinde degisiklik yapma hakkini sakli tutar.',
      '',
      '8. Hesap Askiya Alma',
      'Kurallara aykiri kullanim durumunda kullanici hesaplari askiya alinabilir veya silinebilir.',
    ],
  },
  {
    id: 'gizlilik-politikasi',
    title: 'Gizlilik Politikasi',
    buttonLabel: 'Gizlilik Politikasi',
    content: [
      '1. Veri Sorumlusu',
      'Bu gizlilik politikasi kapsaminda veri sorumlusu Ferhat Sahin\'dir. Iletisim: info@mahallem.live',
      '',
      '2. Toplanan Veriler',
      '- Ad ve soyad',
      '- Telefon numarasi',
      '- Konum bilgisi',
      '- Siparis ve islem gecmisi',
      '- Cihaz bilgileri ve uygulama kullanim verileri',
      '',
      '3. Veri Kullanim Amaclari',
      '- Siparislerin olusturulmasi ve teslimi',
      '- Kullanici deneyiminin iyilestirilmesi',
      '- Hizmetlerin gelistirilmesi',
      '',
      '4. Ucuncu Taraf Hizmetler',
      '- Google (giris ve harita hizmetleri)',
      '- Odeme altyapi saglayicilari',
      '- Sunucu ve veri hizmetleri (orn. Supabase)',
      'Bu hizmetler kapsaminda gerekli veriler paylasilabilir.',
      '',
      '5. Veri Guvenligi',
      'Kisisel veriler guvenli sunucularda saklanir ve yetkisiz erisime karsi korunur.',
      '',
      '6. Veri Saklama Suresi',
      'Veriler, hizmet suresi boyunca ve yasal yukumlulukler geregi gerekli sure kadar saklanir.',
      '',
      '7. Kullanici Haklari',
      'Kullanicilar, verilerine iliskin bilgi talep etme, duzeltme ve silme haklarina sahiptir.',
      'Talepler icin: info@mahallem.live',
    ],
  },
  {
    id: 'kvkk-aydinlatma',
    title: 'KVKK Aydinlatma Metni',
    buttonLabel: 'KVKK',
    content: [
      '6698 sayili Kisisel Verilerin Korunmasi Kanunu kapsaminda, veri sorumlusu sifatiyla Ferhat Sahin olarak kisisel verileriniz islenmektedir.',
      '',
      '1. Islenen Kisisel Veriler',
      '- Kimlik bilgileri (ad, soyad)',
      '- Iletisim bilgileri (telefon)',
      '- Konum verisi',
      '- Siparis ve islem bilgileri',
      '- Kullanim ve cihaz verileri',
      '',
      '2. Isleme Amaclari',
      '- Siparis sureclerinin yurutulmesi',
      '- Hizmetlerin sunulmasi',
      '- Kullanici deneyiminin iyilestirilmesi',
      '',
      '3. Hukuki Sebep',
      'Verileriniz KVKK\'nin 5. maddesi kapsaminda islenmektedir.',
      '',
      '4. Veri Aktarimi',
      'Veriler, hizmetin saglanmasi amaciyla asagidaki taraflarla paylasilabilir:',
      '- Esnaflarla',
      '- Kurye hizmetleriyle',
      '- Odeme sistemleriyle',
      '- Teknik altyapi saglayicilariyla',
      '',
      '5. Haklariniz',
      'KVKK\'nin 11. maddesi kapsaminda asagidaki haklara sahipsiniz:',
      '- Verilerinizi ogrenme',
      '- Duzeltme',
      '- Silinmesini talep etme',
      'Basvuru icin: info@mahallem.live',
    ],
  },
  {
    id: 'satici-sozlesmesi',
    title: 'Satici (Esnaf) Sozlesmesi',
    buttonLabel: 'Satici Sozlesmesi',
    content: [
      '1. Taraflar',
      'Bu sozlesme, Mahallem platformu ile platforma kayit olan satici (esnaf) arasinda yapilmaktadir.',
      '',
      '2. Hizmet Tanimi',
      'Mahallem, saticilarin urun ve hizmetlerini kullanicilarla bulusturan bir araci platformdur.',
      '',
      '3. Satici Yukumlulukleri',
      '- Urun ve hizmet bilgilerini dogru girmekle yukumludur.',
      '- Siparisleri zamaninda hazirlamak ve teslim etmekle sorumludur.',
      '- Yasal mevzuata uygun hareket etmek zorundadir.',
      '',
      '4. Veri Kullanimi ve KVKK',
      'Satici, kullaniciya ait kisisel verileri yalnizca siparisin gerceklestirilmesi amaciyla kullanabilir. Bu veriler ucuncu kisilerle paylasilamaz ve farkli amaclarla kullanilamaz.',
      '',
      '5. Sorumluluk',
      'Satici, sundugu urun ve hizmetlerden dogrudan sorumludur. Mahallem yalnizca araci hizmet saglar.',
      '',
      '6. Odeme ve Komisyon',
      'Platform, saticidan belirli bir komisyon talep etme hakkini sakli tutar.',
      '',
      '7. Hesap Durumu',
      'Kurallara aykiri davranan saticilarin hesaplari askiya alinabilir veya kapatilabilir.',
    ],
  },
  {
    id: 'iletisim',
    title: 'Iletisim',
    buttonLabel: 'Iletisim',
    content: [
      'Her turlu soru, oneri ve talepleriniz icin bizimle iletisime gecebilirsiniz.',
      '',
      'Ad Soyad: Ferhat Sahin',
      'E-posta: destek@mahallem.live',
      'E-posta: info@mahallem.live',
    ],
  },
];

export const LEGAL_SECTION_BY_ID: Record<LegalSectionId, LegalSection> = LEGAL_SECTIONS.reduce(
  (acc, section) => {
    acc[section.id] = section;
    return acc;
  },
  {} as Record<LegalSectionId, LegalSection>
);
