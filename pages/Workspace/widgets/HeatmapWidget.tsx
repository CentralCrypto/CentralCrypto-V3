
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import ExportingModule from 'highcharts/modules/exporting';
import AccessibilityModule from 'highcharts/modules/accessibility';
import { DashboardItem, Language } from '../../../types';
import { Loader2, RefreshCw } from 'lucide-react';

// Tipos de dados
type Coin = {
  id: string;
  symbol?: string;
  name?: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  total_volume?: number;
  volume_24h?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  high_24h?: number;
  low_24h?: number;
  ath?: number;
};

type CategoryRow = { id: string; name: string; };
type CategoryCoinsMap = Record<string, string[]>;
type ValueMode = 'marketcap' | 'var24h';

let HC_INITED = false;
function initHighchartsOnce() {
  if (HC_INITED) return;
  HC_INITED = true;
  try { (TreemapModule as any)(Highcharts); } catch (e) { console.error(e); }
  try { (ExportingModule as any)(Highcharts); } catch (e) { }
  try { (AccessibilityModule as any)(Highcharts); } catch (e) { }

  Highcharts.setOptions({
    chart: { style: { fontFamily: 'Inter, system-ui, sans-serif' } }
  });
}

const ENDPOINTS = {
  COINS_LITE: '/cachecko/cachecko_lite.json',
  TAXONOMY: '/cachecko/categories/taxonomy-master.json',
  CAT_MAP: '/cachecko/categories/category_coins_map.json'
};

async function httpGetJson(url: string) {
  const salt = Math.floor(Date.now() / 60000);
  const finalUrl = url.includes('?') ? `${url}&_cb=${salt}` : `${url}?_cb=${salt}`;
  const r = await fetch(finalUrl, { cache: 'no-store' });
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

function safeNum(v: any) { return Number.isFinite(Number(v)) ? Number(v) : 0; }
function safeUpper(s?: string) { return (s || '').toUpperCase(); }
function fmtPct(v: number) { return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`; }
function fmtMoney(v: number) {
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
}

// Normalizador de categorias (suporta estrutura n8n ou direta)
function normalizeCategories(raw: any): CategoryRow[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
      // Se for array de objetos {id, name}
      const valid = raw.filter(x => x.id && x.name).map(x => ({ id: String(x.id), name: String(x.name) }));
      if (valid.length > 0) return valid;
      // Se tiver children
      const sub = raw.find(x => x && Array.isArray(x.data));
      if (sub) return normalizeCategories(sub.data);
  }
  return [];
}

interface HeatmapWidgetProps {
  item: DashboardItem;
  language?: Language;
}

export default function HeatmapWidget({ item, language }: HeatmapWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [catMap, setCatMap] = useState<CategoryCoinsMap>({});
  
  const [valueMode, setValueMode] = useState<ValueMode>('marketcap');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);

  useEffect(() => { initHighchartsOnce(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cData, tData, mData] = await Promise.all([
        httpGetJson(ENDPOINTS.COINS_LITE),
        httpGetJson(ENDPOINTS.TAXONOMY).catch(() => []),
        httpGetJson(ENDPOINTS.CAT_MAP).catch(() => ({}))
      ]);

      let coinsArr: any[] = [];
      if (Array.isArray(cData)) coinsArr = cData;
      else if (cData?.data && Array.isArray(cData.data)) coinsArr = cData.data;
      else if (Array.isArray(cData?.[0]?.data)) coinsArr = cData[0].data;

      setCoins(coinsArr as Coin[]);
      setCategories(normalizeCategories(tData));
      
      const mapObj = mData?.categories || mData?.data || mData;
      setCatMap(mapObj || {});
    } catch (e) {
      console.error("Heatmap Data Error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Filtros e Dados
  const chartData = useMemo(() => {
    let list = coins;
    
    // Filtrar por categoria
    if (selectedCategoryId && catMap[selectedCategoryId]) {
      const ids = new Set(catMap[selectedCategoryId].map(String));
      list = list.filter(c => ids.has(String(c.id)));
    }

    // Ordenar e limitar
    const sorted = [...list]
      .filter(c => c.id && c.symbol)
      .sort((a, b) => safeNum(b.market_cap) - safeNum(a.market_cap))
      .slice(0, 450);

    return sorted.map(c => {
      const change24 = safeNum(c.price_change_percentage_24h);
      const mc = Math.max(1, safeNum(c.market_cap));
      // No modo MarketCap usamos o MC. No modo Var usamos change absoluto (tamanho) + change real (cor)
      // Ajuste: Para modo Var, usamos MC para tamanho também, para manter hierarquia visual, ou usar abs(change)
      // O padrão da indústria é Tamanho = MarketCap, Cor = Performance. Vamos manter isso pois é mais legível.
      // Se o usuário quiser Tamanho = Performance, podemos mudar.
      // Vou manter Tamanho = MarketCap sempre (mais estável) e Cor muda.
      // SE o usuário selecionou 'var24h' no botão, talvez ele queira Tamanho = Volatilidade?
      // Vou assumir Tamanho = MC sempre, ValueMode altera apenas a lógica de "valor" se fosse drilldown, mas aqui é visual.
      
      const val = valueMode === 'marketcap' ? mc : Math.max(1, safeNum(c.total_volume)); // Var24h size usually volume or mcap

      return {
        id: c.id,
        name: safeUpper(c.symbol),
        value: val,
        colorValue: change24,
        custom: {
          fullName: c.name,
          price: safeNum(c.current_price),
          logo: c.image,
          rank: c.market_cap_rank,
          change24,
          change7d: safeNum(c.price_change_percentage_7d_in_currency),
          change1h: safeNum(c.price_change_percentage_1h_in_currency),
          mcap: mc,
          vol: safeNum(c.total_volume)
        }
      };
    });
  }, [coins, selectedCategoryId, catMap, valueMode]);

  // Render Chart
  useEffect(() => {
    if (!containerRef.current) return;
    if (chartData.length === 0 && !loading) return;

    if (chartRef.current) {
        chartRef.current.destroy();
    }

    chartRef.current = Highcharts.chart(containerRef.current, {
      chart: {
        backgroundColor: '#111216',
        margin: 0,
        height: '100%',
        animation: false
      },
      title: { text: null },
      credits: { enabled: false },
      exporting: { enabled: false },
      tooltip: {
        useHTML: true,
        backgroundColor: 'rgba(20, 20, 25, 0.95)',
        borderColor: '#333',
        borderRadius: 12,
        shadow: true,
        padding: 0,
        followPointer: true,
        formatter: function () {
          // @ts-ignore
          const p = this.point;
          const c = p.custom;
          const color = (v: number) => v >= 0 ? '#2ecc59' : '#f73539';
          
          return `
            <div style="font-family: 'Inter', sans-serif; padding: 12px; min-width: 200px; color: white;">
               <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                  ${c.logo ? `<img src="${c.logo}" style="width: 24px; height: 24px; border-radius: 50%;">` : ''}
                  <div>
                     <div style="font-weight: 900; font-size: 14px;">${p.name}</div>
                     <div style="font-size: 10px; color: #888; text-transform: uppercase;">${c.fullName} #${c.rank}</div>
                  </div>
               </div>
               <div style="font-size: 18px; font-weight: 900; margin-bottom: 8px;">$${c.price < 1 ? c.price.toFixed(6) : c.price.toLocaleString()}</div>
               <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; text-align: center; background: rgba(255,255,255,0.05); padding: 4px; border-radius: 6px;">
                  <div><div style="font-size: 8px; color: #666;">1H</div><div style="font-size: 10px; font-weight: bold; color: ${color(c.change1h)}">${fmtPct(c.change1h)}</div></div>
                  <div><div style="font-size: 8px; color: #666;">24H</div><div style="font-size: 10px; font-weight: bold; color: ${color(c.change24)}">${fmtPct(c.change24)}</div></div>
                  <div><div style="font-size: 8px; color: #666;">7D</div><div style="font-size: 10px; font-weight: bold; color: ${color(c.change7d)}">${fmtPct(c.change7d)}</div></div>
               </div>
               <div style="margin-top: 8px; font-size: 10px; color: #888; display: flex; justify-content: space-between;">
                  <span>MCap: <b style="color: #ddd">${fmtMoney(c.mcap)}</b></span>
                  <span>Vol: <b style="color: #ddd">${fmtMoney(c.vol)}</b></span>
               </div>
            </div>
          `;
        }
      },
      colorAxis: {
        min: -10,
        max: 10,
        stops: [
          [0, '#f73539'],      // Vermelho
          [0.5, '#414555'],    // Cinza
          [1, '#2ecc59']       // Verde
        ]
      },
      series: [{
        type: 'treemap',
        layoutAlgorithm: 'squarified',
        data: chartData,
        borderWidth: 1,
        borderColor: '#111216',
        dataLabels: {
          enabled: true,
          useHTML: true,
          align: 'center',
          verticalAlign: 'middle',
          style: { textOutline: 'none', color: '#fff' },
          formatter: function () {
            // @ts-ignore
            const p = this.point;
            const w = p.shapeArgs?.width || 0;
            const h = p.shapeArgs?.height || 0;
            
            // Lógica de visibilidade baseada no tamanho
            if (w < 35 || h < 25) return ''; 

            const fontSize = Math.min(Math.max(10, w / 5), 40);
            const logoSize = Math.min(fontSize * 1.2, 30);
            
            // Só mostra logo se for grande o suficiente
            const showLogo = w > 60 && h > 60 && p.custom?.logo;

            return `
              <div style="text-align: center; pointer-events: none; line-height: 1;">
                ${showLogo ? `<img src="${p.custom.logo}" style="width: ${logoSize}px; height: ${logoSize}px; margin-bottom: 2px; border-radius: 50%;"> <br/>` : ''}
                <span style="font-size: ${fontSize}px; font-weight: 800; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${p.name}</span><br/>
                <span style="font-size: ${fontSize * 0.7}px; font-weight: 600; opacity: 0.9; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">${fmtPct(p.colorValue)}</span>
              </div>
            `;
          }
        }
      }]
    } as any);

  }, [chartData]); // Re-render when data changes

  const hasCategories = categories.length > 0;

  return (
    <div className="flex flex-col h-full bg-[#111216] relative">
      {/* Header Controls */}
      <div className="flex justify-between items-center p-2 border-b border-white/5 bg-[#111216] z-10">
         <div className="flex gap-2 items-center overflow-x-auto no-scrollbar">
            <div className="flex bg-white/5 rounded p-0.5">
                <button onClick={() => setValueMode('marketcap')} className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${valueMode === 'marketcap' ? 'bg-[#dd9933] text-black' : 'text-gray-400 hover:text-white'}`}>MKT CAP</button>
                <button onClick={() => setValueMode('var24h')} className={`px-3 py-1 text-[10px] font-bold rounded transition-colors ${valueMode === 'var24h' ? 'bg-[#dd9933] text-black' : 'text-gray-400 hover:text-white'}`}>VOLUME</button>
            </div>
            
            {hasCategories && (
                <select 
                    value={selectedCategoryId} 
                    onChange={e => setSelectedCategoryId(e.target.value)}
                    className="bg-white/5 border border-white/10 text-gray-300 text-[10px] font-bold rounded px-2 py-1 outline-none max-w-[150px]"
                >
                    <option value="">Todas as Categorias</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            )}
         </div>
         <button onClick={loadData} className="p-1.5 hover:bg-white/5 rounded text-gray-500 hover:text-[#dd9933] transition-colors"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {/* Chart Container */}
      <div className="flex-1 min-h-0 relative">
         <div ref={containerRef} className="w-full h-full absolute inset-0" />
         {loading && chartData.length === 0 && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                 <Loader2 className="animate-spin text-[#dd9933]" />
             </div>
         )}
      </div>
    </div>
  );
}
