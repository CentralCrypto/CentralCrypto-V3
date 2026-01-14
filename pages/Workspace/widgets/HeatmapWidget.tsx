import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, RefreshCw, AlertTriangle, BarChart2, PieChart, Minimize2 } from 'lucide-react';
import { fetchWithFallback } from '../services/api';
import { DashboardItem } from '../../../types';

interface Props {
  item?: DashboardItem;
  title?: string;
  onClose?: () => void;
  language?: string;
}

// Debug toggle
const DEBUG_HEATMAP = true;

// (Opcional) stables filter
const usdStables = new Set([
  'usdt','usdc','dai','busd','tusd','usdp','gusd','fdusd','usde','usdd','lusd','susd','usdn',
  'eurt','ageur','eurc','gbpt','jpyt','jpyc','cnht'
]);

const getColorForChange = (change: number) => {
  if (change >= 15) return '#052e16';
  if (change >= 7) return '#14532d';
  if (change >= 5) return '#15803d';
  if (change >= 3) return '#16a34a';
  if (change >= 2) return '#22c55e';
  if (change > 0)  return '#4ade80';

  if (change <= -15) return '#450a0a';
  if (change <= -7) return '#7f1d1d';
  if (change <= -5) return '#991b1b';
  if (change <= -3) return '#dc2626';
  if (change <= -2) return '#ef4444';
  if (change < 0)   return '#f87171';

  return '#334155';
};

const formatUSD = (val: number) => {
  if (!Number.isFinite(val)) return '$0';
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${Math.round(val).toLocaleString()}`;
};

const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, payload, depth } = props;

  // DEBUG inside render (limit spam)
  const logRef = (CustomTreemapContent as any)._logRef || { count: 0 };
  (CustomTreemapContent as any)._logRef = logRef;
  if (DEBUG_HEATMAP && logRef.count < 25) {
    logRef.count += 1;
    console.log('[Heatmap][Cell]', {
      depth,
      w: width,
      h: height,
      payloadName: payload?.name,
      payloadChange: payload?.change,
      payloadSize: payload?.size,
      payloadKeys: payload ? Object.keys(payload) : null,
    });
  }

  if (!width || !height || width < 5 || height < 5) return null;

  // IGNORA ROOT (senão vira um mega quadrado)
  if (depth === 0) return null;

  const symbol = String(payload?.name ?? '').toUpperCase();
  const change = Number(payload?.change ?? 0);
  const color = getColorForChange(change);

  const fontSizeSymbol = Math.min(width / 3, height / 3, 24);
  const fontSizePct = Math.min(width / 5, height / 5, 14);
  const showText = width > 40 && height > 35;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color,
          stroke: '#1a1c1e',
          strokeWidth: 2,
          rx: 4,
          ry: 4,
        }}
      />
      {showText && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - fontSizeSymbol * 0.2}
            textAnchor="middle"
            fill="#fff"
            fontWeight="900"
            fontSize={fontSizeSymbol}
            style={{ pointerEvents: 'none', textShadow: '0px 2px 4px rgba(0,0,0,0.6)' }}
          >
            {symbol}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + fontSizeSymbol * 0.8}
            textAnchor="middle"
            fill="rgba(255,255,255,0.95)"
            fontSize={fontSizePct}
            fontWeight="700"
            style={{ pointerEvents: 'none', textShadow: '0px 1px 2px rgba(0,0,0,0.8)' }}
          >
            {change > 0 ? '+' : ''}{Number.isFinite(change) ? change.toFixed(2) : '0.00'}%
          </text>
        </>
      )}
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="bg-[#1a1c1e] border border-gray-700 p-4 rounded-xl shadow-2xl text-xs z-[9999] min-w-[200px]">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col">
            <span className="font-black text-lg text-white">{data.name}</span>
            <span className="text-gray-400 text-[10px] uppercase font-bold">{data.fullName}</span>
          </div>
          <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-[10px] font-bold">Rank #{data.rank}</span>
        </div>

        <div className="space-y-2 border-t border-gray-800 pt-2">
          <div className="flex justify-between gap-6">
            <span className="text-gray-400 font-medium">Preço Atual</span>
            <span className="font-mono font-bold text-white">
              ${Number(data.price) < 1 ? Number(data.price).toFixed(6) : Number(data.price).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-gray-400 font-medium">Market Cap</span>
            <span className="font-mono font-bold text-blue-400">{formatUSD(Number(data.mcap))}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-gray-400 font-medium">Volume 24h</span>
            <span className="font-mono font-bold text-yellow-500">{formatUSD(Number(data.vol))}</span>
          </div>
          <div className="flex justify-between gap-6 pt-2 border-t border-gray-800 mt-1">
            <span className="text-gray-400 font-bold uppercase">Variação 24h</span>
            <span className={`font-mono font-black text-sm ${Number(data.change) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {Number(data.change) > 0 ? '+' : ''}{Number(data.change).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const HeatmapWidget: React.FC<Props> = ({ item, title = "Crypto Heatmap", onClose }) => {
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [metric, setMetric] = useState<'mcap' | 'change'>('mcap');
  const [isFullscreen, setIsFullscreen] = useState(item?.isMaximized || false);
  const [refreshKey, setRefreshKey] = useState(0);

  const debugStatsRef = useRef({
    responseType: '',
    listLen: 0,
    leafLen: 0,
    treeChildrenLen: 0
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response: any = await fetchWithFallback('/cachecko/cachecko_lite.json');

        const responseType = Array.isArray(response) ? 'array' : typeof response;

        let list: any[] = [];
        if (Array.isArray(response)) list = response;
        else if (response && Array.isArray(response.data)) list = response.data;
        else if (response && Array.isArray(response.coins)) list = response.coins;
        else if (response && Array.isArray(response.items)) list = response.items;

        debugStatsRef.current.responseType = responseType;
        debugStatsRef.current.listLen = list.length;

        if (DEBUG_HEATMAP) {
          console.log('[Heatmap] fetch ok', {
            url: '/cachecko/cachecko_lite.json',
            responseType,
            keys: response && typeof response === 'object' ? Object.keys(response) : null,
            listLen: list.length,
            firstItem: list?.[0],
          });
        }

        if (list.length > 0) setRawData(list);
        else setError('Sem dados disponíveis.');
      } catch (e) {
        console.error('[Heatmap] fetch ERROR', e);
        setError('Erro ao carregar dados.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [refreshKey]);

  const treeData = useMemo(() => {
    if (!rawData.length) return [];

    const leaves = rawData
      .map((coin: any, index: number) => {
        const symbolRaw = String(coin.s || coin.symbol || '').toLowerCase();
        const symbol = symbolRaw.toUpperCase();
        const name = String(coin.n || coin.name || symbol);

        if (!symbolRaw) return null;
        if (usdStables.has(symbolRaw)) return null;

        const price = Number(coin.p ?? coin.current_price ?? 0);
        const change = Number(coin.p24 ?? coin.price_change_percentage_24h ?? 0);
        const mcap = Number(coin.mc ?? coin.market_cap ?? 0);
        const vol = Number(coin.v ?? coin.total_volume ?? 0);

        if (!symbol || (!mcap && !vol)) return null;

        let sizeValue = 0;
        if (metric === 'mcap') sizeValue = mcap;
        else {
          const mcapSafe = Math.max(mcap, 1_000);
          sizeValue = Math.pow(Math.abs(change) + 1, 3) * Math.log10(mcapSafe);
        }

        if (!Number.isFinite(sizeValue) || sizeValue <= 0) return null;

        return {
          name: symbol,
          fullName: name,
          size: sizeValue,
          change,
          price,
          mcap,
          vol,
          rank: index + 1
        };
      })
      .filter((p): p is any => p !== null)
      .sort((a, b) => b.size - a.size)
      .slice(0, 50);

    const td = [{ name: 'Market', children: leaves }];

    debugStatsRef.current.leafLen = leaves.length;
    debugStatsRef.current.treeChildrenLen = td?.[0]?.children?.length ?? 0;

    if (DEBUG_HEATMAP) {
      console.log('[Heatmap] build treeData', {
        metric,
        rawLen: rawData.length,
        leavesLen: leaves.length,
        sampleLeaves: leaves.slice(0, 5),
        treeData: td
      });
    }

    return td;
  }, [rawData, metric]);

  const handleToggleFullscreen = () => {
    if (item?.isMaximized && onClose) onClose();
    else setIsFullscreen(!isFullscreen);
  };

  const WidgetContent = (
    <div className="relative w-full h-full flex flex-col bg-[#1a1c1e] overflow-hidden">
      {/* debug overlay */}
      {DEBUG_HEATMAP && (
        <div className="absolute bottom-3 left-3 z-50 bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-mono text-gray-200 max-w-[420px]">
          <div className="font-black text-[#dd9933] mb-1">HEATMAP DEBUG</div>
          <div>responseType: {debugStatsRef.current.responseType}</div>
          <div>rawData: {rawData.length}</div>
          <div>listLen: {debugStatsRef.current.listLen}</div>
          <div>leaves: {debugStatsRef.current.leafLen}</div>
          <div>children: {debugStatsRef.current.treeChildrenLen}</div>
          <div>metric: {metric}</div>
          <div>loading: {String(loading)} | error: {error || 'none'}</div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800 bg-[#1a1c1e] shrink-0 z-10">
        <div className="flex items-center gap-4">
          <span className="text-sm font-black text-white uppercase tracking-wider hidden sm:inline">{title}</span>
          {!loading && !error && (
            <div className="flex bg-black/40 p-0.5 rounded-lg border border-gray-700">
              <button
                onClick={() => setMetric('mcap')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded flex items-center gap-1.5 transition-all ${metric === 'mcap' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
              >
                <PieChart size={14} /> MarketCap
              </button>
              <button
                onClick={() => setMetric('change')}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded flex items-center gap-1.5 transition-all ${metric === 'change' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
              >
                <BarChart2 size={14} /> Var. Price 24h
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
            title="Atualizar Dados"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleToggleFullscreen}
            className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
            title={isFullscreen ? "Minimizar" : "Tela Cheia"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Scale */}
      <div className="bg-[#121416] border-b border-gray-800 px-4 py-2 flex items-center justify-between shrink-0 overflow-x-auto no-scrollbar">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-4 whitespace-nowrap">Escala (Var. Price 24h)</span>
        <div className="flex items-center gap-1 flex-1 min-w-[200px] h-3">
          <div className="flex-1 h-full rounded-sm bg-[#7f1d1d]" title="-7% ou pior"></div>
          <div className="flex-1 h-full rounded-sm bg-[#dc2626]" title="-5%"></div>
          <div className="flex-1 h-full rounded-sm bg-[#ef4444]" title="-3%"></div>
          <div className="flex-1 h-full rounded-sm bg-[#f87171]" title="-2%"></div>
          <div className="flex-1 h-full rounded-sm bg-[#334155]" title="0%"></div>
          <div className="flex-1 h-full rounded-sm bg-[#4ade80]" title="+2%"></div>
          <div className="flex-1 h-full rounded-sm bg-[#22c55e]" title="+3%"></div>
          <div className="flex-1 h-full rounded-sm bg-[#16a34a]" title="+5%"></div>
          <div className="flex-1 h-full rounded-sm bg-[#14532d]" title="+7% ou melhor"></div>
        </div>
        <div className="flex text-[9px] font-mono font-bold text-gray-500 gap-10 ml-4">
          <span>-7%</span>
          <span>0%</span>
          <span>+7%</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 w-full relative bg-[#1a1c1e] min-h-[520px]">
        {loading && treeData.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-[#dd9933]" size={40} />
              <span className="text-xs font-bold uppercase text-gray-500 tracking-widest animate-pulse">Carregando Mapa...</span>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 text-red-500 gap-3 p-4 text-center">
            <AlertTriangle size={32} />
            <span className="font-bold">{error}</span>
            <button onClick={() => setRefreshKey(k => k + 1)} className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 rounded text-red-200 text-xs font-bold uppercase">
              Tentar Novamente
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treeData}
              dataKey="size"
              stroke="#1a1c1e"
              fill="#1a1c1e"
              content={<CustomTreemapContent />}
              isAnimationActive
              animationDuration={500}
            >
              <Tooltip content={<CustomTooltip />} cursor={false} allowEscapeViewBox={{ x: true, y: true }} />
            </Treemap>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );

  if (isFullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] w-screen h-screen bg-[#1a1c1e] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {WidgetContent}
      </div>,
      document.body
    );
  }

  return (
    <div className="w-full h-[680px] overflow-hidden rounded-xl border border-gray-800 shadow-xl bg-[#1a1c1e] flex flex-col">
      {WidgetContent}
    </div>
  );
};

export default HeatmapWidget;
