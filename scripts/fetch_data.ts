import YahooFinance from 'yahoo-finance2';
import fs from 'fs/promises';
import path from 'path';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface RateEntry {
  name: string;
  value: number;
  change_pbs: number;
  trend: string;
  est: boolean;
}

interface BondCurveEntry {
  term: string;
  yield: number;
  week_pbs: number;
  month_pbs: number;
  est: boolean;
}

interface Regional10yEntry {
  country: string;
  yield: number;
  est: boolean;
}

interface EmbigEntry {
  country: string;
  spread: number;
}

interface FxEntry {
  pair: string;
  name: string;
  price: number | null;
  day_pct: number | null;
  ytd_pct: number | null;
}

interface IndexEntry {
  ticker: string;
  name: string;
  price: number | null;
  day_pct: number | null;
  ytd_pct: number | null;
}

interface CommodityEntry {
  name: string;
  unit: string;
  price: number | null;
  day_pct: number | null;
  ytd_pct: number | null;
}

interface EtfEntry {
  ticker: string;
  name: string;
  price: number | null;
  ytd_pct: number | null;
  yield_est: number;
  ter: number;
}

interface CoinEntry {
  id: string;
  symbol: string;
  name: string;
  price: number | null;
  change_24h: number | null;
  change_7d: number | null;
  ytd_pct: number | null;
  market_cap: number | null;
}

interface DashboardData {
  updated_at: string;
  rates: Record<string, RateEntry>;
  bonds: {
    peru_curve: BondCurveEntry[];
    regional_10y: Regional10yEntry[];
    embig: EmbigEntry[];
  };
  fx: FxEntry[];
  indices: IndexEntry[];
  commodities: Record<string, CommodityEntry>;
  etfs: EtfEntry[];
  crypto: {
    market_cap_total: number | null;
    coins: CoinEntry[];
  };
  macro_peru: {
    inflation: { value: number; label: string; unit: string; est: boolean };
    gdp: { value: number; label: string; unit: string; est: boolean };
    debt_gdp: { value: number; label: string; unit: string; est: boolean };
    reserves: { value: number; label: string; unit: string; est: boolean };
    ratings: { moodys: string; sp: string; fitch: string };
    latam_debt_gdp: Array<{ country: string; debt_gdp: number }>;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchQuote(ticker: string): Promise<{ price: number | null; dayPct: number | null }> {
  try {
    const quote = await yahooFinance.quote(ticker);
    const price = quote.regularMarketPrice ?? null;
    const prevClose = quote.regularMarketPreviousClose ?? null;
    const dayPct = (price !== null && prevClose !== null && prevClose !== 0)
      ? ((price - prevClose) / prevClose) * 100
      : null;
    return { price, dayPct };
  } catch {
    return { price: null, dayPct: null };
  }
}

async function fetchYtd(ticker: string): Promise<number | null> {
  try {
    const year = new Date().getFullYear();
    const ytdStart = `${year}-01-02`;
    const history = await yahooFinance.historical(ticker, { period1: ytdStart, period2: new Date() });
    const firstClose = history[0]?.close ?? null;
    const lastClose = history[history.length - 1]?.close ?? null;
    if (firstClose === null || lastClose === null || firstClose === 0) return null;
    return ((lastClose - firstClose) / firstClose) * 100;
  } catch {
    return null;
  }
}

async function fetchFull(ticker: string): Promise<{ price: number | null; dayPct: number | null; ytdPct: number | null }> {
  const [{ price, dayPct }, ytdPct] = await Promise.all([fetchQuote(ticker), fetchYtd(ticker)]);
  return { price, dayPct, ytdPct };
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const updatedAt = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';

  // ── Hardcoded data ────────────────────────────────────────────────────────

  const rates: Record<string, RateEntry> = {
    bcrp:     { name: 'BCRP',     value: 6.25,  change_pbs: 0,   trend: 'neutral', est: true },
    fed:      { name: 'Fed',      value: 5.375, change_pbs: -25, trend: 'down',    est: true },
    ecb:      { name: 'ECB',      value: 3.75,  change_pbs: -25, trend: 'down',    est: true },
    chile:    { name: 'Chile',    value: 5.50,  change_pbs: -25, trend: 'down',    est: true },
    colombia: { name: 'Colombia', value: 10.25, change_pbs: -25, trend: 'down',    est: true },
    mexico:   { name: 'Mexico',   value: 10.75, change_pbs: -25, trend: 'down',    est: true },
    brasil:   { name: 'Brasil',   value: 13.75, change_pbs: 25,  trend: 'up',      est: true },
  };

  const bondsCurve: BondCurveEntry[] = [
    { term: '2Y',  yield: 5.82, week_pbs: -3, month_pbs: -8, est: true },
    { term: '5Y',  yield: 6.21, week_pbs: -2, month_pbs: -5, est: true },
    { term: '10Y', yield: 6.65, week_pbs:  1, month_pbs:  3, est: true },
    { term: '30Y', yield: 7.12, week_pbs:  2, month_pbs:  5, est: true },
  ];

  const bondsRegional10y: Regional10yEntry[] = [
    { country: 'Peru',     yield: 6.65,  est: true  },
    { country: 'Mexico',   yield: 9.45,  est: true  },
    { country: 'Brasil',   yield: 12.80, est: true  },
    { country: 'Colombia', yield: 11.20, est: true  },
    { country: 'Chile',    yield: 5.90,  est: true  },
    { country: 'USA',      yield: 4.20,  est: false },
  ];

  const bondsEmbig: EmbigEntry[] = [
    { country: 'Peru',     spread: 145 },
    { country: 'Mexico',   spread: 185 },
    { country: 'Brasil',   spread: 210 },
    { country: 'Colombia', spread: 265 },
    { country: 'Chile',    spread: 105 },
  ];

  const macroPeru: DashboardData['macro_peru'] = {
    inflation: { value: 2.1,  label: 'Inflacion CPI',             unit: '%',      est: true },
    gdp:       { value: 2.8,  label: 'PIB Crecimiento',           unit: '%',      est: true },
    debt_gdp:  { value: 32.5, label: 'Deuda/PIB',                 unit: '%',      est: true },
    reserves:  { value: 73.5, label: 'Reservas Internacionales',  unit: 'USD bn', est: true },
    ratings:   { moodys: 'Baa1', sp: 'BBB+', fitch: 'BBB+' },
    latam_debt_gdp: [
      { country: 'Peru',      debt_gdp: 32.5 },
      { country: 'Chile',     debt_gdp: 37.8 },
      { country: 'Mexico',    debt_gdp: 46.5 },
      { country: 'Colombia',  debt_gdp: 55.2 },
      { country: 'Brasil',    debt_gdp: 88.1 },
      { country: 'Argentina', debt_gdp: 97.4 },
    ],
  };

  // ── FX ────────────────────────────────────────────────────────────────────

  console.log('[...] Fetching FX...');
  const fxDefs: Array<{ ticker: string; pair: string; name: string }> = [
    { ticker: 'PEN=X',    pair: 'USD/PEN', name: 'Sol Peruano'    },
    { ticker: 'DX-Y.NYB', pair: 'DXY',    name: 'Indice Dolar'   },
    { ticker: 'CLP=X',    pair: 'USD/CLP', name: 'Peso Chileno'   },
    { ticker: 'COP=X',    pair: 'USD/COP', name: 'Peso Colombiano' },
    { ticker: 'MXN=X',    pair: 'USD/MXN', name: 'Peso Mexicano'  },
    { ticker: 'BRL=X',    pair: 'USD/BRL', name: 'Real Brasileno' },
  ];

  const fx: FxEntry[] = await Promise.all(
    fxDefs.map(async (def) => {
      const { price, dayPct, ytdPct } = await fetchFull(def.ticker);
      return { pair: def.pair, name: def.name, price, day_pct: dayPct, ytd_pct: ytdPct };
    })
  );
  console.log('[OK] FX fetched');

  // ── Indices ───────────────────────────────────────────────────────────────

  console.log('[...] Fetching indices...');
  const indexDefs: Array<{ ticker: string; name: string }> = [
    { ticker: '^GSPC', name: 'S&P 500'    },
    { ticker: '^IXIC', name: 'NASDAQ'     },
    { ticker: '^DJI',  name: 'Dow Jones'  },
    { ticker: 'BVL',   name: 'BVL Peru'   },
    { ticker: 'ILF',   name: 'MSCI LATAM' },
  ];

  const indices: IndexEntry[] = await Promise.all(
    indexDefs.map(async (def) => {
      const { price, dayPct, ytdPct } = await fetchFull(def.ticker);
      return { ticker: def.ticker, name: def.name, price, day_pct: dayPct, ytd_pct: ytdPct };
    })
  );
  console.log('[OK] Indices fetched');

  // ── Commodities ───────────────────────────────────────────────────────────

  console.log('[...] Fetching commodities...');
  const commDefs: Array<{ ticker: string; key: string; name: string; unit: string }> = [
    { ticker: 'GC=F', key: 'gold',   name: 'Oro',         unit: 'USD/oz'    },
    { ticker: 'SI=F', key: 'silver', name: 'Plata',       unit: 'USD/oz'    },
    { ticker: 'HG=F', key: 'copper', name: 'Cobre',       unit: 'USD/lb'    },
    { ticker: 'CL=F', key: 'wti',    name: 'WTI',         unit: 'USD/bbl'   },
    { ticker: 'NG=F', key: 'natgas', name: 'Gas Natural', unit: 'USD/MMBtu' },
  ];

  const commoditiesEntries = await Promise.all(
    commDefs.map(async (def) => {
      const { price, dayPct, ytdPct } = await fetchFull(def.ticker);
      const entry: CommodityEntry = { name: def.name, unit: def.unit, price, day_pct: dayPct, ytd_pct: ytdPct };
      return [def.key, entry] as [string, CommodityEntry];
    })
  );
  const commodities: Record<string, CommodityEntry> = Object.fromEntries(commoditiesEntries);
  console.log('[OK] Commodities fetched');

  // ── ETFs ──────────────────────────────────────────────────────────────────

  console.log('[...] Fetching ETFs...');
  const etfDefs: Array<{ ticker: string; name: string; yield_est: number; ter: number }> = [
    { ticker: 'EMB',  name: 'iShares EM Bond',        yield_est: 6.8, ter: 0.40 },
    { ticker: 'VWOB', name: 'Vanguard EM Bond',        yield_est: 6.5, ter: 0.20 },
    { ticker: 'BND',  name: 'Vanguard Total Bond',     yield_est: 4.2, ter: 0.03 },
    { ticker: 'TLT',  name: 'iShares 20Y Treasury',    yield_est: 4.5, ter: 0.15 },
    { ticker: 'LQD',  name: 'iShares IG Corp Bond',    yield_est: 5.1, ter: 0.14 },
    { ticker: 'HYG',  name: 'iShares HY Corp Bond',    yield_est: 7.2, ter: 0.49 },
  ];

  const etfs: EtfEntry[] = await Promise.all(
    etfDefs.map(async (def) => {
      const { price, ytdPct } = await fetchFull(def.ticker);
      return { ticker: def.ticker, name: def.name, price, ytd_pct: ytdPct, yield_est: def.yield_est, ter: def.ter };
    })
  );
  console.log('[OK] ETFs fetched');

  // ── Crypto ────────────────────────────────────────────────────────────────

  console.log('[...] Fetching crypto...');

  const cryptoYtdTickers: Array<{ id: string; ticker: string }> = [
    { id: 'bitcoin',      ticker: 'BTC-USD' },
    { id: 'ethereum',     ticker: 'ETH-USD' },
    { id: 'solana',       ticker: 'SOL-USD' },
    { id: 'ripple',       ticker: 'XRP-USD' },
    { id: 'binancecoin',  ticker: 'BNB-USD' },
  ];

  const ytdMap: Record<string, number | null> = {};
  await Promise.all(
    cryptoYtdTickers.map(async ({ id, ticker }) => {
      ytdMap[id] = await fetchYtd(ticker);
    })
  );

  let geckoJson: Record<string, Record<string, number>> = {};
  let marketCapTotal: number | null = null;

  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,binancecoin&vs_currencies=usd&include_24hr_change=true&include_7d_in_currency=true&include_market_cap=true';
    const res = await fetch(url);
    geckoJson = await res.json() as Record<string, Record<string, number>>;

    // Sum market caps
    let total = 0;
    for (const coin of Object.values(geckoJson)) {
      total += coin['usd_market_cap'] ?? 0;
    }
    marketCapTotal = total > 0 ? total : null;
  } catch (err) {
    console.log('[WARN] CoinGecko fetch failed:', (err as Error).message);
  }

  const coinDefs: Array<{ id: string; symbol: string; name: string }> = [
    { id: 'bitcoin',     symbol: 'BTC', name: 'Bitcoin'  },
    { id: 'ethereum',    symbol: 'ETH', name: 'Ethereum' },
    { id: 'solana',      symbol: 'SOL', name: 'Solana'   },
    { id: 'ripple',      symbol: 'XRP', name: 'XRP'      },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB'      },
  ];

  const coins: CoinEntry[] = coinDefs.map((def) => {
    const g = geckoJson[def.id] ?? {};
    return {
      id:         def.id,
      symbol:     def.symbol,
      name:       def.name,
      price:      g['usd'] ?? null,
      change_24h: g['usd_24h_change'] ?? null,
      change_7d:  g['usd_7d_in_currency'] ?? null,
      ytd_pct:    ytdMap[def.id] ?? null,
      market_cap: g['usd_market_cap'] ?? null,
    };
  });

  console.log('[OK] Crypto fetched');

  // ── Assemble & write ──────────────────────────────────────────────────────

  const data: DashboardData = {
    updated_at: updatedAt,
    rates,
    bonds: {
      peru_curve:   bondsCurve,
      regional_10y: bondsRegional10y,
      embig:        bondsEmbig,
    },
    fx,
    indices,
    commodities,
    etfs,
    crypto: { market_cap_total: marketCapTotal, coins },
    macro_peru: macroPeru,
  };

  const dataDir = path.resolve('data');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(path.join(dataDir, 'latest.json'), JSON.stringify(data, null, 2), 'utf-8');
  console.log('[OK] data/latest.json written');
})();
