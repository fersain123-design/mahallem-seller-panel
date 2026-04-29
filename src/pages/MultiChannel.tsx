import React, { useState, useEffect } from 'react';
import { multiChannelAPI } from '../services/api.ts';

interface Channel {
  id: string;
  name: string;
  icon: string;
  color: string;
  status: 'active' | 'inactive' | 'pending';
  description: string;
  stats?: {
    products?: number;
    orders?: number;
    revenue?: number;
  };
}

const MultiChannel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([
    {
      id: 'instagram',
      name: 'Instagram Shopping',
      icon: 'IG',
      color: 'from-pink-500 to-purple-600',
      status: 'inactive',
      description: 'Instagram üzerinden doğrudan satış yapın. Ürünlerinizi story ve postlarda etiketleyin.',
      stats: { products: 0, orders: 0, revenue: 0 },
    },
    {
      id: 'facebook',
      name: 'Facebook Marketplace',
      icon: 'FB',
      color: 'from-blue-600 to-blue-700',
      status: 'inactive',
      description: 'Facebook Marketplace\'te ürünlerinizi sergileyin ve yerel müşterilere ulaşın.',
      stats: { products: 0, orders: 0, revenue: 0 },
    },
    {
      id: 'google',
      name: 'Google Shopping',
      icon: 'GO',
      color: 'from-red-500 to-yellow-500',
      status: 'inactive',
      description: 'Google arama sonuçlarında ürünlerinizi gösterin. Milyonlarca alıcıya ulaşın.',
      stats: { products: 0, orders: 0, revenue: 0 },
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      icon: 'WA',
      color: 'from-green-500 to-green-600',
      status: 'inactive',
      description: 'WhatsApp üzerinden sipariş alın, katalog paylaşın ve müşterilerle anında iletişim kurun.',
      stats: { products: 0, orders: 0, revenue: 0 },
    },
    {
      id: 'mobile_ios',
      name: 'iOS Mobil Uygulama',
      icon: 'iOS',
      color: 'from-gray-800 to-gray-900',
      status: 'pending',
      description: 'iPhone ve iPad kullanıcıları için özel mobil uygulama. App Store\'da yayınlanma hazırlığı.',
      stats: { products: 0, orders: 0, revenue: 0 },
    },
    {
      id: 'mobile_android',
      name: 'Android Mobil Uygulama',
      icon: 'AND',
      color: 'from-green-600 to-green-700',
      status: 'pending',
      description: 'Android cihazlar için özel mobil uygulama. Google Play Store\'da yayınlanma hazırlığı.',
      stats: { products: 0, orders: 0, revenue: 0 },
    },
  ]);

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupFormData, setSetupFormData] = useState<any>({});

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const response = await multiChannelAPI.getChannels();
      if (response.data?.channels) {
        // Merge backend data with default channels
        const backendChannels = response.data.channels;
        const updatedChannels = channels.map(ch => {
          const backendChannel = backendChannels.find((bc: any) => bc.id === ch.id);
          return backendChannel ? { ...ch, ...backendChannel } : ch;
        });
        setChannels(updatedChannels);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      // Continue with default channels if API fails
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-3 py-1 bg-success/20 text-success text-xs font-semibold rounded-full">Aktif</span>;
      case 'pending':
        return <span className="px-3 py-1 bg-warning/20 text-warning text-xs font-semibold rounded-full">Hazırlanıyor</span>;
      default:
        return <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs font-semibold rounded-full">Pasif</span>;
    }
  };

  const handleActivate = (channel: Channel) => {
    setSelectedChannel(channel);
    setShowSetupModal(true);
  };

  const handleSetupComplete = async () => {
    if (!selectedChannel) return;

    try {
      setLoading(true);
      await multiChannelAPI.activateChannel(selectedChannel.id, setupFormData);
      
      // Update local state
      setChannels(
        channels.map((ch) =>
          ch.id === selectedChannel.id ? { ...ch, status: 'active' as const } : ch
        )
      );
      
      alert(`${selectedChannel.name} başarıyla aktifleştirildi!`);
      setShowSetupModal(false);
      setSelectedChannel(null);
      setSetupFormData({});
    } catch (error: any) {
      console.error('Error activating channel:', error);
      alert(error.response?.data?.detail || 'Kanal aktifleştirilemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const totalActiveChannels = channels.filter((ch) => ch.status === 'active').length;
  const totalRevenue = channels.reduce((sum, ch) => sum + (ch.stats?.revenue || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="seller-page-title">Çok Kanallı Satış</h1>
        <p className="text-text-secondary mt-1">
          Ürünlerinizi farklı platformlarda satın, satışlarınızı artırın
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="seller-surface p-4">
          <div className="text-2xl font-bold text-text-primary">{totalActiveChannels}/{channels.length}</div>
          <div className="text-text-secondary text-sm mt-1">Aktif Kanal</div>
        </div>

        <div className="seller-surface p-4">
          <div className="text-2xl font-bold text-text-primary">₺{totalRevenue.toFixed(2)}</div>
          <div className="text-text-secondary text-sm mt-1">Toplam Gelir</div>
        </div>

        <div className="seller-surface p-4">
          <div className="text-2xl font-bold text-text-primary">
            {channels.filter((ch) => ch.status === 'pending').length}
          </div>
          <div className="text-text-secondary text-sm mt-1">Hazırlanan Kanal</div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="seller-surface-muted p-4">
        <div className="flex items-start space-x-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">i</div>
          <div>
            <h3 className="text-base font-semibold text-primary mb-2">
              Çok Kanallı Satışın Avantajları
            </h3>
            <ul className="text-sm text-text-secondary space-y-1">
              <li>Tek panelden tüm kanalları yönetin</li>
              <li>Ürün ve stok bilgileriniz otomatik senkronize olur</li>
              <li>Her kanaldan gelen siparişleri tek yerden takip edin</li>
              <li>Satış hacmini artırma potansiyeli sağlar</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="seller-surface overflow-hidden hover:shadow-sm transition-all"
          >
            {/* Channel Header */}
            <div className={`bg-gradient-to-r ${channel.color} p-4 text-white`}>
              <div className="flex items-center justify-between mb-3">
                <span className="w-10 h-10 rounded-lg bg-white/20 text-white text-sm font-semibold inline-flex items-center justify-center">{channel.icon}</span>
                {getStatusBadge(channel.status)}
              </div>
              <h3 className="text-lg font-bold">{channel.name}</h3>
            </div>

            {/* Channel Body */}
            <div className="p-4">
              <p className="text-sm text-text-secondary mb-4">{channel.description}</p>

              {/* Stats */}
              {channel.status === 'active' && channel.stats && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">{channel.stats.products}</div>
                    <div className="text-xs text-text-secondary">Ürün</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">{channel.stats.orders}</div>
                    <div className="text-xs text-text-secondary">Sipariş</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">₺{channel.stats.revenue}</div>
                    <div className="text-xs text-text-secondary">Gelir</div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={() => handleActivate(channel)}
                disabled={channel.status === 'active'}
                className={`w-full py-2.5 rounded-lg font-semibold transition-all ${
                  channel.status === 'active'
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : channel.status === 'pending'
                    ? 'bg-warning/10 text-warning hover:bg-warning/20'
                    : 'bg-primary text-white hover:bg-primary-600'
                }`}
              >
                {channel.status === 'active'
                  ? 'Aktif'
                  : channel.status === 'pending'
                  ? 'Hazırlanıyor...'
                  : 'Hemen Başla'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Setup Modal */}
      {showSetupModal && selectedChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-5 border border-black/10 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-text-primary">
                {selectedChannel.name} Kurulumu
              </h3>
              <button
                onClick={() => setShowSetupModal(false)}
                className="text-text-secondary hover:text-text-primary text-xl"
              >
                ×
              </button>
            </div>

            {/* Channel Specific Setup */}
            <div className="space-y-4">
              {selectedChannel.id === 'instagram' && (
                <div>
                  <h4 className="font-semibold text-text-primary mb-3">Instagram Shopping Kurulum Adımları:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary">
                    <li>Instagram Business hesabınızı Facebook sayfanıza bağlayın</li>
                    <li>Ürün kataloğunuzu Meta Commerce Manager'a yükleyin</li>
                    <li>Instagram Shopping özelliğini aktifleştirin</li>
                    <li>Ürünlerinizi postlarınızda etiketlemeye başlayın</li>
                  </ol>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      Instagram Business Hesap Adı
                    </label>
                    <input
                      type="text"
                      placeholder="@mahallem"
                      onChange={(e) => setSetupFormData({ ...setupFormData, instagram_handle: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-primary/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                </div>
              )}

              {selectedChannel.id === 'facebook' && (
                <div>
                  <h4 className="font-semibold text-text-primary mb-3">Facebook Marketplace Kurulum:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary">
                    <li>Facebook Business hesabı oluşturun</li>
                    <li>Mağaza sayfanızı onaylayın</li>
                    <li>Ürün kataloğunuzu yükleyin</li>
                    <li>Marketplace'te satışa başlayın</li>
                  </ol>
                </div>
              )}

              {selectedChannel.id === 'google' && (
                <div>
                  <h4 className="font-semibold text-text-primary mb-3">Google Shopping Kurulum:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary">
                    <li>Google Merchant Center hesabı oluşturun</li>
                    <li>Web sitenizi doğrulayın</li>
                    <li>Ürün feed'inizi yükleyin</li>
                    <li>Google Ads kampanyası başlatın</li>
                  </ol>
                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mt-4">
                    <p className="text-sm text-warning">
                      Google Shopping için reklam bütçesi gereklidir. Minimum ₺500/ay önerilir.
                    </p>
                  </div>
                </div>
              )}

              {selectedChannel.id === 'whatsapp' && (
                <div>
                  <h4 className="font-semibold text-text-primary mb-3">WhatsApp Business Kurulum:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary">
                    <li>WhatsApp Business API erişimi alın</li>
                    <li>İş telefon numaranızı doğrulayın</li>
                    <li>Ürün kataloğunuzu oluşturun</li>
                    <li>Otomatik mesaj şablonlarını ayarlayın</li>
                  </ol>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      WhatsApp Business Telefon
                    </label>
                    <input
                      type="tel"
                      placeholder="+90 555 123 45 67"
                      onChange={(e) => setSetupFormData({ ...setupFormData, phone: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-primary/30 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                </div>
              )}

              {(selectedChannel.id === 'mobile_ios' || selectedChannel.id === 'mobile_android') && (
                <div>
                  <h4 className="font-semibold text-text-primary mb-3">Mobil Uygulama Durumu:</h4>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <p className="text-sm text-text-primary mb-2">
                      Mobil uygulamanız şu anda geliştirilme aşamasında.
                    </p>
                    <p className="text-sm text-text-secondary">
                      • Tasarım: %100 Tamamlandı<br />
                      • Geliştirme: %75 Tamamlandı<br />
                      • Test: %50 Tamamlandı<br />
                      • Yayınlanma: Yakında
                    </p>
                  </div>
                  <div className="mt-4 bg-warning/10 border border-warning/20 rounded-lg p-4">
                    <p className="text-sm text-warning">
                      Tahmini yayın tarihi: 2-3 hafta içinde
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowSetupModal(false)}
                className="flex-1 px-5 py-2.5 border border-primary/30 text-primary rounded-lg hover:bg-primary/5 transition-all font-semibold"
              >
                İptal
              </button>
              <button
                onClick={handleSetupComplete}
                disabled={loading}
                className="flex-1 px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-600 transition-all font-semibold disabled:opacity-50"
              >
                {selectedChannel.status === 'pending' ? 'Bilgilendim' : 'Kurulumu Tamamla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiChannel;
