import React from 'react';
import {
  ShoppingCart,
  Donut,
  Beef,
  CupSoda,
  Sandwich,
  Droplet,
  Fish,
  Cake,
  Coffee,
  Cookie,
  Sprout,
  Flower2,
  PawPrint,
  Store,
} from 'lucide-react';

export type BusinessTypeIcon = React.ComponentType<{ className?: string }>;

export type BusinessTypeId =
  | 'market'
  | 'manav'
  | 'market_manav'
  | 'firin_pastane'
  | 'kasap_sarkuteri'
  | 'kasap'
  | 'bufe'
  | 'sarkuteri'
  | 'su_bayii'
  | 'balikci'
  | 'tatlici'
  | 'kafe'
  | 'ev_gunluk'
  | 'kuruyemis'
  | 'aktar'
  | 'cicekci'
  | 'petshop';

export interface BusinessTypeDefinition {
  id: BusinessTypeId;
  name: string;
  icon: BusinessTypeIcon;
  description: string;
  tone: string;
}

export const BUSINESS_TYPES: BusinessTypeDefinition[] = [
  {
    id: 'market_manav',
    name: 'Market & Manav',
    icon: ShoppingCart,
    description: 'Market ve taze ürünler',
    tone: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  },
  {
    id: 'firin_pastane',
    name: 'Fırın & Pastane',
    icon: Donut,
    description: 'Unlu mamul ve pastane',
    tone: 'text-amber-700 bg-amber-50 border-amber-100',
  },
  {
    id: 'kasap_sarkuteri',
    name: 'Kasap & Şarküteri',
    icon: Beef,
    description: 'Et ve şarküteri ürünleri',
    tone: 'text-red-700 bg-red-50 border-red-100',
  },
  {
    id: 'bufe',
    name: 'Atıştırmalık Büfesi',
    icon: CupSoda,
    description: 'İçecek ve atıştırmalık',
    tone: 'text-sky-700 bg-sky-50 border-sky-100',
  },
  {
    id: 'su_bayii',
    name: 'Su Bayii',
    icon: Droplet,
    description: 'Damacana ve su',
    tone: 'text-cyan-700 bg-cyan-50 border-cyan-100',
  },
  {
    id: 'balikci',
    name: 'Balıkçı',
    icon: Fish,
    description: 'Balık ve deniz ürünleri',
    tone: 'text-blue-700 bg-blue-50 border-blue-100',
  },
  {
    id: 'tatlici',
    name: 'Tatlıcı',
    icon: Cake,
    description: 'Tatlı ve dessert',
    tone: 'text-pink-700 bg-pink-50 border-pink-100',
  },
  {
    id: 'kafe',
    name: 'Kafe',
    icon: Coffee,
    description: 'Kahve ve içecek',
    tone: 'text-stone-700 bg-stone-50 border-stone-100',
  },
  {
    id: 'ev_gunluk',
    name: 'Ev & Günlük İhtiyaç',
    icon: Store,
    description: 'Ev ve günlük ihtiyaç',
    tone: 'text-slate-700 bg-slate-50 border-slate-100',
  },
  {
    id: 'kuruyemis',
    name: 'Kuruyemiş',
    icon: Cookie,
    description: 'Kuruyemiş ve çerez',
    tone: 'text-yellow-700 bg-yellow-50 border-yellow-100',
  },
  {
    id: 'aktar',
    name: 'Aktar',
    icon: Sprout,
    description: 'Baharat ve doğal ürün',
    tone: 'text-green-700 bg-green-50 border-green-100',
  },
  {
    id: 'cicekci',
    name: 'Çiçekçi',
    icon: Flower2,
    description: 'Çiçek ve süs bitkileri',
    tone: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-100',
  },
  {
    id: 'petshop',
    name: 'Petshop',
    icon: PawPrint,
    description: 'Evcil hayvan ürünleri',
    tone: 'text-purple-700 bg-purple-50 border-purple-100',
  },
];

export const filterBusinessTypes = (query: string) => {
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase('tr-TR');
  if (!normalizedQuery) return BUSINESS_TYPES;

  return BUSINESS_TYPES.filter((item) => {
    return (
      item.name.toLocaleLowerCase('tr-TR').includes(normalizedQuery) ||
      item.description.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
    );
  });
};