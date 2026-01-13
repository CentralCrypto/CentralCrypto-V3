
import React, { useEffect, useRef, useState, useMemo } from 'react';
import Highcharts from 'highcharts';
import TreemapModule from 'highcharts/modules/treemap';
import HeatmapModule from 'highcharts/modules/heatmap';
import { createPortal } from 'react-dom';
import { Loader2, Maximize2, X, RefreshCw, AlertTriangle, BarChart2, PieChart, Minimize2 } from 'lucide-react';
import { fetchWithFallback } from '../services/api';
import { DashboardItem } from '../../../types';

// Inicializa módulos do Highcharts uma única vez
try {
  if (typeof Highcharts === 'object') {
    if (!(Highcharts as any).seriesTypes?.treemap) (TreemapModule as any)(Highcharts);
    if (!(Highcharts as any).seriesTypes?.heatmap) (HeatmapModule as any)(Highcharts);
  }
} catch (e) {
  console.error("Highcharts module error", e);
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
  
  const [isFullscreen, setIsFullscreen] = useState(item?.isMaximized || false);
  const [refreshKey, setRefreshKey] = useState(0);

  // 1. Carregar Dados do Lite JSON
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
          // Fallback para dados mockados se a API falhar, para não quebrar a UI
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

  // 2. Processar Dados (Top 50 para performance)
  const chartData = useMemo(() => {
    if (!rawData.length) return [];

    return rawData
      .map((coin: any) => {
        // Mapeamento seguro de campos (lite vs full)
        const symbol = String(coin.symbol || coin.s || '').toUpperCase();
        const name = String(coin.name || coin.n || symbol);
        const price = Number(coin.current_price || coin.p || 0);
        const change = Number(coin.price_change_percentage_24h || coin.p24 || 0);
        const mcap = Number(coin.market_cap || coin.mc || 0);
        const vol = Number(coin.total_volume || coin.v || 0);

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
                performance: (change < 0 ? '' : '+') + change.toFixed(2) + '%'
            }
        };
      })
      .filter((p): p is any => p !== null)
      .sort((a, b) => b.value - a.value) 
      .slice(0, 50); // LIMITAR A 50 ITENS PARA EVITAR LAG
  }, [rawData, metric]);

  // 3. Inicializar Gráfico
  useEffect(() => {
    // Se não tiver container ou dados, aborta
    if (!chartContainerRef.current) return;
    if (loading) return; 
    
    const isDark = document.documentElement.classList.contains('dark');
    const bgColor = isDark ? '#1a1c1e' : '#ffffff';
    const borderColor = isDark ? '#2f3032' : '#e2e8f0';

    const options: Highcharts.Options = {
        chart: {
            renderTo: chartContainerRef.current,
            backgroundColor: bgColor,
            style: { fontFamily: 'Inter, sans-serif' },
            margin: [0, 0, 0, 0],
            spacing: [0, 0, 0, 0],
            animation: false // Desativar animação inicial para performance
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
                style: { textOutline: 'none', fontWeight: 'bold', fontSize: '14px', color: '#ffffff' },
                formatter: function() {
                    const p = this.point as any;
                    if (!p.shapeArgs || p.shapeArgs.width < 40 || p.shapeArgs.height < 30) return '';
                    return `<div style="text-align:center; pointer-events:none;">` + 
                           `<span style="font-size: 14px; display:block;">${p.name}</span>` +
                           `<span style="font-size: 11px; font-weight:normal; opacity:0.9;">${p.custom.performance}</span>` +
                           `</div>`;
                },
                useHTML: true
            },
            data: chartData
        } as any],
        tooltip: {
            enabled: true,
            useHTML: true,
            followPointer: true,
            backgroundColor: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
            borderColor: '#dd9933',
            borderRadius: 8,
            shadow: true,
            style: { color: isDark ? '#fff' : '#000' },
            headerFormat: '<span style="font-size: 14px; font-weight: bold; color: #dd9933">{point.key}</span><br/>',
            pointFormat: 
                '<div style="margin-top: 4px; font-size: 12px;">' +
                '<span>Preço:</span> <b>${point.custom.price}</b><br/>' +
                '<span>{point.custom.metricLabel}:</span> <b>${point.value:,.0f}</b><br/>' +
                '<span>Var 24h:</span> <b style="color:{point.color}">{point.custom.performance}</b>' +
                '</div>'
        },
        colorAxis: {
            minColor: '#ef4444',
            maxColor: '#22c55e',
            stops: [
                [0, '#ef4444'],
                [0.5, '#475569'],
                [1, '#22c55e']
            ],
            min: -7,
            max: 7
        },
        plotOptions: {
            treemap: {
                animation: false,
                states: { hover: { brightness: 0.1 } }
            }
        }
    };

    // Cria ou atualiza o chart
    if (chartInstanceRef.current) {
        chartInstanceRef.current.update(options);
    } else {
        chartInstanceRef.current = Highcharts.chart(options);
    }

  }, [chartData, loading, metric]); // Remove isFullscreen dependency to avoid full re-init

  // 4. Resize Observer (O SEGREDO PARA CORRIGIR TELA BRANCA E RESPONSIVIDADE)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.reflow();
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const handleToggleFullscreen = () => {
      if (item?.isMaximized && onClose) {
          onClose(); 
      } else {
          setIsFullscreen(!isFullscreen);
      }
  };

  // Conteúdo Renderizado
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

        {/* Chart Container - Flex 1 para ocupar todo o espaço restante */}
        <div className="flex-1 w-full relative min-h-0 bg-[#1a1c1e]">
            {loading && chartData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                    <Loader2 className="animate-spin text-[#dd9933]" size={32} />
                </div>
            ) : error ? (
                <div className="absolute inset-0 flex items-center justify-center z-20 text-red-500 gap-2">
                    <AlertTriangle size={24} /> <span>{error}</span>
                </div>
            ) : null}
            
            {/* O container precisa ter width/height 100% absolutos para o Highcharts reflow funcionar */}
            <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />
        </div>
    </div>
  );

  if (isFullscreen) {
    return createPortal(
        <div className="fixed inset-0 z-[9999] w-screen h-screen bg-[#1a1c1e] flex flex-col">
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
