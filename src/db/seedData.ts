import { Container, Vehicle } from '../types';
import { calculateCbm, extractChassisPrefix, hasCbmMismatch } from '../utils/chassisParser';

function makeVehicle(
  serialNo: number,
  make: string,
  model: string,
  engineCC: number,
  fuel: string,
  year: number,
  vehicleIdNo: string,
  chassisNo: string,
  length: number,
  width: number,
  height: number,
  qty: number,
  price: number,
  weight: number,
  cbm: number,
  containerNo?: string
): Vehicle {
  const prefix = extractChassisPrefix(chassisNo);
  const calcCbm = calculateCbm(length, width, height);
  return {
    id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    serialNo,
    make: make.toUpperCase(),
    model: model.toUpperCase(),
    engineCC,
    fuel: fuel.toUpperCase(),
    year,
    vehicleIdNo,
    chassisNo,
    chassisPrefix: prefix,
    length,
    width,
    height,
    qty,
    price,
    weight,
    cbm,
    calculatedCbm: calcCbm,
    cbmMismatch: hasCbmMismatch(cbm, calcCbm),
    containerNo,
  };
}

export function buildContainerFromVehicles(
  containerNo: string,
  sealOrBlNo: string,
  extraValue: number | string,
  vehiclesList: any[][]
): Container {
  const builtVehicles: Vehicle[] = [];
  let totalCbm = 0;
  let totalWeight = 0;
  let totalPrice = 0;
  const modelsSet = new Set<string>();
  const prefixesSet = new Set<string>();

  vehiclesList.forEach((args, idx) => {
    const v = (makeVehicle as any)(...args, containerNo);
    v.serialNo = idx + 1;
    builtVehicles.push(v);

    totalCbm += v.cbm || 0;
    totalWeight += v.weight || 0;
    totalPrice += v.price || 0;
    modelsSet.add(v.model);
    if (v.chassisPrefix) prefixesSet.add(v.chassisPrefix);
  });

  return {
    containerNo,
    sealOrBlNo,
    extraValue,
    vehicles: builtVehicles,
    totalCbm: Math.round(totalCbm * 1000) / 1000,
    totalWeight,
    totalPrice,
    vehicleCount: builtVehicles.length,
    models: Array.from(modelsSet),
    chassisPrefixes: Array.from(prefixesSet),
    createdAt: Date.now() - Math.floor(Math.random() * 30) * 86400000,
    updatedAt: Date.now(),
  };
}

export const INITIAL_SEED_CONTAINERS: Container[] = [
  // Container 1 (From prompt)
  {
    containerNo: 'MSKU0113466',
    sealOrBlNo: 'ML-JP0409806',
    extraValue: 4000,
    vehicles: [
      makeVehicle(1, 'MITSUBISHI', 'CANTER', 3560, 'D', 1990, '3422024991969555', 'FE315BD-445529', 469, 169, 199, 1, 2340000, 2630, 15.773, 'MSKU0113466'),
      makeVehicle(2, 'TOYOTA', 'WISH', 1790, 'G', 2012, '36130359C1958023', 'ZGE20-0134978', 459, 169, 159, 1, 420000, 1350, 12.334, 'MSKU0113466'),
      makeVehicle(3, 'TOYOTA', 'HIACE', 2980, 'D', 2012, '3471034303155005', 'KDH206-8053689', 469, 170, 193, 1, 920000, 2220, 15.388, 'MSKU0113466'),
      makeVehicle(4, 'ISUZU', 'ELF', 3630, 'D', 1991, '2111020112654821', 'NPR58P7106494', 674, 203, 235, 1, 1040000, 2770, 32.153, 'MSKU0113466'),
    ],
    totalCbm: 75.648,
    totalWeight: 8970,
    totalPrice: 4720000,
    vehicleCount: 4,
    models: ['CANTER', 'WISH', 'HIACE', 'ELF'],
    chassisPrefixes: ['FE315BD', 'ZGE20', 'KDH206', 'NPR58P'],
    createdAt: Date.now() - 7 * 86400000,
    updatedAt: Date.now() - 7 * 86400000,
  },
  // Container 2 (From prompt)
  {
    containerNo: 'MSKU1239891',
    sealOrBlNo: 'ML-JP0409805',
    extraValue: 3790,
    vehicles: [
      makeVehicle(1, 'ISUZU', 'ELF', 4320, 'D', 1990, '3222034001207501', 'NKR61E-7101966', 469, 169, 199, 1, 1960000, 2730, 15.773, 'MSKU1239891'),
      makeVehicle(2, 'TOYOTA', 'RUMION', 1790, 'G', 2012, '3431023303219164', 'ZRE152-4002950', 421, 176, 163, 1, 360000, 1320, 12.078, 'MSKU1239891'),
      makeVehicle(3, 'ISUZU', 'ELF', 3630, 'D', 1989, '3481021001210222', 'NPR58P7103642', 682, 204, 209, 1, 1320000, 3010, 29.078, 'MSKU1239891'),
      makeVehicle(4, 'TOYOTA', 'HIACE', 2980, 'D', 2012, '3613034793484793', 'KDH206-8044898', 469, 169, 198, 1, 950000, 1980, 15.694, 'MSKU1239891'),
    ],
    totalCbm: 72.623,
    totalWeight: 9040,
    totalPrice: 4590000,
    vehicleCount: 4,
    models: ['ELF', 'RUMION', 'HIACE'],
    chassisPrefixes: ['NKR61E', 'ZRE152', 'NPR58P', 'KDH206'],
    createdAt: Date.now() - 5 * 86400000,
    updatedAt: Date.now() - 5 * 86400000,
  },
  // Container 3 (HINO DUTRO + TOYOTA DYNA + PROBOX + HIACE)
  {
    containerNo: 'TGHU6458291',
    sealOrBlNo: 'ML-JP0410221',
    extraValue: 3950,
    vehicles: [
      makeVehicle(1, 'HINO', 'DUTRO', 4000, 'D', 2005, '3491024481029192', 'XZU308-0004921', 469, 169, 198, 1, 1850000, 2580, 15.694, 'TGHU6458291'),
      makeVehicle(2, 'TOYOTA', 'PROBOX', 1490, 'G', 2014, '2819201948102941', 'NCP51V-0192841', 419, 169, 152, 1, 310000, 1080, 10.763, 'TGHU6458291'),
      makeVehicle(3, 'TOYOTA', 'DYNA', 4100, 'D', 2003, '1829104928190291', 'XZU347-1002948', 612, 199, 224, 1, 1420000, 2890, 27.281, 'TGHU6458291'),
      makeVehicle(4, 'TOYOTA', 'HIACE', 2980, 'D', 2013, '3471034303199842', 'TRH200-0192840', 469, 169, 198, 1, 880000, 1940, 15.694, 'TGHU6458291'),
    ],
    totalCbm: 69.432,
    totalWeight: 8490,
    totalPrice: 4460000,
    vehicleCount: 4,
    models: ['DUTRO', 'PROBOX', 'DYNA', 'HIACE'],
    chassisPrefixes: ['XZU308', 'NCP51V', 'XZU347', 'TRH200'],
    createdAt: Date.now() - 4 * 86400000,
    updatedAt: Date.now() - 4 * 86400000,
  },
  // Container 4 (NISSAN ATLAS + CARAVAN + WISH + CANTER)
  {
    containerNo: 'ONEU9104820',
    sealOrBlNo: 'ML-JP0411093',
    extraValue: 4100,
    vehicles: [
      makeVehicle(1, 'MITSUBISHI', 'CANTER', 4890, 'D', 2004, '4910294810294819', 'FE73E-510294', 469, 169, 199, 1, 2100000, 2710, 15.773, 'ONEU9104820'),
      makeVehicle(2, 'NISSAN', 'CARAVAN', 2480, 'D', 2011, '3910294810294812', 'VW6E26-004910', 469, 169, 199, 1, 790000, 1890, 15.773, 'ONEU9104820'),
      makeVehicle(3, 'NISSAN', 'ATLAS', 3150, 'D', 1999, '2819201948192019', 'AKR66E-740192', 625, 201, 215, 1, 1250000, 2920, 27.010, 'ONEU9104820'),
      makeVehicle(4, 'TOYOTA', 'WISH', 1790, 'G', 2011, '36130359C1911928', 'ZGE20-0082918', 459, 169, 159, 1, 390000, 1340, 12.334, 'ONEU9104820'),
    ],
    totalCbm: 70.890,
    totalWeight: 8860,
    totalPrice: 4530000,
    vehicleCount: 4,
    models: ['CANTER', 'CARAVAN', 'ATLAS', 'WISH'],
    chassisPrefixes: ['FE73E', 'VW6E26', 'AKR66E', 'ZGE20'],
    createdAt: Date.now() - 3 * 86400000,
    updatedAt: Date.now() - 3 * 86400000,
  },
  // Container 5 (ISUZU ELF + TOYOTA VOXY + RUMION + ELF)
  {
    containerNo: 'CMAU7391042',
    sealOrBlNo: 'ML-JP0411883',
    extraValue: 3820,
    vehicles: [
      makeVehicle(1, 'ISUZU', 'ELF', 2990, 'D', 2013, '3819201948102941', 'NLR85A-700291', 468, 169, 196, 1, 2280000, 2490, 15.502, 'CMAU7391042'),
      makeVehicle(2, 'TOYOTA', 'VOXY', 1980, 'G', 2010, '2910294819201948', 'ZRR70-0284918', 459, 169, 185, 1, 460000, 1580, 14.351, 'CMAU7391042'),
      makeVehicle(3, 'TOYOTA', 'RUMION', 1790, 'G', 2013, '3431023303299912', 'ZRE152-4011294', 421, 176, 163, 1, 380000, 1330, 12.078, 'CMAU7391042'),
      makeVehicle(4, 'ISUZU', 'ELF', 4770, 'D', 1996, '2910294819204910', 'NPR71G7109281', 684, 204, 228, 1, 1380000, 3110, 31.815, 'CMAU7391042'),
    ],
    totalCbm: 73.746,
    totalWeight: 8510,
    totalPrice: 4500000,
    vehicleCount: 4,
    models: ['ELF', 'VOXY', 'RUMION'],
    chassisPrefixes: ['NLR85A', 'ZRR70', 'ZRE152', 'NPR71G'],
    createdAt: Date.now() - 2 * 86400000,
    updatedAt: Date.now() - 2 * 86400000,
  },
  // Container 6 (ISUZU ELF + TOYOTA HIACE + WISH + CANTER)
  {
    containerNo: 'EGLV0928410',
    sealOrBlNo: 'ML-JP0412349',
    extraValue: 3880,
    vehicles: [
      makeVehicle(1, 'ISUZU', 'ELF', 4320, 'D', 1992, '3222034001928410', 'NKR61E-7119284', 469, 169, 199, 1, 1910000, 2690, 15.773, 'EGLV0928410'),
      makeVehicle(2, 'TOYOTA', 'WISH', 1790, 'G', 2010, '36130359C1949102', 'ZGE20-0099481', 459, 169, 159, 1, 380000, 1340, 12.334, 'EGLV0928410'),
      makeVehicle(3, 'TOYOTA', 'HIACE', 2980, 'D', 2011, '3471034303188921', 'KDH206-8041928', 469, 170, 193, 1, 890000, 2190, 15.388, 'EGLV0928410'),
      makeVehicle(4, 'MITSUBISHI', 'CANTER', 4890, 'D', 2002, '4910294810294911', 'FE63EEV-540192', 679, 203, 226, 1, 1490000, 2980, 31.151, 'EGLV0928410'),
    ],
    totalCbm: 74.646,
    totalWeight: 9200,
    totalPrice: 4670000,
    vehicleCount: 4,
    models: ['ELF', 'WISH', 'HIACE', 'CANTER'],
    chassisPrefixes: ['NKR61E', 'ZGE20', 'KDH206', 'FE63EEV'],
    createdAt: Date.now() - 1 * 86400000,
    updatedAt: Date.now() - 1 * 86400000,
  },
];
