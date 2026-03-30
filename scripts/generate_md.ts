import fs from 'fs/promises';
import path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RateEntry {
  name: string;
  value: number | null;
  change_pbs: number | null;
  trend?: string;
  est?: boolean;
}

interface BondCurveEntry {
  term: string;
  yield: number;
  week_pbs: number | null;
  month_pbs: number | null;
  est?: boolean;
}

interface Regional10yEntry {
  country: string;
  yield: number;
  est?: boolean;
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

interface MacroKpi {
  value: number;
  label: string;
  unit: string;
  est?: boolean;
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
    inflation: MacroKpi;
    gdp: MacroKpi;
    debt_gdp: MacroKpi;
    reserves: MacroKpi;
    ratings: { moodys: string; sp: string; fitch: string };
    latam_debt_gdp: Array<{ country: string; debt_gdp: number }>;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(v: number | null, decimals = 2, suffix = ''): string {
  if (v === null || v === undefined) return 'N/A';
  return `${v.toFixed(decimals)}${suffix}`;
}

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return 'N/A';
  const arrow = v > 0 ? '+' : (v < 0 ? '' : '');
  return `${arrow}${v.toFixed(2)}%`;
}

function fmtBps(v: number | null): string {
  if (v === null || v === undefined) return 'N/A';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v} pbs`;
}

function trendIcon(v: number | null): string {
  if (v === null || v === undefined) return '→';
  return v > 0 ? '↑' : (v < 0 ? '↓' : '→');
}

function est(flag: boolean | undefined): string {
  return flag ? ' *(est.)*' : '';
}

function mermaidSafe(s: string): string {
  return String(s).replace(/"/g, "'");
}

function xaxis(labels: string[]): string {
  const quoted = labels.map(l => `"${l}"`).join(', ');
  return `    x-axis [${quoted}]`;
}

function clampYtd(values: (number | null)[], fallback = 0): number[] {
  return values.map(v => (v !== null && v !== undefined) ? v : fallback);
}

/**
 * Generates the Mermaid %%{init}%% directive for a dark-themed xychart-beta.
 * @param color  Main plot color (hex). Defaults to indigo.
 */
function chartInit(color = '#6366f1'): string {
  const theme = {
    theme: 'base',
    themeVariables: {
      xyChart: {
        backgroundColor:     '#475569',
        plotBackgroundColor: '#334155',
        plotColorPalette:    color,
        titleColor:          '#ffffff',
        axisLineColor:       '#cbd5e1',
        labelColor:          '#ffffff',
        tickColor:           '#cbd5e1',
      },
    },
  };
  return `%%{init: ${JSON.stringify(theme)}}%%`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const raw = await fs.readFile('data/latest.json', 'utf-8');
  const data: DashboardData = JSON.parse(raw);
  const today = new Date().toISOString().split('T')[0];

  const outDir = path.resolve('reports');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${today}.md`);

  // ── Alert detection ────────────────────────────────────────────────────────

  const alerts: Array<[string, string]> = [];

  for (const fx of data.fx ?? []) {
    if (fx.pair === 'USD/PEN' && fx.day_pct !== null) {
      if (Math.abs(fx.day_pct) >= 0.5) {
        const dir = fx.day_pct > 0 ? 'subio' : 'bajo';
        alerts.push(['warning', `USD/PEN ${dir} ${Math.abs(fx.day_pct).toFixed(2)}% en el dia — movimiento relevante.`]);
      }
    }
  }

  for (const idx of data.indices ?? []) {
    if (idx.day_pct !== null) {
      if (idx.day_pct <= -2.0) {
        alerts.push(['danger', `${idx.name} cae ${idx.day_pct.toFixed(2)}% hoy — sesion bajista.`]);
      } else if (idx.day_pct >= 2.0) {
        alerts.push(['success', `${idx.name} sube ${idx.day_pct.toFixed(2)}% hoy — sesion alcista.`]);
      }
    }
  }

  for (const coin of data.crypto?.coins ?? []) {
    if (coin.id === 'bitcoin' && coin.change_24h !== null) {
      if (coin.change_24h <= -5.0) {
        alerts.push(['danger', `BTC cae ${coin.change_24h.toFixed(2)}% en 24h — precaucion en crypto.`]);
      } else if (coin.change_24h >= 5.0) {
        alerts.push(['success', `BTC sube ${coin.change_24h.toFixed(2)}% en 24h — impulso alcista.`]);
      }
    }
  }

  const wti = data.commodities?.wti;
  if (wti?.day_pct !== null && wti?.day_pct !== undefined && Math.abs(wti.day_pct) >= 2.0) {
    const dir = wti.day_pct > 0 ? 'sube' : 'cae';
    alerts.push(['warning', `WTI ${dir} ${Math.abs(wti.day_pct).toFixed(2)}% — impacto potencial en inflacion importada.`]);
  }

  // ── Key highlights ─────────────────────────────────────────────────────────

  const highlights: string[] = [];

  for (const fx of data.fx ?? []) {
    if (fx.pair === 'USD/PEN') {
      highlights.push(`**USD/PEN** ${fmtNum(fx.price, 4)} (${fmtPct(fx.day_pct)} dia)`);
      break;
    }
  }

  const gold = data.commodities?.gold;
  if (gold?.price) {
    highlights.push(`**Oro** USD ${fmtNum(gold.price, 2)}/oz (${fmtPct(gold.day_pct)} dia)`);
  }

  for (const coin of data.crypto?.coins ?? []) {
    if (coin.id === 'bitcoin' && coin.price) {
      highlights.push(`**BTC** USD ${coin.price.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${fmtPct(coin.change_24h)} 24h)`);
      break;
    }
  }

  const indicesWithPct = (data.indices ?? []).filter(i => i.day_pct !== null);
  if (indicesWithPct.length > 0) {
    const best  = indicesWithPct.reduce((a, b) => (b.day_pct! > a.day_pct! ? b : a));
    const worst = indicesWithPct.reduce((a, b) => (b.day_pct! < a.day_pct! ? b : a));
    highlights.push(`**Mejor indice** ${best.name} ${fmtPct(best.day_pct)}`);
    highlights.push(`**Peor indice** ${worst.name} ${fmtPct(worst.day_pct)}`);
  }

  const bcrp = data.rates?.bcrp;
  if (bcrp?.value) {
    highlights.push(`**Tasa BCRP** ${fmtNum(bcrp.value, 2)}%${est(bcrp.est)}`);
  }

  // ── Build lines ────────────────────────────────────────────────────────────

  const L: string[] = [];

  // YAML frontmatter
  L.push('---');
  L.push('tags: [finanzas, latam, mercados, renta-fija]');
  L.push(`date: ${today}`);
  L.push('type: tablero-diario');
  L.push(`updated_at: "${data.updated_at ?? ''}"`);
  L.push('---');
  L.push('');
  L.push(`# Tablero Financiero LATAM — ${today}`);
  L.push('');

  // Highlights callout
  L.push('> [!abstract]+ Resumen del dia');
  for (const h of highlights) {
    L.push(`> - ${h}`);
  }
  L.push('');

  // Alert callouts
  for (const [alertType, msg] of alerts) {
    L.push(`> [!${alertType}] Alerta de mercado`);
    L.push(`> ${msg}`);
    L.push('');
  }

  // ── TAB 1: TASAS ────────────────────────────────────────────────────────────

  L.push('## Tasas de Politica Monetaria');
  L.push('');

  const ratesData = data.rates ?? {};
  const rateNames  = Object.values(ratesData).map(r => mermaidSafe(r.name));
  const rateValues = Object.values(ratesData).map(r => r.value !== null ? Math.round(r.value * 100) / 100 : 0);
  const maxRate    = rateValues.length > 0 ? Math.max(...rateValues) : 15;

  L.push('```mermaid');
  L.push(chartInit('#a5b4fc')); // pastel indigo — tasas
  L.push('xychart-beta');
  L.push('    title "Tasas de Politica Monetaria (%)"');
  L.push(xaxis(rateNames));
  L.push(`    y-axis "Tasa %" 0 --> ${maxRate + 2}`);
  L.push(`    bar [${rateValues.join(', ')}]`);
  L.push('```');
  L.push('');

  L.push('| Banco Central | Tasa (%) | Cambio | Tendencia |');
  L.push('| ------------- | -------: | -----: | :-------: |');
  for (const r of Object.values(ratesData)) {
    const icon = trendIcon(r.change_pbs);
    L.push(
      `| ${r.name}${est(r.est)} ` +
      `| **${fmtNum(r.value, 2)}** ` +
      `| ${fmtBps(r.change_pbs)} ` +
      `| ${icon} |`
    );
  }
  L.push('');

  const bcrpVal = bcrp?.value ?? null;
  L.push('> [!note] Contexto de politica monetaria');
  L.push(
    `> La tasa BCRP se encuentra en **${fmtNum(bcrpVal, 2)}%**${est(bcrp?.est)}. ` +
    'El ciclo de recortes en LATAM continua con distintas velocidades segun dinamica inflacionaria local. ' +
    'La Fed mantiene una postura restrictiva con impacto sobre flujos de capital hacia emergentes.'
  );
  L.push('');

  // ── TAB 2: BONOS ────────────────────────────────────────────────────────────

  L.push('## Bonos Soberanos');
  L.push('');

  const peruCurve  = data.bonds?.peru_curve ?? [];
  const curveTerms  = peruCurve.map(b => b.term);
  const curveYields = peruCurve.map(b => Math.round(b.yield * 100) / 100);

  if (curveYields.length > 0) {
    const yMin = Math.max(0, Math.min(...curveYields) - 0.5);
    const yMax = Math.max(...curveYields) + 0.5;
    L.push('### Curva Soberana Peru');
    L.push('');
    L.push('```mermaid');
    L.push(chartInit('#fcd34d')); // pastel amber — yield curve
    L.push('xychart-beta');
    L.push('    title "Curva Soberana Peru (Yield %)"');
    L.push(xaxis(curveTerms));
    L.push(`    y-axis "Yield %" ${yMin.toFixed(1)} --> ${yMax.toFixed(1)}`);
    L.push(`    line [${curveYields.join(', ')}]`);
    L.push('```');
    L.push('');
  }

  L.push('| Plazo | Rendimiento (%) | Semana | Mes |');
  L.push('| :---: | --------------: | -----: | --: |');
  for (const b of peruCurve) {
    L.push(
      `| ${b.term}${est(b.est)} ` +
      `| **${fmtNum(b.yield, 2)}** ` +
      `| ${fmtBps(b.week_pbs)} ` +
      `| ${fmtBps(b.month_pbs)} |`
    );
  }
  L.push('');

  const regional     = data.bonds?.regional_10y ?? [];
  const regCountries = regional.map(r => mermaidSafe(r.country));
  const regYields    = regional.map(r => Math.round(r.yield * 100) / 100);

  if (regYields.length > 0) {
    L.push('### Tasas 10Y Regionales');
    L.push('');
    L.push('```mermaid');
    L.push(chartInit('#86efac')); // pastel green — regional yields
    L.push('xychart-beta');
    L.push('    title "Tasas Soberanas 10Y — LATAM (%)"');
    L.push(xaxis(regCountries));
    L.push(`    y-axis "Yield %" 0 --> ${Math.max(...regYields) + 1}`);
    L.push(`    bar [${regYields.join(', ')}]`);
    L.push('```');
    L.push('');
    L.push('| Pais | Yield 10Y (%) |');
    L.push('| ---- | ------------: |');
    for (const r of regional) {
      L.push(`| ${r.country}${est(r.est)} | ${fmtNum(r.yield, 2)} |`);
    }
    L.push('');
  }

  const embig = data.bonds?.embig ?? [];
  if (embig.length > 0) {
    const embigCountries = embig.map(e => mermaidSafe(e.country));
    const embigSpreads   = embig.map(e => e.spread);

    L.push('### EMBIG Spreads (pbs)');
    L.push('');
    L.push('```mermaid');
    L.push(chartInit('#fca5a5')); // pastel red — risk/spreads
    L.push('xychart-beta');
    L.push('    title "EMBIG Spreads vs US Treasuries (pbs)"');
    L.push(xaxis(embigCountries));
    L.push(`    y-axis "Spread pbs" 0 --> ${Math.max(...embigSpreads) + 50}`);
    L.push(`    bar [${embigSpreads.join(', ')}]`);
    L.push('```');
    L.push('');
    L.push('| Pais | Spread EMBIG (pbs) |');
    L.push('| ---- | -----------------: |');
    for (const e of embig) {
      L.push(`| ${e.country} | ${e.spread} |`);
    }
    L.push('');

    const peruSpread = embig.find(e => e.country === 'Peru')?.spread ?? null;
    if (peruSpread !== null) {
      const level = peruSpread < 150 ? 'bajo' : (peruSpread < 250 ? 'moderado' : 'elevado');
      const calloutType = peruSpread < 150 ? 'success' : (peruSpread < 250 ? 'warning' : 'danger');
      L.push(`> [!${calloutType}] Riesgo soberano Peru`);
      L.push(
        `> EMBIG spread de Peru en **${peruSpread} pbs** — nivel ${level}. ` +
        'Un spread menor indica menor percepcion de riesgo pais y costo de deuda mas competitivo.'
      );
      L.push('');
    }
  }

  // ── TAB 3: DIVISAS ──────────────────────────────────────────────────────────

  L.push('## Divisas');
  L.push('');

  const fxList  = data.fx ?? [];
  const ytdVals = clampYtd(fxList.map(fx => fx.ytd_pct));
  const fxPairs = fxList.map(fx => mermaidSafe(fx.pair));

  if (ytdVals.some(v => v !== 0)) {
    const yBound = Math.max(...ytdVals.map(v => Math.abs(v))) + 2;
    L.push('```mermaid');
    L.push(chartInit('#67e8f9')); // pastel cyan — FX
    L.push('xychart-beta');
    L.push('    title "Variacion YTD vs USD (%)"');
    L.push(xaxis(fxPairs));
    L.push(`    y-axis "%" -${yBound.toFixed(0)} --> ${yBound.toFixed(0)}`);
    L.push(`    bar [${ytdVals.map(v => (Math.round(v * 100) / 100).toFixed(2)).join(', ')}]`);
    L.push('```');
    L.push('');
  }

  L.push('| Par | Nombre | Precio | Dia | YTD |');
  L.push('| --- | ------ | -----: | --: | --: |');
  for (const fx of fxList) {
    const icon = trendIcon(fx.day_pct);
    L.push(
      `| **${fx.pair}** ` +
      `| ${fx.name} ` +
      `| ${fmtNum(fx.price, 4)} ` +
      `| ${icon} ${fmtPct(fx.day_pct)} ` +
      `| ${fmtPct(fx.ytd_pct)} |`
    );
  }
  L.push('');

  const dxy = fxList.find(fx => fx.pair === 'DXY') ?? null;
  if (dxy && dxy.price !== null) {
    const dxyLevel = dxy.price > 104 ? 'fortaleza' : (dxy.price < 100 ? 'debilidad' : 'rango neutro');
    L.push('> [!tip] Contexto DXY');
    L.push(
      `> El indice dolar (DXY) cotiza en **${fmtNum(dxy.price, 2)}** — zona de ${dxyLevel}. ` +
      'Un DXY alto presiona divisas emergentes y commodities denominados en USD.'
    );
    L.push('');
  }

  // ── TAB 4: ACTIVOS ──────────────────────────────────────────────────────────

  L.push('## Indices Bursatiles');
  L.push('');

  L.push('| Indice | Precio | Dia | YTD |');
  L.push('| ------ | -----: | --: | --: |');
  for (const idx of data.indices ?? []) {
    const icon = trendIcon(idx.day_pct);
    L.push(
      `| ${idx.name} ` +
      `| ${fmtNum(idx.price, 2)} ` +
      `| ${icon} ${fmtPct(idx.day_pct)} ` +
      `| ${fmtPct(idx.ytd_pct)} |`
    );
  }
  L.push('');

  L.push('### Materias Primas');
  L.push('');

  const commodities = data.commodities ?? {};
  const commNames   = Object.values(commodities).map(c => mermaidSafe(c.name));
  const commYtd     = clampYtd(Object.values(commodities).map(c => c.ytd_pct));

  if (commYtd.some(v => v !== 0)) {
    const yBound = Math.max(...commYtd.map(v => Math.abs(v))) + 3;
    L.push('```mermaid');
    L.push(chartInit('#fde68a')); // pastel gold — commodities
    L.push('xychart-beta');
    L.push('    title "Commodities — Variacion YTD (%)"');
    L.push(xaxis(commNames));
    L.push(`    y-axis "%" -${yBound.toFixed(0)} --> ${yBound.toFixed(0)}`);
    L.push(`    bar [${commYtd.map(v => (Math.round(v * 100) / 100).toFixed(2)).join(', ')}]`);
    L.push('```');
    L.push('');
  }

  L.push('| Commodity | Unidad | Precio | Dia | YTD |');
  L.push('| --------- | ------ | -----: | --: | --: |');
  for (const c of Object.values(commodities)) {
    const icon = trendIcon(c.day_pct);
    L.push(
      `| **${c.name}** ` +
      `| ${c.unit} ` +
      `| ${fmtNum(c.price, 2)} ` +
      `| ${icon} ${fmtPct(c.day_pct)} ` +
      `| ${fmtPct(c.ytd_pct)} |`
    );
  }
  L.push('');

  const copper = commodities.copper;
  if (copper?.price !== null && copper?.price !== undefined) {
    const copperLevel = copper.price > 4.5 ? 'alto' : (copper.price > 3.5 ? 'moderado' : 'bajo');
    L.push('> [!note] Cobre y economia peruana');
    L.push(
      `> El cobre cotiza en **USD ${fmtNum(copper.price, 3)}/lb** — nivel ${copperLevel}. ` +
      'Peru es el segundo productor mundial: precio elevado impacta positivamente en exportaciones, ' +
      'recaudacion y tipo de cambio.'
    );
    L.push('');
  }

  // ── TAB 5: ETFs RENTA FIJA ──────────────────────────────────────────────────

  L.push('## ETFs Renta Fija');
  L.push('');

  const etfs       = data.etfs ?? [];
  const etfTickers = etfs.map(e => mermaidSafe(e.ticker));
  const etfYtd     = clampYtd(etfs.map(e => e.ytd_pct));

  if (etfYtd.some(v => v !== 0)) {
    const yBound = Math.max(...etfYtd.map(v => Math.abs(v))) + 2;
    L.push('```mermaid');
    L.push(chartInit('#c4b5fd')); // pastel purple — ETFs
    L.push('xychart-beta');
    L.push('    title "ETFs Renta Fija — Retorno YTD (%)"');
    L.push(xaxis(etfTickers));
    L.push(`    y-axis "%" -${yBound.toFixed(0)} --> ${yBound.toFixed(0)}`);
    L.push(`    bar [${etfYtd.map(v => (Math.round(v * 100) / 100).toFixed(2)).join(', ')}]`);
    L.push('```');
    L.push('');
  }

  L.push('| Ticker | Nombre | Precio | YTD | Yield Est. | TER |');
  L.push('| :----: | ------ | -----: | --: | ---------: | --: |');
  for (const etf of etfs) {
    const icon = trendIcon(etf.ytd_pct);
    L.push(
      `| **${etf.ticker}** ` +
      `| ${etf.name} ` +
      `| ${fmtNum(etf.price, 2)} ` +
      `| ${icon} ${fmtPct(etf.ytd_pct)} ` +
      `| ${fmtNum(etf.yield_est, 1)}% ` +
      `| ${fmtNum(etf.ter, 2)}% |`
    );
  }
  L.push('');

  const validEtfs = etfs.filter(e => e.ytd_pct !== null);
  if (validEtfs.length > 0) {
    const bestEtf  = validEtfs.reduce((a, b) => (b.ytd_pct! > a.ytd_pct! ? b : a));
    const worstEtf = validEtfs.reduce((a, b) => (b.ytd_pct! < a.ytd_pct! ? b : a));
    L.push('> [!tip] ETFs destacados');
    L.push(`> - **Mejor YTD**: ${bestEtf.ticker} — ${bestEtf.name} (${fmtPct(bestEtf.ytd_pct)})`);
    L.push(`> - **Peor YTD**: ${worstEtf.ticker} — ${worstEtf.name} (${fmtPct(worstEtf.ytd_pct)})`);
    L.push('> - TLT y bonos largos son los mas sensibles a cambios en tasas Fed.');
    L.push('');
  }

  // ── TAB 6: CRYPTO ───────────────────────────────────────────────────────────

  L.push('## Criptomonedas');
  L.push('');

  const crypto = data.crypto ?? { market_cap_total: null, coins: [] };
  const coins  = crypto.coins ?? [];

  if (crypto.market_cap_total) {
    L.push(`> [!abstract] Market Cap Total Crypto: **USD ${(crypto.market_cap_total / 1e9).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}B**`);
    L.push('');
  }

  const coinSymbols = coins.map(c => mermaidSafe(c.symbol));
  const coinYtd     = clampYtd(coins.map(c => c.ytd_pct));

  if (coinYtd.some(v => v !== 0)) {
    const yBound = Math.max(...coinYtd.map(v => Math.abs(v))) + 5;
    L.push('```mermaid');
    L.push(chartInit('#fdba74')); // pastel orange — crypto
    L.push('xychart-beta');
    L.push('    title "Criptomonedas — Variacion YTD (%)"');
    L.push(xaxis(coinSymbols));
    L.push(`    y-axis "%" -${yBound.toFixed(0)} --> ${yBound.toFixed(0)}`);
    L.push(`    bar [${coinYtd.map(v => (Math.round(v * 100) / 100).toFixed(2)).join(', ')}]`);
    L.push('```');
    L.push('');
  }

  L.push('| Moneda | Precio USD | 24h | 7d | YTD | Market Cap |');
  L.push('| ------ | ---------: | --: | -: | --: | ---------: |');
  for (const coin of coins) {
    const mc = coin.market_cap !== null
      ? `USD ${(coin.market_cap / 1e9).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}B`
      : 'N/A';
    const priceStr = coin.price !== null
      ? coin.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : 'N/A';
    const icon = trendIcon(coin.change_24h);
    L.push(
      `| **${coin.name}** (${coin.symbol}) ` +
      `| ${priceStr} ` +
      `| ${icon} ${fmtPct(coin.change_24h)} ` +
      `| ${fmtPct(coin.change_7d)} ` +
      `| ${fmtPct(coin.ytd_pct)} ` +
      `| ${mc} |`
    );
  }
  L.push('');

  const btc = coins.find(c => c.id === 'bitcoin') ?? null;
  if (btc && btc.price !== null) {
    const btcTrend = (btc.change_24h ?? 0) > 0 ? 'alcista' : 'bajista';
    L.push('> [!note] Bitcoin — senal de mercado');
    L.push(
      `> BTC cotiza en **USD ${btc.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}** con tendencia ${btcTrend} en 24h. ` +
      'Bitcoin actua como indicador lider para el resto del mercado crypto. ' +
      'Alta correlacion con activos de riesgo (Nasdaq, growth stocks) en entornos de liquidez ajustada.'
    );
    L.push('');
  }

  // ── TAB 7: MACRO PERU ───────────────────────────────────────────────────────

  L.push('## Macro Peru');
  L.push('');

  const macro = data.macro_peru;
  const kpiKeys = ['inflation', 'gdp', 'debt_gdp', 'reserves'] as const;

  L.push('### Indicadores Clave');
  L.push('');
  for (const k of kpiKeys) {
    const item = macro?.[k];
    if (item) {
      const val = fmtNum(item.value, 1);
      L.push(`- **${item.label ?? k}**: ${val} ${item.unit ?? ''}${est(item.est)}`);
    }
  }
  L.push('');

  const ratings = macro?.ratings;
  L.push('> [!success] Calificaciones Soberanas Peru');
  L.push('> | Agencia | Rating |');
  L.push('> | ------- | ------ |');
  L.push(`> | Moody's | **${ratings?.moodys ?? 'N/A'}** — Grado de inversion |`);
  L.push(`> | S&P     | **${ratings?.sp ?? 'N/A'}** — Grado de inversion |`);
  L.push(`> | Fitch   | **${ratings?.fitch ?? 'N/A'}** — Grado de inversion |`);
  L.push('> ');
  L.push('> Peru mantiene grado de inversion en las tres agencias principales.');
  L.push('');

  const latamDebt = macro?.latam_debt_gdp ?? [];
  if (latamDebt.length > 0) {
    const debtCountries = latamDebt.map(r => mermaidSafe(r.country));
    const debtValues    = latamDebt.map(r => Math.round(r.debt_gdp * 10) / 10);
    const refLine       = Array(latamDebt.length).fill(60.0);

    L.push('### Deuda/PIB LATAM');
    L.push('');
    L.push('```mermaid');
    L.push(chartInit('#fca5a5')); // pastel red — debt warning
    L.push('xychart-beta');
    L.push('    title "Deuda Publica / PIB — LATAM (%)"');
    L.push(xaxis(debtCountries));
    L.push(`    y-axis "%" 0 --> ${Math.max(...debtValues) + 10}`);
    L.push(`    bar [${debtValues.join(', ')}]`);
    L.push(`    line [${refLine.join(', ')}]`);
    L.push('```');
    L.push('');
    L.push('| Pais | Deuda/PIB (%) |');
    L.push('| ---- | ------------: |');
    for (const row of latamDebt) {
      const marker = row.debt_gdp < 60 ? ' checkmark' : ' warning';
      L.push(`| ${row.country}${marker} | **${fmtNum(row.debt_gdp, 1)}** |`);
    }
    L.push('');

    const peruDebt = latamDebt.find(r => r.country === 'Peru')?.debt_gdp ?? null;
    if (peruDebt !== null) {
      const calloutType = peruDebt < 45 ? 'success' : (peruDebt < 60 ? 'warning' : 'danger');
      L.push(`> [!${calloutType}] Sostenibilidad fiscal de Peru`);
      L.push(
        `> Deuda/PIB en **${peruDebt.toFixed(1)}%** — por debajo del umbral de referencia del 60% (linea horizontal). ` +
        'Peru mantiene una de las posiciones fiscales mas solidas de LATAM, lo que sustenta su grado de inversion.'
      );
      L.push('');
    }
  }

  // ── FOOTER ──────────────────────────────────────────────────────────────────

  L.push('---');
  L.push('');
  L.push('## Fuentes Consolidadas');
  L.push('');
  L.push('| Categoria | Fuente | URL |');
  L.push('| --------- | ------ | --- |');
  L.push('| Tasas | BCRP | [bcrp.gob.pe](https://www.bcrp.gob.pe) |');
  L.push('| Tasas | Federal Reserve | [federalreserve.gov](https://www.federalreserve.gov) |');
  L.push('| Tasas | ECB | [ecb.europa.eu](https://www.ecb.europa.eu) |');
  L.push('| Tasas LATAM | Trading Economics | [tradingeconomics.com](https://tradingeconomics.com) |');
  L.push('| Bonos | Investing.com | [investing.com/rates-bonds](https://investing.com/rates-bonds) |');
  L.push('| Bonos LATAM | World Gov. Bonds | [worldgovernmentbonds.com](http://www.worldgovernmentbonds.com) |');
  L.push('| Bonos US | FRED | [fred.stlouisfed.org](https://fred.stlouisfed.org) |');
  L.push('| Divisas | Yahoo Finance | [finance.yahoo.com](https://finance.yahoo.com) |');
  L.push('| Divisas | Fed H.10 | [federalreserve.gov/releases/h10](https://www.federalreserve.gov/releases/h10) |');
  L.push('| Indices | Yahoo Finance | [finance.yahoo.com](https://finance.yahoo.com) |');
  L.push('| Indices | CNBC | [cnbc.com/markets](https://www.cnbc.com/markets) |');
  L.push('| BVL | Bolsa de Valores Lima | [bvl.com.pe](https://www.bvl.com.pe) |');
  L.push('| Commodities | Yahoo Finance Futures | GC=F, SI=F, HG=F, CL=F, NG=F |');
  L.push('| Commodities | Bloomberg Markets | [bloomberg.com/markets/commodities](https://www.bloomberg.com/markets/commodities) |');
  L.push('| ETFs | Stock Analysis | [stockanalysis.com/etf](https://stockanalysis.com/etf) |');
  L.push('| Crypto | CoinGecko API | [coingecko.com/api](https://www.coingecko.com/en/api) |');
  L.push('| Crypto | CoinMarketCap | [coinmarketcap.com](https://coinmarketcap.com) |');
  L.push('| Macro Peru | BCRP Estadisticas | [bcrp.gob.pe/estadisticas](https://www.bcrp.gob.pe/estadisticas.html) |');
  L.push('| Macro Peru | MEF | [mef.gob.pe](https://www.mef.gob.pe) |');
  L.push('| Macro LATAM | FMI WEO | [imf.org/en/Publications/WEO](https://www.imf.org/en/Publications/WEO) |');
  L.push('| Analisis | BBVA Research | [bbvaresearch.com](https://www.bbvaresearch.com) |');
  L.push('');
  L.push('> [!quote] Aviso legal');
  L.push('> Esta nota es generada automaticamente con fines informativos y de referencia personal.');
  L.push('> **No constituye asesoria financiera ni recomendacion de inversion.**');
  L.push('> Los valores marcados con *(est.)* son estimaciones basadas en ultima informacion disponible.');
  L.push(`> Generado el ${today} — Datos: ${data.updated_at ?? today}`);
  L.push('');

  await fs.writeFile(outPath, L.join('\n'), 'utf-8');
  console.log(`[OK] Report saved to ${outPath}`);
})();
