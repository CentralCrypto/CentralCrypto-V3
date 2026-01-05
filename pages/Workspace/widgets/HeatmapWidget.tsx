import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Loader2, Layers, RefreshCw } from 'lucide-react';
import { fetchTopCoins, isStablecoin } from '../services/api';
import { DashboardItem, Language, ApiCoin } from '../../../types';

interface Props {
  item: DashboardItem;
  language?: Language;
}

const formatUSD = (val: number) => {
  if (!val || !isFinite(val)) return '$0';
  const abs = Math.abs(val);
  if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
};

const pct = (v: number) => {
  if (!isFinite(v)) return '—';
  const s = v >= 0 ? '+' : '';
  return `${s}${v.toFixed(2)}%`;
};

type TaxMaster = {
  id: string;
  name: string;
  categoryIds: string[];
  children: { id: string; name: string; categoryIds: string[] }[];
};

const HeatmapWidget: React.FC<Props> = ({ item, language = 'pt' }) => {
  const [coins, setCoins] = useState<ApiCoin[]>([]);
  const [loading, setLoading] = useState(true);

  // Toggle só pra label (tamanho fica por marketcap, como heatmap decente)
  const [mode, setMode] = useState<'marketCap' | 'percentChange24h'>('marketCap');

  const [taxonomy, setTaxonomy] = useState<any>(null);
  const [catCoinMap, setCatCoinMap] = useState<Record<string, string[]> | null>(null);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);
  const pluginAddedRef = useRef(false);

  const fetchJsonSafe = async (url: string) => {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${url} -> ${r.status}`);
    return r.json();
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [top, taxonomyJson, mapJson] = await Promise.all([
        fetchTopCoins().catch(() => []),
        fetchJsonSafe('/cachecko/categories/taxonomy-master.json').catch(() => null),
        fetchJsonSafe('/cachecko/categories/category_coins_map.json').catch(() => null),
      ]);

      const filtered = (Array.isArray(top) ? top : [])
        .filter(c => c && c.id && c.symbol)
        .filter(c => !isStablecoin(String(c.symbol)))
        .map((c: any) => ({
          ...c,
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
        .sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));

      setCoins(filtered);
      setTaxonomy(taxonomyJson);

      if (mapJson && typeof mapJson === 'object') {
        const categories = (mapJson as any).categories && typeof (mapJson as any).categories === 'object'
          ? (mapJson as any).categories
          : mapJson;

        setCatCoinMap(categories && typeof categories === 'object' ? (categories as Record<string, string[]>) : null);
      } else {
        setCatCoinMap(null);
      }
    } catch (e) {
      console.error('Heatmap load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const parsedTaxonomy: TaxMaster[] = useMemo(() => {
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
        children: (Array.isArray(m.children) ? m.children : Array.isArray(m.groups) ? m.groups : [])
          .filter(Boolean)
          .map((c: any) => ({
            id: String(c.id ?? c.key ?? c.name ?? '').trim(),
            name: String(c.name ?? c.title ?? c.id ?? '').trim(),
            categoryIds: Array.isArray(c.categoryIds) ? c.categoryIds.map(String) : Array.isArray(c.categories) ? c.categories.map(String) : [],
          }))
      }))
      .filter((m: any) => m.id && m.name);
  }, [taxonomy]);

  const coinById = useMemo(() => {
    const m = new Map<string, ApiCoin>();
    for (const c of coins) if (c?.id) m.set(String(c.id), c);
    return m;
  }, [coins]);

  const categoryCoinIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!catCoinMap) return map;
    for (const [catId, arr] of Object.entries(catCoinMap)) {
      if (!catId || !Array.isArray(arr)) continue;
      map.set(String(catId), new Set(arr.map(x => String(x))));
    }
    return map;
  }, [catCoinMap]);

  const getCoinChange24 = (c: ApiCoin) => {
    const v = (c as any).price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? 0;
    return isFinite(v) ? Number(v) : 0;
  };

  const membersFromCategoryIds = useCallback((catIds: string[]) => {
    const seen = new Set<string>();
    const out: ApiCoin[] = [];

    for (const cid of catIds) {
      const setIds = categoryCoinIds.get(cid);
      if (!setIds) continue;
      for (const id of setIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        const c = coinById.get(id);
        if (c) out.push(c);
      }
    }
    // limita pra não explodir (mas ainda mostra bastante)
    out.sort((a, b) => (Number(b.market_cap || 0) - Number(a.market_cap || 0)));
    return out.slice(0, 180);
  }, [categoryCoinIds, coinById]);

  const buildTreemapData = useMemo(() => {
    // fallback: se não tiver mapping, cai pro top 100 por mcap sem agrupamento
    if (!parsedTaxonomy.length || categoryCoinIds.size === 0) {
      const top = coins.slice(0, 120);
      return top.map((c) => {
        const ch = getCoinChange24(c);
        const mc = Number(c.market_cap || 0) || 1;
        return {
          id: String(c.id),
          name: String(c.symbol || '').toUpperCase(),
          value: mc,
          colorValue: ch,
          custom: {
            fullName: c.name,
            performance: pct(ch),
            logo: c.image,
            price: c.current_price,
            mkt: c.market_cap,
            vol: c.total_volume,
            ath: c.ath,
            ath_p: c.ath_change_percentage,
            atl: c.atl,
            atl_p: c.atl_change_percentage,
            high24: c.high_24h,
            low24: c.low_24h
          }
        };
      });
    }

    const points: any[] = [];

    // level 1: masters
    for (const master of parsedTaxonomy) {
      points.push({
        id: master.id,
        name: master.name,
        custom: { fullName: master.name }
      });

      const subs = Array.isArray(master.children) && master.children.length > 0
        ? master.children
        : [{ id: `${master.id}__all__`, name: 'Todas', categoryIds: master.categoryIds }];

      for (const sub of subs) {
        const subId = `${master.id}::${sub.id}`;
        points.push({
          id: subId,
          parent: master.id,
          name: sub.name,
          custom: { fullName: sub.name }
        });

        const members = membersFromCategoryIds(sub.categoryIds || []);
        for (const c of members) {
          const ch = getCoinChange24(c);
          const mc = Number(c.market_cap || 0) || 1;

          points.push({
            id: `${c.id}__${subId}`, // evita colisão se a moeda aparecer em mais de um grupo
            name: String(c.symbol || '').toUpperCase(),
            parent: subId,
            value: mc,
            colorValue: ch,
            custom: {
              fullName: c.name,
              performance: pct(ch),
              logo: c.image,
              price: c.current_price,
              mkt: c.market_cap,
              vol: c.total_volume,
              ath: c.ath,
              ath_p: c.ath_change_percentage,
              atl: c.atl,
              atl_p: c.atl_change_percentage,
              high24: c.high_24h,
              low24: c.low_24h
            }
          });
        }
      }
    }

    return points;
  }, [parsedTaxonomy, categoryCoinIds, coins, membersFromCategoryIds]);

  useEffect(() => {
    if (!chartRef.current || !(window as any).Highcharts) return;
    if (!buildTreemapData || buildTreemapData.length === 0) return;

    const Highcharts = (window as any).Highcharts;

    // plugin 1x (igual demo)
    if (!pluginAddedRef.current) {
      pluginAddedRef.current = true;

      Highcharts.addEvent(Highcharts.Series, 'drawDataLabels', function () {
        if (this.type !== 'treemap') return;

        this.points.forEach((point: any) => {
          // Level 2 header: calcula performance combinada (approx) e pinta callout
          if (point?.node?.level === 2 && Number.isFinite(point.value)) {
            const children = Array.isArray(point.node.children) ? point.node.children : [];
            if (!children.length) return;

            const previousValue = children.reduce((acc: number, child: any) => {
              const v = (child.point?.value || 0);
              const cv = (child.point?.colorValue || 0);
              return acc + v - v * cv / 100;
            }, 0);

            const perf = 100 * (point.value - previousValue) / (previousValue || 1);

            point.custom = {
              ...(point.custom || {}),
              performance: (perf < 0 ? '' : '+') + perf.toFixed(2) + '%'
            };

            if (point.dlOptions && this.colorAxis) {
              point.dlOptions.backgroundColor = this.colorAxis.toColor(perf);
            }
          }

          // Level 3 leaf: fonte escala por área
          if (point?.node?.level === 3 && point.shapeArgs && point.dlOptions?.style) {
            const area = point.shapeArgs.width * point.shapeArgs.height;
            point.dlOptions.style.fontSize = `${Math.min(34, 9 + Math.round(area * 0.0008))}px`;
          }
        });
      });
    }

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    chartInstance.current = Highcharts.chart(chartRef.current, {
      chart: {
        type: 'treemap',
        backgroundColor: 'transparent',
        animation: false,
        spacing: [0, 0, 0, 0],
        margin: [0, 0, 0, 0],
        style: { fontFamily: 'Inter, sans-serif' }
      },
      title: { text: null },
      subtitle: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      exporting: { enabled: false },

      colorAxis: {
        min: -15,
        max: 15,
        minColor: '#f73539',
        maxColor: '#2ecc59',
        stops: [
          [0, '#f73539'],
          [0.5, '#414555'],
          [1, '#2ecc59']
        ],
        gridLineWidth: 0,
        labels: {
          overflow: 'allow',
          format: '{#gt value 0}+{value}{else}{value}{/gt}%',
          style: { color: 'white' }
        }
      },

      tooltip: {
        enabled: true,
        useHTML: true,
        outside: true,
        followPointer: true,
        backgroundColor: 'rgba(10, 11, 12, 0.98)',
        borderColor: 'rgba(221, 153, 51, 0.9)',
        borderRadius: 18,
        shadow: true,
        padding: 0,
        style: { zIndex: 9999, color: '#ffffff', pointerEvents: 'none' },
        formatter: function (this: any) {
          const p = this.point;
          if (!p?.custom) return `<div style="padding:14px;color:#fff;">${p.name}</div>`;

          // ignora tooltip de master/sub (sem leaf)
          if (!p.custom.price && p.node?.level !== 3) {
            const perf = p.custom.performance ? ` (${p.custom.performance})` : '';
            return `<div style="padding:14px;min-width:240px;color:#fff;">
              <div style="font-weight:900;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#dd9933;">
                ${p.name}${perf}
              </div>
            </div>`;
          }

          const change = Number(p.colorValue || 0);
          const changeColor = change >= 0 ? '#22c55e' : '#ef4444';

          return `
            <div style="padding: 18px; min-width: 340px; color: #ffffff; pointer-events: none; font-family: 'Inter', sans-serif;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;border-bottom:2px solid rgba(255,255,255,0.08);padding-bottom:14px;">
                ${p.custom.logo ? `<img src="${p.custom.logo}" style="width:48px;height:48px;border-radius:50%;background:#fff;border:3px solid #dd9933;">` : ''}
                <div>
                  <div style="font-size:22px;font-weight:900;line-height:1;">${p.name}</div>
                  <div style="font-size:12px;color:#dd9933;font-weight:800;text-transform:uppercase;margin-top:4px;letter-spacing:.12em;">
                    ${p.custom.fullName || ''}
                  </div>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
                <div>
                  <div style="font-size:10px;color:#999;font-weight:900;text-transform:uppercase;">PREÇO</div>
                  <div style="font-size:17px;font-weight:900;font-family:'JetBrains Mono';">$${(p.custom.price || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div style="font-size:10px;color:#999;font-weight:900;text-transform:uppercase;">24H</div>
                  <div style="font-size:17px;font-weight:1000;color:${changeColor};">${pct(change)}</div>
                </div>
                <div>
                  <div style="font-size:10px;color:#999;font-weight:900;text-transform:uppercase;">MARKET CAP</div>
                  <div style="font-size:15px;font-weight:900;color:#60a5fa;">${formatUSD(p.custom.mkt || 0)}</div>
                </div>
                <div>
                  <div style="font-size:10px;color:#999;font-weight:900;text-transform:uppercase;">VOL 24H</div>
                  <div style="font-size:15px;font-weight:900;color:#dd9933;">${formatUSD(p.custom.vol || 0)}</div>
                </div>
              </div>

              <div style="background:rgba(255,255,255,0.05);padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,0.08);">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px;">
                  <div>
                    <div style="font-size:9px;color:#666;font-weight:900;text-transform:uppercase;">MÁX 24H</div>
                    <div style="font-size:12px;font-weight:800;color:#22c55e;">$${(p.custom.high24 || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style="font-size:9px;color:#666;font-weight:900;text-transform:uppercase;">MÍN 24H</div>
                    <div style="font-size:12px;font-weight:800;color:#ef4444;">$${(p.custom.low24 || 0).toLocaleString()}</div>
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                  <div>
                    <div style="font-size:9px;color:#666;font-weight:900;text-transform:uppercase;">ATH</div>
                    <div style="font-size:12px;font-weight:800;color:#fff;">$${(p.custom.ath || 0).toLocaleString()}</div>
                    <div style="font-size:10px;font-weight:1000;color:#ef4444;">${(p.custom.ath_p ?? 0).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div style="font-size:9px;color:#666;font-weight:900;text-transform:uppercase;">ATL</div>
                    <div style="font-size:12px;font-weight:800;color:#fff;">$${(p.custom.atl || 0).toLocaleString()}</div>
                    <div style="font-size:10px;font-weight:1000;color:#22c55e;">+${(p.custom.atl_p ?? 0).toFixed(0)}%</div>
                  </div>
                </div>
              </div>
            </div>
          `;
        }
      },

      plotOptions: {
        series: {
          animation: false
        }
      },

      series: [{
        name: 'All',
        type: 'treemap',
        allowDrillToNode: true,
        animationLimit: 1000,
        layoutAlgorithm: 'squarified',
        borderColor: '#0a0b0c',
        color: '#0a0b0c',
        opacity: 0.01,
        nodeSizeBy: 'leaf',
        dataLabels: {
          enabled: false,
          allowOverlap: true,
          style: {
            fontSize: '0.9em',
            textOutline: 'none'
          }
        },
        levels: [{
          level: 1,
          dataLabels: {
            enabled: true,
            headers: true,
            align: 'left',
            style: {
              fontWeight: 'bold',
              fontSize: '0.75em',
              lineClamp: 1,
              textTransform: 'uppercase',
              color: '#ffffff'
            },
            padding: 3
          },
          borderWidth: 3,
          levelIsConstant: false
        }, {
          level: 2,
          dataLabels: {
            enabled: true,
            headers: true,
            align: 'center',
            shape: 'callout',
            backgroundColor: '#414555',
            borderWidth: 1,
            borderColor: '#0a0b0c',
            padding: 0,
            style: {
              color: 'white',
              fontWeight: 'normal',
              fontSize: '0.65em',
              lineClamp: 1,
              textOutline: 'none',
              textTransform: 'uppercase'
            }
          },
          groupPadding: 1
        }, {
          level: 3,
          dataLabels: {
            enabled: true,
            align: 'center',
            useHTML: true,
            formatter: function (this: any) {
              const p = this.point;
              const w = p.shapeArgs?.width || 0;
              const h = p.shapeArgs?.height || 0;
              if (w < 42 || h < 38) return null;

              const line2 = mode === 'marketCap'
                ? formatUSD(Number(p.custom?.mkt || 0))
                : (p.custom?.performance || pct(Number(p.colorValue || 0)));

              // opcional: logo só se tiver espaço
              let logoHtml = '';
              if (w > 72 && h > 88 && p.custom?.logo) {
                const imgSize = Math.min(Math.max(w * 0.28, 22), 56);
                logoHtml = `<img src="${p.custom.logo}" style="width:${imgSize}px;height:${imgSize}px;border-radius:50%;margin-bottom:6px;background:#fff;box-shadow:0 4px 10px rgba(0,0,0,.65);border:2px solid rgba(255,255,255,.2);" />`;
              }

              return `
                <div style="text-align:center;color:#fff;line-height:1.05;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;">
                  ${logoHtml}
                  <div style="font-weight:1000;text-shadow:0 2px 7px rgba(0,0,0,1);">
                    ${p.name}
                  </div>
                  <div style="font-weight:900;opacity:.95;text-shadow:0 2px 6px rgba(0,0,0,.9);font-size:.8em;">
                    ${line2}
                  </div>
                </div>
              `;
            },
            style: { color: '#ffffff', textOutline: 'none' }
          }
        }],
        accessibility: { exposeAsGroupOnly: true },
        breadcrumbs: {
          buttonTheme: {
            style: { color: 'silver' },
            states: {
              hover: { fill: '#333' },
              select: { style: { color: 'white' } }
            }
          }
        },
        data: buildTreemapData
      }]
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [buildTreemapData, mode]);

  return (
    <div className="h-full flex flex-col bg-black relative overflow-hidden">
      <div className="flex flex-col z-30 border-b border-white/10 bg-[#0a0b0c]/90 backdrop-blur-md shrink-0">
        <div className="flex justify-between items-center px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-tech-800 rounded border border-[#dd9933]/30">
              <Layers size={16} className="text-[#dd9933]" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black uppercase text-white tracking-tighter">Market Heatmap</span>
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Drilldown por categorias → moedas</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white/5 p-0.5 rounded border border-white/10">
              <button
                onClick={() => setMode('marketCap')}
                className={`px-4 py-1.5 text-xs font-black rounded transition-all ${mode === 'marketCap' ? 'bg-[#dd9933] text-black shadow' : 'text-gray-500 hover:text-white'}`}
              >
                MARKET CAP
              </button>
              <button
                onClick={() => setMode('percentChange24h')}
                className={`px-4 py-1.5 text-xs font-black rounded transition-all ${mode === 'percentChange24h' ? 'bg-[#dd9933] text-black shadow' : 'text-gray-500 hover:text-white'}`}
              >
                VAR % 24H
              </button>
            </div>

            <button
              onClick={loadAll}
              className={`p-2 hover:text-[#dd9933] transition-colors rounded ${loading ? 'animate-spin' : ''}`}
              title="Atualizar"
            >
              <RefreshCw size={18} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 relative bg-black overflow-visible">
        <div ref={chartRef} className="absolute inset-0 w-full h-full" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[100]">
            <div className="flex items-center gap-3 bg-black/80 border border-[#dd9933]/50 px-6 py-4 rounded-xl shadow-2xl">
              <Loader2 className="animate-spin text-[#dd9933]" size={24} />
              <span className="text-xs font-black text-white uppercase tracking-widest">Sincronizando Mercado...</span>
            </div>
          </div>
        )}
      </div>

      <div className="h-12 bg-[#0a0b0c] border-t border-white/5 flex flex-col justify-center px-6 z-20 shrink-0">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full gap-4">
          <div className="flex flex-col gap-1 w-full">
            <div className="h-2 w-full rounded-full overflow-hidden flex border border-white/5">
              <div className="flex-1 bg-[#f73539]" />
              <div className="flex-1 bg-[#b53b43]" />
              <div className="flex-1 bg-[#414555]" />
              <div className="flex-1 bg-[#2ecc59]" />
              <div className="flex-1 bg-[#1fb14a]" />
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
