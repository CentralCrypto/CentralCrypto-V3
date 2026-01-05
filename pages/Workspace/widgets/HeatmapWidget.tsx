import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Layers, RefreshCw } from 'lucide-react';
import { fetchTopCoins, isStablecoin } from '../services/api';
import { DashboardItem, Language, ApiCoin } from '../../../types';

interface Props {
  item: DashboardItem;
  language?: Language;
}

declare global {
  interface Window {
    Highcharts: any;
  }
}

const formatUSD = (val: number) => {
  if (val === undefined || val === null || !isFinite(val)) return '$0';
  const abs = Math.abs(val);
  if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
  return `$${val.toLocaleString()}`;
};

const safePct = (v: number) => {
  const n = Number(v);
  if (!isFinite(n)) return '--';
  const s = n >= 0 ? '+' : '';
  return `${s}${n.toFixed(2)}%`;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const HeatmapWidget: React.FC<Props> = ({ item, language = 'pt' }) => {
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  const [taxonomy, setTaxonomy] = useState<any>(null);
  const [catCoinMap, setCatCoinMap] = useState<Record<string, string[]> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<'marketCap' | 'percentChange24h'>('marketCap');

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);

  const fetchJsonSafe = async (url: string) => {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.json();
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const base = '/cachecko/categories';

      const [coinsRes, taxonomyRes, coinMapRes] = await Promise.all([
        fetchTopCoins().catch(() => []),
        fetchJsonSafe(`${base}/taxonomy-master.json`).catch(() => null),
        fetchJsonSafe(`${base}/category_coins_map.json`).catch(() => null),
      ]);

      const processed = (Array.isArray(coinsRes) ? coinsRes : [])
        .filter((c: any) => c && c.id && c.symbol)
        .filter((c: any) => !isStablecoin(String(c.symbol)))
        .map((c: any) => ({
          id: c.id,
          symbol: String(c.symbol || '').toUpperCase(),
          name: c.name || c.symbol,
          current_price: Number(c.current_price || 0) || 0,
          price_change_percentage_24h: Number(c.price_change_percentage_24h || 0) || 0,
          market_cap: Number(c.market_cap || 0) || 0,
          total_volume: Number(c.total_volume || 0) || 0,
          image: c.image || '',
          ath: Number(c.ath || 0) || 0,
          ath_change_percentage: Number(c.ath_change_percentage || 0) || 0,
          atl: Number(c.atl || 0) || 0,
          atl_change_percentage: Number(c.atl_change_percentage || 0) || 0,
          high_24h: Number(c.high_24h || 0) || 0,
          low_24h: Number(c.low_24h || 0) || 0,
        }))
        .sort((a: any, b: any) => (b.market_cap || 0) - (a.market_cap || 0));

      // Pega mais que 100 pra preencher melhor as categorias
      setCoins(processed.slice(0, 300));

      setTaxonomy(taxonomyRes);

      // category_coins_map.json pode vir no formato {categories:{...}} ou direto {...}
      const mapRaw = coinMapRes && typeof coinMapRes === 'object' ? coinMapRes : null;
      const categories =
        mapRaw?.categories && typeof mapRaw.categories === 'object'
          ? mapRaw.categories
          : mapRaw;

      if (categories && typeof categories === 'object') {
        setCatCoinMap(categories as Record<string, string[]>);
      } else {
        setCatCoinMap(null);
      }
    } catch (e) {
      console.error('Heatmap loadData error:', e);
      setCatCoinMap(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- taxonomy parsing (igual teu MarketCapTable) --------
  const parsedTaxonomy = useMemo(() => {
    const raw = taxonomy;
    let masters: any[] = [];

    if (Array.isArray(raw)) masters = raw;
    else if (raw && Array.isArray((raw as any).masters)) masters = (raw as any).masters;
    else if (raw && Array.isArray((raw as any).items)) masters = (raw as any).items;

    return masters
      .filter(Boolean)
      .map((m: any) => ({
        id: String(m.id ?? m.key ?? m.name ?? '').trim(),
        name: String(m.name ?? m.title ?? m.id ?? '').trim(),
        categoryIds: Array.isArray(m.categoryIds) ? m.categoryIds.map(String) : Array.isArray(m.categories) ? m.categories.map(String) : [],
        children: Array.isArray(m.children) ? m.children : Array.isArray(m.groups) ? m.groups : [],
      }))
      .filter((m: any) => m.id);
  }, [taxonomy]);

  // category -> set(coinId)
  const categoryCoinIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!catCoinMap) return map;

    for (const [catId, arr] of Object.entries(catCoinMap)) {
      if (!catId || !Array.isArray(arr)) continue;
      map.set(String(catId), new Set(arr.map(x => String(x))));
    }
    return map;
  }, [catCoinMap]);

  // coinById
  const coinById = useMemo(() => {
    const m = new Map<string, ApiCoin>();
    for (const c of coins) {
      if (c?.id) m.set(String(c.id), c);
    }
    return m;
  }, [coins]);

  // Resolve membros por catIds (existentes no coinById)
  const membersFromCategoryIds = (catIds: string[]) => {
    const seen = new Set<string>();
    const members: ApiCoin[] = [];

    for (const cid of catIds) {
      const setIds = categoryCoinIds.get(cid);
      if (!setIds) continue;

      for (const id of setIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        const c = coinById.get(id);
        if (c) members.push(c);
      }
    }
    return members;
  };

  // --------- monta data do treemap (LEVEL 1 -> LEVEL 2 -> COINS) ----------
  const treemapData = useMemo(() => {
    // Se não tem mapping de categorias, mete tudo num grupo só e segue o jogo.
    const hasMap = !!catCoinMap && categoryCoinIds.size > 0 && parsedTaxonomy.length > 0;

    const data: any[] = [];
    const assigned = new Set<string>();

    const buildLeaf = (coin: ApiCoin, parentId: string) => {
      const change = Number((coin as any).price_change_percentage_24h || 0) || 0;
      const mkt = Number((coin as any).market_cap || 0) || 0;

      const sizeValue =
        mode === 'marketCap'
          ? Math.max(1, mkt)
          : Math.max(1, mkt); // mantém área por mcap; modo muda o label/tooltip (mais legível)

      return {
        id: `c:${coin.id}`,
        parent: parentId,
        name: String((coin as any).symbol || '').toUpperCase(),
        value: sizeValue,
        colorValue: clamp(change, -12, 12),
        custom: {
          fullName: (coin as any).name || '',
          change,
          price: Number((coin as any).current_price || 0) || 0,
          mkt,
          vol: Number((coin as any).total_volume || 0) || 0,
          logo: (coin as any).image || '',
          ath: Number((coin as any).ath || 0) || 0,
          ath_p: Number((coin as any).ath_change_percentage || 0) || 0,
          atl: Number((coin as any).atl || 0) || 0,
          atl_p: Number((coin as any).atl_change_percentage || 0) || 0,
          high24: Number((coin as any).high_24h || 0) || 0,
          low24: Number((coin as any).low_24h || 0) || 0,
        },
      };
    };

    const weightedChange = (members: ApiCoin[]) => {
      const wSum = members.reduce((s, c) => s + (Number((c as any).market_cap || 0) || 0), 0);
      if (wSum <= 0) {
        const vals = members.map(c => Number((c as any).price_change_percentage_24h || 0)).filter(isFinite);
        if (vals.length === 0) return 0;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
      }
      let acc = 0;
      for (const c of members) {
        const w = Number((c as any).market_cap || 0) || 0;
        const ch = Number((c as any).price_change_percentage_24h || 0) || 0;
        acc += w * ch;
      }
      return acc / wSum;
    };

    if (!hasMap) {
      // Level 1
      data.push({
        id: 'm:all',
        name: 'All Coins',
        custom: { fullName: 'All Coins' },
      });
      // Level 2 (sempre cria pra manter levels=3)
      data.push({
        id: 's:all:all',
        parent: 'm:all',
        name: 'Todas',
        custom: { fullName: 'Todas' },
      });

      for (const c of coins.slice(0, 200)) {
        assigned.add(String(c.id));
        data.push(buildLeaf(c, 's:all:all'));
      }

      return data;
    }

    // Com taxonomy + map: masters em ordem
    for (const master of parsedTaxonomy) {
      const masterId = `m:${master.id}`;
      data.push({
        id: masterId,
        name: master.name || master.id,
        custom: { fullName: master.name || master.id },
      });

      const children = Array.isArray(master.children) ? master.children : [];
      const masterCatIds = Array.isArray(master.categoryIds) ? master.categoryIds.map(String) : [];

      // Se não tem children, cria um sub “Todas”
      const effectiveSubs =
        children.length > 0
          ? children
              .filter(Boolean)
              .map((c: any) => ({
                id: String(c.id ?? c.key ?? c.name ?? '').trim(),
                name: String(c.name ?? c.title ?? c.id ?? '').trim(),
                categoryIds: Array.isArray(c.categoryIds) ? c.categoryIds.map(String) : Array.isArray(c.categories) ? c.categories.map(String) : [],
              }))
              .filter((x: any) => x.id)
          : [
              {
                id: '__all__',
                name: 'Todas',
                categoryIds: masterCatIds,
              },
            ];

      for (const sub of effectiveSubs) {
        const subId = `s:${master.id}:${sub.id}`;
        data.push({
          id: subId,
          parent: masterId,
          name: sub.name || sub.id,
          custom: { fullName: sub.name || sub.id },
        });

        // Pega membros pelo mapping e remove duplicados globais (pra não repetir moeda em 2 grupos)
        const membersAll = membersFromCategoryIds(sub.categoryIds || []);
        const members = membersAll.filter(c => !assigned.has(String(c.id)));

        // Se um sub ficar vazio, só deixa o header (ok), mas tenta preencher com algo do master (quando __all__)
        if (members.length === 0 && sub.id === '__all__') {
          const fallbackMembersAll = membersFromCategoryIds(masterCatIds);
          const fallbackMembers = fallbackMembersAll.filter(c => !assigned.has(String(c.id)));
          for (const c of fallbackMembers) {
            assigned.add(String(c.id));
            data.push(buildLeaf(c, subId));
          }
        } else {
          for (const c of members) {
            assigned.add(String(c.id));
            data.push(buildLeaf(c, subId));
          }
        }

        // Dá cor pro header do sub com perf ponderada (nice, igual demo)
        const leafMembers = members.length > 0 ? members : membersFromCategoryIds(sub.categoryIds || []).filter(c => assigned.has(String(c.id)));
        if (leafMembers.length > 0) {
          const perf = weightedChange(leafMembers);
          const totalMcap = leafMembers.reduce((s, c) => s + (Number((c as any).market_cap || 0) || 0), 0);

          // Atualiza o próprio sub node (último push desse sub foi o header)
          const idx = data.findIndex(p => p.id === subId);
          if (idx >= 0) {
            data[idx] = {
              ...data[idx],
              value: Math.max(1, totalMcap),
              colorValue: clamp(perf, -12, 12),
              custom: {
                ...(data[idx].custom || {}),
                performance: safePct(perf),
              },
            };
          }
        }
      }
    }

    // Sobras (coins top que não caíram em nada): joga em OTHER
    const leftovers = coins.filter(c => !assigned.has(String(c.id))).slice(0, 120);
    if (leftovers.length > 0) {
      data.push({ id: 'm:other', name: 'Other', custom: { fullName: 'Other' } });
      data.push({ id: 's:other:all', parent: 'm:other', name: 'Todas', custom: { fullName: 'Todas' } });

      for (const c of leftovers) {
        data.push(buildLeaf(c, 's:other:all'));
      }
    }

    return data;
  }, [coins, catCoinMap, categoryCoinIds, coinById, parsedTaxonomy, mode]);

  // ----------- render Highcharts -----------
  useEffect(() => {
    if (!chartRef.current || !window.Highcharts) return;
    if (!treemapData || treemapData.length === 0) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    chartInstance.current = window.Highcharts.chart(chartRef.current, {
      chart: {
        type: 'treemap',
        backgroundColor: 'transparent',
        animation: false,
        style: { fontFamily: 'Inter, sans-serif' },
        spacing: [0, 0, 0, 0],
        margin: [0, 0, 0, 0],
      },
      title: { text: null },
      subtitle: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      exporting: { enabled: false },

      colorAxis: {
        min: -12,
        max: 12,
        stops: [
          [0, '#f23645'],
          [0.5, '#363a45'],
          [1, '#089981'],
        ],
        gridLineWidth: 0,
        labels: { enabled: false },
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
          // Nó de grupo (level 1/2)
          if (!p?.custom?.price && p?.node?.level && p.node.level <= 2) {
            const perf = p?.custom?.performance ? String(p.custom.performance) : '--';
            return `
              <div style="padding: 16px; min-width: 260px; color:#fff; font-family:Inter,sans-serif; pointer-events:none;">
                <div style="font-size:14px; font-weight:900; color:#dd9933; text-transform:uppercase; letter-spacing:1px;">Grupo</div>
                <div style="font-size:22px; font-weight:1000; margin-top:4px;">${p.name}</div>
                <div style="margin-top:10px; font-size:12px; color:#9aa0aa; text-transform:uppercase; font-weight:900;">Performance (ponderada)</div>
                <div style="font-size:18px; font-weight:1000;">${perf}</div>
              </div>
            `;
          }

          // Moeda (leaf)
          const change = Number(p?.custom?.change || 0) || 0;
          const changeColor = change >= 0 ? '#22c55e' : '#ef4444';

          return `
            <div style="padding: 20px; min-width: 360px; color: #ffffff; pointer-events: none; font-family: 'Inter', sans-serif;">
              <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px; border-bottom:2px solid rgba(255,255,255,0.1); padding-bottom:16px;">
                ${p.custom.logo ? `<img src="${p.custom.logo}" style="width:52px; height:52px; border-radius:50%; background:#fff; border:3px solid #dd9933;">` : ''}
                <div>
                  <div style="font-size:24px; font-weight:900; line-height:1;">${p.name}</div>
                  <div style="font-size:13px; color:#dd9933; font-weight:800; text-transform:uppercase; margin-top:5px; letter-spacing:1px;">
                    ${(p.custom.fullName || '').toString()}
                  </div>
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                <div>
                  <div style="font-size:10px; color:#999; font-weight:bold; text-transform:uppercase;">PREÇO ATUAL</div>
                  <div style="font-size:18px; font-weight:900; font-family:'JetBrains Mono';">$${Number(p.custom.price || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div style="font-size:10px; color:#999; font-weight:bold; text-transform:uppercase;">VARIAÇÃO 24H</div>
                  <div style="font-size:18px; font-weight:1000; color:${changeColor};">${change.toFixed(2)}%</div>
                </div>
                <div>
                  <div style="font-size:10px; color:#999; font-weight:bold; text-transform:uppercase;">MARKET CAP</div>
                  <div style="font-size:17px; font-weight:900; color:#60a5fa;">${formatUSD(Number(p.custom.mkt || 0))}</div>
                </div>
                <div>
                  <div style="font-size:10px; color:#999; font-weight:bold; text-transform:uppercase;">VOLUME 24H</div>
                  <div style="font-size:17px; font-weight:900; color:#dd9933;">${formatUSD(Number(p.custom.vol || 0))}</div>
                </div>
              </div>

              <div style="background:rgba(255,255,255,0.05); padding:16px; border-radius:16px; border:1px solid rgba(255,255,255,0.08);">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:12px;">
                  <div>
                    <div style="font-size:9px; color:#666; font-weight:900; text-transform:uppercase;">MÁX 24H</div>
                    <div style="font-size:13px; font-weight:800; color:#22c55e;">$${Number(p.custom.high24 || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style="font-size:9px; color:#666; font-weight:900; text-transform:uppercase;">MÍN 24H</div>
                    <div style="font-size:13px; font-weight:800; color:#ef4444;">$${Number(p.custom.low24 || 0).toLocaleString()}</div>
                  </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                  <div>
                    <div style="font-size:9px; color:#666; font-weight:900; text-transform:uppercase;">ALL TIME HIGH</div>
                    <div style="font-size:13px; font-weight:800; color:#fff;">$${Number(p.custom.ath || 0).toLocaleString()}</div>
                    <div style="font-size:10px; font-weight:1000; color:#ef4444;">${Number(p.custom.ath_p || 0).toFixed(1)}% (DROP)</div>
                  </div>
                  <div>
                    <div style="font-size:9px; color:#666; font-weight:900; text-transform:uppercase;">ALL TIME LOW</div>
                    <div style="font-size:13px; font-weight:800; color:#fff;">$${Number(p.custom.atl || 0).toLocaleString()}</div>
                    <div style="font-size:10px; font-weight:1000; color:#22c55e;">+${Number(p.custom.atl_p || 0).toFixed(0)}% (PUMP)</div>
                  </div>
                </div>
              </div>
            </div>
          `;
        },
      },

      series: [
        {
          name: 'All',
          type: 'treemap',
          layoutAlgorithm: 'squarified',
          allowDrillToNode: true,
          animationLimit: 1000,
          borderColor: 'rgba(0,0,0,0.35)',
          borderWidth: 1,
          opacity: 1,
          nodeSizeBy: 'leaf',

          dataLabels: {
            enabled: false,
            useHTML: true,
            allowOverlap: true,
            style: { textOutline: 'none' },
          },

          levels: [
            {
              level: 1,
              borderWidth: 3,
              levelIsConstant: false,
              dataLabels: {
                enabled: true,
                headers: true,
                align: 'left',
                padding: 6,
                style: {
                  fontWeight: '900',
                  fontSize: '12px',
                  color: '#dd9933',
                  textTransform: 'uppercase',
                  textOutline: 'none',
                },
                formatter: function (this: any) {
                  return `<span style="letter-spacing:1px;">${this.point.name}</span>`;
                },
              },
            },
            {
              level: 2,
              groupPadding: 2,
              dataLabels: {
                enabled: true,
                headers: true,
                align: 'center',
                useHTML: true,
                padding: 0,
                style: {
                  color: '#ffffff',
                  fontWeight: '900',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  textOutline: 'none',
                },
                formatter: function (this: any) {
                  const p = this.point;
                  const perf = p?.custom?.performance ? String(p.custom.performance) : '';
                  const bg = 'rgba(54,58,69,0.65)';
                  return `
                    <div style="
                      display:inline-flex; align-items:center; gap:8px;
                      background:${bg};
                      border:1px solid rgba(255,255,255,0.12);
                      padding:2px 8px; border-radius:999px;
                      line-height:1;
                      box-shadow:0 6px 14px rgba(0,0,0,0.35);
                      ">
                      <span style="font-size:11px;">${p.name}</span>
                      ${perf ? `<span style="font-size:11px; color:#dd9933;">${perf}</span>` : ''}
                    </div>
                  `;
                },
              },
            },
            {
              level: 3,
              dataLabels: {
                enabled: true,
                useHTML: true,
                allowOverlap: true,
                formatter: function (this: any) {
                  const p = this.point;
                  const w = p.shapeArgs?.width || 0;
                  const h = p.shapeArgs?.height || 0;
                  if (w < 46 || h < 34) return '';

                  const change = Number(p?.custom?.change || 0) || 0;
                  const changeColor = change >= 0 ? '#22c55e' : '#ef4444';

                  const fontSize = Math.min(Math.max(w / 6.2, 10), 28);
                  const subFont = Math.max(Math.floor(fontSize * 0.7), 10);

                  const showLogo = w > 70 && h > 70 && !!p?.custom?.logo;
                  const imgSize = Math.min(Math.max(w * 0.28, 22), 52);

                  const secondLine =
                    mode === 'marketCap'
                      ? formatUSD(Number(p?.custom?.mkt || 0))
                      : `${change.toFixed(2)}%`;

                  const secondColor = mode === 'marketCap' ? '#ffffff' : changeColor;

                  return `
                    <div style="
                      width:100%; height:100%;
                      display:flex; flex-direction:column;
                      align-items:center; justify-content:center;
                      text-align:center; pointer-events:none;
                      color:#fff; line-height:1.05;
                      text-shadow:0 2px 6px rgba(0,0,0,0.95);
                    ">
                      ${showLogo ? `<img src="${p.custom.logo}" style="
                        width:${imgSize}px; height:${imgSize}px; border-radius:50%;
                        background:#fff; padding:2px;
                        border:2px solid rgba(221,153,51,0.75);
                        box-shadow:0 6px 16px rgba(0,0,0,0.45);
                        margin-bottom:6px;
                      "/>` : ''}
                      <div style="font-weight:1000; font-size:${fontSize}px;">${p.name}</div>
                      <div style="font-weight:900; opacity:0.95; font-size:${subFont}px; color:${secondColor};">
                        ${secondLine}
                      </div>
                    </div>
                  `;
                },
                style: { textOutline: 'none' },
              },
            },
          ],

          accessibility: { exposeAsGroupOnly: true },

          breadcrumbs: {
            buttonTheme: {
              fill: 'rgba(10,11,12,0.6)',
              stroke: 'rgba(255,255,255,0.08)',
              style: { color: '#dd9933', fontWeight: '900' },
              states: {
                hover: { fill: 'rgba(10,11,12,0.85)', style: { color: '#ffffff' } },
                select: { style: { color: '#ffffff' } },
              },
            },
          },

          data: treemapData,
        },
      ],
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [treemapData, mode]);

  return (
    <div className="h-full flex flex-col bg-black relative overflow-hidden">
      <div className="flex flex-col z-30 border-b border-white/10 bg-[#0a0b0c]/90 backdrop-blur-md shrink-0">
        <div className="flex justify-between items-center px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-tech-800 rounded border border-[#dd9933]/30">
              <Layers size={16} className="text-[#dd9933]" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black uppercase text-white tracking-tighter">
                Market Heatmap
              </span>
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                Drilldown por Categorias → Moedas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white/5 p-0.5 rounded border border-white/10">
              <button
                onClick={() => setMode('marketCap')}
                className={`px-4 py-1.5 text-xs font-black rounded transition-all ${
                  mode === 'marketCap'
                    ? 'bg-[#dd9933] text-black shadow'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                MARKET CAP
              </button>
              <button
                onClick={() => setMode('percentChange24h')}
                className={`px-4 py-1.5 text-xs font-black rounded transition-all ${
                  mode === 'percentChange24h'
                    ? 'bg-[#dd9933] text-black shadow'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                VAR % 24H
              </button>
            </div>

            <button
              onClick={loadData}
              className={`p-2 hover:text-[#dd9933] transition-colors rounded ${
                isLoading ? 'animate-spin' : ''
              }`}
              title="Atualizar"
            >
              <RefreshCw size={18} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 relative bg-black overflow-visible">
        <div ref={chartRef} className="absolute inset-0 w-full h-full" />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[100]">
            <div className="flex items-center gap-3 bg-black/80 border border-[#dd9933]/50 px-6 py-4 rounded-xl shadow-2xl">
              <Loader2 className="animate-spin text-[#dd9933]" size={24} />
              <span className="text-xs font-black text-white uppercase tracking-widest">
                Sincronizando Mercado...
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="h-12 bg-[#0a0b0c] border-t border-white/5 flex flex-col justify-center px-6 z-20 shrink-0">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full gap-4">
          <div className="flex flex-col gap-1 w-full">
            <div className="h-2 w-full rounded-full overflow-hidden flex border border-white/5">
              <div className="flex-1 bg-[#f23645]" />
              <div className="flex-1 bg-[#7c252b]" />
              <div className="flex-1 bg-[#363a45]" />
              <div className="flex-1 bg-[#1b433d]" />
              <div className="flex-1 bg-[#089981]" />
            </div>
            <div className="flex justify-between w-full text-[9px] font-black text-gray-600 uppercase tracking-widest">
              <span>MUITO BEARISH</span>
              <span>QUEDA</span>
              <span>NEUTRO</span>
              <span>ALTA</span>
              <span>MUITO BULLISH</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapWidget;
