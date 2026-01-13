
import React, { useEffect, useRef, useState, useMemo } from 'react';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import HeatmapModule from 'highcharts/modules/heatmap';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, X, RefreshCw, AlertTriangle, Minimize2 } from 'lucide-react';
import { fetchHeatmapCategories, HeatmapCategory } from '../services/api';
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

// Plugin para tamanho de fonte relativo e cores de performance (Baseado no seu código de exemplo)
(function (H: any) {
    H.addEvent(H.Series, 'drawDataLabels', function (this: any) {
        if (this.type === 'treemap') {
            this.points.forEach((point: any) => {
                // Colorir os cabeçalhos de nível 2 (Categorias) com base na performance combinada
                if (point.node.level === 1 && Number.isFinite(point.value) && point.node.children.length > 0) {
                    // Lógica simplificada para calcular performance agregada da categoria
                    // Média ponderada seria ideal, mas soma simples de variação funciona para visualização rápida
                    let totalChange = 0;
                    let totalWeight = 0;
                    
                    point.node.children.forEach((child: any) => {
                        const val = child.point.value || 0;
                        const change = child.point.colorValue || 0;
                        totalChange += change * val;
                        totalWeight += val;
                    });

                    const avgPerf = totalWeight > 0 ? totalChange / totalWeight : 0;

                    point.custom = point.custom || {};
                    point.custom.performance = (avgPerf < 0 ? '' : '+') + avgPerf.toFixed(2) + '%';

                    if (point.dlOptions && this.colorAxis) {
                        // Aplica cor ao header da categoria
                        point.dlOptions.backgroundColor = this.colorAxis.toColor(avgPerf);
                    }
                }

                // Definir tamanho da fonte baseado na área do ponto (Nível 2 - Moedas)
                if (point.node.level === 2 && point.shapeArgs) {
                    const area = point.shapeArgs.width * point.shapeArgs.height;
                    // Fórmula ajustada para telas HD/4K
                    const fontSize = Math.min(48, Math.max(10, Math.round(Math.sqrt(area) / 4)));
                    
                    if (point.dataLabel && point.dataLabel.css) {
                        point.dataLabel.css({
                            fontSize: `${fontSize}px`
                        });
                    }
                }
            });
        }
    });
}(Highcharts));

interface Props {
  item?: DashboardItem;
  title?: string;
  onClose?: () => void;
  language?: string;
}

const HeatmapWidget: React.FC<Props> = ({ item, title = "Crypto Heatmap", onClose }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<Highcharts.Chart | null>(null);
  
  const [categories, setCategories] = useState<HeatmapCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Se o item vier maximizado (da página de indicadores), já inicia fullscreen
  const [isFullscreen, setIsFullscreen] = useState(item?.isMaximized || false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Carregar Dados
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchHeatmapCategories();
        if (data && data.length > 0) {
          setCategories(data);
        } else {
          setError('Sem dados de categorias.');
        }
      } catch (e) {
        console.error(e);
        setError('Erro ao carregar mapa.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  // Processar Dados para o formato do Highcharts Tree Map
  const chartData = useMemo(() => {
    if (!categories.length) return [];

    const data: any[] = [];
    
    // Nível 1: Categorias (Smart Contracts, DeFi, etc)
    categories.forEach(cat => {
        // Filtra categorias vazias
        if (cat.coins && cat.coins.length > 0) {
            data.push({
                id: cat.id,
                name: cat.name,
                color: '#232528' // Cor de fundo do header da categoria (será sobrescrita pelo evento drawDataLabels)
            });

            // Nível 2: Moedas
            cat.coins.forEach((coin: any) => {
                const change = coin.price_change_percentage_24h || 0;
                const mcap = coin.market_cap || 0;
                
                data.push({
                    id: `${cat.id}_${coin.id}`,
                    name: coin.symbol.toUpperCase(),
                    parent: cat.id,
                    value: mcap,       // Tamanho do quadrado
                    colorValue: change,// Cor do quadrado
                    custom: {
                        fullName: coin.name,
                        price: coin.current_price,
                        performance: (change < 0 ? '' : '+') + change.toFixed(2) + '%'
                    }
                });
            });
        }
    });

    return data;
  }, [categories]);

  // Inicializar/Atualizar Gráfico
  useEffect(() => {
    if (!chartContainerRef.current || loading || chartData.length === 0) return;

    const isDark = document.documentElement.classList.contains('dark');
    const bgColor = isDark ? '#1a1c1e' : '#ffffff';
    const borderColor = isDark ? '#2f3032' : '#e2e8f0';

    const options: Highcharts.Options = {
        chart: {
            backgroundColor: bgColor,
            style: { fontFamily: 'Inter, sans-serif' },
            margin: [0, 0, 0, 0],
            spacing: [0, 0, 0, 0],
            height: isFullscreen ? '100%' : '100%'
        },
        title: { text: undefined },
        credits: { enabled: false },
        exporting: { enabled: false },
        series: [{
            type: 'treemap',
            name: 'Crypto Market',
            layoutAlgorithm: 'squarified',
            allowDrillToNode: true,
            animationLimit: 1000,
            borderColor: borderColor,
            borderWidth: 1,
            data: chartData,
            dataLabels: {
                enabled: false,
                allowOverlap: true,
                style: { textOutline: 'none' }
            },
            levels: [
                {
                    level: 1,
                    dataLabels: {
                        enabled: true,
                        align: 'left',
                        verticalAlign: 'top',
                        style: {
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#ffffff',
                            textTransform: 'uppercase',
                            textOutline: 'none'
                        },
                        padding: 6,
                        zIndex: 5
                    },
                    borderWidth: 3,
                    borderColor: bgColor,
                    levelIsConstant: false
                },
                {
                    level: 2,
                    dataLabels: {
                        enabled: true,
                        align: 'center',
                        verticalAlign: 'middle',
                        // Formato: SIMBOLO <br> %
                        format: '<span style="font-weight:900; color: white; text-shadow: 0 1px 3px rgba(0,0,0,0.5)">{point.name}</span><br><span style="font-weight:normal; opacity:0.9; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.5)">{point.custom.performance}</span>',
                        style: {
                            textOutline: 'none'
                        },
                        // Filtro para não mostrar label em quadrados muito pequenos
                        filter: {
                            property: 'value',
                            operator: '>',
                            value: 0
                        }
                    }
                }
            ],
            // Botão de voltar ao navegar (Drill up)
            breadcrumbs: {
                buttonTheme: {
                    style: { color: '#9ca3af' },
                    states: {
                        hover: { fill: '#333', style: { color: '#fff' } },
                        select: { fill: '#333', style: { color: '#fff' } }
                    }
                }
            }
        } as any],
        tooltip: {
            useHTML: true,
            followPointer: true,
            backgroundColor: 'rgba(20, 20, 20, 0.95)',
            borderColor: '#dd9933',
            borderRadius: 8,
            shadow: true,
            padding: 12,
            style: { color: '#fff' },
            headerFormat: '<span style="font-size: 14px; font-weight: bold; color: #dd9933">{point.key}</span><br/>',
            pointFormat: 
                '<div style="margin-top: 4px">' +
                '<span style="color: #9ca3af">Preço:</span> <b>${point.custom.price}</b><br/>' +
                '<span style="color: #9ca3af">Market Cap:</span> <b>${point.value:,.0f}</b><br/>' +
                '<span style="color: #9ca3af">Variação 24h:</span> <b style="color:{point.color}">{point.custom.performance}</b>' +
                '</div>'
        },
        colorAxis: {
            minColor: '#ef4444', // Vermelho forte
            maxColor: '#22c55e', // Verde forte
            stops: [
                [0, '#ef4444'],
                [0.5, '#2f3032'], // Cinza escuro (Neutro)
                [1, '#22c55e']
            ],
            min: -8, // Saturação máxima em -8%
            max: 8,  // Saturação máxima em +8%
        },
        plotOptions: {
            treemap: {
                animation: true,
                states: { hover: { brightness: 0.1 } }
            }
        }
    };

    if (chartInstanceRef.current) {
        chartInstanceRef.current.update(options);
        // Pequeno delay para garantir reflow correto se container mudou de tamanho
        setTimeout(() => chartInstanceRef.current?.reflow(), 50);
    } else {
        chartInstanceRef.current = Highcharts.chart(chartContainerRef.current, options);
    }

  }, [chartData, isFullscreen, loading]);

  // Handle Resize Events
  useEffect(() => {
      const handleResize = () => {
          if (chartInstanceRef.current) {
              chartInstanceRef.current.reflow();
          }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Forçar reflow quando alterna modo tela cheia
  useEffect(() => {
      setTimeout(() => {
          if (chartInstanceRef.current) {
              chartInstanceRef.current.reflow();
          }
      }, 100);
  }, [isFullscreen]);

  const handleToggleFullscreen = () => {
      if (item?.isMaximized && onClose) {
          // Se estamos no modo "página dedicada", fechar significa voltar
          onClose();
      } else {
          // Se estamos num widget normal, alterna fullscreen local
          setIsFullscreen(!isFullscreen);
      }
  };

  // Conteúdo do Widget
  const WidgetContent = (
    <div className={`relative w-full h-full flex flex-col ${isFullscreen ? 'bg-[#1a1c1e]' : 'bg-transparent'} overflow-hidden`}>
        {/* Barra de Controle (Visível apenas em Fullscreen ou se tiver espaço) */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800 bg-[#1a1c1e] shrink-0 z-10">
            <div className="flex items-center gap-3">
                <span className="text-sm font-black text-white uppercase tracking-wider">{title}</span>
                {!loading && !error && (
                    <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono border border-gray-700">
                        {chartData.filter((d:any) => d.parent).length} Ativos
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 mr-4">
                    <span className="w-3 h-3 bg-red-500 rounded-sm"></span>
                    <span className="text-[10px] text-gray-400 mr-2">-8%</span>
                    <span className="w-3 h-3 bg-[#2f3032] rounded-sm"></span>
                    <span className="text-[10px] text-gray-400 mr-2">0%</span>
                    <span className="w-3 h-3 bg-green-500 rounded-sm"></span>
                    <span className="text-[10px] text-gray-400">+8%</span>
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
        <div className="flex-1 relative w-full h-full min-h-0 bg-[#1a1c1e]">
            {loading && chartData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#1a1c1e]">
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                        <Loader2 className="animate-spin text-[#dd9933]" size={40} />
                        <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Construindo Mapa...</span>
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
            
            <div ref={chartContainerRef} className="w-full h-full" />
        </div>
    </div>
  );

  // Se estiver em modo fullscreen, renderiza via Portal direto no body para garantir sobreposição total
  if (isFullscreen) {
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#1a1c1e] animate-in fade-in zoom-in-95 duration-200">
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
