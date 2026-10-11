'use strict';
// ───────────────────────── game data ─────────────────────────
const START_YEAR = 2026;
const START_CASH = 1000000;
const SALES_TAX = 0.05;        // property sales tax (stamp duty) on purchases
const SELL_COMMISSION = 0.025; // agent commission when selling
const INCOME_TAX = 0.25;       // on positive net rental income
const LAND_PER_TILE = 50000;

// Segments drive demand. Zones gate what can be built.
const SEGMENTS = { res: 'Residential', com: 'Commercial', ind: 'Industrial', agri: 'Agricultural', hosp: 'Hospitality' };
const ZONES = {
  R1: { name: 'Low-density homes', short: 'R1', tier: 1, seg: 'res', color: '#7fc06a' },
  R2: { name: 'Medium-density homes', short: 'R2', tier: 2, seg: 'res', color: '#e0b84a' },
  R3: { name: 'High-density towers', short: 'R3', tier: 3, seg: 'res', color: '#e07a3a' },
  C1: { name: 'Local commercial', short: 'C1', tier: 2, seg: 'com', color: '#5aa9d8' },
  C2: { name: 'City commercial', short: 'C2', tier: 3, seg: 'com', color: '#3a6fc0' },
  I: { name: 'Industrial', short: 'I', tier: 2, seg: 'ind', color: '#9a8f86' },
  A: { name: 'Agricultural', short: 'A', tier: 1, seg: 'agri', color: '#b8a24a' },
  T: { name: 'Tourism & resort', short: 'T', tier: 3, seg: 'hosp', color: '#d0679a' },
};
const LUX = ['Basic', 'Standard', 'Premium', 'Luxury'];
const LUX_V = [0.86, 1, 1.15, 1.32];   // value multiplier
const LUX_C = [0.85, 1, 1.32, 1.8];    // construction cost multiplier
const LUX_FIT = [
  'Laminate benches, vinyl floors, basic appliances',
  'Laminate & tile, carpeted bedrooms, standard appliances',
  'Stone benchtops, oak floors, designer lighting',
  'Marble, smart-home everything, chef’s kitchen',
];

// cat: res | com | ind | agri | hosp | civic | land.  lots: allowed footprints [w,d]. base: value of the first footprint
// at the kind's default size (f0 floors) and fittings (lux). fl: floors used when generating; bf: floors allowed when building.
// unitSqm: floor area per unit (res) or per tenancy (com). beds/baths per residential unit.
const KINDS = {
  cottage:     { name: 'Cottage', cat: 'res', lots: [[2, 2]], base: 395000, yield: 0.049, top: 80, zone: 'R1', style: 'Heritage', lux: 1, sqm: 110, beds: 2, baths: 1, build: true },
  house:       { name: 'House', cat: 'res', lots: [[2, 2]], base: 640000, yield: 0.046, top: 86, zone: 'R1', style: 'Classic', lux: 1, sqm: 185, beds: 3, baths: 2, build: true },
  duplex:      { name: 'Duplex', cat: 'res', lots: [[2, 2]], base: 830000, yield: 0.047, top: 86, zone: 'R2', style: 'Classic', lux: 1, sqm: 135, beds: 3, baths: 2, units: 2, build: true },
  townhouse:   { name: 'Townhouses', cat: 'res', lots: [[2, 2], [2, 4], [4, 2], [4, 4]], base: 760000, yield: 0.047, top: 96, zone: 'R2', style: 'Heritage', lux: 1, sqm: 120, beds: 3, baths: 2, build: true },
  villa:       { name: 'Villa', cat: 'res', lots: [[2, 2]], base: 1480000, yield: 0.039, top: 84, zone: 'R1', style: 'Modern', lux: 2, sqm: 320, beds: 4, baths: 3, pool: true, build: true },
  mansion:     { name: 'Mansion', cat: 'res', lots: [[4, 4]], base: 5600000, yield: 0.031, top: 116, zone: 'R1', style: 'Classic', lux: 3, sqm: 850, beds: 6, baths: 5, pool: true, build: true },
  apartment:   { name: 'Apartments', cat: 'res', lots: [[2, 2], [2, 4], [4, 2], [4, 4]], base: 3300000, yield: 0.051, top: 150, zone: 'R2', style: 'Modern', lux: 1, sqm: 72, beds: 2, baths: 1, strata: true, fl: [4, 6], f0: 5, bf: [3, 9], build: true },
  condotower:  { name: 'Condo Tower', cat: 'res', lots: [[2, 2]], base: 12400000, yield: 0.048, top: 440, zone: 'R3', style: 'Modern', lux: 2, sqm: 85, beds: 2, baths: 2, strata: true, fl: [16, 22], f0: 19, bf: [12, 40], build: true },
  chalet:      { name: 'Chalet', cat: 'res', lots: [[2, 2]], base: 1150000, yield: 0.044, top: 92, zone: 'R1', style: 'Alpine', lux: 2, sqm: 210, beds: 4, baths: 3, build: true, only: 'snow' },
  cabin:       { name: 'Log Cabin', cat: 'res', lots: [[2, 2]], base: 470000, yield: 0.05, top: 76, zone: 'R1', style: 'Alpine', lux: 1, sqm: 95, beds: 2, baths: 1, build: true, only: 'snow' },
  lakehouse:   { name: 'Lake House', cat: 'res', lots: [[2, 2]], base: 2350000, yield: 0.036, top: 84, zone: 'R1', style: 'Modern', lux: 3, sqm: 300, beds: 5, baths: 4, build: true, only: 'lake' },
  beachvilla:  { name: 'Beach House', cat: 'res', lots: [[2, 2]], base: 1550000, yield: 0.042, top: 80, zone: 'R1', style: 'Coastal', lux: 2, sqm: 220, beds: 4, baths: 3, build: true, only: 'beach' },
  cornerstore: { name: 'Corner Store', cat: 'com', lots: [[2, 2]], base: 520000, yield: 0.068, top: 76, zone: 'C1', style: 'Heritage', lux: 1, sqm: 150, build: true },
  cafe:        { name: 'Café', cat: 'com', lots: [[2, 2]], base: 760000, yield: 0.066, top: 76, zone: 'C1', style: 'Heritage', lux: 1, sqm: 140, build: true },
  skishop:     { name: 'Ski Shop', cat: 'com', lots: [[2, 2]], base: 640000, yield: 0.068, top: 84, zone: 'C1', style: 'Alpine', lux: 1, sqm: 160, build: true, only: 'snow' },
  beachbar:    { name: 'Beach Bar', cat: 'com', lots: [[2, 2]], base: 690000, yield: 0.07, top: 76, zone: 'C1', style: 'Coastal', lux: 1, sqm: 130, build: true, only: 'beach' },
  retail:      { name: 'Retail Strip', cat: 'com', lots: [[2, 4], [4, 2], [4, 4]], base: 2150000, yield: 0.07, top: 76, zone: 'C1', style: 'Modern', lux: 1, sqm: 150, units: 4, build: true },
  office:      { name: 'Office Block', cat: 'com', lots: [[2, 2]], base: 4900000, yield: 0.064, top: 170, zone: 'C1', style: 'Modern', lux: 1, sqm: 420, strata: true, fl: [5, 8], f0: 6, bf: [3, 12], build: true },
  officetower: { name: 'Office Tower', cat: 'com', lots: [[2, 2]], base: 24500000, yield: 0.058, top: 560, zone: 'C2', style: 'Modern', lux: 2, sqm: 650, strata: true, fl: [22, 30], f0: 26, bf: [15, 50], build: true },
  mall:        { name: 'Shopping Mall', cat: 'com', lots: [[4, 4]], base: 31000000, yield: 0.062, top: 110, zone: 'C2', style: 'Modern', lux: 1, sqm: 700, units: 24, strata: true, build: true },
  hotel:       { name: 'Hotel', cat: 'hosp', lots: [[2, 2]], base: 9600000, yield: 0.06, top: 330, zone: 'C2', style: 'Classic', lux: 2, sqm: 9000, strata: true, fl: [10, 14], f0: 12, bf: [6, 30], build: true },
  resort:      { name: 'Beach Resort', cat: 'hosp', lots: [[4, 4]], base: 17500000, yield: 0.061, top: 120, zone: 'T', style: 'Coastal', lux: 3, sqm: 14000, build: true, only: 'beach' },
  skilodge:    { name: 'Ski Lodge', cat: 'hosp', lots: [[4, 4]], base: 8800000, yield: 0.062, top: 120, zone: 'T', style: 'Alpine', lux: 2, sqm: 6500, build: true, only: 'snow' },
  warehouse:   { name: 'Warehouse', cat: 'ind', lots: [[2, 4], [4, 2], [4, 4]], base: 2300000, yield: 0.073, top: 76, zone: 'I', style: 'Industrial', lux: 1, sqm: 2400, build: true },
  factory:     { name: 'Factory', cat: 'ind', lots: [[2, 4], [4, 2], [4, 4]], base: 3200000, yield: 0.075, top: 150, zone: 'I', style: 'Industrial', lux: 1, sqm: 3000, build: true },
  containeryard: { name: 'Container Yard', cat: 'ind', lots: [[4, 4]], base: 4100000, yield: 0.078, top: 90, zone: 'I', style: 'Industrial', lux: 1, sqm: 9000 },
  farm:        { name: 'Farm', cat: 'agri', lots: [[4, 4]], base: 1850000, yield: 0.052, top: 110, zone: 'A', style: 'Farmhouse', lux: 1, sqm: 160000, build: true },
  field:       { name: 'Wheat Field', cat: 'agri', lots: [[4, 4]], base: 920000, yield: 0.055, top: 60, zone: 'A', style: 'Farmhouse', lux: 1, sqm: 160000 },
  vineyard:    { name: 'Vineyard', cat: 'agri', lots: [[4, 4]], base: 2250000, yield: 0.05, top: 80, zone: 'A', style: 'Farmhouse', lux: 2, sqm: 160000, build: true },
  orchard:     { name: 'Orchard', cat: 'agri', lots: [[4, 4]], base: 1400000, yield: 0.054, top: 70, zone: 'A', style: 'Farmhouse', lux: 1, sqm: 160000 },
  site:        { name: 'Construction Site', cat: 'land', lots: [[2, 2], [2, 4], [4, 2], [4, 4]], base: 0, yield: 0, top: 60, zone: null, style: null, lux: 0, sqm: 0 },
  land:        { name: 'Vacant Land', cat: 'land', lots: [[2, 2], [4, 4]], base: 0, yield: 0, top: 50, zone: null, style: null, lux: 0, sqm: 0 },
  park:        { name: 'Park', cat: 'civic', lots: [[4, 4]], top: 60 },
  sportsfield: { name: 'Sports Ground', cat: 'civic', lots: [[4, 4]], top: 66 },
  plaza:       { name: 'Town Plaza', cat: 'civic', lots: [[4, 4], [2, 2]], top: 60 },
  trees:       { name: 'Bushland', cat: 'civic', lots: [[1, 1]], top: 60 },
  mountain:    { name: 'Mount Frost', cat: 'civic', lots: [[4, 4]], top: 240 },
  skislope:    { name: 'Ski Run', cat: 'civic', lots: [[4, 4]], top: 150 },
  powerplant:  { name: 'Power Station', cat: 'civic', lots: [[4, 4]], top: 190 },
  golf:        { name: 'Golf Course', cat: 'civic', lots: [[4, 4]], top: 60 },
};
const isProperty = (k) => { const c = KINDS[k].cat; return c !== 'civic'; };
const isBuilding = (k) => { const c = KINDS[k].cat; return c !== 'civic' && c !== 'land'; };
const segOf = (k) => { const c = KINDS[k].cat; return c === 'land' || c === 'civic' ? 'res' : c; };

// which kinds each zone may hold
const ZONE_KINDS = {
  R1: ['cottage', 'house', 'villa', 'mansion', 'chalet', 'cabin', 'lakehouse', 'beachvilla'],
  R2: ['duplex', 'townhouse', 'apartment', 'cottage', 'house'],
  R3: ['apartment', 'condotower', 'townhouse'],
  C1: ['cornerstore', 'cafe', 'skishop', 'beachbar', 'retail', 'office'],
  C2: ['office', 'officetower', 'mall', 'hotel', 'retail'],
  I: ['warehouse', 'factory'],
  A: ['farm', 'vineyard'],
  T: ['hotel', 'resort', 'skilodge', 'beachbar'],
};

// style: ground look. zones: zones the council allows here without a fight.
// dem: starting demand per segment.  pref: tags locals pay more for.
const DISTRICTS = [
  { id: 'cbd', name: 'Centropolis CBD', seed: [53, 47], mult: 1.7, growth: 0.052, vol: 0.006, grass: '#86bb57', style: 'city',
    blurb: 'Glass towers, power lunches and the best skyline views on the island.', zones: ['C1', 'C2', 'R2', 'R3'],
    dem: { res: 1.05, com: 1.15, hosp: 1.1, ind: 0.7, agri: 0.5 }, pref: { view: 0.14, gym: 0.06, Modern: 0.05, rooftop: 0.05, fitout: 0.06 },
    w: { officetower: 3, office: 4, hotel: 2, condotower: 3, apartment: 2, cafe: 2, retail: 1, mall: 1, plaza: 1.4, park: 0.4 } },
  { id: 'harbour', name: 'Harbourside', seed: [51, 66], mult: 1.55, growth: 0.056, vol: 0.008, grass: '#8cc05b', style: 'city',
    blurb: 'Sailboats, seafood and sunset apartments along the bay.', zones: ['R1', 'R2', 'R3', 'C1'],
    dem: { res: 1.12, com: 1.0, hosp: 1.1, ind: 0.6, agri: 0.5 }, pref: { waterfront: 0.15, view: 0.08, pool: 0.05, dock: 0.06 },
    w: { condotower: 2, apartment: 3, villa: 3, cafe: 2, hotel: 1, townhouse: 2, park: 0.8, plaza: 0.5 } },
  { id: 'lychee', name: 'Lychee', seed: [33, 50], mult: 1.0, growth: 0.046, vol: 0.005, grass: '#93c45c', style: 'suburb',
    blurb: 'Leafy family streets, good schools and Saturday sport.', zones: ['R1', 'R2', 'C1'],
    dem: { res: 1.08, com: 0.95, hosp: 0.8, ind: 0.6, agri: 0.6 }, pref: { family: 0.1, garage: 0.06, garden: 0.06, Heritage: 0.04 },
    w: { house: 5, cottage: 4, townhouse: 2, duplex: 2, cornerstore: 1, cafe: 0.7, park: 0.8, apartment: 0.5, land: 0.5 } },
  { id: 'rhodes', name: 'Rhodeshurst', seed: [42, 34], mult: 1.15, growth: 0.05, vol: 0.006, grass: '#8fc259', style: 'suburb',
    blurb: 'Creative riverside lanes full of terraces, studios and brunch spots.', zones: ['R1', 'R2', 'C1'],
    dem: { res: 1.06, com: 1.05, hosp: 0.9, ind: 0.6, agri: 0.5 }, pref: { Heritage: 0.08, suite: 0.06, fitout: 0.05 },
    w: { townhouse: 3, apartment: 3, house: 2, cafe: 1.5, cornerstore: 1, office: 1, retail: 1, park: 0.8 } },
  { id: 'rouse', name: 'Rousebrooke', seed: [62, 34], mult: 0.92, growth: 0.042, vol: 0.005, grass: '#98c65e', style: 'suburb',
    blurb: 'Affordable starter homes with big backyards and a sports ground.', zones: ['R1', 'R2', 'C1'],
    dem: { res: 1.0, com: 0.9, hosp: 0.7, ind: 0.7, agri: 0.6 }, pref: { garden: 0.08, family: 0.08, garage: 0.05 },
    w: { house: 4, cottage: 3, duplex: 2, sportsfield: 0.8, park: 1.2, cornerstore: 1, retail: 0.5, land: 0.7 } },
  { id: 'iron', name: 'Ironvale', seed: [70, 50], mult: 0.78, growth: 0.036, vol: 0.008, grass: '#a3bf63', style: 'industrial',
    blurb: 'Factories, freight and smokestacks. Gritty, cheap and full of potential.', zones: ['I', 'C1'],
    dem: { res: 0.8, com: 0.9, hosp: 0.6, ind: 1.15, agri: 0.5 }, pref: { Industrial: 0.08, automation: 0.08, green: 0.05 },
    w: { warehouse: 4, factory: 4, retail: 1, cornerstore: 1, office: 1, powerplant: 0.6, land: 0.8 } },
  { id: 'maple', name: 'Maple Heights', seed: [34, 66], mult: 1.35, growth: 0.05, vol: 0.006, grass: '#8abf5c', style: 'suburb',
    blurb: 'Old money, autumn maples and very quiet streets.', zones: ['R1'],
    dem: { res: 1.1, com: 0.85, hosp: 0.8, ind: 0.4, agri: 0.5 }, pref: { luxury: 0.1, pool: 0.06, Classic: 0.06, garden: 0.05 },
    w: { villa: 4, mansion: 1.6, house: 3, park: 1.2, cafe: 0.5 } },
  { id: 'kings', name: 'Kingsbridge', seed: [64, 66], mult: 1.1, growth: 0.048, vol: 0.006, grass: '#91c35b', style: 'suburb',
    blurb: 'A busy high street of shops, cafés and terraces by the bridge.', zones: ['R1', 'R2', 'C1', 'C2'],
    dem: { res: 1.04, com: 1.08, hosp: 0.9, ind: 0.6, agri: 0.5 }, pref: { fitout: 0.06, suite: 0.05, Heritage: 0.05 },
    w: { townhouse: 3, retail: 2, cafe: 2, cornerstore: 2, house: 2, apartment: 2, mall: 0.6, office: 1 } },
  { id: 'alpine', name: 'Alpine Ridge', seed: [16, 15], mult: 1.2, growth: 0.05, vol: 0.011, grass: '#e9f1f6', style: 'snow',
    blurb: 'A snowy ski village under Mount Frost. Booming in winter, sleepy in summer.', zones: ['R1', 'C1', 'T'],
    dem: { res: 0.95, com: 1.0, hosp: 1.2, ind: 0.4, agri: 0.4 }, pref: { Alpine: 0.12, cozy: 0.14, garage: 0.04 },
    w: { chalet: 4, cabin: 3, skishop: 1.5, skilodge: 1.2, hotel: 0.6, mountain: 5, skislope: 2.2, land: 0.5 } },
  { id: 'lake', name: 'Lake Serene', seed: [83, 17], mult: 1.65, growth: 0.054, vol: 0.007, grass: '#82c05e', style: 'lake',
    blurb: 'Glassy water, private jetties and the fanciest dinner parties in the state.', zones: ['R1', 'T'],
    dem: { res: 1.12, com: 0.8, hosp: 1.0, ind: 0.3, agri: 0.5 }, pref: { waterfront: 0.16, luxury: 0.14, dock: 0.08, pool: 0.05 },
    w: { lakehouse: 5, mansion: 2, villa: 2, cafe: 0.6, golf: 0.9, hotel: 0.4, land: 0.4 } },
  { id: 'farm', name: 'Haybrook', seed: [17, 83], mult: 0.62, growth: 0.04, vol: 0.009, grass: '#a9c766', style: 'farm',
    blurb: 'Wheat, wine and windmills. Land is cheap and the sunsets are free.', zones: ['A', 'R1', 'C1'],
    dem: { res: 0.85, com: 0.8, hosp: 0.8, ind: 0.7, agri: 1.15 }, pref: { Farmhouse: 0.1, green: 0.08, large: 0.06 },
    w: { farm: 3, field: 4, vineyard: 2, orchard: 2, cottage: 0.6, cornerstore: 0.4, land: 0.5 } },
  { id: 'coral', name: 'Coral Key', seed: [88, 88], mult: 1.45, growth: 0.058, vol: 0.012, grass: '#7fcf6a', style: 'beach',
    blurb: 'A palm-fringed island of surf, resorts and barefoot money.', zones: ['R1', 'C1', 'T'],
    dem: { res: 1.0, com: 1.0, hosp: 1.2, ind: 0.3, agri: 0.4 }, pref: { Coastal: 0.12, pool: 0.1, waterfront: 0.14, spa: 0.06 },
    w: { beachvilla: 5, beachbar: 2, resort: 1.4, villa: 1.5, cafe: 1, land: 0.6 } },
  { id: 'port', name: 'Portside', seed: [86, 55], mult: 0.85, growth: 0.04, vol: 0.009, grass: '#a6bb6a', style: 'industrial',
    blurb: 'Cranes, containers and the island’s busiest docks.', zones: ['I', 'C1'],
    dem: { res: 0.75, com: 0.95, hosp: 0.6, ind: 1.2, agri: 0.4 }, pref: { automation: 0.1, Industrial: 0.06 },
    w: { containeryard: 3, warehouse: 3, factory: 2, office: 0.8, cornerstore: 0.6, land: 0.6 } },
];
const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));

const STREETS_X = ['Kestrel St', 'Wattle Ave', 'Juniper Ln', 'Copper St', 'Bramble Way', 'Lantern St', 'Orchard Ave', 'Marigold Cres', 'Saltbush Rd', 'Pelican Pde', 'Ember St', 'Tinker St', 'Fern Gully Rd', 'Snowgum Way', 'Lakeview Dr', 'Coral Cres', 'Harvest Ln', 'Dockside Rd', 'Pine Ridge Rd', 'Sunset Blvd'];
const STREETS_Y = ['Grand Blvd', 'Union St', 'Maple Dr', 'Ferry Rd', 'Bellbird Ave', 'Station St', 'Willow Way', 'Market St', 'Clover Rd', 'Regent St', 'Seaview Tce', 'Quarry Rd', 'Chairlift Rd', 'Jetty Rd', 'Windmill Ln', 'Palm Ave', 'Barley St', 'Crane St', 'Summit Rd', 'Lagoon Rd'];

// ── upgrades: cost & effect as a share of property value ──
// val: value boost, rent: rent boost, tag: what tenants see, vis: visible on the map
const UPGRADES = {
  fittings:  { name: 'Premium fittings', desc: 'Raises the fittings one level (kitchen, floors, lighting).', kinds: 'resCom', cost: 0.09, repeat: true, tag: null },
  extension: { name: 'Extension', desc: 'Adds a bedroom and living space.', kinds: ['cottage', 'house', 'chalet', 'cabin', 'beachvilla'], cost: 0.1, val: 0.11, rent: 0.09, beds: 1, tag: 'large', vis: true },
  suite:     { name: 'Secondary suite', desc: 'A self-contained granny flat. Adds a rentable unit.', kinds: ['cottage', 'house', 'chalet', 'lakehouse', 'beachvilla', 'villa'], cost: 0.1, val: 0.08, units: 1, tag: 'suite', vis: true },
  pool:      { name: 'Swimming pool', desc: 'Sparkling backyard pool.', kinds: ['cottage', 'house', 'chalet', 'lakehouse', 'beachvilla', 'duplex'], cost: 0.06, val: 0.07, rent: 0.05, tag: 'pool', vis: true },
  garage:    { name: 'Double garage', desc: 'Off-street parking and storage.', kinds: ['cottage', 'cabin', 'chalet', 'lakehouse', 'beachvilla', 'villa'], cost: 0.035, val: 0.04, rent: 0.03, tag: 'garage', vis: true },
  landscaping: { name: 'Landscaped garden', desc: 'Lush gardens. Homes let faster.', kinds: 'resSingle', cost: 0.02, val: 0.03, fill: 0.12, tag: 'garden', vis: true },
  solar:     { name: 'Solar panels', desc: 'Cuts upkeep costs by 15%.', kinds: 'building', cost: 0.025, val: 0.02, maint: -0.15, tag: 'green', vis: true },
  dock:      { name: 'Private jetty', desc: 'A jetty for the boat. Waterfront buyers love it.', kinds: ['lakehouse', 'beachvilla', 'villa', 'mansion'], water: true, cost: 0.04, val: 0.06, rent: 0.03, tag: 'dock', vis: true },
  hottub:    { name: 'Hot tub & fireplace', desc: 'Cozy après-ski comfort.', kinds: ['chalet', 'cabin', 'lakehouse'], cost: 0.03, val: 0.03, rent: 0.06, tag: 'cozy', vis: true },
  gym:       { name: 'Residents’ gym', desc: 'Gym and lounge for tenants.', kinds: ['apartment', 'condotower', 'office', 'officetower', 'hotel'], cost: 0.03, val: 0.03, rent: 0.04, tag: 'gym' },
  rooftop:   { name: 'Rooftop garden', desc: 'A green rooftop terrace.', kinds: ['apartment', 'condotower', 'office', 'officetower', 'hotel'], cost: 0.03, val: 0.04, rent: 0.02, tag: 'rooftop', vis: true },
  fitout:    { name: 'Modern fit-out', desc: 'Move-in-ready commercial interiors.', kinds: ['office', 'officetower', 'retail', 'mall', 'cafe', 'cornerstore', 'skishop', 'beachbar'], cost: 0.05, val: 0.05, rent: 0.06, tag: 'fitout' },
  spa:       { name: 'Day spa', desc: 'Guests pay more for a spa.', kinds: ['hotel', 'resort', 'skilodge'], cost: 0.05, val: 0.05, rent: 0.07, tag: 'spa' },
  automation:{ name: 'Automation', desc: 'Robots and smart racking.', kinds: ['warehouse', 'factory', 'containeryard'], cost: 0.05, val: 0.05, rent: 0.07, tag: 'automation' },
  irrigation:{ name: 'Irrigation', desc: 'Drought-proof crops.', kinds: ['farm', 'field', 'vineyard', 'orchard'], cost: 0.05, val: 0.05, rent: 0.08, tag: 'green', vis: true },
};

const LENDERS = [
  { id: 'centro', name: 'Centro Savings Bank', margin: 0.012, minDep: 0.2, minRep: -20, color: '#2f7d6d', blurb: 'Steady rates for steady hands.' },
  { id: 'harbour', name: 'Harbour Mutual', margin: 0.016, minDep: 0.1, minRep: -40, color: '#2d5f9a', blurb: 'Low deposits, a little extra interest.' },
  { id: 'gold', name: 'Gold Coin Credit', margin: 0.024, minDep: 0.05, minRep: -100, color: '#b5651d', blurb: 'Lends to almost anyone. At a price.' },
  { id: 'kings', name: 'Kingsbridge Private', margin: 0.007, minDep: 0.3, minRep: 25, color: '#6b3f8f', blurb: 'Best rates, for moguls with a name.' },
];
const LENDER_BY_ID = Object.fromEntries(LENDERS.map((l) => [l.id, l]));

// ── people ──
// look: skin, hair colour, hair style, outfit, accent, extras
const AGENTS = [
  { id: 'sunny', name: 'Sunny Patel', title: 'The Negotiator', perk: 'negotiate',
    perkText: 'Sellers give ground faster, and listings come 2% cheaper.',
    hello: "Let's find you a bargain. I never pay sticker price.",
    look: { skin: '#c68a5b', hair: '#1f1a17', hs: 'spike', top: '#e0a43a', acc: '#7a3b1c', glasses: true, tie: true } },
  { id: 'margot', name: 'Margot Lee', title: 'The Analyst', perk: 'analyst',
    perkText: 'Shows each suburb’s 12-month price outlook.',
    hello: 'Numbers first, feelings later. I’ll show you where the market is heading.',
    look: { skin: '#f0c9a4', hair: '#2a1d16', hs: 'bob', top: '#2f6f8f', acc: '#fff4e0', earrings: true } },
  { id: 'theo', name: 'Theo Brooks', title: 'The Manager', perk: 'manager',
    perkText: 'Finds tenants 40% faster, and more tenants renew.',
    hello: 'Happy tenants, full buildings. Leave the leases to me.',
    look: { skin: '#8a5a3c', hair: '#141110', hs: 'short', top: '#5c7a3a', acc: '#d9a441', tie: true, beard: true } },
  { id: 'rosa', name: 'Rosa Alvarez', title: 'The Finance Whiz', perk: 'finance',
    perkText: 'Mortgage rates 0.35% lower and deposits 5% smaller.',
    hello: 'Leverage is a superpower. I’ll get you the sharpest loans in town.',
    look: { skin: '#d9a273', hair: '#5a2a1a', hs: 'bun', top: '#b23a48', acc: '#fff8ef', glasses: true } },
];
const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

const RIVALS = [
  { id: 'r1', name: 'Penny Sterling', drift: 0.012, vol: 0.02 },
  { id: 'r2', name: 'Barron Von Brick', drift: 0.015, vol: 0.035 },
  { id: 'r3', name: 'Ivy Leasewell', drift: 0.01, vol: 0.012 },
  { id: 'r4', name: 'Duke Deedmore', drift: 0.017, vol: 0.045 },
  { id: 'r5', name: 'Rosie Rafters', drift: 0.011, vol: 0.018 },
  { id: 'r6', name: 'Stan Stucco', drift: 0.008, vol: 0.01 },
];

// Private investors. cap: capital they can deploy. likes: segments they co-invest in.
// share: max share of a deal. rate: private loan rate. met: known from the start.
const INVESTORS = [
  { id: 'mabel', name: 'Aunt Mabel', title: 'Retired schoolteacher', cap: 1.2e6, likes: ['res'], share: 0.4, rate: 0.075, met: true, minRep: -100,
    blurb: 'Believes in you. Likes houses she can drive past.', look: { skin: '#f2d2b6', hair: '#d9d4cc', hs: 'bun', top: '#7d5fa8', acc: '#f6e6ff', glasses: true } },
  { id: 'gus', name: 'Gus Goldberg', title: 'Dentist with spare cash', cap: 3e6, likes: ['res', 'com'], share: 0.35, rate: 0.085, met: true, minRep: -100,
    blurb: 'Wants steady rent and a story for the golf club.', look: { skin: '#e8b996', hair: '#6b4a2f', hs: 'bald', top: '#3d78c2', acc: '#ffffff', beard: true } },
  { id: 'priya', name: 'Priya Raman', title: 'Tech founder', cap: 12e6, likes: ['com', 'res', 'dev'], share: 0.5, rate: 0.08, minRep: 0,
    blurb: 'Sold her app. Loves anything new, shiny and fast-growing.', look: { skin: '#b8835a', hair: '#1b1412', hs: 'long', top: '#2f7d6d', acc: '#ffd34d' } },
  { id: 'harold', name: 'Harold Vance III', title: 'Old-money heir', cap: 25e6, likes: ['res', 'hosp'], share: 0.45, rate: 0.07, minRep: 15,
    blurb: 'Only invests where the right people summer.', look: { skin: '#f3d6bd', hair: '#c9a46a', hs: 'swoop', top: '#2b2d3a', acc: '#b23a48', tie: true } },
  { id: 'kiki', name: 'Kiki Moreau', title: 'Fashion mogul', cap: 18e6, likes: ['com', 'hosp'], share: 0.5, rate: 0.082, minRep: 10,
    blurb: 'Boutiques, hotels and anything with a rooftop bar.', look: { skin: '#9a6440', hair: '#f06a8a', hs: 'bob', top: '#111111', acc: '#ffd34d', earrings: true } },
  { id: 'otto', name: 'Otto Brandt', title: 'Logistics king', cap: 30e6, likes: ['ind', 'com'], share: 0.6, rate: 0.078, minRep: 5,
    blurb: 'Warehouses, ports, trucks. Allergic to anything pretty.', look: { skin: '#e8c3a0', hair: '#8a8f99', hs: 'short', top: '#e07a3a', acc: '#4a4f5a', beard: true } },
  { id: 'sage', name: 'Sage Okafor', title: 'Green fund manager', cap: 40e6, likes: ['agri', 'dev', 'res'], share: 0.55, rate: 0.072, minRep: 20,
    blurb: 'Farms, solar and sustainable builds. Will ask about your carbon.', look: { skin: '#6e4630', hair: '#1a1210', hs: 'locs', top: '#3e9b4f', acc: '#f3e6c8', glasses: true } },
  { id: 'yuki', name: 'Yuki Tanaka', title: 'Hotel dynasty', cap: 60e6, likes: ['hosp', 'com'], share: 0.55, rate: 0.07, minRep: 30,
    blurb: 'Third-generation hotelier. Patient money, high standards.', look: { skin: '#f0d0ae', hair: '#141110', hs: 'swoop', top: '#b23a48', acc: '#fff3d0' } },
  { id: 'dmitri', name: 'Dmitri Volkov', title: 'Mystery billionaire', cap: 150e6, likes: ['dev', 'com', 'res', 'hosp'], share: 0.7, rate: 0.095, minRep: 40,
    blurb: 'Nobody knows where the money comes from. Nobody asks.', look: { skin: '#e9c6a6', hair: '#2b2420', hs: 'slick', top: '#1f1f2a', acc: '#d9a21c', glasses: true } },
  { id: 'bea', name: 'Bea Sunshine', title: 'Pop star', cap: 22e6, likes: ['res', 'hosp'], share: 0.5, rate: 0.085, minRep: 25,
    blurb: 'Wants beach houses and ski chalets for the tour downtime.', look: { skin: '#c48a62', hair: '#ffd34d', hs: 'long', top: '#e86a8a', acc: '#ffffff', earrings: true } },
  { id: 'walt', name: 'Walter Pike', title: 'Pension fund', cap: 90e6, likes: ['com', 'ind', 'res'], share: 0.6, rate: 0.068, minRep: 35,
    blurb: 'Boring, enormous and very, very patient.', look: { skin: '#d9a273', hair: '#5a4a3a', hs: 'short', top: '#566275', acc: '#ffffff', tie: true, glasses: true } },
  { id: 'luna', name: 'Luna Reyes', title: 'Crypto whale', cap: 45e6, likes: ['dev', 'hosp', 'com'], share: 0.65, rate: 0.11, minRep: 0,
    blurb: 'Moves fast, invests faster. Sometimes vanishes for a month.', look: { skin: '#a8714a', hair: '#7a3bd6', hs: 'spike', top: '#2b2d3a', acc: '#7fe0c8' } },
];
const INVESTOR_BY_ID = Object.fromEntries(INVESTORS.map((x) => [x.id, x]));

// Staff. value: how the game estimates the dollars they earn you (shown on their card).
const STAFF = [
  { id: 'pm', role: 'Property Manager', salary: 6500, name: 'Dot Fairweather', effect: 'Tenants found 30% faster, 10% more renewals, and small repairs handled for you.',
    look: { skin: '#f0c9a4', hair: '#a8552f', hs: 'bun', top: '#2f7d6d', acc: '#fff4e0', glasses: true } },
  { id: 'handy', role: 'Maintenance Crew', salary: 5200, name: 'Big Lou', effect: 'Upkeep costs 25% less and buildings wear 40% slower.',
    look: { skin: '#c68a5b', hair: '#3a2a1e', hs: 'cap', top: '#e07a3a', acc: '#3d78c2', beard: true } },
  { id: 'leasing', role: 'Leasing Agent', salary: 7000, name: 'Chad Sterling', effect: 'Twice as many business lease offers, on 5% better terms.',
    look: { skin: '#e8c3a0', hair: '#e0b03a', hs: 'swoop', top: '#3f527d', acc: '#ffffff', tie: true } },
  { id: 'acct', role: 'Accountant', salary: 6000, name: 'Penelope Ledger', effect: 'Cuts your tax rate on rental profit from 25% to 17%.',
    look: { skin: '#b8835a', hair: '#1b1412', hs: 'bob', top: '#566275', acc: '#ffffff', glasses: true } },
  { id: 'lawyer', role: 'Property Lawyer', salary: 9000, name: 'Marcus Quill', effect: '+12% rezoning approval, lawsuits cost 60% less, sellers concede a little more.',
    look: { skin: '#6e4630', hair: '#1a1210', hs: 'short', top: '#1f1f2a', acc: '#b23a48', tie: true } },
  { id: 'architect', role: 'Architect', salary: 8000, name: 'Ingrid Vale', effect: 'Construction costs 12% less and finishes 25% faster.',
    look: { skin: '#f3d6bd', hair: '#111111', hs: 'bob', top: '#111111', acc: '#e86a8a', glasses: true } },
  { id: 'pr', role: 'PR Manager', salary: 6200, name: 'Zara Bloom', effect: 'Neighbours warm up to you each month and bad press hurts less.',
    look: { skin: '#9a6440', hair: '#f06a8a', hs: 'long', top: '#e86a8a', acc: '#ffffff', earrings: true } },
  { id: 'analyst', role: 'Market Analyst', salary: 7200, name: 'Felix Chen', effect: 'Shows suburb outlooks and stock tips, and warns you before slumps.',
    look: { skin: '#f0d0ae', hair: '#141110', hs: 'spike', top: '#3d78c2', acc: '#ffffff', glasses: true } },
];
const STAFF_BY_ID = Object.fromEntries(STAFF.map((x) => [x.id, x]));

// Skill tree: three tiers per branch. Each costs one skill point and needs the tier before it.
const SKILL_BRANCHES = [
  { id: 'dealer', name: 'Dealer', color: '#e07a3a', icon: 'handshake' },
  { id: 'fin', name: 'Financier', color: '#2f7d6d', icon: 'bank' },
  { id: 'inv', name: 'Investor', color: '#6b3f8f', icon: 'people' },
  { id: 'land', name: 'Landlord', color: '#3d78c2', icon: 'key' },
  { id: 'dev', name: 'Developer', color: '#b5651d', icon: 'crane' },
  { id: 'soc', name: 'Socialite', color: '#d0679a', icon: 'party' },
];
const SKILLS = [
  { id: 'dealer1', b: 'dealer', t: 1, name: 'Sharp Eye', desc: 'Your agent always learns why the seller is selling. Sellers concede 5% more each round.' },
  { id: 'dealer2', b: 'dealer', t: 2, name: 'Haggler', desc: 'Sellers have one extra round of patience, and listings start 2% cheaper.' },
  { id: 'dealer3', b: 'dealer', t: 3, name: 'The Closer', desc: 'Off-market deals 10–15% below value get offered to you a few times a year.' },
  { id: 'fin1', b: 'fin', t: 1, name: 'Credit Line', desc: 'All mortgage rates 0.25% lower.' },
  { id: 'fin2', b: 'fin', t: 2, name: 'Leverage', desc: 'Deposits 5% smaller and banks believe in 25% more of your rent.' },
  { id: 'fin3', b: 'fin', t: 3, name: 'The Financier', desc: 'Another 0.25% off rates, and you can refinance to pull equity out of any property.' },
  { id: 'inv1', b: 'inv', t: 1, name: 'Networker', desc: 'Meet a new investor every year.' },
  { id: 'inv2', b: 'inv', t: 2, name: 'Trusted Partner', desc: 'Investors trust you 50% faster and take bigger shares.' },
  { id: 'inv3', b: 'inv', t: 3, name: 'The Rainmaker', desc: 'Happy investors introduce their rich friends. Private loans 2% cheaper.' },
  { id: 'land1', b: 'land', t: 1, name: 'Tenant Whisperer', desc: 'Vacancies fill 15% faster.' },
  { id: 'land2', b: 'land', t: 2, name: 'Maintenance Pro', desc: 'Buildings wear 30% slower and issues cost 20% less.' },
  { id: 'land3', b: 'land', t: 3, name: 'Empire Manager', desc: '15% more renewals and 30% fewer building issues.' },
  { id: 'dev1', b: 'dev', t: 1, name: 'Permits', desc: '+10% chance at council for every rezoning.' },
  { id: 'dev2', b: 'dev', t: 2, name: 'Builder', desc: 'Construction 10% cheaper.' },
  { id: 'dev3', b: 'dev', t: 3, name: 'Visionary', desc: 'Everything you build is worth 10% more.' },
  { id: 'soc1', b: 'soc', t: 1, name: 'Host', desc: 'Parties are 25% more effective.' },
  { id: 'soc2', b: 'soc', t: 2, name: 'Philanthropist', desc: 'Donations win 50% more goodwill.' },
  { id: 'soc3', b: 'soc', t: 3, name: 'Celebrity', desc: '+1 reputation every month, and neighbours forgive you faster.' },
];
const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

const DEGREES = [
  { id: 'license', name: 'Real Estate License', months: 3, cost: 9000, sp: 1, effect: 'Selling commission drops from 2.5% to 1.5%.' },
  { id: 'finance', name: 'Finance Diploma', months: 6, cost: 28000, sp: 1, effect: 'Mortgage rates 0.15% lower.' },
  { id: 'mba', name: 'MBA', months: 12, cost: 140000, sp: 2, effect: 'Staff salaries 15% lower and investors trust you faster.' },
  { id: 'law', name: 'Law Degree', months: 18, cost: 95000, sp: 2, effect: '+15% at council and lawsuits cost half.' },
  { id: 'arch', name: 'Architecture Degree', months: 24, cost: 120000, sp: 2, effect: 'Construction 10% cheaper.' },
  { id: 'phd', name: 'PhD in Urban Planning', months: 36, cost: 210000, sp: 3, effect: '+20% at council, and neighbours mind density less.', req: 'law' },
];
const DEGREE_BY_ID = Object.fromEntries(DEGREES.map((d) => [d.id, d]));

// Marketplace. drift: yearly value change. upkeep/income: yearly share of value. buffs add to parties, investor appeal and reputation.
const ASSETS = [
  { id: 'hatch', name: 'Zippy Hatchback', cat: 'Cars', price: 28000, drift: -0.14, vol: 0.02, upkeep: 0.04, buffs: { fun: 1 }, rarity: 'common', art: 'car', color: '#f0c23a' },
  { id: 'convert', name: 'Riviera Convertible', cat: 'Cars', price: 95000, drift: -0.1, vol: 0.03, upkeep: 0.04, buffs: { party: 4, fun: 3 }, rarity: 'rare', art: 'car', color: '#d64b3c' },
  { id: 'classic', name: '1962 Classic Coupe', cat: 'Cars', price: 185000, drift: 0.045, vol: 0.06, upkeep: 0.03, buffs: { party: 5, rep: 1 }, rarity: 'rare', art: 'classic', color: '#3e9b6a' },
  { id: 'super', name: 'Furioso Supercar', cat: 'Cars', price: 380000, drift: -0.08, vol: 0.04, upkeep: 0.05, buffs: { party: 8, investor: 3, rep: 1 }, rarity: 'epic', art: 'super', color: '#e07a3a' },
  { id: 'runabout', name: 'Runabout Boat', cat: 'Boats', price: 62000, drift: -0.08, vol: 0.03, upkeep: 0.06, buffs: { fun: 3, party: 2 }, rarity: 'common', art: 'boat', color: '#3d78c2' },
  { id: 'sail', name: 'Sailboat "Breeze"', cat: 'Boats', price: 240000, drift: -0.05, vol: 0.03, upkeep: 0.06, buffs: { party: 8, investor: 2, fun: 4 }, rarity: 'rare', art: 'sail', color: '#ffffff' },
  { id: 'yacht', name: 'Superyacht "Moneta"', cat: 'Boats', price: 12500000, drift: -0.06, vol: 0.03, upkeep: 0.08, buffs: { party: 35, investor: 15, rep: 3 }, rarity: 'legendary', art: 'yacht', color: '#ffffff' },
  { id: 'seaplane', name: 'Seaplane', cat: 'Aircraft', price: 950000, drift: -0.06, vol: 0.03, upkeep: 0.07, buffs: { party: 6, investor: 4, fun: 5 }, rarity: 'epic', art: 'seaplane', color: '#f0c23a' },
  { id: 'jet', name: 'Private Jet', cat: 'Aircraft', price: 26000000, drift: -0.05, vol: 0.02, upkeep: 0.07, buffs: { investor: 30, rep: 4, party: 10 }, rarity: 'legendary', art: 'jet', color: '#f7f4ee' },
  { id: 'balloon', name: 'Hot-Air Balloon', cat: 'Fun', price: 140000, drift: -0.07, vol: 0.03, upkeep: 0.05, buffs: { fun: 6, party: 6 }, rarity: 'rare', art: 'balloon', color: '#e86a8a' },
  { id: 'painting', name: 'Neon Sunflowers (painting)', cat: 'Art', price: 420000, drift: 0.06, vol: 0.12, upkeep: 0.005, buffs: { party: 4, rep: 1 }, rarity: 'epic', art: 'painting', color: '#ffd34d' },
  { id: 'sculpture', name: 'Golden Pigeon (sculpture)', cat: 'Art', price: 1600000, drift: 0.05, vol: 0.15, upkeep: 0.005, buffs: { party: 8, investor: 4, rep: 2 }, rarity: 'legendary', art: 'sculpture', color: '#d9a21c' },
  { id: 'foodtruck', name: 'Taco Truck', cat: 'Businesses', price: 85000, drift: -0.08, vol: 0.03, upkeep: 0.02, income: 0.22, buffs: { fun: 2 }, rarity: 'common', art: 'truck', color: '#e07a3a' },
  { id: 'racehorse', name: 'Racehorse "Lucky Deed"', cat: 'Businesses', price: 520000, drift: -0.04, vol: 0.2, upkeep: 0.06, income: 0.1, buffs: { party: 4, rep: 1, fun: 4 }, rarity: 'epic', art: 'horse', color: '#8a5a3c' },
  { id: 'coffee', name: 'Coffee Plantation', cat: 'Businesses', price: 3200000, drift: 0.02, vol: 0.06, upkeep: 0.01, income: 0.075, buffs: { investor: 3 }, rarity: 'epic', art: 'plantation', color: '#6b4424' },
  { id: 'island', name: 'Tiny Private Island', cat: 'Fun', price: 9000000, drift: 0.035, vol: 0.04, upkeep: 0.015, buffs: { party: 25, investor: 12, rep: 3, fun: 8 }, rarity: 'legendary', art: 'island', color: '#7fcf6a' },
];
const ASSET_BY_ID = Object.fromEntries(ASSETS.map((a) => [a.id, a]));
const RARITY = { common: '#8db36b', rare: '#3d8fe0', epic: '#a35fd6', legendary: '#e7a721' };

const STOCKS = [
  { id: 'CTX', name: 'Centropolis 50 Index', sector: 'Index fund', p: 100, drift: 0.07, vol: 0.035, div: 0.025, link: null },
  { id: 'KBNK', name: 'Kingsbridge Bank', sector: 'Banking', p: 42, drift: 0.06, vol: 0.05, div: 0.05, link: 'rate' },
  { id: 'CRAIL', name: 'Centro Rail', sector: 'Transport', p: 18, drift: 0.05, vol: 0.06, div: 0.03, link: 'cbd' },
  { id: 'QNTM', name: 'Quantum Labs', sector: 'Technology', p: 64, drift: 0.12, vol: 0.14, div: 0, link: 'cbd' },
  { id: 'IRON', name: 'Ironvale Steel', sector: 'Industry', p: 27, drift: 0.04, vol: 0.08, div: 0.045, link: 'iron' },
  { id: 'HAYB', name: 'Haybrook Foods', sector: 'Agriculture', p: 15, drift: 0.045, vol: 0.06, div: 0.04, link: 'farm' },
  { id: 'ALPN', name: 'Alpine Resorts', sector: 'Leisure', p: 33, drift: 0.06, vol: 0.1, div: 0.02, link: 'alpine' },
  { id: 'CORL', name: 'Coral Tourism', sector: 'Travel', p: 22, drift: 0.065, vol: 0.11, div: 0.015, link: 'coral' },
  { id: 'PORT', name: 'Portside Shipping', sector: 'Logistics', p: 51, drift: 0.055, vol: 0.07, div: 0.04, link: 'port' },
];
const STOCK_BY_ID = Object.fromEntries(STOCKS.map((s) => [s.id, s]));

// medal: bronze | silver | gold | blue | green.  ribbon: two colours.
const ACHIEVEMENTS = [
  { id: 'firstRes', name: 'The First of Many', desc: 'Buy your first residential property', medal: 'bronze', ribbon: ['#8db36b', '#d8c86a'], test: (s) => s.boughtRes >= 1 },
  { id: 'firstCom', name: 'Open for Business', desc: 'Buy your first commercial property', medal: 'bronze', ribbon: ['#d8c86a', '#8db36b'], test: (s) => s.boughtCom >= 1 },
  { id: 'firstLoan', name: 'Sign on the Dotted Line', desc: 'Take out your first mortgage', medal: 'green', ribbon: ['#7fb0d8', '#d8eaf5'], test: (s) => s.loansTaken >= 1 },
  { id: 'p5', name: 'Junior Mogul', desc: 'Own 5 properties at once', medal: 'silver', ribbon: ['#d64b3c', '#f08a6e'], test: (s) => s.props >= 5 },
  { id: 'p10', name: 'Now We’re Cooking', desc: 'Own 10 properties at once', medal: 'gold', ribbon: ['#3d78c2', '#9cc4ef'], test: (s) => s.props >= 10 },
  { id: 'p20', name: 'The Growing Empire', desc: 'Own 20 properties at once', medal: 'blue', ribbon: ['#3d78c2', '#9cc4ef'], test: (s) => s.props >= 20 },
  { id: 'units50', name: 'Landlord of Many', desc: 'Have 50 tenants at once', medal: 'gold', ribbon: ['#2f7d6d', '#bfe8cf'], test: (s) => s.tenants >= 50 },
  { id: 'com5', name: 'Enter the Entrepreneur', desc: 'Own 5 commercial or industrial properties', medal: 'blue', ribbon: ['#7fb0d8', '#ffffff'], test: (s) => s.com >= 5 },
  { id: 'fix', name: 'Fixer Upper', desc: 'Renovate a property', medal: 'bronze', ribbon: ['#c98a4b', '#f3d39b'], test: (s) => s.renovations >= 1 },
  { id: 'upg', name: 'Pimp My Crib', desc: 'Add 5 upgrades', medal: 'silver', ribbon: ['#e86a8a', '#ffe0ea'], test: (s) => s.upgrades >= 5 },
  { id: 'flip', name: 'Quick Flip', desc: 'Sell a property for a profit', medal: 'silver', ribbon: ['#6aa84f', '#c9e6b3'], test: (s) => s.profitSales >= 1 },
  { id: 'build', name: 'Groundbreaker', desc: 'Finish your first building', medal: 'gold', ribbon: ['#b5651d', '#f3d39b'], test: (s) => s.built >= 1 },
  { id: 'rezone', name: 'Friends at City Hall', desc: 'Win a rezoning', medal: 'blue', ribbon: ['#3a6fc0', '#d8eaf5'], test: (s) => s.rezoned >= 1 },
  { id: 'partner', name: 'Better Together', desc: 'Close a deal with an investor', medal: 'green', ribbon: ['#6b3f8f', '#e6d6f5'], test: (s) => s.coinvests >= 1 },
  { id: 'party', name: 'Party Animal', desc: 'Throw 5 parties', medal: 'silver', ribbon: ['#e86a8a', '#ffd34d'], test: (s) => s.parties >= 5 },
  { id: 'staff3', name: 'The A-Team', desc: 'Employ 3 staff at once', medal: 'silver', ribbon: ['#3d78c2', '#ffd34d'], test: (s) => s.staff >= 3 },
  { id: 'grad', name: 'Class of Centropolis', desc: 'Earn a degree', medal: 'blue', ribbon: ['#1f1f2a', '#d9a21c'], test: (s) => s.degrees >= 1 },
  { id: 'yacht', name: 'I’m On a Boat', desc: 'Own a boat', medal: 'blue', ribbon: ['#2f8fb5', '#ffffff'], test: (s) => s.boats >= 1 },
  { id: 'stocks', name: 'Bulls & Bears', desc: 'Make $100,000 on the stock market', medal: 'green', ribbon: ['#2f8a3d', '#d64b3c'], test: (s) => s.stockGain >= 100000 },
  { id: 'nw5', name: 'Five Million Club', desc: 'Reach a net worth of $5,000,000', medal: 'silver', ribbon: ['#e0a43a', '#fff0c2'], test: (s) => s.net >= 5e6 },
  { id: 'nw25', name: 'Twenty-Five Large', desc: 'Reach a net worth of $25,000,000', medal: 'gold', ribbon: ['#e0a43a', '#fff0c2'], test: (s) => s.net >= 25e6 },
  { id: 'nw100', name: 'Centi-Millionaire', desc: 'Reach a net worth of $100,000,000', medal: 'gold', ribbon: ['#b5651d', '#ffd34d'], test: (s) => s.net >= 1e8 },
  { id: 'nw1b', name: 'Mogul of Centropolis', desc: 'Reach a net worth of $1,000,000,000', medal: 'gold', ribbon: ['#6b3f8f', '#ffd34d'], test: (s) => s.net >= 1e9 },
  { id: 'rep50', name: 'Landlord of the Year', desc: 'Reach a reputation of 50', medal: 'green', ribbon: ['#3e9b6a', '#bfe8cf'], test: (s) => s.rep >= 50 },
  { id: 'water', name: 'Waterfront Wonder', desc: 'Own a waterfront property', medal: 'blue', ribbon: ['#2f8fb5', '#bfe6f2'], test: (s) => s.waterfront >= 1 },
  { id: 'sky', name: 'Sky High', desc: 'Own a tower or hotel', medal: 'gold', ribbon: ['#3a4f7a', '#aab9da'], test: (s) => s.towers >= 1 },
  { id: 'everywhere', name: 'Postcode Collector', desc: 'Own property in 8 different suburbs', medal: 'gold', ribbon: ['#d64b3c', '#3d78c2'], test: (s) => s.districts >= 8 },
  { id: 'home', name: 'Home Sweet Home', desc: 'Move into a home of your own', medal: 'bronze', ribbon: ['#e86a8a', '#fff1f4'], test: (s) => s.home },
  { id: 'decade', name: 'Time in the Market', desc: 'Play for 10 years', medal: 'bronze', ribbon: ['#8a8f99', '#d9dde3'], test: (s) => s.months >= 120 },
];

// District events change price momentum and demand.
// seg: which demand segment moves. dem: demand change. fx: immediate price change.
const DISTRICT_EVENTS = [
  { text: 'New light-rail line announced for {d}', fx: 0.06, seg: 'res', dem: 0.1 },
  { text: 'Celebrity chef opens a restaurant in {d}', fx: 0.03, seg: 'com', dem: 0.1 },
  { text: 'Top-rated school zone expands into {d}', fx: 0.05, seg: 'res', dem: 0.12 },
  { text: 'Tech startup moves its HQ to {d}', fx: 0.05, seg: 'com', dem: 0.15 },
  { text: 'Factory closure hits {d}', fx: -0.05, seg: 'ind', dem: -0.15 },
  { text: 'Major roadworks snarl traffic in {d}', fx: -0.025, seg: 'com', dem: -0.08 },
  { text: 'Oversupply of new apartments in {d}', fx: -0.04, seg: 'res', dem: -0.12 },
  { text: 'Crime wave makes headlines in {d}', fx: -0.035, seg: 'res', dem: -0.1 },
  { text: 'Streetscape makeover finished in {d}', fx: 0.03, seg: 'com', dem: 0.08 },
  { text: 'Travel bloggers crown {d} the coolest suburb', fx: 0.04, seg: 'hosp', dem: 0.15 },
];
const SPECIAL_EVENTS = {
  alpine: [{ text: 'Record snowfall! Ski season packed at {d}', fx: 0.04, seg: 'hosp', dem: 0.25 }, { text: 'Warm winter leaves {d} slopes bare', fx: -0.05, seg: 'hosp', dem: -0.25 }, { text: 'Avalanche closes the road to {d}', fx: -0.03, seg: 'res', dem: -0.1 }],
  coral: [{ text: 'Shark sighting empties the beaches of {d}', fx: -0.03, seg: 'hosp', dem: -0.18 }, { text: 'Cruise ships add {d} to their route', fx: 0.04, seg: 'hosp', dem: 0.2 }, { text: 'Cyclone warning for {d}', fx: -0.05, seg: 'res', dem: -0.12 }],
  farm: [{ text: 'Bumper harvest across {d}', fx: 0.03, seg: 'agri', dem: 0.2 }, { text: 'Drought grips {d}', fx: -0.05, seg: 'agri', dem: -0.2 }, { text: 'Wine critics rave about {d} reds', fx: 0.04, seg: 'agri', dem: 0.15 }],
  lake: [{ text: 'Algae bloom closes the lake at {d}', fx: -0.04, seg: 'res', dem: -0.12 }, { text: 'Billionaire buys a lake estate in {d}', fx: 0.06, seg: 'res', dem: 0.15 }],
  port: [{ text: 'Port expansion approved at {d}', fx: 0.05, seg: 'ind', dem: 0.2 }, { text: 'Dock workers strike in {d}', fx: -0.04, seg: 'ind', dem: -0.15 }],
  iron: [{ text: 'Electric-truck plant opens in {d}', fx: 0.05, seg: 'ind', dem: 0.2 }],
  cbd: [{ text: 'Banking giant takes ten floors in {d}', fx: 0.04, seg: 'com', dem: 0.18 }, { text: 'Work-from-home trend empties {d} offices', fx: -0.04, seg: 'com', dem: -0.18 }],
};

// Name pools for generated people (tenants, neighbours, businesses)
const FIRST = ['Ava', 'Ben', 'Chloe', 'Dev', 'Ellie', 'Finn', 'Grace', 'Hugo', 'Isla', 'Jai', 'Kira', 'Leo', 'Maya', 'Noah', 'Olive', 'Pete', 'Quinn', 'Rubi', 'Sam', 'Tara', 'Uma', 'Vic', 'Wes', 'Xin', 'Yara', 'Zed', 'Marge', 'Barry', 'Doris', 'Kevin', 'Gwen', 'Otis'];
const LAST = ['Nguyen', 'Smith', 'Okoro', 'Rossi', 'Kaur', 'Murphy', 'Chen', 'Haddad', 'Silva', 'Brown', 'Kowalski', 'Ito', 'Moreno', 'Byrne', 'Novak', 'Fraser', 'Walsh', 'Duarte', 'Yamada', 'Clarke'];
const BIZ_A = ['Bean', 'Pixel', 'Golden', 'Blue', 'Urban', 'Happy', 'Swift', 'Iron', 'Coastal', 'Summit', 'Velvet', 'Rocket', 'Maple', 'Atlas', 'Lucky', 'Clever'];
const BIZ_B = ['Labs', 'Logistics', 'Bakery', 'Partners', 'Studio', 'Bank', 'Fitness', 'Dental', 'Legal', 'Co-op', 'Goods', 'Media', 'Freight', 'Analytics', 'Kitchen', 'Outfitters'];
