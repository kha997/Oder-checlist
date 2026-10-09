import { removeVietnameseTones } from './searchHelper';

export type PlaceType = 'condo' | 'office' | 'commercial' | 'street' | 'landmark';

export interface GooglePlaceSuggestion {
  placeId: string;
  name: string;
  mainText: string;
  secondaryText: string;
  fullAddress: string;
  type: PlaceType;
  condoName?: string;
  suggestedBlocks?: string[];
  district?: string;
  ward?: string;
  city?: string;
  lat?: number;
  lng?: number;
  isStandardized: boolean;
}

/**
 * Standardized Google Places Database for Delivery Hubs & Addresses
 */
export const STANDARDIZED_PLACES_DATABASE: GooglePlaceSuggestion[] = [
  // 1. Major Condos & Residential Complexes (TP.HCM)
  {
    placeId: 'ChIJ-sunrise-city-q7',
    name: 'Chung cư Sunrise City',
    mainText: 'Chung cư Sunrise City',
    secondaryText: '27 Nguyễn Hữu Thọ, P. Tân Hưng, Quận 7, TP. Hồ Chí Minh',
    fullAddress: '27 Nguyễn Hữu Thọ, Phường Tân Hưng, Quận 7, TP. Hồ Chí Minh',
    type: 'condo',
    condoName: 'Chung cư Sunrise City',
    suggestedBlocks: ['A', 'B', 'C', 'D', 'W1', 'W2', 'South'],
    district: 'Quận 7',
    ward: 'P. Tân Hưng',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7412,
    lng: 106.7028,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-vinhomes-grand-park-q9',
    name: 'Vinhomes Grand Park',
    mainText: 'Vinhomes Grand Park',
    secondaryText: 'Nguyễn Xiển, P. Long Thạnh Mỹ, TP. Thủ Đức, TP. Hồ Chí Minh',
    fullAddress: 'Đường Nguyễn Xiển, Phường Long Thạnh Mỹ, Thành phố Thủ Đức, TP. Hồ Chí Minh',
    type: 'condo',
    condoName: 'Vinhomes Grand Park',
    suggestedBlocks: ['S1', 'S2', 'S3', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'],
    district: 'TP. Thủ Đức',
    ward: 'P. Long Thạnh Mỹ',
    city: 'TP. Hồ Chí Minh',
    lat: 10.8443,
    lng: 106.8375,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-masteri-centre-point',
    name: 'Masteri Centre Point',
    mainText: 'Masteri Centre Point',
    secondaryText: 'Khu đô thị Vinhomes Grand Park, P. Long Bình, TP. Thủ Đức, TP. Hồ Chí Minh',
    fullAddress: 'Khu đô thị Vinhomes Grand Park, Phường Long Bình, Thành phố Thủ Đức, TP. Hồ Chí Minh',
    type: 'condo',
    condoName: 'Masteri Centre Point',
    suggestedBlocks: ['A', 'B', 'C', 'D', 'E'],
    district: 'TP. Thủ Đức',
    ward: 'P. Long Bình',
    city: 'TP. Hồ Chí Minh',
    lat: 10.8465,
    lng: 106.8402,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-landmark-81-bth',
    name: 'Landmark 81 (Vinhomes Central Park)',
    mainText: 'Landmark 81 - Vinhomes Central Park',
    secondaryText: '208 Nguyễn Hữu Cảnh, P. 22, Q. Bình Thạnh, TP. Hồ Chí Minh',
    fullAddress: '208 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh, TP. Hồ Chí Minh',
    type: 'condo',
    condoName: 'Vinhomes Central Park',
    suggestedBlocks: ['L81', 'Park 1', 'Park 2', 'Central 1', 'Central 2', 'Central 3'],
    district: 'Q. Bình Thạnh',
    ward: 'P. 22',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7951,
    lng: 106.7218,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-masteri-thao-dien',
    name: 'Masteri Thảo Điền',
    mainText: 'Masteri Thảo Điền',
    secondaryText: '159 Xa Lộ Hà Nội, P. Thảo Điền, TP. Thủ Đức, TP. Hồ Chí Minh',
    fullAddress: '159 Xa Lộ Hà Nội, Phường Thảo Điền, Thành phố Thủ Đức, TP. Hồ Chí Minh',
    type: 'condo',
    condoName: 'Masteri Thảo Điền',
    suggestedBlocks: ['T1', 'T2', 'T3', 'T4', 'T5'],
    district: 'TP. Thủ Đức',
    ward: 'P. Thảo Điền',
    city: 'TP. Hồ Chí Minh',
    lat: 10.8037,
    lng: 106.7381,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-saigon-pearl',
    name: 'Saigon Pearl',
    mainText: 'Chung cư Saigon Pearl',
    secondaryText: '92 Nguyễn Hữu Cảnh, P. 22, Q. Bình Thạnh, TP. Hồ Chí Minh',
    fullAddress: '92 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh, TP. Hồ Chí Minh',
    type: 'condo',
    condoName: 'Saigon Pearl',
    suggestedBlocks: ['Ruby', 'Topaz', 'Sapphire'],
    district: 'Q. Bình Thạnh',
    ward: 'P. 22',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7904,
    lng: 106.7169,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-sky-garden-pmh',
    name: 'Sky Garden (Phú Mỹ Hưng)',
    mainText: 'Chung cư Sky Garden',
    secondaryText: 'Đường Phạm Văn Nghị, P. Tân Phong, Quận 7, TP. Hồ Chí Minh',
    fullAddress: 'Khu đô thị Phú Mỹ Hưng, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh',
    type: 'condo',
    condoName: 'Sky Garden Phú Mỹ Hưng',
    suggestedBlocks: ['1', '2', '3', 'A', 'B', 'C'],
    district: 'Quận 7',
    ward: 'P. Tân Phong',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7301,
    lng: 106.7083,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-the-manor-hcm',
    name: 'The Manor Officetel & Apartments',
    mainText: 'The Manor Officetel & Apartments',
    secondaryText: '91 Nguyễn Hữu Cảnh, P. 22, Q. Bình Thạnh, TP. Hồ Chí Minh',
    fullAddress: '91 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh, TP. Hồ Chí Minh',
    type: 'condo',
    condoName: 'The Manor',
    suggestedBlocks: ['A', 'B', 'Officetel'],
    district: 'Q. Bình Thạnh',
    ward: 'P. 22',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7915,
    lng: 106.7176,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-diamond-island',
    name: 'Đảo Kim Cương (Diamond Island)',
    mainText: 'Đảo Kim Cương (Diamond Island)',
    secondaryText: 'Số 1 Đường 104-BTT, P. Bình Trưng Tây, TP. Thủ Đức, TP. Hồ Chí Minh',
    fullAddress: 'Số 1 Đường 104-BTT, Phường Bình Trưng Tây, Thành phố Thủ Đức, TP. Hồ Chí Minh',
    type: 'condo',
    condoName: 'Diamond Island',
    suggestedBlocks: ['Brilliant', 'Hawaii', 'Bora Bora', 'Canary', 'Bahamas', 'Maldives'],
    district: 'TP. Thủ Đức',
    ward: 'P. Bình Trưng Tây',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7712,
    lng: 106.7554,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-estella-heights',
    name: 'Estella Heights',
    mainText: 'Estella Heights',
    secondaryText: '88 Song Hành, P. An Phú, TP. Thủ Đức, TP. Hồ Chí Minh',
    fullAddress: '88 Song Hành, Phường An Phú, Thành phố Thủ Đức, TP. Hồ Chí Minh',
    type: 'condo',
    condoName: 'Estella Heights',
    suggestedBlocks: ['T1', 'T2', 'T3', 'T4'],
    district: 'TP. Thủ Đức',
    ward: 'P. An Phú',
    city: 'TP. Hồ Chí Minh',
    lat: 10.8012,
    lng: 106.7461,
    isStandardized: true,
  },

  // 2. Commercial Towers & Offices
  {
    placeId: 'ChIJ-bitexco-financial-tower',
    name: 'Bitexco Financial Tower',
    mainText: 'Tòa nhà Bitexco Financial Tower',
    secondaryText: '2 Hải Triều, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    fullAddress: '2 Hải Triều, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    type: 'office',
    district: 'Quận 1',
    ward: 'P. Bến Nghé',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7717,
    lng: 106.7044,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-saigon-centre-takashimaya',
    name: 'Saigon Centre & Takashimaya',
    mainText: 'Saigon Centre (Takashimaya)',
    secondaryText: '65 Lê Lợi, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    fullAddress: '65 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    type: 'commercial',
    district: 'Quận 1',
    ward: 'P. Bến Nghé',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7734,
    lng: 106.7011,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-ab-tower-le-lai',
    name: 'Tòa nhà AB Tower',
    mainText: 'AB Tower (Sảnh bảo vệ & Lễ tân)',
    secondaryText: '76A Lê Lai, P. Bến Thành, Quận 1, TP. Hồ Chí Minh',
    fullAddress: '76A Lê Lai, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    type: 'office',
    district: 'Quận 1',
    ward: 'P. Bến Thành',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7711,
    lng: 106.6953,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-vietcombank-tower-q1',
    name: 'Vietcombank Tower',
    mainText: 'Vietcombank Tower Saigon',
    secondaryText: '5 Công Trường Mê Linh, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    fullAddress: '5 Công Trường Mê Linh, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    type: 'office',
    district: 'Quận 1',
    ward: 'P. Bến Nghé',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7758,
    lng: 106.7063,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-lim-tower-1',
    name: 'Lim Tower 1',
    mainText: 'Lim Tower 1',
    secondaryText: '9-11 Tôn Đức Thắng, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    fullAddress: '9-11 Tôn Đức Thắng, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    type: 'office',
    district: 'Quận 1',
    ward: 'P. Bến Nghé',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7801,
    lng: 106.7052,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-deutsches-haus',
    name: 'Ngôi Nhà Đức (Deutsches Haus)',
    mainText: 'Deutsches Haus Ho Chi Minh City',
    secondaryText: '33 Lê Duẩn, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    fullAddress: '33 Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    type: 'office',
    district: 'Quận 1',
    ward: 'P. Bến Nghé',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7818,
    lng: 106.7005,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-vincom-center-dong-khoi',
    name: 'Vincom Center Đồng Khởi',
    mainText: 'Vincom Center Đồng Khởi',
    secondaryText: '72 Lê Thánh Tôn, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    fullAddress: '72 Lê Thánh Tôn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    type: 'commercial',
    district: 'Quận 1',
    ward: 'P. Bến Nghé',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7781,
    lng: 106.7019,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-crescent-mall-q7',
    name: 'Crescent Mall Phú Mỹ Hưng',
    mainText: 'TTTM Crescent Mall',
    secondaryText: '101 Tôn Dật Tiên, P. Tân Phú, Quận 7, TP. Hồ Chí Minh',
    fullAddress: '101 Tôn Dật Tiên, Phường Tân Phú, Quận 7, TP. Hồ Chí Minh',
    type: 'commercial',
    district: 'Quận 7',
    ward: 'P. Tân Phú',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7294,
    lng: 106.7219,
    isStandardized: true,
  },

  // 3. Popular Street Addresses & Major Delivery Zones
  {
    placeId: 'ChIJ-72-le-loi-q1',
    name: '72 Lê Lợi, Bến Nghé, Q.1',
    mainText: '72 Lê Lợi',
    secondaryText: 'P. Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    fullAddress: '72 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    type: 'street',
    district: 'Quận 1',
    ward: 'P. Bến Nghé',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7725,
    lng: 106.7008,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-128-nguyen-trai-q1',
    name: '128 Nguyễn Trãi, Bến Thành, Q.1',
    mainText: '128 Nguyễn Trãi',
    secondaryText: 'P. Bến Thành, Quận 1, TP. Hồ Chí Minh',
    fullAddress: '128 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    type: 'street',
    district: 'Quận 1',
    ward: 'P. Bến Thành',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7689,
    lng: 106.6905,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-pho-di-bo-nguyen-hue',
    name: 'Phố Đi Bộ Nguyễn Huệ',
    mainText: 'Phố Đi Bộ Nguyễn Huệ',
    secondaryText: 'Đường Nguyễn Huệ, P. Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    fullAddress: 'Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    type: 'landmark',
    district: 'Quận 1',
    ward: 'P. Bến Nghé',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7744,
    lng: 106.7032,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-cho-ben-thanh',
    name: 'Chợ Bến Thành',
    mainText: 'Chợ Bến Thành',
    secondaryText: 'Đường Lê Lợi, P. Bến Thành, Quận 1, TP. Hồ Chí Minh',
    fullAddress: 'Đường Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    type: 'landmark',
    district: 'Quận 1',
    ward: 'P. Bến Thành',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7725,
    lng: 106.6981,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-23-thang-9-park',
    name: 'Công Viên 23 Tháng 9',
    mainText: 'Công Viên 23 Tháng 9',
    secondaryText: 'Đường Phạm Ngũ Lão, P. Phạm Ngũ Lão, Quận 1, TP. Hồ Chí Minh',
    fullAddress: 'Đường Phạm Ngũ Lão, Phường Phạm Ngũ Lão, Quận 1, TP. Hồ Chí Minh',
    type: 'landmark',
    district: 'Quận 1',
    ward: 'P. Phạm Ngũ Lão',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7682,
    lng: 106.6934,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-ho-con-rua-q3',
    name: 'Hồ Con Rùa',
    mainText: 'Hồ Con Rùa (Công trường Quốc Tế)',
    secondaryText: 'P. Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
    fullAddress: 'Công trường Quốc Tế, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh',
    type: 'landmark',
    district: 'Quận 3',
    ward: 'P. Võ Thị Sáu',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7825,
    lng: 106.6961,
    isStandardized: true,
  },
  {
    placeId: 'ChIJ-phan-xich-long-pn',
    name: 'Khu Phố Ẩm Thực Phan Xích Long',
    mainText: 'Đường Phan Xích Long',
    secondaryText: 'P. 2 & P. 7, Q. Phú Nhuận, TP. Hồ Chí Minh',
    fullAddress: 'Đường Phan Xích Long, Phường 2, Quận Phú Nhuận, TP. Hồ Chí Minh',
    type: 'street',
    district: 'Q. Phú Nhuận',
    ward: 'P. 2',
    city: 'TP. Hồ Chí Minh',
    lat: 10.7984,
    lng: 106.6892,
    isStandardized: true,
  },
];

/**
 * Searches places against standardized database using Google Places-like autocomplete behavior
 */
export function searchStandardizedPlaces(query: string, filterType?: PlaceType | 'all'): GooglePlaceSuggestion[] {
  const cleanQ = removeVietnameseTones(query.trim().toLowerCase());
  if (!cleanQ) {
    if (filterType && filterType !== 'all') {
      return STANDARDIZED_PLACES_DATABASE.filter((p) => p.type === filterType).slice(0, 8);
    }
    return STANDARDIZED_PLACES_DATABASE.slice(0, 8);
  }

  const queryTokens = cleanQ.split(/\s+/).filter(Boolean);

  const matched = STANDARDIZED_PLACES_DATABASE.filter((place) => {
    if (filterType && filterType !== 'all' && place.type !== filterType) {
      return false;
    }

    const targetSearchText = removeVietnameseTones(
      `${place.name} ${place.mainText} ${place.secondaryText} ${place.fullAddress} ${place.district || ''} ${place.ward || ''} ${place.condoName || ''}`.toLowerCase()
    );

    // Exact full query match gets top priority
    if (targetSearchText.includes(cleanQ)) return true;

    // Multi-token match
    return queryTokens.every((token) => targetSearchText.includes(token));
  });

  // Sort with highest relevance first
  return matched.sort((a, b) => {
    const aClean = removeVietnameseTones(a.mainText.toLowerCase());
    const bClean = removeVietnameseTones(b.mainText.toLowerCase());

    const aStarts = aClean.startsWith(cleanQ);
    const bStarts = bClean.startsWith(cleanQ);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    return a.mainText.localeCompare(b.mainText);
  });
}

/**
 * Generates an accurate, standardized delivery address formatted string
 */
export function formatStandardizedDeliveryLocation(params: {
  place: GooglePlaceSuggestion;
  block?: string;
  floor?: string;
  unit?: string;
  roomOrFloorNote?: string;
}): string {
  const { place, block, floor, unit, roomOrFloorNote } = params;

  if (place.type === 'condo') {
    const b = block ? block.trim().toUpperCase() : 'B';
    const f = floor ? floor.trim().padStart(2, '0') : '01';
    const u = unit ? unit.trim().padStart(2, '0') : '01';
    return `${b}-${f}-${u} (${place.name}, ${place.district || ''})`.replace(', )', ')');
  }

  // Office / Commercial / Street
  const prefix = roomOrFloorNote ? `${roomOrFloorNote.trim()}, ` : '';
  return `${prefix}${place.fullAddress}`;
}
