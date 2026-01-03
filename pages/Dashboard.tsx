import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowUpRight, Zap, Eye, EyeOff, ArrowDownRight, Activity, Loader2, ChevronDown, ExternalLink, ArrowUp, ArrowDown, LayoutDashboard, Calendar, Server, RefreshCw, Search, Clock } from '../components/Icons';
import NewsGrid from '../components/NewsGrid';
import NewsFeed from '../components/NewsFeed';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, CartesianGrid, Tooltip, AreaChart, Area, Brush, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { WPPost, Language, ViewMode, RsiAvgData } from '../types';
import MagazineTicker from '../components/MagazineTicker';
import { getTranslations } from '../locales';
import { 
    fetchWithFallback,
    fetchTopCoins, 
    fetchAltcoinSeason, 
    fetchAltcoinSeasonHistory, 
    fetchTrumpData, 
    fetchGainersLosers,
    fetchRsiAverage,
    TrumpData,
    fetchLongShortRatio,
    fetchMarketCapHistory,
    fetchEconomicCalendar,
    fetchFearAndGreed
} from './Workspace/services/api';
// Fix: Import missing widget components
import AltSeasonWidget from './Workspace/widgets/AltcoinSeasonWidget';
import EtfFlowWidget from './Workspace/widgets/EtfFlowWidget';
import TrumpOMeterWidget from './Workspace/widgets/TrumpMeterWidget';
import GainersLosersWidget from './Workspace/widgets/GainersLosersWidget';
import MarketCapWidget from './Workspace/widgets/MarketCapWidget';
import EconomicCalendarWidget from './Workspace/widgets/CalendarWidget';

interface DashboardProps {
  onPostClick: (postId: number) => void;
  language: Language;
  setView: (view: ViewMode) => void;
  theme: 'dark' | 'light';
}

const WorkspaceLink = ({ onClick }: { onClick: () => void }) => (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="text-gray-500 hover:text-tech-accent transition-colors p-0.5 ml-2" title="Open in Workspace">
        <LayoutDashboard size={14} />
    </button>
);

const CustomTooltip = ({ active, payload, label, prefix = "", suffix = "", language = 'pt' }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(payload[0].payload.date || payload[0].payload.timestamp || label);
    const dayName = date.toLocaleDateString(language, { weekday: 'long' });
    const fullDate = date.toLocaleDateString(language, { day: '2-digit', month: 'short', year: 'numeric' });
    
    return (
      <div className="bg-white dark:bg-[#1e2022] border border-gray-200 dark:border-tech-700 p-4 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] font-sans min-w-[180px]">
        <p className="text-[10px] text-[#dd9933] font-black uppercase tracking-[0.2em] mb-1">{dayName}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold mb-3 border-b border-gray-100 dark:border-white/5 pb-2 uppercase tracking-widest">{fullDate}</p>
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-tech-success"></div>
            <p className="text-base font-black text-gray-900 dark:text-white font-mono">{prefix}{payload[0].value.toLocaleString()}{suffix}</p>
        </div>
      </div>
    );
  }
  return null;
};

const HorizontalHistoryRow = ({ data, labels }: { data: (string | number)[], labels: string[] }) => (
  <div className="flex justify-between pt-1 px-1 text-center border-t border-tech-700/50 mt-1 w-full">
      {labels.map((label, i) => (
          <div key={label}>
              <div className="text-[9px] text-gray-500 font-bold uppercase">{label}</div>
              <div className="text-sm font-bold text-gray-400 dark:text-gray-300 font-mono">{data[i] !== undefined ? data[i] : '-'}</div>
          </div>
      ))}
  </div>
);

const MarketCapHistoryWidget = ({ language, onNavigate, theme }: { language: Language; onNavigate: () => void; theme: 'dark' | 'light' }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const t = getTranslations(language as Language).dashboard.widgets.mktcapHistory;

  useEffect(() => { 
    setLoading(true);
    fetchMarketCapHistory().then(res => {
        setData(res);
        setLoading(false);
    }).catch(() => setLoading(false)); 
  }, []);
  
  const formatVal = (v?: number) => {
    if (v === undefined || v === null) return '-';
    return v >= 1e12 ? `$${(v/1e12).toFixed(2)}T` : `$${(v/1e9).toFixed(1)}B`;
  };

  const strokeColor = theme === 'dark' ? '#548f3f' : '#1a1c1e';
  const fillColor = theme === 'dark' ? '#548f3f' : '#1a1c1e';

  const rawRoot = useMemo(() => Array.isArray(data) ? data[0] : data, [data]);

  const chartPoints = useMemo(() => {
    const yearData = rawRoot?.['1Y'];
    if (!yearData || !yearData.timestamps || !yearData.values) return [];
    
    return yearData.timestamps.map((ts: number, i: number) => ({
        date: ts,
        value: yearData.values[i]
    }));
  }, [rawRoot]);

  const latestValue = rawRoot?.['1Y']?.values?.slice(-1)[0];

  return (
    <div className="glass-panel p-3 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 relative overflow-hidden transition-all duration-700">
      <div className="shrink-0 flex justify-between items-start mb-1">
        <div className="flex flex-col">
            <span className="font-black text-[11px] leading-tight text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.title}</span>
            <span className="text-[10px] font-bold text-gray-600 dark:text-gray-200">Global 1Y</span>
        </div>
        <div className="text-right flex items-start gap-2">
            <span className="text-base font-bold text-tech-accent font-mono">{formatVal(latestValue)}</span>
            <WorkspaceLink onClick={onNavigate} />
        </div>
      </div>
      <div className="relative flex-1 bg-white/50 dark:bg-black/40 rounded-lg mb-1 overflow-hidden min-h-[90px] w-full">
        {loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-[#dd9933]" size={16} /></div>
        ) : chartPoints.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartPoints}>
                    <defs>
                      <linearGradient id="colorMkt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={fillColor} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={fillColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke={strokeColor} fill="url(#colorMkt)" strokeWidth={1} dot={false} isAnimationActive={true} />
                </AreaChart>
            </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-[10px] text-gray-500 italic uppercase">Sem Dados Históricos</div>
        )}
      </div>
      <HorizontalHistoryRow 
        labels={[t.yesterday, t.week, t.month]} 
        data={[
            formatVal(rawRoot?.['24H']?.values?.slice(-2)[0]), 
            formatVal(rawRoot?.['7D']?.values?.slice(-2)[0]), 
            formatVal(rawRoot?.['1M']?.values?.slice(-2)[0])
        ]} 
      />
    </div>
  );
};

const GAUGE_CX = 100;
const GAUGE_CY = 75; 
const GAUGE_R = 65;  
const GAUGE_RY = 65; 
const TEXT_VAL_Y = 104; 
const TEXT_LBL_Y = 122; 
const GAUGE_STROKE = 10; 

const FearAndGreedWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const t = getTranslations(language as Language).dashboard.widgets.fng;
  const timeT = getTranslations(language as Language).dashboard.widgets.time;

  useEffect(() => {
    fetchFearAndGreed().then(res => {
      if (res && Array.isArray(res)) setData(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const current = data[0];
  const val = current ? (parseInt(current.value) || 50) : 50;
  
  const getSarcasticLabel = (v: number) => {
    if (v <= 25) return t.s0; 
    if (v <= 45) return t.s1; 
    if (v <= 55) return t.s2; 
    if (v <= 75) return t.s3; 
    if (v <= 94) return t.s4; 
    return t.s5; 
  };

  const classification = getSarcasticLabel(val);
  const rotation = -90 + (val / 100) * 180;

  return (
    <div className="glass-panel p-2 rounded-xl flex flex-col h-full relative overflow-hidden bg-tech-800 border-tech-700 hover:border-[#dd9933]/50 transition-all">
      <div className="flex justify-between items-start absolute top-2 left-2 right-2 z-10">
          <span className="text-[11px] leading-tight text-gray-500 dark:text-gray-400 font-black uppercase tracking-wider truncate">{t.title}</span>
          <WorkspaceLink onClick={onNavigate} />
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-500 animate-pulse">Loading...</div>
      ) : (
        <>
           <div className="flex-1 min-h-0 relative w-full flex justify-center items-center py-2">
             <svg viewBox="0 0 200 135" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMax meet">
               <defs>
                 <linearGradient id="fngGradient" x1="0" y1="0" x2="1" y2="0">
                   <stop offset="0%" stopColor="#CD534B" />
                   <stop offset="50%" stopColor="#FFD700" />
                   <stop offset="100%" stopColor="#548f3f" />
                 </linearGradient>
               </defs>
               <path d={`M ${GAUGE_CX-GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX+GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="currentColor" className="text-gray-200 dark:text-tech-700" strokeWidth={GAUGE_STROKE} strokeLinecap="round" />
               <path d={`M ${GAUGE_CX-GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX+GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="url(#fngGradient)" strokeWidth={GAUGE_STROKE} strokeLinecap="round" />
               <g transform={`rotate(${rotation} ${GAUGE_CX} ${GAUGE_CY})`}>
                 <path d={`M ${GAUGE_CX} ${GAUGE_CY} L ${GAUGE_CX} ${GAUGE_CY - GAUGE_RY + 2}`} stroke="var(--color-text-main)" strokeWidth="4" strokeLinecap="round" />
                 <circle cx={GAUGE_CX} cy={GAUGE_CY} r="5" fill="var(--color-text-main)" />
               </g>
               <text x={GAUGE_CX} y={TEXT_VAL_Y} textAnchor="middle" fill="var(--color-gauge-val)" fontSize="24" fontWeight="900" fontFamily="monospace">{val}</text>
               <text x={GAUGE_CX} y={TEXT_LBL_Y} textAnchor="middle" fill="var(--color-text-main)" fontSize="12" fontWeight="900" letterSpacing="1" style={{ textTransform: 'uppercase' }}>{classification}</text>
             </svg>
           </div>
           <HorizontalHistoryRow 
             labels={[timeT.yesterday, timeT.d7, timeT.d30]} 
             data={[data[1]?.value || '-', data[7]?.value || '-', data[29]?.value || '-']} 
           />
        </>
      )}
    </div>
  );
};

const RsiWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
  const [data, setData] = useState<RsiAvgData | null>(null);
  const [loading, setLoading] = useState(true);

  const timeT = getTranslations(language).dashboard.widgets.time;
  const t = getTranslations(language).dashboard.widgets.rsi;

  const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
  const toRotation = (v: number) => -90 + (clamp(v) / 100) * 180;

  const [needleBase, setNeedleBase] = useState(50);
  const needleBaseRef = useRef(50);
  const [jitter, setJitter] = useState(0);
  const targetRef = useRef(50);

  useEffect(() => {
    needleBaseRef.current = needleBase;
  }, [needleBase]);

  const refresh = async () => {
    try {
      const res = await fetchRsiAverage();
      if (res) setData(res);
    } catch {
      // Data remains null or previous state on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const rsiVal = clamp(data?.averageRsi ?? 50);
  const label = rsiVal < 30 ? t.oversold : rsiVal > 70 ? t.overbought : t.neutral;
  const rotation = toRotation(clamp(needleBase + jitter));

  useEffect(() => {
    const from = needleBaseRef.current;
    const to = rsiVal;
    targetRef.current = to;

    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(p);
      setNeedleBase(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rsiVal]);

  useEffect(() => {
    if (loading) return;
    const id = window.setInterval(() => {
      const base = targetRef.current;
      const amp = Math.max(0.2, base * 0.01);
      const offset = (Math.random() * 2 - 1) * amp;
      setJitter(offset);
    }, 650);
    return () => window.clearInterval(id);
  }, [loading]);

  return (
    <div className="glass-panel p-2 rounded-xl flex flex-col h-full relative overflow-hidden bg-tech-800 border-tech-700 hover:border-[#dd9933]/50 transition-all">
      <div className="flex justify-between items-start absolute top-2 left-2 right-2 z-10">
        <span className="text-[11px] leading-tight text-gray-500 dark:text-gray-400 font-black uppercase tracking-wider truncate">
          {t.title}
        </span>
        <WorkspaceLink onClick={onNavigate} />
      </div>

      {loading && !data ? (
        <div className="flex-1 flex items-center justify-center text-xs text-gray-500 animate-pulse">Loading...</div>
      ) : (
        <>
          <div className="flex-1 min-h-0 relative w-full flex justify-center items-center py-2">
            <svg viewBox="0 0 200 135" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMax meet">
              <defs>
                <linearGradient id="rsiGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#548f3f" />
                  <stop offset="50%" stopColor="#FFD700" />
                  <stop offset="100%" stopColor="#CD534B" />
                </linearGradient>
              </defs>
              <path d={`M ${GAUGE_CX - GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX + GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="currentColor" className="text-gray-200 dark:text-tech-700" strokeWidth={GAUGE_STROKE} strokeLinecap="round" />
              <path d={`M ${GAUGE_CX - GAUGE_R} ${GAUGE_CY} A ${GAUGE_R} ${GAUGE_RY} 0 0 1 ${GAUGE_CX + GAUGE_R} ${GAUGE_CY}`} fill="none" stroke="url(#rsiGradient)" strokeWidth={GAUGE_STROKE} strokeLinecap="round" />
              <g transform={`rotate(${rotation} ${GAUGE_CX} ${GAUGE_CY})`}>
                <path d={`M ${GAUGE_CX} ${GAUGE_CY} L ${GAUGE_CX} ${GAUGE_CY - GAUGE_RY + 2}`} stroke="var(--color-text-main)" strokeWidth="4" strokeLinecap="round" />
                <circle cx={GAUGE_CX} cy={GAUGE_CY} r="5" fill="var(--color-text-main)" />
              </g>
              <text x={GAUGE_CX} y={TEXT_VAL_Y} textAnchor="middle" fill="var(--color-gauge-val)" fontSize="24" fontWeight="900" fontFamily="monospace">
                {rsiVal.toFixed(0)}
              </text>
              <text x={GAUGE_CX} y={TEXT_LBL_Y} textAnchor="middle" fill="var(--color-text-main)" fontSize="12" fontWeight="900" letterSpacing="1" style={{ textTransform: 'uppercase' }}>
                {label}
              </text>
            </svg>
          </div>
          <HorizontalHistoryRow
            labels={[timeT.yesterday, timeT.d7, timeT.d30]}
            data={[
              (data?.yesterday ?? 0).toFixed(0),
              (data?.days7Ago ?? 0).toFixed(0),
              (data?.days30Ago ?? 0).toFixed(0),
            ]}
          />
        </>
      )}
    </div>
  );
};


const LongShortRatioWidget = ({ language, onNavigate }: { language: Language; onNavigate: () => void }) => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [period, setPeriod] = useState('5m');
  const [data, setData] = useState<any>(null);
  const t = getTranslations(language as Language).dashboard.widgets.lsr;

  useEffect(() => {
    fetchLongShortRatio(symbol, period).then(setData).catch(() => setData(null));
  }, [symbol, period]);

  const val = data?.lsr ?? 1;
  const clampedVal = Math.min(Math.max(val, 1), 5);
  const rotation = -90 + ((clampedVal - 1) / 4) * 180;

  // ✅ AUMENTO DO ARCO (antes 55)
  const MINI_GAUGE_R = 70;
  const MINI_GAUGE_RY = 70;

  // ✅ Escala respeitando stroke + "round caps" nas pontas
  const LABEL_PAD = 8;
  const CAP_PAD = (GAUGE_STROKE / 2) + 4;
  const LABEL_R = MINI_GAUGE_R + (GAUGE_STROKE / 2) + LABEL_PAD;

  return (
    <div className="glass-panel p-2 rounded-xl flex flex-col h-full bg-tech-800 border-tech-700 hover:border-[#dd9933]/50 transition-all relative overflow-hidden">
      <div className="w-full flex justify-between items-center mb-1">
        <span className="text-[11px] leading-tight text-gray-500 dark:text-gray-400 uppercase tracking-wider font-black ml-1">
          {t.title}
        </span>
        <WorkspaceLink onClick={onNavigate} />
      </div>

      <div className="flex justify-center gap-1 mb-1">
        <select
          value={symbol}
          onChange={e => setSymbol(e.target.value)}
          className="bg-gray-100 dark:bg-tech-900 text-gray-800 dark:text-gray-200 text-[10px] font-bold rounded px-1.5 py-0.5 border border-transparent dark:border-tech-700 outline-none"
        >
          <option value="BTCUSDT">BTC</option>
          <option value="ETHUSDT">ETH</option>
          <option value="SOLUSDT">SOL</option>
        </select>

        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="bg-gray-100 dark:bg-tech-900 text-gray-800 dark:text-gray-200 text-[10px] font-bold rounded px-1.5 py-0.5 border border-transparent dark:border-tech-700 outline-none"
        >
          <option value="5m">5m</option>
          <option value="1h">1h</option>
          <option value="1D">1D</option>
        </select>
      </div>

      <div className="flex-1 relative w-full flex justify-center items-center pb-1 overflow-visible">
        <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMax meet">
          <defs>
            <linearGradient id="lsrGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#CD534B" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#548f3f" />
            </linearGradient>
          </defs>

          {/* ✅ Arco cinza (endpoint corrigido pra MINI_GAUGE_R) */}
          <path
            d={`M ${GAUGE_CX - MINI_GAUGE_R} ${GAUGE_CY} A ${MINI_GAUGE_R} ${MINI_GAUGE_RY} 0 0 1 ${GAUGE_CX + MINI_GAUGE_R} ${GAUGE_CY}`}
            fill="none"
            stroke="currentColor"
            className="text-gray-200 dark:text-tech-700"
            strokeWidth={GAUGE_STROKE}
            strokeLinecap="round"
          />

          {/* ✅ Arco colorido (mesma geometria) */}
          <path
            d={`M ${GAUGE_CX - MINI_GAUGE_R} ${GAUGE_CY} A ${MINI_GAUGE_R} ${MINI_GAUGE_RY} 0 0 1 ${GAUGE_CX + MINI_GAUGE_R} ${GAUGE_CY}`}
            fill="none"
            stroke="url(#lsrGradient)"
            strokeWidth={GAUGE_STROKE}
            strokeLinecap="round"
          />

          {/* ✅ Escala (fora do arco, respeitando stroke/caps) */}
          {[1, 2, 3, 4, 5].map(v => {
            // 1..5 => 180..0 (esquerda -> direita)
            const angleDeg = 180 - ((v - 1) / 4) * 180;
            const theta = (angleDeg * Math.PI) / 180;

            // ponto sobre a elipse do arco
            const px = GAUGE_CX + MINI_GAUGE_R * Math.cos(theta);
            const py = GAUGE_CY - MINI_GAUGE_RY * Math.sin(theta);

            // normal radial "pra fora"
            const nx = Math.cos(theta);
            const ny = -Math.sin(theta);

            let tx = px + nx * (LABEL_R - MINI_GAUGE_R);
            let ty = py + ny * (LABEL_R - MINI_GAUGE_R);

            // empurra as pontas pra não brigar com o round cap
            if (v === 1) tx -= CAP_PAD;
            if (v === 5) tx += CAP_PAD;

            const anchor: 'start' | 'middle' | 'end' = v === 1 ? 'start' : v === 5 ? 'end' : 'middle';

            return (
              <text
                key={v}
                x={tx}
                y={ty}
                textAnchor={anchor}
                dominantBaseline="middle"
                fill="currentColor"
                className="text-gray-500 font-black"
                fontSize="8"
              >
                {v}
              </text>
            );
          })}

          {/* Ponteiro */}
          <g transform={`rotate(${rotation} ${GAUGE_CX} ${GAUGE_CY})`}>
            <path
              d={`M ${GAUGE_CX} ${GAUGE_CY} L ${GAUGE_CX} ${GAUGE_CY - MINI_GAUGE_RY + 2}`}
              stroke="var(--color-text-main)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx={GAUGE_CX} cy={GAUGE_CY} r="5" fill="var(--color-text-main)" />
          </g>

          {/* Valor */}
          <text
            x={GAUGE_CX}
            y={TEXT_VAL_Y - 3}
            textAnchor="middle"
            fill="var(--color-gauge-val)"
            fontSize="22"
            fontWeight="900"
            fontFamily="monospace"
          >
            {Number.isFinite(val) ? val.toFixed(2) : '--'}
          </text>
        </svg>
      </div>

      <div className="flex justify-between px-2 pt-1 border-t border-tech-700/50 mt-1">
        <div className="text-center">
          <div className="text-[10px] text-gray-500 font-black uppercase tracking-tighter">Shorts</div>
          <div className="text-s font-mono font-black text-tech-danger">
            {data?.shorts != null ? `${data.shorts.toFixed(1)}%` : '--'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-gray-500 font-black uppercase tracking-tighter">Longs</div>
          <div className="text-s font-mono font-black text-tech-success">
            {data?.longs != null ? `${data.longs.toFixed(1)}%` : '--'}
          </div>
        </div>
      </div>
    </div>
  );
};

// Other widgets... (code omitted for brevity but they are in the user-provided file)

const Dashboard: React.FC<DashboardProps> = ({ onPostClick, language = 'pt' as Language, setView, theme }) => {
  const [showStats, setShowStats] = useState(true);
  const t = getTranslations(language).dashboard;
  const navigateToWorkspace = () => setView(ViewMode.WORKSPACE);

  return (
    <div className="w-full flex-1 flex flex-col transition-colors duration-700 pb-20">
      <div className="w-full max-w-[90%] mx-auto px-4 mt-6">
        <div className="flex items-center justify-center mb-6">
            <div className="h-px bg-tech-600 flex-1 opacity-20 dark:opacity-100"></div>
            <div className="flex items-center gap-4 px-4 py-1 bg-tech-800 border border-tech-700 rounded-lg shadow-xl">
               <button onClick={() => setView(ViewMode.WORKSPACE)} className="text-gray-900 dark:text-[#dd9933] hover:text-[#dd9933] transition-colors font-black tracking-[0.2em] text-lg uppercase flex items-center gap-2">
                   ANALYTICS WORKSPACE <LayoutDashboard size={16} />
               </button>
               <div className="w-px h-4 bg-tech-600/50"></div>
               <button onClick={() => setShowStats(!showStats)} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-[#dd9933]">
                    {showStats ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
            </div>
            <div className="h-px bg-tech-600 flex-1 opacity-20 dark:opacity-100"></div>
        </div>

        {showStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-[repeat(7,minmax(0,1fr))] gap-3 animate-in fade-in slide-in-from-top-4 duration-700 w-full">
                <div className="h-[250px] md:h-[260px] xl:h-[270px]"><FearAndGreedWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[250px] md:h-[260px] xl:h-[270px]"><RsiWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[250px] md:h-[260px] xl:h-[270px]"><LongShortRatioWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[250px] md:h-[260px] xl:h-[270px]"><AltSeasonWidget language={language} onNavigate={navigateToWorkspace} theme={theme} /></div>
                <div className="h-[250px] md:h-[260px] xl:h-[270px]"><MarketCapHistoryWidget language={language} onNavigate={navigateToWorkspace} theme={theme} /></div>
                <div className="h-[250px] md:h-[260px] xl:h-[270px]"><EtfFlowWidget language={language} onNavigate={navigateToWorkspace} theme={theme} /></div>
                <div className="h-[250px] md:h-[260px] xl:h-[270px]"><TrumpOMeterWidget language={language} onNavigate={navigateToWorkspace} /></div>
                
                <div className="h-[340px] md:col-span-1 xl:col-span-2"><GainersLosersWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[340px] md:col-span-2 xl:col-span-2"><MarketCapWidget language={language} onNavigate={navigateToWorkspace} /></div>
                <div className="h-[340px] md:col-span-3 xl:col-span-3"><EconomicCalendarWidget language={language} onNavigate={navigateToWorkspace} /></div>
            </div>
        )}
      </div>

      <div className="w-full max-w-[90%] mx-auto px-4 mt-16 flex flex-col items-center">
        <div className="flex items-center justify-center mb-8 w-full">
            <div className="h-px bg-tech-600 flex-1 opacity-20 dark:opacity-100"></div>
            <div className="px-6 py-2 bg-tech-800 border border-tech-700 rounded-lg shadow-xl"><h2 className="text-gray-900 dark:text-[#dd9933] font-black tracking-[0.2em] text-lg uppercase">CENTRAL MAGAZINE</h2></div>
            <div className="h-px bg-tech-600 flex-1 opacity-20 dark:opacity-100"></div>
        </div>
        <div className="flex flex-col gap-5 w-full">
            <div className="min-h-[100px] w-full"><MagazineTicker onPostClick={onPostClick} /></div>
            <div className="min-h-[600px] w-full"><NewsGrid onPostClick={onPostClick} language={language} /></div>
            <div className="w-full"><NewsFeed onPostClick={onPostClick} language={language} /></div>
        </div>
      </div>
    </div>
  );
};

// Remainder of the file with other widgets (code omitted for brevity)
// ... (LongShortRatioWidget, AltSeasonWidget, EtfFlowWidget, TrumpOMeterWidget, GainersLosersWidget, MarketCapWidget, EconomicCalendarWidget)
export default Dashboard;
