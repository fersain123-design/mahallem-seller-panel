export type TrProvince = {
  id: number; // ideally plate code or an official code
  name: string;
  plate?: number;
};

export type TrDistrict = {
  id: number;
  provinceId: number;
  name: string;
};

export type TrNeighborhood = {
  id: number;
  districtId: number;
  name: string;
  type?: string; // Mahalle/Köy/Belde etc.
};

export type TrAddressData = {
  version: string;
  source?: string;
  provinces: TrProvince[];
  districts: TrDistrict[];
  neighborhoods: TrNeighborhood[];
  districtIdsByProvinceId: Record<string, number[]>;
  neighborhoodIdsByDistrictId: Record<string, number[]>;
};
