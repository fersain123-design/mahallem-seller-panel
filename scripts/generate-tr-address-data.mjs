import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Generates `public/data/tr-address.min.json` for the seller panel address selector.
// Source: MIT-licensed `turkey-neighbourhoods` dataset.
//
// Output schema matches `src/lib/trAddress/types.ts`.

const ROOT = process.cwd();
const OUT_PATH = path.join(ROOT, 'public', 'data', 'tr-address.min.json');

const normalizeNeighborhood = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return { name: '', type: undefined };

  // Common suffixes from the dataset
  const suffixes = [
    { re: /\s+Mah\.?$/i, type: 'Mahalle' },
    { re: /\s+Mahallesi$/i, type: 'Mahalle' },
    { re: /\s+Köy\.?$/i, type: 'Köy' },
    { re: /\s+Köyü$/i, type: 'Köy' },
    { re: /\s+Belde\.?$/i, type: 'Belde' },
  ];

  for (const { re, type } of suffixes) {
    if (re.test(s)) {
      return { name: s.replace(re, '').trim(), type };
    }
  }

  return { name: s, type: undefined };
};

const main = async () => {
  // Use CJS require to avoid ESM interop surprises
  const require = createRequire(import.meta.url);
  let tn;
  try {
    tn = require('turkey-neighbourhoods');
  } catch (e) {
    console.error('Missing optional dev dependency: turkey-neighbourhoods');
    console.error('To regenerate the address dataset, run:');
    console.error('  npm install --save-dev turkey-neighbourhoods @tsconfig/strictest @tsconfig/node20 --legacy-peer-deps --no-fund --no-audit');
    console.error('Note: `turkey-neighbourhoods` ships a tsconfig that extends these presets; installing them avoids VS Code/TS preset resolution errors.');
    process.exitCode = 1;
    return;
  }

  const provinces = tn.cityList
    .map((c) => ({ id: Number(c.code), plate: Number(c.code), name: c.name }))
    .sort((a, b) => a.plate - b.plate);

  const districts = [];
  const neighborhoods = [];
  const districtIdsByProvinceId = {};
  const neighborhoodIdsByDistrictId = {};

  for (const p of provinces) {
    const code = String(p.plate).padStart(2, '0');
    const districtNames = Array.isArray(tn.districtsByCityCode?.[code]) ? tn.districtsByCityCode[code] : [];

    const districtIds = [];

    districtNames.forEach((districtName, districtIndex) => {
      // Deterministic numeric ID (stable across runs)
      const districtId = p.id * 1000 + (districtIndex + 1);
      districts.push({ id: districtId, provinceId: p.id, name: String(districtName) });
      districtIds.push(districtId);

      const rawNeighborhoods = tn.neighbourhoodsByDistrictAndCityCode?.[code]?.[districtName] || [];
      const neighIds = [];

      rawNeighborhoods.forEach((raw, neighIndex) => {
        const { name, type } = normalizeNeighborhood(raw);
        if (!name) return;

        // Deterministic numeric ID. 10_000 leaves room for up to 9999 neighbourhoods per district.
        const neighborhoodId = districtId * 10000 + (neighIndex + 1);
        const item = { id: neighborhoodId, districtId, name };
        if (type) item.type = type;
        neighborhoods.push(item);
        neighIds.push(neighborhoodId);
      });

      neighborhoodIdsByDistrictId[String(districtId)] = neighIds;
    });

    districtIdsByProvinceId[String(p.id)] = districtIds;
  }

  const pkgPath = path.join(ROOT, 'node_modules', 'turkey-neighbourhoods', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const output = {
    version: `turkey-neighbourhoods@${pkg.version} (generated ${new Date().toISOString().slice(0, 10)})`,
    source: `MIT - ${pkg.repository?.url || 'turkey-neighbourhoods'}`,
    provinces,
    districts,
    neighborhoods,
    districtIdsByProvinceId,
    neighborhoodIdsByDistrictId,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output));

  console.log('OK:', OUT_PATH);
  console.log('provinces:', provinces.length, 'districts:', districts.length, 'neighborhoods:', neighborhoods.length);
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
