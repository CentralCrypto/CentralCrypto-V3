
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, X, RefreshCw, AlertTriangle, BarChart2, PieChart, Minimize2 } from 'lucide-react';
import { fetchWithFallback } from '../services/api';
import { DashboardItem } from '../../../types';

interface Props {
  item?: DashboardItem;
  title?: string;
  onClose?: () => void;
  language?: string;
}

// Cores Oficiais
const COLORS = {
  up: '#16a34a',   // Green 600
  down: '#dc2626', // Red 600
  neutral: '#475569',
  text: '#ffffff'
};

const formatUSD = (val: number) => {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
};

// Componente customizado para desenhar cada bloco do Treemap
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, change, value } = props;
  
  // Evitar renderizar blocos muito pequenos ou inválidos
  if (!width || !height || width < 0 || height < 0) return null;

  const isPositive = change >= 0;
  const color = change === 0 ? COLORS.neutral : (isPositive ? COLORS.up : COLORS.down);
  
  // Opacidade baseada na intensidade (opcional, aqui usando sólido para clareza)
  const fontSize = Math.min(width / 4, height / 4, 20); // Ajusta fonte ao tamanho
  const showText = width > 40 && height > 30;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color,
          stroke: '#fff',
          strokeWidth: 1, // Borda branca fina para separar
          opacity: 1,
        }}
      />
      {showText && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - fontSize * 0.2}
            textAnchor="middle"
            fill="#fff"
            fontWeight="900"
            fontSize={fontSize}
            style={{ pointerEvents: 'none', textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
          >
            {name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + fontSize * 0.9}
            textAnchor="middle"
            fill="rgba(255,255,255,0.9)"
            fontSize={fontSize * 0.65}
            fontWeight="bold"
            style={{ pointerEvents: 'none', textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
          >
            {isPositive ? '+' : ''}{change?.toFixed(2)}%
          </text>
        </>
      )}
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-[#1a1c1e] border border-gray-200 dark:border-slate-700 p-3 rounded-lg shadow-xl text-xs z-[100]">
        <div className="font-black text-base mb-1 text-gray-900 dark:text-white">{data.fullName} ({data.name})</div>
        <div className="flex flex-col gap-1">
            <div className="flex justify-between gap-4">
                <span className="text-gray-500">Preço:</span>
                <span className="font-mono font-bold dark:text-gray-300">${data.price?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-4">
                <span className="text-gray-500">Valor (Size):</span>
                <span className="font-mono font-bold text-[#dd9933]">{formatUSD(data.value)}</span>
            </div>
            <div className="flex justify-between gap-4">
                <span className="text-gray-500">Variação 24h:</span>
                <span className={`font-mono font-black ${data.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {data.change > 0 ? '+' : ''}{data.change?.toFixed(2)}%
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
  const [metric, setMetric] = useState<'mcap' | 'vol'>('mcap');
  const [isFullscreen, setIsFullscreen] = useState(item?.isMaximized || false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Carregar Dados
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetchWithFallback('/cachecko/cachecko_lite.json');
        
        let list: any[] = [];
        if (Array.isArray(response)) {
            list = response;
        } else if (response && Array.isArray(response.data)) {
            list = response.data;
        }

        if (list.length > 0) {
          setRawData(list);
        } else {
          setError('Sem dados.');
        }
      } catch (e) {
        console.error(e);
        setError('Erro API.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  // Preparar dados para o Recharts Treemap
  // Estrutura necessária: { children: [ { name, size, ...props } ] }
  const treeData = useMemo(() => {
    if (!rawData.length) return [];

    const leaves = rawData
      .map((coin: any) => {
        const symbol = String(coin.symbol || coin.s || '').toUpperCase();
        const name = String(coin.name || coin.n || symbol);
        const price = Number(coin.current_price || coin.p || 0);
        const change = Number(coin.price_change_percentage_24h || coin.p24 || 0);
        const mcap = Number(coin.market_cap || coin.mc || 0);
        const vol = Number(coin.total_volume || coin.v || 0);

        const sizeValue = metric === 'mcap' ? mcap : vol;

        if (!symbol || sizeValue <= 0) return null;

        return {
            name: symbol,
            fullName: name,
            size: sizeValue, // A propriedade 'size' é usada pelo Recharts para calcular a área
            change: change,
            price: price,
            // Valor original para tooltip
            value: sizeValue 
        };
      })
      .filter((p): p is any => p !== null)
      .sort((a, b) => b.size - a.size)
      .slice(0, 50); // Top 50 para performance e leitura

    return [{ name: 'Market', children: leaves }];
  }, [rawData, metric]);

  const handleToggleFullscreen = () => {
      if (item?.isMaximized && onClose) {
          onClose(); 
      } else {
          setIsFullscreen(!isFullscreen);
      }
  };

  const WidgetContent = (
    <div className={`relative w-full h-full flex flex-col bg-[#1a1c1e] overflow-hidden`}>
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800 bg-[#1a1c1e] shrink-0 z-10">
            <div className="flex items-center gap-4">
                <span className="text-sm font-black text-white uppercase tracking-wider">{title}</span>
                {!loading && !error && (
                    <div className="flex bg-black/30 p-0.5 rounded-lg border border-gray-700">
                        <button 
                            onClick={() => setMetric('mcap')} 
                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded flex items-center gap-1 transition-all ${metric === 'mcap' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <PieChart size={12} /> MCAD
                        </button>
                        <button 
                            onClick={() => setMetric('vol')} 
                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded flex items-center gap-1 transition-all ${metric === 'vol' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <BarChart2 size={12} /> VOL
                        </button>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 mr-4 bg-black/20 px-2 py-1 rounded border border-gray-800">
                    <span className="w-2 h-2 bg-red-600 rounded-sm"></span> <span className="text-[10px] text-gray-400">Queda</span>
                    <span className="w-2 h-2 bg-green-600 rounded-sm ml-2"></span> <span className="text-[10px] text-gray-400">Alta</span>
                </div>
                <button 
                    onClick={() => setRefreshKey(k => k + 1)} 
                    className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
                <button 
                    onClick={handleToggleFullscreen} 
                    className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                >
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
            </div>
        </div>

        {/* Chart Area */}
        <div className="flex-1 w-full min-h-0 bg-[#1a1c1e] relative">
            {loading && treeData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                    <Loader2 className="animate-spin text-[#dd9933]" size={32} />
                </div>
            ) : error ? (
                <div className="absolute inset-0 flex items-center justify-center z-20 text-red-500 gap-2">
                    <AlertTriangle size={24} /> <span>{error}</span>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={treeData}
                        dataKey="size"
                        stroke="#fff"
                        fill="#1a1c1e"
                        content={<CustomTreemapContent />}
                        animationDuration={500}
                    >
                        <Tooltip content={<CustomTooltip />} />
                    </Treemap>
                </ResponsiveContainer>
            )}
        </div>
    </div>
  );

  if (isFullscreen) {
    return createPortal(
        <div className="fixed inset-0 z-[9999] w-screen h-screen bg-[#1a1c1e] flex flex-col overflow-hidden">
            {WidgetContent}
        </div>,
        document.body
    );
  }

  return (
    <div className="w-full h-full overflow-hidden rounded-xl border border-gray-800 shadow-xl bg-[#1a1c1e]">
        {WidgetContent}
    </div>
  );
};

export default HeatmapWidget;
