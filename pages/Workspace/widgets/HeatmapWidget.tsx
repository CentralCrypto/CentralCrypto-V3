
import React, { useEffect, useState, useMemo } from 'react';
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

// Escala de cores expandida (Degradê rico)
const getColorForChange = (change: number) => {
    if (change >= 15) return '#052e16'; // Very Dark Green
    if (change >= 7) return '#14532d'; // Green 900
    if (change >= 5) return '#15803d'; // Green 700
    if (change >= 3) return '#16a34a'; // Green 600
    if (change >= 2) return '#22c55e'; // Green 500
    if (change > 0)  return '#4ade80'; // Green 400
    
    if (change <= -15) return '#450a0a'; // Very Dark Red
    if (change <= -7) return '#7f1d1d'; // Red 900
    if (change <= -5) return '#991b1b'; // Red 800
    if (change <= -3) return '#dc2626'; // Red 600
    if (change <= -2) return '#ef4444'; // Red 500
    if (change < 0)   return '#f87171'; // Red 400
    
    return '#334155'; // Slate 700 (Neutro)
};

const formatUSD = (val: number) => {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
};

// Componente visual de cada bloco do Treemap
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, change } = props;
  
  if (!width || !height || width < 5 || height < 5) return null;

  const color = getColorForChange(change);
  // Fonte responsiva baseada no tamanho do bloco
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
          stroke: '#1a1c1e', // Borda escura para separar blocos
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
            {name}
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
            {change > 0 ? '+' : ''}{change?.toFixed(2)}%
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
                <span className="font-mono font-bold text-white">${data.price < 1 ? data.price.toFixed(6) : data.price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-6">
                <span className="text-gray-400 font-medium">Market Cap</span>
                <span className="font-mono font-bold text-blue-400">{formatUSD(data.mcap)}</span>
            </div>
            <div className="flex justify-between gap-6">
                <span className="text-gray-400 font-medium">Volume 24h</span>
                <span className="font-mono font-bold text-yellow-500">{formatUSD(data.vol)}</span>
            </div>
            <div className="flex justify-between gap-6 pt-2 border-t border-gray-800 mt-1">
                <span className="text-gray-400 font-bold uppercase">Variação 24h</span>
                <span className={`font-mono font-black text-sm ${data.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
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
  
  // 'mcap' = Tamanho por Capitalização
  // 'change' = Tamanho por Volatilidade (Absoluta de variação)
  const [metric, setMetric] = useState<'mcap' | 'change'>('mcap');
  
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
          setError('Sem dados disponíveis.');
        }
      } catch (e) {
        console.error(e);
        setError('Erro ao carregar dados.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  // Processamento de Dados
  const treeData = useMemo(() => {
    if (!rawData.length) return [];

    const leaves = rawData
      .map((coin: any, index: number) => {
        // Fallback robusto de propriedades
        const symbol = String(coin.s || coin.symbol || '').toUpperCase();
        const name = String(coin.n || coin.name || symbol);
        const price = Number(coin.p || coin.current_price || 0);
        const change = Number(coin.p24 || coin.price_change_percentage_24h || 0);
        const mcap = Number(coin.mc || coin.market_cap || 0);
        const vol = Number(coin.v || coin.total_volume || 0);

        if (!symbol || (!mcap && !vol)) return null;

        // Definição do tamanho do bloco
        let sizeValue = 0;
        if (metric === 'mcap') {
            sizeValue = mcap;
        } else {
            // "Var. Price 24h" -> Tamanho baseado na intensidade da mudança (positiva ou negativa)
            // Usamos Math.abs(change) para que grandes quedas também sejam grandes blocos
            // Adicionamos um fator base para moedas estáveis não sumirem completamente
            sizeValue = Math.pow(Math.abs(change) + 1, 3) * (Math.log10(mcap || 1000)); 
        }

        return {
            name: symbol,
            fullName: name,
            size: sizeValue, 
            change: change,
            price: price,
            mcap: mcap,
            vol: vol,
            rank: index + 1
        };
      })
      .filter((p): p is any => p !== null && p.size > 0)
      .sort((a, b) => b.size - a.size) // Ordenar do maior para o menor
      .slice(0, 50); // Top 50 para melhor performance visual

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
                <span className="text-sm font-black text-white uppercase tracking-wider hidden sm:inline">{title}</span>
                {!loading && !error && (
                    <div className="flex bg-black/40 p-0.5 rounded-lg border border-gray-700">
                        <button 
                            onClick={() => setMetric('mcap')} 
                            className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded flex items-center gap-1.5 transition-all ${metric === 'mcap' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
                            title="Tamanho proporcional ao Market Cap"
                        >
                            <PieChart size={14} /> MarketCap
                        </button>
                        <button 
                            onClick={() => setMetric('change')} 
                            className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded flex items-center gap-1.5 transition-all ${metric === 'change' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
                            title="Tamanho proporcional à Variação de Preço (Volatilidade)"
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

        {/* Legenda de Escala Melhorada */}
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

        {/* Área do Gráfico */}
        {/* Forçando altura mínima e relativa para garantir renderização do Recharts */}
        <div className="flex-1 w-full relative min-h-[400px] bg-[#1a1c1e]">
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
                    <button onClick={() => setRefreshKey(k => k + 1)} className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 rounded text-red-200 text-xs font-bold uppercase">Tentar Novamente</button>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={treeData}
                        dataKey="size"
                        stroke="#1a1c1e"
                        fill="#1a1c1e"
                        content={<CustomTreemapContent />}
                        animationDuration={600}
                        aspectRatio={16/9} // Melhor proporção para telas wide
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
    <div className="w-full h-full overflow-hidden rounded-xl border border-gray-800 shadow-xl bg-[#1a1c1e] flex flex-col">
        {WidgetContent}
    </div>
  );
};

export default HeatmapWidget;
