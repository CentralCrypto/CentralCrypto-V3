
import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { LsrData, fetchLongShortRatio } from '../services/api'; 
import { DashboardItem, Language } from '../../../types';
import { getTranslations } from '../../../locales';

declare global {
  interface Window { Highcharts: any; }
}

const LSR_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'TRXUSDT', 'LINKUSDT',
    'MATICUSDT', 'LTCUSDT', 'BCHUSDT', 'NEARUSDT', 'UNIUSDT', 'INJUSDT', 'OPUSDT', 'ARBUSDT', 'SHIBUSDT', 'DOTUSDT',
    'TRXUSDT', 'ETCUSDT', 'FILUSDT', 'APTUSDT', 'HBARUSDT', 'XLMUSDT', 'STXUSDT', 'IMXUSDT', 'VETUSDT', 'GRTUSDT'
];

const LSR_INTERVALS = ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1D'];

const LsrHistoryChart: React.FC<{ data: any[], isDark: boolean }> = ({ data, isDark }) => {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartRef.current || !window.Highcharts || data.length === 0) return;

        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';
        const labelColor = isDark ? '#cbd5e1' : '#1e293b';

        window.Highcharts.chart(chartRef.current, {
            chart: {
                backgroundColor: 'transparent',
                zoomType: 'x',
                style: { fontFamily: 'Inter, sans-serif' },
                marginTop: 20,
                spacingBottom: 15,
                resetZoomButton: {
                    theme: {
                        fill: isDark ? '#dd9933' : '#334155',
                        stroke: isDark ? '#dd9933' : '#334155',
                        r: 4,
                        style: { color: isDark ? '#000' : '#fff', fontWeight: 'bold' }
                    }
                }
            },
            title: { text: null },
            credits: { enabled: false },
            exporting: { enabled: false },
            xAxis: {
                type: 'datetime',
                gridLineColor: gridColor,
                labels: { style: { color: labelColor, fontSize: '9px', fontWeight: '800' } },
                lineColor: gridColor
            },
            yAxis: [{
                title: { text: 'Ratio', style: { color: '#dd9933', fontWeight: 'bold', fontSize: '10px' } },
                labels: { style: { color: textColor, fontSize: '9px' } },
                gridLineColor: gridColor,
                opposite: true
            }, {
                title: { text: '%', style: { color: textColor, fontSize: '10px' } },
                labels: { style: { color: textColor, fontSize: '9px' } },
                max: 100, min: 0,
                gridLineWidth: 0
            }],
            tooltip: {
                shared: true,
                backgroundColor: isDark ? '#1a1c1e' : '#ffffff',
                borderColor: '#dd9933',
                style: { color: isDark ? '#fff' : '#000' }
            },
            plotOptions: { column: { stacking: 'normal', borderWidth: 0 } },
            series: [
                { name: 'Shorts %', type: 'column', yAxis: 1, data: data.map(p => [p.timestamp, p.shorts]), color: 'rgba(239, 68, 68, 0.4)', tooltip: { valueSuffix: '%' } },
                { name: 'Longs %', type: 'column', yAxis: 1, data: data.map(p => [p.timestamp, p.longs]), color: 'rgba(34, 197, 94, 0.4)', tooltip: { valueSuffix: '%' } },
                { name: 'Ratio', type: 'spline', data: data.map(p => [p.timestamp, p.lsr]), color: '#dd9933', lineWidth: 3, marker: { enabled: false } }
            ]
        });
    }, [data, isDark]);

    return <div ref={chartRef} className="w-full h-full" />;
};

const LsrWidget: React.FC<{ item: DashboardItem, language?: Language }> = ({ item, language = 'pt' }) => {
    const [lsrData, setLsrData] = useState<LsrData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lsrSymbol, setLsrSymbol] = useState(item.symbol === 'MARKET' ? 'BTCUSDT' : item.symbol);
    const [lsrPeriod, setLsrPeriod] = useState('5m');
    const [needleAngle, setNeedleAngle] = useState(-90);
    const [isDark, setIsDark] = useState(false);

    const t = getTranslations(language as Language).dashboard.widgets.lsr;

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains('dark'));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const loadData = async (isManual = false) => {
        if(isManual) setIsLoading(true);
        // Reset ponteiro para o mínimo (-90 graus) antes de mover para o novo valor
        setNeedleAngle(-90);
        
        try {
            const data = await fetchLongShortRatio(lsrSymbol, lsrPeriod, item.isMaximized ? 50 : 1);
            if (data && data.lsr !== null) {
                setLsrData(data);
                const norm = Math.min(Math.max(data.lsr, 0), 5);
                const targetAngle = (norm / 5) * 180 - 90;
                setTimeout(() => setNeedleAngle(targetAngle), 100);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData(true);
    }, [lsrSymbol, lsrPeriod]);

    const val = lsrData?.lsr || 1.0;
    const longs = lsrData?.longs || 50;
    const shorts = lsrData?.shorts || 50;
    const gradId = `lsr-grad-${item.id}`;

    if (item.isMaximized) {
        return (
            <div className="h-full flex flex-col bg-white dark:bg-[#2f3032] p-4 relative overflow-hidden transition-colors">
                <div className="z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-gray-100 dark:border-slate-700/50 pb-4">
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <div className="text-4xl font-black text-[#dd9933]">{val.toFixed(2)}</div>
                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Ratio</div>
                        </div>
                        <div className="h-10 w-px bg-gray-200 dark:bg-slate-700"></div>
                        <div className="flex gap-4">
                            <div className="text-center"><div className="text-xl font-black text-green-500">{longs}%</div><div className="text-[8px] font-bold text-gray-400 uppercase">Longs</div></div>
                            <div className="text-center"><div className="text-xl font-black text-red-500">{shorts}%</div><div className="text-[8px] font-bold text-gray-400 uppercase">Shorts</div></div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <select value={lsrSymbol} onChange={e => setLsrSymbol(e.target.value)} className="bg-gray-100 dark:bg-[#1a1c1e] text-[10px] font-black p-2 rounded border-none text-gray-900 dark:text-white outline-none">
                            {LSR_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={lsrPeriod} onChange={e => setLsrPeriod(e.target.value)} className="bg-gray-100 dark:bg-[#1a1c1e] text-[10px] font-black p-2 rounded border-none text-gray-900 dark:text-white outline-none">
                            {LSR_INTERVALS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex-1 min-h-0 z-10">
                    <LsrHistoryChart data={lsrData?.history || []} isDark={isDark} />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-4 relative bg-white dark:bg-[#2f3032] overflow-hidden transition-colors">
            <div className="absolute top-2 left-2 right-2 z-20 flex justify-between">
                <select value={lsrSymbol} onChange={e => setLsrSymbol(e.target.value)} className="bg-white/50 dark:bg-black/30 text-[9px] font-bold p-1 rounded text-gray-900 dark:text-white outline-none border-none backdrop-blur-sm">
                    {LSR_SYMBOLS.slice(0, 10).map(s => <option key={s} value={s}>{s.replace('USDT','')}</option>)}
                </select>
                <select value={lsrPeriod} onChange={e => setLsrPeriod(e.target.value)} className="bg-white/50 dark:bg-black/30 text-[9px] font-bold p-1 rounded text-gray-900 dark:text-white outline-none border-none backdrop-blur-sm">
                    {LSR_INTERVALS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center mt-4">
                <div className="relative w-[180px] h-[100px] z-10 overflow-visible">
                    <svg viewBox="0 0 200 110" className="overflow-visible">
                        <defs>
                            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#ef4444" />
                                <stop offset="50%" stopColor="#eab308" />
                                <stop offset="100%" stopColor="#22c55e" />
                            </linearGradient>
                        </defs>
                        <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" className="stroke-gray-100 dark:stroke-slate-800" strokeWidth="16" strokeLinecap="round" />
                        <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke={`url(#${gradId})`} strokeWidth="16" strokeDasharray={`${((needleAngle + 90)/180)*283} 283`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
                        <motion.g 
                            animate={{ rotate: needleAngle }}
                            transition={{ type: 'spring', stiffness: 40, damping: 10 }}
                            style={{ originX: '100px', originY: '100px' }}
                        >
                            <path d="M 100 100 L 100 25" className="stroke-gray-900 dark:stroke-white" strokeWidth="4" strokeLinecap="round" />
                            <circle cx="100" cy="100" r="5" className="fill-gray-900 dark:fill-white" />
                        </motion.g>
                    </svg>
                    {isLoading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-[#dd9933]" /></div>}
                </div>
                <div className="text-center z-10">
                    <div className="text-4xl font-black text-[#dd9933] leading-none">{val.toFixed(2)}</div>
                    <div className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase mt-1">
                        {val > 1.1 ? t.longs : val < 0.9 ? t.shorts : t.neutral}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-slate-700/50 text-center z-10">
                <div className="flex flex-col">
                    <span className="text-sm font-black text-green-500">{longs}%</span>
                    <span className="text-[8px] text-gray-400 uppercase font-bold">Longs</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-black text-red-500">{shorts}%</span>
                    <span className="text-[8px] text-gray-400 uppercase font-bold">Shorts</span>
                </div>
            </div>
        </div>
    );
};

export default LsrWidget;
