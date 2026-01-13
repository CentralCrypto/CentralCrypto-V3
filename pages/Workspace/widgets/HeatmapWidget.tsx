
import React, { useEffect, useRef, useState, useMemo } from 'react';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import HeatmapModule from 'highcharts/modules/heatmap';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, X, RefreshCw, AlertTriangle, BarChart2, PieChart } from 'lucide-react';
import { fetchWithFallback } from '../services/api';
import { DashboardItem } from '../../../types';

// Inicializa módulos do Highcharts
try {
  if (typeof Highcharts === 'object') {
    (TreemapModule as any)(Highcharts);
    (HeatmapModule as any)(Highcharts);
  }
} catch (e) {
  console.error("Highcharts init error", e);
}

interface Props {
  item?: DashboardItem;
  title?: string;
  onClose?: () => void;
  language?: string;
}

const HeatmapWidget: React.FC<Props> = ({ item, title = "Crypto Heatmap", onClose }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<Highcharts.Chart | null>(null);
  
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState<'mcap' | 'vol'>('mcap');
  
  // Se o item vier maximizado (da página de indicadores), já inicia fullscreen
  const [isFullscreen, setIsFullscreen] = useState(item?.isMaximized || false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Carregar Dados
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // Usa endpoint lite solicitado
        const response = await fetchWithFallback('/cachecko/cachecko_lite.json');
        
        // Tenta extrair array de várias estruturas possíveis
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

  // Processar Dados para o formato do Highcharts (Lista Plana)
  const chartData = useMemo(() => {
    if (!rawData.length) return [];

    return rawData
      .map((coin: any) => {
        // Suporte a chaves padrão (CoinGecko) e abreviadas (Lite)
        const symbol = (coin.symbol || coin.s || '').toUpperCase();
        const name = coin.name || coin.n || symbol;
        const price = Number(coin.current_price || coin.p || 0);
        const change = Number(coin.price_change_percentage_24h || coin.p24 || 0);
        const mcap = Number(coin.market_cap || coin.mc || 0);
        const vol = Number(coin.total_volume || coin.v || 0);

        // Define o tamanho do bloco
        const sizeValue = metric === 'mcap' ? mcap : vol;

        if (!symbol || sizeValue <= 0) return null;

        return {
            id: symbol,
            name: symbol,
            value: sizeValue,       
            colorValue: change,
            custom: {
                fullName: name,
                price: price,
                metricLabel: metric === 'mcap' ? 'Market Cap' : 'Volume 24h',
                metricValue: sizeValue,
                performance: (change < 0 ? '' : '+') + change.toFixed(2) + '%'
            }
        };
      })
      .filter((p): p is any => p !== null)
      .sort((a, b) => b.value - a.value) // Ordena por tamanho para melhor layout
      .slice(0, 100); // Limita aos top 100 para performance
  }, [rawData, metric]);

  // Inicializar/Atualizar Gráfico
  useEffect(() => {
    if (!chartContainerRef.current || loading) return;
    if (chartData.length === 0 && !loading && !error) return;

    const isDark = document.documentElement.classList.contains('dark');
    const bgColor = isDark ? '#1a1c1e' : '#ffffff';
    const borderColor = isDark ? '#2f3032' : '#e2e8f0';
    const textColor = isDark ? '#ffffff' : '#000000';

    const options: Highcharts.Options = {
        chart: {
            backgroundColor: bgColor,
            style: { fontFamily: 'Inter, sans-serif' },
            margin: [0, 0, 0, 0],
            spacing: [0, 0, 0, 0],
            height: '100%', // Altura 100% relativa ao container pai
            animation: false
        },
        title: { text: undefined },
        credits: { enabled: false },
        exporting: { enabled: false },
        series: [{
            type: 'treemap',
            layoutAlgorithm: 'squarified',
            allowDrillToNode: false,
            alternateStartingDirection: true,
            levelIsConstant: false,
            borderColor: borderColor,
            borderWidth: 1,
            dataLabels: {
                enabled: true,
                style: {
                    textOutline: 'none',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    color: '#ffffff'
                },
                formatter: function() {
                    const point = this.point as any;
                    // Lógica para esconder labels em blocos muito pequenos
                    if (!point.shapeArgs) return '';
                    const { width, height } = point.shapeArgs;
                    if (width < 35 || height < 25) return ''; 
                    
                    const fontSize = Math.min(20, Math.max(10, Math.sqrt(width * height) / 6));
                    
                    return `<div style="text-align:center; pointer-events:none;">` + 
                           `<span style="font-size: ${fontSize}px; display:block;">${point.name}</span>` +
                           `<span style="font-size: ${fontSize * 0.75}px; font-weight:normal; opacity:0.9;">${point.custom.performance}</span>` +
                           `</div>`;
                },
                useHTML: true 
            },
            levels: [{
                level: 1,
                borderWidth: 1,
                borderColor: borderColor,
                dataLabels: {
                    enabled: true,
                    align: 'center',
                    verticalAlign: 'middle'
                }
            }],
            data: chartData
        } as any],
        tooltip: {
            useHTML: true,
            followPointer: true,
            backgroundColor: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: '#dd9933',
            borderRadius: 8,
            shadow: true,
            padding: 10,
            style: { color: textColor },
            headerFormat: '<span style="font-size: 14px; font-weight: bold; color: #dd9933">{point.key}</span><br/>',
            pointFormat: 
                '<div style="margin-top: 4px; font-size: 12px;">' +
                '<span>Preço:</span> <b>${point.custom.price}</b><br/>' +
                '<span>{point.custom.metricLabel}:</span> <b>${point.value:,.0f}</b><br/>' +
                '<span>Var 24h:</span> <b style="color:{point.color}">{point.custom.performance}</b>' +
                '</div>'
        },
        colorAxis: {
            minColor: '#ef4444', // Vermelho
            maxColor: '#22c55e', // Verde
            stops: [
                [0, '#ef4444'],
                [0.5, '#475569'], // Cinza (Neutro)
                [1, '#22c55e']
            ],
            min: -7, 
            max: 7,  
        },
        plotOptions: {
            treemap: {
                animation: false,
                states: { hover: { brightness: 0.1 } }
            }
        }
    };

    if (chartInstanceRef.current) {
        chartInstanceRef.current.update(options);
    } else {
        chartInstanceRef.current = Highcharts.chart(chartContainerRef.current, options);
    }

    // Força reflow após renderizar para garantir que preencha o container
    requestAnimationFrame(() => {
        chartInstanceRef.current?.reflow();
    });

  }, [chartData, isFullscreen, loading, metric]);

  // Handle Resize
  useEffect(() => {
      const handleResize = () => {
          if (chartInstanceRef.current) {
              chartInstanceRef.current.reflow();
          }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Força reflow quando alterna modo tela cheia com um pequeno delay
  useEffect(() => {
      const timer = setTimeout(() => {
          if (chartInstanceRef.current) {
              chartInstanceRef.current.reflow();
          }
      }, 100);
      return () => clearTimeout(timer);
  }, [isFullscreen]);

  const handleToggleFullscreen = () => {
      if (item?.isMaximized && onClose) {
          onClose(); // Se é página dedicada, volta
      } else {
          setIsFullscreen(!isFullscreen);
      }
  };

  // Conteúdo do Widget
  const WidgetContent = (
    // IMPORTANTE: h-full e w-full aqui para preencher o container pai (seja div ou portal)
    <div className={`relative w-full h-full flex flex-col bg-[#1a1c1e] overflow-hidden`}>
        {/* Barra de Controle */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800 bg-[#1a1c1e] shrink-0 z-10">
            <div className="flex items-center gap-4">
                <span className="text-sm font-black text-white uppercase tracking-wider">{title}</span>
                {!loading && !error && (
                    <div className="flex bg-black/30 p-0.5 rounded-lg border border-gray-700">
                        <button 
                            onClick={() => setMetric('mcap')} 
                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded flex items-center gap-1 transition-all ${metric === 'mcap' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <PieChart size={12} /> Market Cap
                        </button>
                        <button 
                            onClick={() => setMetric('vol')} 
                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded flex items-center gap-1 transition-all ${metric === 'vol' ? 'bg-[#dd9933] text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <BarChart2 size={12} /> Volume
                        </button>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 mr-4 hidden sm:flex bg-black/20 px-2 py-1 rounded border border-gray-800">
                    <span className="w-2 h-2 bg-red-500 rounded-sm"></span>
                    <span className="text-[10px] text-gray-400 mr-2 font-mono">-7%</span>
                    <span className="w-2 h-2 bg-slate-600 rounded-sm"></span>
                    <span className="text-[10px] text-gray-400 mr-2 font-mono">0%</span>
                    <span className="w-2 h-2 bg-green-500 rounded-sm"></span>
                    <span className="text-[10px] text-gray-400 font-mono">+7%</span>
                </div>

                <button 
                    onClick={() => setRefreshKey(k => k + 1)} 
                    className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                    title="Recarregar"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
                <button 
                    onClick={handleToggleFullscreen} 
                    className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                    title={isFullscreen ? "Fechar / Minimizar" : "Tela Cheia"}
                >
                    {isFullscreen ? <X size={18} /> : <Maximize2 size={16} />}
                </button>
            </div>
        </div>

        {/* Área do Gráfico */}
        <div className="flex-1 relative w-full h-full min-h-0 bg-[#1a1c1e] overflow-hidden">
            {loading && chartData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#1a1c1e]">
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                        <Loader2 className="animate-spin text-[#dd9933]" size={40} />
                        <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Carregando Mapa...</span>
                    </div>
                </div>
            ) : error ? (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#1a1c1e]">
                    <div className="flex flex-col items-center gap-3 text-red-500">
                        <AlertTriangle size={40} />
                        <span className="text-sm font-bold uppercase tracking-widest">{error}</span>
                        <button onClick={() => setRefreshKey(k => k + 1)} className="mt-2 px-4 py-2 bg-red-900/20 border border-red-900/50 rounded text-xs font-bold hover:bg-red-900/40 uppercase">Tentar Novamente</button>
                    </div>
                </div>
            ) : null}
            
            <div ref={chartContainerRef} className="w-full h-full absolute inset-0" />
        </div>
    </div>
  );

  // Render via Portal para garantir que fique SOBRE TUDO e ocupe a tela toda sem scrollbars
  if (isFullscreen) {
    return createPortal(
        <div className="fixed inset-0 z-[9999] w-screen h-screen bg-[#1a1c1e] flex flex-col overflow-hidden">
            {WidgetContent}
        </div>,
        document.body
    );
  }

  // Renderização normal dentro do grid/card
  return (
    <div className="w-full h-full overflow-hidden rounded-xl border border-gray-800 shadow-xl bg-[#1a1c1e]">
        {WidgetContent}
    </div>
  );
};

export default HeatmapWidget;
