import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Loader2, Layers, RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchTopCoins, isStablecoin } from '../services/api';
import { DashboardItem, Language, ApiCoin } from '../../../types';

declare global {
  interface Window {
    Highcharts?: any;
  }
}

interface Props {
  item: DashboardItem;
  language?: Language;
}

const formatUSD = (val: number) => {
  if (val === undefined || val === null || !isFinite(val)) return '$0';
  const abs = Math.abs(val);
  if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
};

type HeatMode = 'marketCap' | 'volatility24h';

type TaxMaster = {
  id: string;
  name: string;
  categoryIds: string[];
  children: { id: string; name: string; categoryIds: string[] }[];
};

type CatCoinMap = Record<string, string[]>;

const HeatmapWidget: React.FC<Props> = ({ item, language = 'pt' }) => {
  const [marketData, setMarketData] = useState<ApiCoin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // size mode (área)
  const [mode, setMode] = useState<HeatMode>('marketCap');

  // agrupamento
  const [taxonomy, setTaxonomy] = useState<any>(null);
  const [catCoinMap, setCatCoinMap] = useState<CatCoinMap | null>(null);
  const [catWarn, setCatWarn] = useState<string>('');

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);

  const fetchJsonSafe = useCallback(async (url: string) => {
    const salt = Math.floor(Date.now() / 60000);
    const finalUrl = url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
    const r = await fetch(finalUrl, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.json();
  }, []);

  const getBgColor = (change: number) => {
    if (change >= 3) return '#089981';
    if (change >= 1) return '#0bbf9b';
    if (change > 0) return '#1b433d';
    if (change <= -3) return '#f23645';
    if (change <= -1) return '#7c252b';
    if (change < 0) return '#431c1f';
    return '#363a45';
  };

  const normalizeCoins = (coins: any[]): ApiCoin[] => {
    const processed = (coins || [])
      .filter(c => c && c.symbol)
      .filter(c => !isStablecoin(String(c.symbol || '').toLowerCase()))
      .map(c => ({
        id: c.id,
        symbol: (c.symbol || '').toUpperCase(),
        name: c.name || c.symbol,
        current_price: c.current_price || 0,
        price_change_percentage_24h: c.price_change_percentage_24h || 0,
        market_cap: c.market_cap || 0,
        total_volume: c.total_volume || 0,
        image: c.image || '',
        ath: c.ath || 0,
        ath_change_percentage: c.ath_change_percentage || 0,
        atl: c.atl || 0,
        atl_change_percentage: c.atl_change_percentage || 0,
        high_24h: c.high_24h || 0,
        low_24h: c.low_24h || 0
      }))
      .sort((a: any, b: any) => (Number(b.market_cap || 0) - Number(a.market_cap || 0)));

    // pra treemap com grupos ficar fluido sem explodir:
    return processed.slice(0, 220);
  };

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setCatWarn('');
    try {
      const base = '/cachecko/categories';

      const [coinsRaw, taxonomyJson, mapJson] = await Promise.all([
        fetchTopCoins().catch(() => []),
        fetchJsonSafe(`${base}/taxonomy-master.json`).catch(() => null),
        fetchJsonSafe(`${base}/category_coins_map.json`).catch(() => null),
      ]);

      const normalized = normalizeCoins(Array.isArray(coinsRaw) ? coinsRaw : []);
      setMarketData(normalized);

      setTaxonomy(taxonomyJson);

      if (mapJson && typeof mapJson === 'object') {
        const categories =
          (mapJson as any).categories && typeof (mapJson as any).categories === 'object'
            ? (mapJson as any).categories
            : mapJson;

        if (categories && typeof categories === 'object') {
          setCatCoinMap(categories as CatCoinMap);
        } else {
          setCatCoinMap(null);
          setCatWarn('category_coins_map.json inválido: não foi possível montar agrupamentos.');
        }
      } else {
        setCatCoinMap(null);
        setCatWarn('category_coins_map.json ausente: heatmap ficará sem agrupamentos.');
      }
    } catch (e: any) {
      console.error('Heatmap load error', e);
      setCatWarn('Falha ao carregar dados do heatmap.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchJsonSafe]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---------- taxonomy parsing ----------
  const parsedTaxonomy: TaxMaster[] = useMemo(() => {
    const raw = taxonomy;

    let masters: any[] = [];
    if (Array.isArray(raw)) masters = raw;
    else if (raw && Array.isArray((raw as any).masters)) masters = (raw as any).masters;
    else if (raw && Array.isArray((raw as any).items)) masters = (raw as any).items;

    return (masters || [])
      .filter(Boolean)
      .map((m: any) => ({
        id: String(m.id ?? m.key ?? m.name ?? '').trim(),
        name: String(m.name ?? m.title ?? m.id ?? '').trim(),
        categoryIds: Array.isArray(m.categoryIds) ? m.categoryIds.map(String) : Array.isArray(m.categories) ? m.categories.map(String) : [],
        children: (Array.isArray(m.children) ? m.children : Array.isArray(m.groups) ? m.groups : [])
          .filter(Boolean)
          .map((c: any) => ({
            id: String(c.id ?? c.key ?? c.name ?? '').trim(),
            name: String(c.name ?? c.title ?? c.id ?? '').trim(),
            categoryIds: Array.isArray(c.categoryIds) ? c.categoryIds.map(String) : Array.isArray(c.categories) ? c.categories.map(String) : [],
          })),
      }))
      .filter((m: any) => m.id && m.name);
  }, [taxonomy]);

  // ---------- build master -> coinId set union ----------
  const categoryCoinIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!catCoinMap) return map;
    for (const [catId, arr] of Object.entries(catCoinMap)) {
      if (!catId || !Array.isArray(arr)) continue;
      map.set(String(catId), new Set(arr.map(x => String(x))));
    }
    return map;
  }, [catCoinMap]);

  const masterSets = useMemo(() => {
    const sets = new Map<string, { master: TaxMaster; catIds: string[]; set: Set<string> }>();

    for (const m of parsedTaxonomy) {
      const allCatIds: string[] = [];

      for (const cid of (m.categoryIds || [])) allCatIds.push(String(cid));
      for (const child of (m.children || [])) {
        for (const cid of (child.categoryIds || [])) allCatIds.push(String(cid));
      }

      const uniqueCatIds = Array.from(new Set(allCatIds)).filter(Boolean);
      const union = new Set<string>();

      for (const cid of uniqueCatIds) {
        const s = categoryCoinIds.get(cid);
        if (!s) continue;
        for (const id of s) union.add(id);
      }

      sets.set(m.id, { master: m, catIds: uniqueCatIds, set: union });
    }

    return sets;
  }, [parsedTaxonomy, categoryCoinIds]);

  // precompute master "potential mcap" (pra desempate na atribuição)
  const masterPotentialMcap = useMemo(() => {
    const map = new Map<string, number>();
    const byId = new Map<string, ApiCoin>();
    for (const c of marketData) byId.set(String(c.id), c);

    for (const [mid, pack] of masterSets.entries()) {
      let sum = 0;
      for (const cid of pack.set) {
        const coin = byId.get(String(cid));
        if (coin) sum += Number((coin as any).market_cap || 0) || 0;
      }
      map.set(mid, sum);
    }
    return map;
  }, [masterSets, marketData]);

  // ---------- assign each coin to ONE master (no duplicates) ----------
  const grouped = useMemo(() => {
    const byId = new Map<string, ApiCoin>();
    for (const c of marketData) byId.set(String(c.id), c);

    // helper: membership count of coin across master's catIds
    const membershipCount = (coinId: string, catIds: string[]) => {
      let count = 0;
      for (const cid of catIds) {
        const s = categoryCoinIds.get(cid);
        if (s && s.has(coinId)) count++;
      }
      return count;
    };

    const assignments = new Map<string, string>(); // coinId -> masterId
    const masterMembers = new Map<string, ApiCoin[]>(); // masterId -> coins

    for (const c of marketData) {
      const coinId = String(c.id);
      let bestMasterId: string | null = null;
      let bestCount = 0;
      let bestPotential = -1;

      for (const [mid, pack] of masterSets.entries()) {
        if (!pack.set.has(coinId)) continue;

        const cnt = membershipCount(coinId, pack.catIds);
        const pot = masterPotentialMcap.get(mid) || 0;

        if (cnt > bestCount) {
          bestCount = cnt;
          bestPotential = pot;
          bestMasterId = mid;
        } else if (cnt === bestCount && cnt > 0) {
          if (pot > bestPotential) {
            bestPotential = pot;
            bestMasterId = mid;
          }
        }
      }

      if (!bestMasterId) bestMasterId = '__others__';

      assignments.set(coinId, bestMasterId);

      if (!masterMembers.has(bestMasterId)) masterMembers.set(bestMasterId, []);
      masterMembers.get(bestMasterId)!.push(c);
    }

    // build master list in a stable order (by potential mcap desc, others last)
    const mastersOrdered: { id: string; name: string; coins: ApiCoin[] }[] = [];

    const realMasters = Array.from(masterMembers.keys()).filter(k => k !== '__others__');
    realMasters.sort((a, b) => (masterPotentialMcap.get(b) || 0) - (masterPotentialMcap.get(a) || 0));

    for (const mid of realMasters) {
      const m = parsedTaxonomy.find(x => x.id === mid);
      if (!m) continue;
      mastersOrdered.push({ id: mid, name: m.name, coins: masterMembers.get(mid) || [] });
    }

    const othersCoins = masterMembers.get('__others__') || [];
    if (othersCoins.length > 0) {
      mastersOrdered.push({ id: '__others__', name: 'Others', coins: othersCoins });
    }

    return mastersOrdered;
  }, [marketData, masterSets, parsedTaxonomy, categoryCoinIds, masterPotentialMcap]);

  // ---------- build treemap data ----------
  const treemapData = useMemo(() => {
    // fallback: sem grouping
    const hasGrouping = grouped.length > 1 && (catCoinMap && parsedTaxonomy.length > 0);

    if (!hasGrouping) {
      return {
        hasGrouping: false,
        data: marketData.slice(0, 120).map((coin: any) => {
          const change = Number(coin.price_change_percentage_24h || 0) || 0;
          const mcap = Number(coin.market_cap || 0) || 0;

          let areaVal = mode === 'marketCap'
            ? mcap
            : Math.max(1, Math.abs(change) * Math.max(1, mcap));

          if (!isFinite(areaVal) || areaVal <= 0) areaVal = 1;

          return {
            id: `c_${coin.symbol}_${coin.id}`,
            name: coin.symbol,
            value: areaVal,
            change,
            price: coin.current_price,
            mkt: coin.market_cap,
            vol: coin.total_volume,
            logo: coin.image,
            fullName: coin.name,
            ath: coin.ath,
            ath_p: coin.ath_change_percentage,
            atl: coin.atl,
            atl_p: coin.atl_change_percentage,
            high24: coin.high_24h,
            low24: coin.low_24h,
            groupName: 'Market',
            isGroup: false,
            color: getBgColor(change),
          };
        })
      };
    }

    const out: any[] = [];

    // parent nodes + children
    for (const g of grouped) {
      const parentId = `m_${g.id}`;

      const members = g.coins || [];
      const mcapSum = members.reduce((s, c: any) => s + (Number(c.market_cap || 0) || 0), 0);
      const wSum = mcapSum > 0 ? mcapSum : members.length;

      const wAvgChange = (() => {
        if (members.length === 0) return 0;
        let acc = 0;
        for (const c of members) {
          const w = mcapSum > 0 ? (Number((c as any).market_cap || 0) || 0) : 1;
          const ch = Number((c as any).price_change_percentage_24h || 0) || 0;
          acc += ch * w;
        }
        return wSum > 0 ? acc / wSum : 0;
      })();

      out.push({
        id: parentId,
        name: g.name,
        isGroup: true,
        groupName: g.name,
        change: wAvgChange,
        mkt: mcapSum,
        coinsCount: members.length,
        color: getBgColor(wAvgChange)
      });

      for (const coin of members) {
        const change = Number((coin as any).price_change_percentage_24h || 0) || 0;
        const mcap = Number((coin as any).market_cap || 0) || 0;

        let areaVal = mode === 'marketCap'
          ? mcap
          : Math.max(1, Math.abs(change) * Math.max(1, mcap));

        if (!isFinite(areaVal) || areaVal <= 0) areaVal = 1;

        out.push({
          id: `c_${coin.symbol}_${coin.id}`,
          parent: parentId,
          name: coin.symbol,
          value: areaVal,

          change,
          price: (coin as any).current_price,
          mkt: (coin as any).market_cap,
          vol: (coin as any).total_volume,
          logo: (coin as any).image,
          fullName: (coin as any).name,
          ath: (coin as any).ath,
          ath_p: (coin as any).ath_change_percentage,
          atl: (coin as any).atl,
          atl_p: (coin as any).atl_change_percentage,
          high24: (coin as any).high_24h,
          low24: (coin as any).low_24h,

          groupName: g.name,
          isGroup: false,
          color: getBgColor(change),
        });
      }
    }

    return { hasGrouping: true, data: out };
  }, [grouped, marketData, mode, catCoinMap, parsedTaxonomy.length]);

  // ---------- render highcharts ----------
  useEffect(() => {
    const Highcharts = window.Highcharts;
    if (!chartRef.current) return;
    if (!Highcharts) return;
    if (!treemapData.data || treemapData.data.length === 0) return;

    // treemap module check
    const hasTreemap = !!(Highcharts.seriesTypes && Highcharts.seriesTypes.treemap);
    if (!hasTreemap) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    chartInstance.current = Highcharts.chart(chartRef.current, {
      chart: {
        type: 'treemap',
        backgroundColor: 'transparent',
        animation: false,
        style: { fontFamily: 'Inter, sans-serif' },
        spacing: [0, 0, 0, 0],
        margin: [0, 0, 0, 0],
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      exporting: { enabled: false },

      plotOptions: {
        series: {
          animation: false,
          borderColor: 'rgba(0,0,0,0.75)',
          borderWidth: 1,
          states: {
            hover: {
              brightness: 0.08
            }
          }
        },
        treemap: {
          allowDrillToNode: true,
          interactByLeaf: true,
          levelIsConstant: false,
          layoutAlgorithm: 'squarified',
        }
      },

      tooltip: {
        enabled: true,
        useHTML: true,
        outside: true,
        followPointer: true,
        backgroundColor: 'rgba(10, 11, 12, 0.98)',
        borderColor: 'rgba(221, 153, 51, 0.9)',
        borderRadius: 20,
        shadow: true,
        padding: 0,
        style: { zIndex: 9999, color: '#ffffff', pointerEvents: 'none' },
        formatter: function (this: any) {
          const p = this.point;
          const isGroup = !!p.isGroup || !p.parent;

          const change = Number(p.change || 0) || 0;
          const changeColor = change >= 0 ? '#22c55e' : '#ef4444';

          if (isGroup) {
            return `
              <div style="padding: 18px; min-width: 360px; color: #ffffff; font-family: 'Inter', sans-serif; pointer-events:none;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom: 2px solid rgba(255,255,255,0.08); padding-bottom: 14px; margin-bottom: 14px;">
                  <div>
                    <div style="font-size: 22px; font-weight: 1000; line-height: 1;">${p.name}</div>
                    <div style="font-size: 10px; color: #dd9933; font-weight: 900; text-transform: uppercase; margin-top: 6px; letter-spacing: 2px;">CATEGORY GROUP</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size: 10px; color:#888; font-weight:900; text-transform:uppercase;">AVG 24H</div>
                    <div style="font-size: 18px; font-weight: 1000; color:${changeColor};">${change.toFixed(2)}%</div>
                  </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                  <div>
                    <div style="font-size: 10px; color: #999; font-weight: 900; text-transform: uppercase;">MARKET CAP</div>
                    <div style="font-size: 16px; font-weight: 1000; color:#60a5fa;">${formatUSD(Number(p.mkt || 0))}</div>
                  </div>
                  <div>
                    <div style="font-size: 10px; color: #999; font-weight: 900; text-transform: uppercase;"># COINS</div>
                    <div style="font-size: 16px; font-weight: 1000; color:#dd9933;">${Number(p.coinsCount || 0).toLocaleString()}</div>
                  </div>
                </div>

                <div style="margin-top: 14px; font-size: 11px; color:#777; font-weight: 800;">
                  Clique para dar zoom no grupo.
                </div>
              </div>
            `;
          }

          const logoHtml = p.logo
            ? `<img src="${p.logo}" style="width: 50px; height: 50px; border-radius: 50%; background: #fff; border: 3px solid #dd9933;">`
            : '';

          return `
            <div style="padding: 20px; min-width: 360px; color: #ffffff; pointer-events: none; font-family: 'Inter', sans-serif;">
              <div style="display:flex; align-items:center; gap: 16px; margin-bottom: 14px; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 14px;">
                ${logoHtml}
                <div style="min-width:0;">
                  <div style="font-size: 24px; font-weight: 1000; line-height:1;">${p.name}</div>
                  <div style="font-size: 12px; color:#dd9933; font-weight: 900; text-transform: uppercase; margin-top: 6px; letter-spacing: 1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${p.fullName || ''}
                  </div>
                  <div style="font-size: 10px; color:#666; font-weight: 900; text-transform: uppercase; margin-top: 6px; letter-spacing: 2px;">
                    ${p.groupName ? `GROUP: ${p.groupName}` : ''}
                  </div>
                </div>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                <div>
                  <div style="font-size: 10px; color: #999; font-weight: 900; text-transform: uppercase;">PREÇO</div>
                  <div style="font-size: 16px; font-weight: 1000; font-family: 'JetBrains Mono';">$${Number(p.price || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div style="font-size: 10px; color: #999; font-weight: 900; text-transform: uppercase;">VAR 24H</div>
                  <div style="font-size: 16px; font-weight: 1000; color:${changeColor};">${Number(p.change || 0).toFixed(2)}%</div>
                </div>
                <div>
                  <div style="font-size: 10px; color: #999; font-weight: 900; text-transform: uppercase;">MARKET CAP</div>
                  <div style="font-size: 15px; font-weight: 1000; color:#60a5fa;">${formatUSD(Number(p.mkt || 0))}</div>
                </div>
                <div>
                  <div style="font-size: 10px; color: #999; font-weight: 900; text-transform: uppercase;">VOL 24H</div>
                  <div style="font-size: 15px; font-weight: 1000; color:#dd9933;">${formatUSD(Number(p.vol || 0))}</div>
                </div>
              </div>

              <div style="background: rgba(255,255,255,0.05); padding: 14px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08);">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 10px;">
                  <div>
                    <div style="font-size: 9px; color:#666; font-weight: 1000; text-transform: uppercase;">MÁX 24H</div>
                    <div style="font-size: 12px; font-weight: 900; color:#22c55e;">$${Number(p.high24 || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style="font-size: 9px; color:#666; font-weight: 1000; text-transform: uppercase;">MÍN 24H</div>
                    <div style="font-size: 12px; font-weight: 900; color:#ef4444;">$${Number(p.low24 || 0).toLocaleString()}</div>
                  </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                  <div>
                    <div style="font-size: 9px; color:#666; font-weight: 1000; text-transform: uppercase;">ATH</div>
                    <div style="font-size: 12px; font-weight: 900; color:#fff;">$${Number(p.ath || 0).toLocaleString()}</div>
                    <div style="font-size: 10px; font-weight: 1000; color:#ef4444;">${Number(p.ath_p || 0).toFixed(1)}% (DROP)</div>
                  </div>
                  <div>
                    <div style="font-size: 9px; color:#666; font-weight: 1000; text-transform: uppercase;">ATL</div>
                    <div style="font-size: 12px; font-weight: 900; color:#fff;">$${Number(p.atl || 0).toLocaleString()}</div>
                    <div style="font-size: 10px; font-weight: 1000; color:#22c55e;">+${Number(p.atl_p || 0).toFixed(0)}% (PUMP)</div>
                  </div>
                </div>
              </div>
            </div>
          `;
        }
      },

      series: [{
        type: 'treemap',
        data: treemapData.data,
        turboThreshold: 0,
        dataLabels: {
          enabled: true,
          useHTML: true,
          style: { textOutline: 'none' },
        },
        levels: [
          {
            level: 1,
            borderWidth: 2,
            borderColor: 'rgba(0,0,0,0.85)',
            dataLabels: {
              enabled: true,
              align: 'left',
              verticalAlign: 'top',
              allowOverlap: false,
              useHTML: true,
              formatter: function (this: any) {
                const p = this.point;
                const w = p.shapeArgs?.width || 0;
                const h = p.shapeArgs?.height || 0;
                if (w < 110 || h < 70) return null;

                const fs = Math.min(Math.max(w / 18, 12), 22);
                const sub = Math.max(fs * 0.75, 10);

                const ch = Number(p.change || 0) || 0;
                const chColor = ch >= 0 ? '#22c55e' : '#ef4444';

                return `
                  <div style="padding:10px 10px; pointer-events:none;">
                    <div style="font-size:${fs}px; font-weight:1000; color:#fff; text-shadow:0 2px 6px rgba(0,0,0,1); line-height:1.05;">
                      ${p.name}
                    </div>
                    <div style="margin-top:6px; font-size:${sub}px; font-weight:1000; color:${chColor}; text-shadow:0 2px 6px rgba(0,0,0,0.9);">
                      ${ch.toFixed(2)}% • ${Number(p.coinsCount || 0).toLocaleString()} coins
                    </div>
                  </div>
                `;
              }
            }
          },
          {
            level: 2,
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.7)',
            dataLabels: {
              enabled: true,
              useHTML: true,
              formatter: function (this: any) {
                const p = this.point;
                const w = p.shapeArgs?.width || 0;
                const h = p.shapeArgs?.height || 0;

                // filtra labels pequenas (performance + legibilidade)
                if (w < 48 || h < 44) return null;

                const fs = Math.min(Math.max(w / 5.2, 12), 32);
                const sub = Math.max(fs * 0.62, 10);

                let logoHtml = '';
                if (w > 70 && h > 90 && p.logo) {
                  const imgSize = Math.min(Math.max(w * 0.28, 22), 56);
                  logoHtml = `<img src="${p.logo}" style="width:${imgSize}px; height:${imgSize}px; border-radius:50%; margin-bottom:6px; background:#fff; box-shadow:0 4px 8px rgba(0,0,0,0.6); border:2px solid rgba(255,255,255,0.18);" />`;
                }

                const displayVal = mode === 'marketCap'
                  ? formatUSD(Number(p.mkt || 0))
                  : `${Number(p.change || 0).toFixed(2)}%`;

                return `
                  <div style="text-align:center; color:#fff; pointer-events:none; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; line-height:1.1;">
                    ${logoHtml}
                    <div style="font-size:${fs}px; font-weight:1000; text-shadow:0 2px 6px rgba(0,0,0,1);">${p.name}</div>
                    <div style="font-size:${sub}px; font-weight:900; opacity:0.95; text-shadow:0 2px 4px rgba(0,0,0,0.85);">${displayVal}</div>
                  </div>
                `;
              }
            }
          }
        ]
      }]
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [treemapData, mode]);

  const highchartsOk = !!(window.Highcharts && window.Highcharts.seriesTypes && window.Highcharts.seriesTypes.treemap);

  return (
    <div className="h-full flex flex-col bg-black relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col z-30 border-b border-white/10 bg-[#0a0b0c]/90 backdrop-blur-md shrink-0">
        <div className="flex justify-between items-center px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-tech-800 rounded border border-[#dd9933]/30">
              <Layers size={16} className="text-[#dd9933]" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black uppercase text-white tracking-tighter">Market Heatmap</span>
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                {treemapData.hasGrouping ? 'Agrupado por categorias (Master)' : 'Sem agrupamento (fallback)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white/5 p-0.5 rounded border border-white/10">
              <button
                onClick={() => setMode('marketCap')}
                className={`px-4 py-1.5 text-xs font-black rounded transition-all ${
                  mode === 'marketCap' ? 'bg-[#dd9933] text-black shadow' : 'text-gray-500 hover:text-white'
                }`}
                title="Área proporcional ao Market Cap"
              >
                MARKET CAP
              </button>
              <button
                onClick={() => setMode('volatility24h')}
                className={`px-4 py-1.5 text-xs font-black rounded transition-all ${
                  mode === 'volatility24h' ? 'bg-[#dd9933] text-black shadow' : 'text-gray-500 hover:text-white'
                }`}
                title="Área proporcional à volatilidade (|24h%| * mcap)"
              >
                VOLATILIDADE 24H
              </button>
            </div>

            <button
              onClick={loadAll}
              className={`p-2 hover:text-[#dd9933] transition-colors rounded ${isLoading ? 'animate-spin' : ''}`}
              title="Atualizar"
            >
              <RefreshCw size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {(catWarn || !highchartsOk) && (
          <div className="px-4 pb-3">
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              <AlertTriangle size={18} className="text-amber-400 mt-0.5" />
              <div className="text-xs font-bold text-amber-200 leading-relaxed">
                {!highchartsOk
                  ? 'Highcharts Treemap não está disponível. Garanta que o módulo treemap (highcharts/modules/treemap) foi carregado no bundle (local, sem CDN).'
                  : (catWarn || '')
                }
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 relative bg-black overflow-visible">
        <div ref={chartRef} className="absolute inset-0 w-full h-full" />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[100]">
            <div className="flex items-center gap-3 bg-black/80 border border-[#dd9933]/50 px-6 py-4 rounded-xl shadow-2xl">
              <Loader2 className="animate-spin text-[#dd9933]" size={24} />
              <span className="text-xs font-black text-white uppercase tracking-widest">Sincronizando Mercado...</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="h-12 bg-[#0a0b0c] border-t border-white/5 flex flex-col justify-center px-6 z-20 shrink-0">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full gap-4">
          <div className="flex flex-col gap-1 w-full">
            <div className="h-2 w-full rounded-full overflow-hidden flex border border-white/5">
              <div className="flex-1 bg-[#f23645]"></div>
              <div className="flex-1 bg-[#7c252b]"></div>
              <div className="flex-1 bg-[#363a45]"></div>
              <div className="flex-1 bg-[#1b433d]"></div>
              <div className="flex-1 bg-[#089981]"></div>
            </div>
            <div className="flex justify-between w-full text-[9px] font-black text-gray-600 uppercase tracking-widest">
              <span>MUITO BEARISH</span><span>QUEDA</span><span>NEUTRO</span><span>ALTA</span><span>MUITO BULLISH</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapWidget;
