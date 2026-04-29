import React, { useEffect, useMemo, useState } from 'react';
import { loadTrAddressData } from '../lib/trAddress/loadTrAddress';
import { normalizeTr } from '../lib/trAddress/normalizeTr';
import type { TrAddressData } from '../lib/trAddress/types';

type Props = {
  city: string;
  district: string;
  neighborhood: string;
  disabled?: boolean;
  onChange: (next: { city: string; district: string; neighborhood: string }) => void;
};

function findIdByName<T extends { id: number; name: string }>(items: T[], name: string): number | null {
  const target = normalizeTr(name);
  if (!target) return null;
  const direct = items.find((x) => normalizeTr(x.name) === target);
  if (direct) return direct.id;
  // fallback contains match (handles suffix/prefix changes)
  const contains = items.find((x) => normalizeTr(x.name).includes(target) || target.includes(normalizeTr(x.name)));
  return contains ? contains.id : null;
}

export default function TrAddressSelect({ city, district, neighborhood, disabled, onChange }: Props) {
  const [data, setData] = useState<TrAddressData | null>(null);
  const [loadError, setLoadError] = useState<string>('');

  const [provinceId, setProvinceId] = useState<number | ''>('');
  const [districtId, setDistrictId] = useState<number | ''>('');
  const [neighborhoodId, setNeighborhoodId] = useState<number | ''>('');

  useEffect(() => {
    let mounted = true;
    loadTrAddressData()
      .then((d) => {
        if (!mounted) return;
        setData(d);
      })
      .catch((e) => {
        if (!mounted) return;
        setLoadError(e?.message || 'Adres dataset yüklenemedi');
      });
    return () => {
      mounted = false;
    };
  }, []);

  const districtsById = useMemo(() => {
    const map = new Map<number, TrAddressData['districts'][number]>();
    if (data) data.districts.forEach((d) => map.set(d.id, d));
    return map;
  }, [data]);

  const neighborhoodsById = useMemo(() => {
    const map = new Map<number, TrAddressData['neighborhoods'][number]>();
    if (data) data.neighborhoods.forEach((n) => map.set(n.id, n));
    return map;
  }, [data]);

  // Initialize selection from existing string values.
  useEffect(() => {
    if (!data) return;

    const pId = findIdByName(data.provinces, city);
    if (pId && provinceId === '') setProvinceId(pId);

    if (pId) {
      const districtIds = data.districtIdsByProvinceId[String(pId)] || [];
      const districtItems = districtIds.map((id) => districtsById.get(id)).filter(Boolean) as any;
      const dId = findIdByName(districtItems, district);
      if (dId && districtId === '') setDistrictId(dId);

      if (dId) {
        const nIds = data.neighborhoodIdsByDistrictId[String(dId)] || [];
        const neighborhoodItems = nIds.map((id) => neighborhoodsById.get(id)).filter(Boolean) as any;
        const nId = findIdByName(neighborhoodItems, neighborhood);
        if (nId && neighborhoodId === '') setNeighborhoodId(nId);
      }
    }
  }, [data, districtsById, neighborhoodsById]);

  const provinceOptions = useMemo(() => {
    if (!data) return [];
    return [...data.provinces].sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
  }, [data]);

  const districtOptions = useMemo(() => {
    if (!data || provinceId === '') return [];
    const ids = data.districtIdsByProvinceId[String(provinceId)] || [];
    return ids
      .map((id) => districtsById.get(id))
      .filter(Boolean)
      .sort((a, b) => (a as any).name.localeCompare((b as any).name, 'tr-TR')) as any[];
  }, [data, provinceId, districtsById]);

  const neighborhoodOptions = useMemo(() => {
    if (!data || districtId === '') return [];
    const ids = data.neighborhoodIdsByDistrictId[String(districtId)] || [];
    return ids
      .map((id) => neighborhoodsById.get(id))
      .filter(Boolean)
      .sort((a, b) => (a as any).name.localeCompare((b as any).name, 'tr-TR')) as any[];
  }, [data, districtId, neighborhoodsById]);

  const selectClass = 'w-full px-4 py-2 border border-gray-light rounded-lg focus:ring-2 focus:ring-primary disabled:bg-gray-50';

  if (loadError) {
    return (
      <div className="bg-error/5 border border-error rounded-lg p-3 text-error text-sm">
        {loadError}
        <div className="text-xs text-text-secondary mt-1">
          Beklenen dosya: <code>/public/data/tr-address.min.json</code>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">İl</label>
        <select
          value={provinceId}
          onChange={(e) => {
            const nextProvinceId = e.target.value ? Number(e.target.value) : '';
            setProvinceId(nextProvinceId);
            setDistrictId('');
            setNeighborhoodId('');
            const pName = nextProvinceId !== '' ? data?.provinces.find((p) => p.id === nextProvinceId)?.name || '' : '';
            onChange({ city: pName, district: '', neighborhood: '' });
          }}
          disabled={disabled || !data}
          className={selectClass}
        >
          <option value="">İl seçiniz</option>
          {provinceOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">İlçe</label>
        <select
          value={districtId}
          onChange={(e) => {
            const nextDistrictId = e.target.value ? Number(e.target.value) : '';
            setDistrictId(nextDistrictId);
            setNeighborhoodId('');
            const dName = nextDistrictId !== '' ? data?.districts.find((d) => d.id === nextDistrictId)?.name || '' : '';
            onChange({ city: city || '', district: dName, neighborhood: '' });
          }}
          disabled={disabled || !data || provinceId === ''}
          className={selectClass}
        >
          <option value="">İlçe seçiniz</option>
          {districtOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Mahalle</label>
        <select
          value={neighborhoodId}
          onChange={(e) => {
            const nextNeighborhoodId = e.target.value ? Number(e.target.value) : '';
            setNeighborhoodId(nextNeighborhoodId);
            const nName =
              nextNeighborhoodId !== '' ? data?.neighborhoods.find((n) => n.id === nextNeighborhoodId)?.name || '' : '';
            onChange({ city: city || '', district: district || '', neighborhood: nName });
          }}
          disabled={disabled || !data || districtId === ''}
          className={selectClass}
        >
          <option value="">Mahalle seçiniz</option>
          {neighborhoodOptions.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden md:block" />
    </div>
  );
}
