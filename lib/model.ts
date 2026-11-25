// Token Radar Model (radar-2-peerfit): Market-anchored category valuation via log-log peer fit, peer adjustment, momentum, and maturity factors.
// Inspected snapshot (as_of 2026-11-14, 758 protocols):
// - change_7d scale: min -72.71%, p50 -8.22%, p95 +5.77%, max +4448.47% (momentum clamped [-60, 120] -> [0.7, 1.5]).
// - Tokenized protocols: 144. Log-log OLS fit on tokenized peers.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  global_median_ratio: number;
  momentum_floor: number;
  momentum_cap: number;
  age_floor: number;
  age_cap: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  global_median_ratio: 0.1691,
  momentum_floor: 0.9,
  momentum_cap: 1.1,
  age_floor: 0.85,
  age_cap: 1.25,
  unknown_age_days: 365,
};

export const MODEL_VERSION = 'radar-5-fittedpeers';

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  category_ratio: number;
  momentum_factor: number;
  age_factor: number;
  watchlist: boolean;
  peer_rate: number;
  peer_tokenized: number;
  model: {
    category_ratio: number;
    momentum_factor: number;
    age_factor: number;
    age_days: number | null;
  };
  farm_steps: string[];
  farm_total_gas_usd: number;
  farm_total_minutes: number;
  farm_weeks: number;
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_ratio: number;
  momentum_factor: number;
  age_factor: number;
  watchlist: boolean;
  peer_rate: number;
  peer_tokenized: number;
  launch_odds_pct: number;
  farm_total_gas_usd: number;
  farm_total_minutes: number;
  farm_weeks: number;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  excluded_count: number;
  candidate_count: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  fit: {
    peers_tokenized: number;
    peers_pretoken: number;
    global_launch_rate_pct: number;
    test_n: number;
    median_abs_err_pct: number;
    within_2x_pct: number;
    intercept: number;
    slope: number;
  };
  fitted_peers: {
    slug: string;
    name: string;
    tvl_usd: number;
    mcap_usd: number;
    fitted_usd: number;
    ratio: number;
  }[];
  rows: RadarRow[];
  live: LiveRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeModelBase(protocol: SnapshotProtocol, fit: LogLogFit): number {
  const cat = protocol.category || 'Other';
  const catAdj = fit.catAdj.get(cat) ?? 0;
  const tvl = Math.max(1, protocol.tvl_usd);
  return Math.exp(fit.intercept + fit.slope * Math.log(tvl) + catAdj);
}

export function computeFittedUsd(protocol: SnapshotProtocol, fit: LogLogFit): number {
  return Math.round(computeModelBase(protocol, fit));
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

export const EXCLUDED_CATEGORIES: string[] = [
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Staking Pool',
  'Restaking',
  'Restaked BTC',
  'Anchor BTC',
  'Decentralized BTC',
  'Stablecoin Wrapper',
];

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    p.category !== 'CEX' &&
    !VERSIONED.test(p.name) &&
    (p.category === null || !EXCLUDED_CATEGORIES.includes(p.category))
  );
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

export interface PeerStats {
  category: string;
  tokenized: number;
  pretoken: number;
  launch_rate: number;
}

export function computePeerStats(protocols: SnapshotProtocol[]): {
  byCategory: Map<string, PeerStats>;
  globalRate: number;
  tokenized: number;
  pretoken: number;
} {
  const catMap = new Map<string, { tokenized: number; pretoken: number }>();
  let globalTokenized = 0;
  let globalPretoken = 0;

  for (const p of protocols) {
    const cat = p.category || 'Other';
    let entry = catMap.get(cat);
    if (!entry) {
      entry = { tokenized: 0, pretoken: 0 };
      catMap.set(cat, entry);
    }
    if (p.mcap_usd !== null) {
      entry.tokenized++;
      globalTokenized++;
    } else {
      entry.pretoken++;
      globalPretoken++;
    }
  }

  const byCategory = new Map<string, PeerStats>();
  for (const [cat, counts] of catMap.entries()) {
    const total = counts.tokenized + counts.pretoken;
    const launch_rate = total > 0 ? round4(counts.tokenized / total) : 0;
    byCategory.set(cat, {
      category: cat,
      tokenized: counts.tokenized,
      pretoken: counts.pretoken,
      launch_rate,
    });
  }

  const globalTotal = globalTokenized + globalPretoken;
  const globalRate = globalTotal > 0 ? round4(globalTokenized / globalTotal) : 0;

  return {
    byCategory,
    globalRate,
    tokenized: globalTokenized,
    pretoken: globalPretoken,
  };
}

function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export interface LogLogFit {
  intercept: number;
  slope: number;
  catAdj: Map<string, number>;
  n: number;
}

export function fitLogLog(protocols: SnapshotProtocol[]): LogLogFit {
  const fitProtocols = protocols.filter(
    (p) =>
      p.mcap_usd !== null &&
      p.mcap_usd > 0 &&
      p.tvl_usd > 0 &&
      (p.category === null || !EXCLUDED_CATEGORIES.includes(p.category))
  );

  const n = fitProtocols.length;
  if (n === 0) {
    return { intercept: 0, slope: 0, catAdj: new Map(), n: 0 };
  }

  const xs = fitProtocols.map((p) => Math.log(p.tvl_usd));
  const ys = fitProtocols.map((p) => Math.log(p.mcap_usd as number));

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    sxx += dx * dx;
    sxy += dx * (ys[i]! - meanY);
  }

  const slopeRaw = sxx === 0 ? 0 : sxy / sxx;
  const interceptRaw = meanY - slopeRaw * meanX;

  const intercept = round4(interceptRaw);
  const slope = round4(slopeRaw);

  const catResiduals = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const p = fitProtocols[i]!;
    const cat = p.category || 'Other';
    const predictedLogMcap = intercept + slope * xs[i]!;
    const residual = ys[i]! - predictedLogMcap;
    let list = catResiduals.get(cat);
    if (!list) {
      list = [];
      catResiduals.set(cat, list);
    }
    list.push(residual);
  }

  const catAdj = new Map<string, number>();
  for (const [cat, residuals] of catResiduals.entries()) {
    if (residuals.length >= 5) {
      const med = median(residuals);
      catAdj.set(cat, round4(med));
    } else {
      catAdj.set(cat, 0);
    }
  }

  return { intercept, slope, catAdj, n };
}

export interface FitStats {
  test_n: number;
  median_abs_err_pct: number;
  within_2x_pct: number;
  test_b_n: number;
  test_b_median_abs_err_pct: number;
  test_b_within_2x_pct: number;
}

function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function computeFitStats(protocols: SnapshotProtocol[], asOf: string = '2026-11-14'): FitStats {
  const tokenized = protocols.filter(
    (p) =>
      p.mcap_usd !== null &&
      p.mcap_usd > 0 &&
      p.tvl_usd > 0 &&
      (p.category === null || !EXCLUDED_CATEGORIES.includes(p.category))
  );

  const predict = (p: SnapshotProtocol, fit: LogLogFit): number => {
    const age = ageDays(asOf, p.listed_at);
    const ag = ageFactor(age);
    const base = computeModelBase(p, fit);
    const categoryRatio = base / p.tvl_usd;
    return p.tvl_usd * categoryRatio * ag;
  };

  const sorted = [...tokenized].sort((a, b) => {
    const ha = fnv1a(a.slug);
    const hb = fnv1a(b.slug);
    if (ha !== hb) return ha - hb;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });

  const mid = Math.floor(sorted.length / 2);
  const fitHalf = sorted.slice(0, mid);
  const testHalf = sorted.slice(mid);

  const fitA = fitLogLog(fitHalf);
  const test_n = testHalf.length;

  let median_abs_err_pct = 0;
  let within_2x_pct = 0;

  if (test_n > 0) {
    const absErrors: number[] = [];
    let within2xCount = 0;

    for (const p of testHalf) {
      const pred = predict(p, fitA);
      const actual = p.mcap_usd as number;
      const absErrPct = (Math.abs(pred - actual) / actual) * 100;
      absErrors.push(absErrPct);

      if (pred >= actual / 2 && pred <= actual * 2) {
        within2xCount++;
      }
    }

    median_abs_err_pct = round1(median(absErrors));
    within_2x_pct = round1((within2xCount / test_n) * 100);
  }

  const categories = Array.from(new Set(tokenized.map((p) => p.category || 'Other')));
  const absErrorsB: number[] = [];
  let within2xCountB = 0;

  for (const cat of categories) {
    const trainPeers = tokenized.filter((p) => (p.category || 'Other') !== cat);
    const testPeers = tokenized.filter((p) => (p.category || 'Other') === cat);
    if (trainPeers.length === 0 || testPeers.length === 0) continue;

    const fitB = fitLogLog(trainPeers);
    for (const p of testPeers) {
      const pred = predict(p, fitB);
      const actual = p.mcap_usd as number;
      const absErrPct = (Math.abs(pred - actual) / actual) * 100;
      absErrorsB.push(absErrPct);

      if (pred >= actual / 2 && pred <= actual * 2) {
        within2xCountB++;
      }
    }
  }

  const test_b_n = absErrorsB.length;
  const test_b_median_abs_err_pct = test_b_n > 0 ? round1(median(absErrorsB)) : 0;
  const test_b_within_2x_pct = test_b_n > 0 ? round1((within2xCountB / test_b_n) * 100) : 0;

  return {
    test_n,
    median_abs_err_pct,
    within_2x_pct,
    test_b_n,
    test_b_median_abs_err_pct,
    test_b_within_2x_pct,
  };
}

export function getPeerAdj(
  category: string | null,
  peerStats: { byCategory: Map<string, PeerStats>; globalRate: number }
): number {
  const cat = category || 'Other';
  const stats = peerStats.byCategory.get(cat);
  if (!stats || peerStats.globalRate === 0) return 1.0;
  const ratio = stats.launch_rate / peerStats.globalRate;
  return Math.min(1.15, Math.max(0.85, round4(ratio)));
}

export function momentumFactor(change7d: number | null): number {
  if (change7d === null) return 1.0;
  const clamped = Math.min(60, Math.max(-30, change7d));
  const val = 0.9 + ((clamped + 30) / 90) * 0.2;
  return round4(val);
}

function ageFactor(ageDaysVal: number | null): number {
  const age = ageDaysVal ?? 365;
  const clampedAge = Math.min(1095, Math.max(0, age));
  const ratio = Math.log1p(clampedAge) / Math.log1p(1095);
  return round4(0.85 + ratio * 0.4); // range [0.85, 1.25]
}

export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: LogLogFit,
  peerAdj: number
): {
  implied: number;
  categoryRatio: number;
  momentumFactor: number;
  ageFactor: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const ag = ageFactor(age);
  const base = computeModelBase(protocol, fit);
  const categoryRatio = round4((base / protocol.tvl_usd) * peerAdj);
  const mom = momentumFactor(protocol.change_7d);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * categoryRatio * mom * ag));
  return { implied, categoryRatio, momentumFactor: mom, ageFactor: ag, age };
}

function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 300;
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

function holdWeeksFor(age: number | null): number {
  if (age === null) return 6;
  if (age < 180) return 10;
  if (age < 365) return 8;
  return 6;
}

export function farmEconomics(p: SnapshotProtocol, age: number | null): {
  farm_total_gas_usd: number;
  farm_total_minutes: number;
  farm_weeks: number;
} {
  const capital = capitalFor(p);
  const weeks = holdWeeksFor(age);
  const h = fnv1a(p.slug);
  const setupGas = pick(h, 1, [2, 3, 4]);
  const deployGas = capital >= 150 ? 10 : 5;
  const crossGas = 8 + (h % 9);
  const weeklyGas = 1 + (h % 3);

  const farm_total_gas_usd = Math.round(setupGas + deployGas + crossGas + (weeklyGas * weeks) + 1);
  const farm_total_minutes = Math.round(5 + 15 + 20 + 5 + ((10 + 5) * weeks));
  const farm_weeks = weeks;

  return { farm_total_gas_usd, farm_total_minutes, farm_weeks };
}

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category || '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Supply $${capital} of USDC as collateral and borrow against it on ${name} on ${chain}.`;
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) {
    return `Swap tokens and deposit $${capital} of liquidity into ${name}'s main pool on ${chain}.`;
  }
  if (c.includes('bridge')) {
    return `Bridge $${capital} of USDC across chains using ${name} and interact with destination liquidity.`;
  }
  if (c.includes('staking') || c.includes('restak')) {
    return `Stake $${capital} of the chain's primary asset through ${name} and retain receipt tokens.`;
  }
  if (c.includes('perpetual') || c.includes('derivative')) {
    return `Deposit $${capital} of USDC collateral on ${name} and open a hedged perpetual position.`;
  }
  if (c.includes('prediction')) {
    return `Commit $${capital} to active prediction markets on ${name}.`;
  }
  if (c.includes('curator') || c.includes('allocator')) {
    return `Deposit $${capital} into a managed ${name} strategy vault on ${chain}.`;
  }
  if (c.includes('stable')) {
    return `Mint or deposit $${capital} equivalent of stable assets through ${name} on ${chain}.`;
  }
  if (c.includes('rwa')) {
    return `Allocate $${capital} into ${name}'s yield-bearing real-world asset token on ${chain}.`;
  }
  return `Deposit $${capital} of USDC into ${name}'s primary product on ${chain} and maintain the position.`;
}

function pick<T>(hash: number, offset: number, variants: T[]): T {
  const index = Math.abs(hash + offset) % variants.length;
  return variants[index]!;
}

export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chains = p.chains.length > 0 ? p.chains : ['Ethereum'];
  const primaryChain = chains[0]!;
  const capital = capitalFor(p);
  const weeks = holdWeeksFor(age);
  const coreAction = actionFor(p, capital, primaryChain);

  const topChains = chains.slice(0, 3);
  const chainListStr = topChains.join(', ');

  const h = fnv1a(p.slug);
  const setupGas = pick(h, 1, ['$2', '$3', '$4']);
  const crossGas = 8 + (h % 9);
  const weeklyGas = 1 + (h % 3);

  const open1 = pick(h, 2, [
    `Establish a dedicated farming wallet`,
    `Set up a clean operational wallet`,
    `Initialize a secure dedicated wallet`,
  ]);
  const open3 = pick(h, 3, [
    `Execute equivalent farming interactions`,
    `Replicate cross-chain deployment steps`,
    `Deploy liquidity actions`,
  ]);
  const recurringAction = pick(h, 4, [
    `compounding yield`,
    `rebalancing positions`,
    `participating in governance voting`,
    `claiming and redepositing rewards`,
  ]);
  const open6 = pick(h, 5, [
    `Monitor official governance proposals`,
    `Track DAO proposals and ecosystem updates`,
    `Review governance and protocol bulletins`,
  ]);
  const open7 = pick(h, 6, [
    `Maintain a secure farm log`,
    `Keep a detailed operational ledger`,
    `Record all activity in a secure backup sheet`,
  ]);

  return [
    {
      text: `${open1} on ${primaryChain} to interact with ${p.name}, keeping seed phrase offline.`,
      cost: `under ${setupGas} of native gas for initial setup`,
      time: '5 minutes',
    },
    {
      text: coreAction,
      cost: `$${capital} capital commitment and approximately $${capital >= 150 ? 10 : 5} in gas fees`,
      time: '15 minutes',
    },
    {
      text: `${open3} across each of your target chains: ${chainListStr}.`,
      cost: `approximately $${crossGas} in cross-chain gas fees`,
      time: '20 minutes across 2 sessions',
    },
    {
      text: `Perform at least 1 weekly recurring ${recurringAction} on ${p.name}.`,
      cost: `about $${weeklyGas} gas per weekly interaction`,
      time: '10 minutes weekly',
    },
    {
      text: `Maintain active positions, liquidity pools, or staked balances for a continuous duration of ${weeks} weeks.`,
      cost: `opportunity cost of locked $${capital} capital`,
      time: `${weeks} weeks duration`,
    },
    {
      text: `${open6} for ${p.name}, snapshot announcements, and claim rewards strictly via verified links.`,
      cost: '$0 in claim fees; avoid unverified links',
      time: '5 minutes weekly',
    },
    {
      text: `${open7} recording wallet addresses, transaction hashes, dates, and position sizes for ${p.name} verification.`,
      cost: 'under $1 for a printed backup sheet',
      time: '5 minutes after setup',
    },
  ];
}

export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's official app interface.`;
  return s;
}

export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const peerStats = computePeerStats(snapshot.protocols);
  const fit = fitLogLog(snapshot.protocols);

  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }

  const allPreToken = [...snapshot.protocols.values()].filter(isRankable);
  const scoredAll = allPreToken.map((p) => {
    const peerAdj = getPeerAdj(p.category, peerStats);
    const res = impliedValue(p, snapshot.as_of, fit, peerAdj);
    return { p, ...res };
  });

  scoredAll.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }

  for (const s of scoredAll) {
    if (chosen.size >= 4000) break;
    if (s.p.tvl_usd < snapshot.floor_usd) {
      chosen.set(s.p.slug, s.p);
    }
  }

  if (chosen.size < 4000) {
    for (const s of scoredAll) {
      if (chosen.size >= 4000) break;
      chosen.set(s.p.slug, s.p);
    }
  }

  const finalScored = [...chosen.values()].map((p) => {
    const peerAdj = getPeerAdj(p.category, peerStats);
    const res = impliedValue(p, snapshot.as_of, fit, peerAdj);
    return { p, ...res };
  });

  finalScored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  return finalScored.map((s, i) => {
    const cat = s.p.category || 'Other';
    const pStats = peerStats.byCategory.get(cat);
    const peer_rate = pStats ? round1(pStats.launch_rate * 100) : 0;
    const peer_tokenized = pStats ? pStats.tokenized : 0;
    const fe = farmEconomics(s.p, s.age);

    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token',
      age_days: s.age,
      implied_value_usd: s.implied,
      category_ratio: s.categoryRatio,
      momentum_factor: s.momentumFactor,
      age_factor: s.ageFactor,
      watchlist: snapshot.watchlist.includes(s.p.slug),
      peer_rate,
      peer_tokenized,
      model: {
        category_ratio: s.categoryRatio,
        momentum_factor: s.momentumFactor,
        age_factor: s.ageFactor,
        age_days: s.age,
      },
      farm_steps: farmSteps(s.p, s.age).map(stepText),
      farm_total_gas_usd: fe.farm_total_gas_usd,
      farm_total_minutes: fe.farm_total_minutes,
      farm_weeks: fe.farm_weeks,
    };
  });
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, 24)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

export function radarRow(row: BoardRow, peerMap?: Map<string, PeerStats>): RadarRow {
  const cat = row.category || 'Other';
  const stat = peerMap?.get(cat);
  const launchRatePct = stat ? stat.launch_rate * 100 : row.peer_rate;
  const age = row.age_days;
  const ageDecay = age === null ? 1.0 : Math.max(0.5, 1 - age / 1460);
  const launch_odds_pct = round1(launchRatePct * ageDecay);

  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_ratio: row.category_ratio,
    momentum_factor: row.momentum_factor,
    age_factor: row.age_factor,
    watchlist: row.watchlist,
    peer_rate: row.peer_rate,
    peer_tokenized: row.peer_tokenized,
    launch_odds_pct,
    farm_total_gas_usd: row.farm_total_gas_usd,
    farm_total_minutes: row.farm_total_minutes,
    farm_weeks: row.farm_weeks,
  };
}

export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const excluded_count = snapshot.protocols.filter(
    (p) => isPreToken(p) && p.category !== null && EXCLUDED_CATEGORIES.includes(p.category)
  ).length;
  const candidate_count = snapshot.protocols.filter(
    (p) => isPreToken(p) && (p.category === null || !EXCLUDED_CATEGORIES.includes(p.category))
  ).length;
  const peerStats = computePeerStats(snapshot.protocols);
  const fit = fitLogLog(snapshot.protocols);
  const fitStats = computeFitStats(snapshot.protocols, snapshot.as_of);

  const fitProtocols = snapshot.protocols.filter(
    (p) =>
      p.mcap_usd !== null &&
      p.mcap_usd > 0 &&
      p.tvl_usd > 0 &&
      (p.category === null || !EXCLUDED_CATEGORIES.includes(p.category))
  );

  const fitted_peers = [...fitProtocols]
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, 8)
    .map((p) => {
      const fitted_usd = computeFittedUsd(p, fit);
      const mcap_usd = p.mcap_usd as number;
      const ratio = fitted_usd > 0 ? round2(mcap_usd / fitted_usd) : 0;
      return {
        slug: p.slug,
        name: p.name,
        tvl_usd: p.tvl_usd,
        mcap_usd,
        fitted_usd,
        ratio,
      };
    });

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    excluded_count,
    candidate_count,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    fit: {
      peers_tokenized: peerStats.tokenized,
      peers_pretoken: peerStats.pretoken,
      global_launch_rate_pct: round1(peerStats.globalRate * 100),
      test_n: fitStats.test_n,
      median_abs_err_pct: fitStats.median_abs_err_pct,
      within_2x_pct: fitStats.within_2x_pct,
      test_b_n: fitStats.test_b_n,
      test_b_median_abs_err_pct: fitStats.test_b_median_abs_err_pct,
      test_b_within_2x_pct: fitStats.test_b_within_2x_pct,
      intercept: fit.intercept,
      slope: fit.slope,
    },
    fitted_peers,
    rows: board.map((r) => radarRow(r, peerStats.byCategory)),
    live,
  };
  return { board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `board length ${board.length} is outside 100..4000 range`;
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return `board contains duplicate slugs`;
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
