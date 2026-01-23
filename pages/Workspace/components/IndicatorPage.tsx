
// IndicatorPage.tsx
import React, { useState, useMemo, useRef } from 'react';
import { ApiCoin, Language, WidgetType, UserTier } from '../../../types';
import { getTranslations } from '../../../locales';
import CryptoWidget from './CryptoWidget';
import CryptoMarketBubbles from '../widgets/CryptoMarketBubbles';
import MarketCapTable from '../widgets/MarketCapTable';
import { RsiGauge, RsiScatterChart, RsiTableList, RsiFaq } from '../widgets/RsiWidget';
import { MacdSidebar, MacdScatterChart, MacdTableList, MacdFaq } from '../widgets/MacdWidget';

import {
  Activity,
  ArrowUpRight,
  BarChart2,
  Calendar,
  ChevronDown,
  CircleDashed,
  LayoutGrid,
  List,
  Lock,
  PieChart,
  User,
  Layers,
  TrendingUp,
  Map,
  Crosshair,
  LineChart
} from 'lucide-react';

function LockOverlay() {
  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center rounded-xl">
      <Lock size={40} className="text-[#dd9933] mb-4" />
      <h3 className="text-xl font-bold text-white mb-2">Upgrade Required</h3>
      <p className="text-gray-300 text-sm mb-4">Subscribe to Tier 2 or higher to access this page.</p>
    </div>
  );
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-[#1a1c1e] p-6 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors mb-6 shrink-0">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
      <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">{description}</p>
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-gray-500 dark:text-slate-500 bg-white dark:bg-[#1a1c1e] rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
      <div className="p-4 bg-gray-50 dark:bg-[#2f3032] rounded-full mb-4">
        <Activity size={32} className="opacity-50" />
      </div>
      <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">{title}</h3>
      <p className="text-sm font-medium opacity-70">Funcionalidade em desenvolvimento (Em Breve)</p>
    </div>
  );
}

function PageFaq({ language, pageType }: { language: Language; pageType: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const t = getTranslations(language).workspace.pages.faq;

  const faqData = useMemo(() => {
    // Moved check inside hook to prevent "Rendered fewer hooks than expected" error
    if (pageType === 'RSI' || pageType === 'MACD') return null;

    switch (pageType) {
      case 'FNG': return t.fng;
      case 'ALTSEASON': return t.altseason;
      case 'ETF': return t.etf;
      case 'LSR': return t.lsr;
      case 'TRUMP': return t.trump;
      case 'CALENDAR': return t.calendar;
      case 'HEATMAP': return t.heatmap;
      case 'BUBBLES': return t.bubble;
      default: return null;
    }
  }, [pageType, t]);

  // Safe return after all hooks are called
  if (!faqData) return null;

  const items = [
    { q: faqData.q1, a: faqData.a1 },
    { q: faqData.q2, a: faqData.a2 }
  ];

  return (
    <div className="mt-8 mb-12 max-w-4xl mx-auto px-4">
      <h3 className="text-xl font-black text-gray-800 dark:text-[#dd9933] uppercase tracking-widest text-center mb-8">Metodologia e FAQ</h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-tech-800 rounded-xl overflow-hidden shadow-sm transition-all duration-500">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between p-5 text-left group"
            >
              <span className={`font-bold text-base transition-colors ${openIndex === i ? 'text-[#dd9933]' : 'text-gray-700 dark:text-gray-300'}`}>{item.q}</span>
              <ChevronDown size={20} className={`text-gray-400 transition-transform duration-500 ${openIndex === i ? 'rotate-180 text-[#dd9933]' : ''}`} />
            </button>
            <div className={`transition-all duration-500 ease-in-out ${openIndex === i ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="p-5 pt-0 text-base text-gray-500 dark:text-slate-400 leading-relaxed border-t border-transparent dark:border-white/5">
                <div dangerouslySetInnerHTML={{ __html: item.a }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- RSI CUSTOM PAGE LAYOUT (FIXED HEIGHT GRID) ---
const RsiPageLayout = ({ language }: { language: Language }) => {
    return (
        <div className="flex flex-col gap-6 w-full pb-10">
            {/* Top Row: Gauge (1/3) + Heatmap (2/3) - FIXED EQUAL HEIGHT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
                <div className="col-span-1 h-full min-h-0">
                    <RsiGauge language={language} />
                </div>
                <div className="col-span-1 lg:col-span-2 h-full min-h-0">
                    <RsiScatterChart />
                </div>
            </div>

            {/* Bottom Row: Table (Full) */}
            <div className="w-full">
                <RsiTableList isPage={true} />
            </div>
            
            {/* FAQ Section */}
            <RsiFaq />
        </div>
    );
};

// --- MACD CUSTOM PAGE LAYOUT ---
const MacdPageLayout = ({ language }: { language: Language }) => {
    return (
        <div className="flex flex-col gap-6 w-full pb-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
                <div className="col-span-1 h-full min-h-0">
                    <MacdSidebar language={language} />
                </div>
                <div className="col-span-1 lg:col-span-2 h-full min-h-0">
                    <MacdScatterChart />
                </div>
            </div>

            <div className="w-full">
                <MacdTableList isPage={true} />
            </div>
            
            <MacdFaq />
        </div>
    );
};

interface IndicatorPageProps {
  language: Language;
  coinMap: Record<string, ApiCoin>;
  userTier: UserTier;
}

type PageType = 
  | 'MARKETCAP' 
  | 'HEATMAP' 
  | 'BUBBLES' 
  | 'ETF' 
  | 'RSI' 
  | 'MACD' 
  | 'CCT_INDEX'
  | 'LSR' 
  | 'OPEN_INTEREST' 
  | 'BASIS' 
  | 'LIQ_MAP' 
  | 'LIQ_HEATMAP' 
  | 'DERIVATIVES_TRACKING'
  | 'CALENDAR' 
  | 'FNG' 
  | 'ALTSEASON' 
  | 'TRUMP';

function IndicatorPage({ language, coinMap: _coinMap, userTier }: IndicatorPageProps) {
  const [activePage, setActivePage] = useState<PageType>('MARKETCAP');
  const mainScrollRef = useRef<HTMLDivElement | null>(null);

  const GROUPS = [
    { 
      title: 'Market', 
      items: [
        { id: 'MARKETCAP' as PageType, label: "MarketCap", icon: <List size={18} /> },
        { id: 'HEATMAP' as PageType, label: "HeatMap Tree", icon: <LayoutGrid size={18} /> },
        { id: 'BUBBLES' as PageType, label: "CryptoBubbles", icon: <CircleDashed size={18} /> },
        { id: 'ETF' as PageType, label: "ETFs", icon: <ArrowUpRight size={18} /> },
      ] 
    },
    { 
      title: 'Indicadores Técnicos', 
      items: [
        { id: 'RSI' as PageType, label: "RSI Tracker", icon: <Activity size={18} /> },
        { id: 'MACD' as PageType, label: "MACD Average", icon: <BarChart2 size={18} /> },
        { id: 'CCT_INDEX' as PageType, label: "CCT Index", icon: <LineChart size={18} /> },
      ] 
    },
    { 
      title: 'Derivativos', 
      items: [
        { id: 'LSR' as PageType, label: "Long/Short Ratio", icon: <BarChart2 size={18} /> },
        { id: 'OPEN_INTEREST' as PageType, label: "Open Interest", icon: <Layers size={18} /> },
        { id: 'BASIS' as PageType, label: "Basis", icon: <TrendingUp size={18} /> },
        { id: 'LIQ_MAP' as PageType, label: "Liquidation Map", icon: <Map size={18} /> },
        { id: 'LIQ_HEATMAP' as PageType, label: "Liquidation HeatMap", icon: <LayoutGrid size={18} /> },
        { id: 'DERIVATIVES_TRACKING' as PageType, label: "CCT Derivatives Tracking", icon: <Crosshair size={18} /> },
      ] 
    },
    { 
      title: 'Global', 
      items: [
        { id: 'CALENDAR' as PageType, label: "Calendario", icon: <Calendar size={18} /> },
      ] 
    },
    { 
      title: 'Sentimento', 
      items: [
        { id: 'FNG' as PageType, label: "Fear&Greed Sincero", icon: <PieChart size={18} /> },
        { id: 'ALTSEASON' as PageType, label: "AltCoin Seanson Index", icon: <Activity size={18} /> },
        { id: 'TRUMP' as PageType, label: "Trump-o-meter", icon: <User size={18} /> },
      ] 
    }
  ];

  let currentPage = GROUPS[0].items[0];
  for (const group of GROUPS) {
    const found = group.items.find(item => item.id === activePage);
    if (found) { currentPage = found; break; }
  }

  return (
    <div className="flex flex-col w-full h-[calc(100vh-160px)] overflow-hidden">
      <div className="flex h-full w-full gap-4 overflow-hidden">
        {/* Sidebar */}
        <div className={`w-64 flex-shrink-0 bg-white dark:bg-[#1a1c1e] border border-gray-100 dark:border-slate-800 rounded-xl flex-col overflow-hidden shadow-sm transition-all duration-300 shrink-0 ${activePage === 'BUBBLES' ? 'hidden' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 font-black text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">Dashboard Pages</div>
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {GROUPS.map((group, groupIdx) => (
              <div key={groupIdx} className="mb-4">
                <div className="px-4 py-2 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">{group.title}</div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActivePage(item.id);
                        if (mainScrollRef.current) mainScrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-black transition-all tracking-wide ${activePage === item.id ? 'bg-[#dd9933] text-black shadow-md' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2f3032]'}`}
                    >
                      {item.icon}{item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div
          ref={mainScrollRef}
          className={`flex-1 flex-col min-w-0 h-full overflow-y-auto custom-scrollbar pr-1 ${activePage === 'BUBBLES' ? 'hidden' : 'flex'}`}
        >
          {/* Custom Headers for RSI/MACD pages */}
          {activePage === 'RSI' ? (
              <div className="bg-white dark:bg-[#1a1c1e] p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors mb-6 shrink-0">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Crypto Relative Strength Index (RSI)</h2>
                  <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">
                      Análise global de momentum, divergências e condições de sobrecompra/sobrevenda.
                  </p>
              </div>
          ) : activePage === 'MACD' ? (
              <div className="bg-white dark:bg-[#1a1c1e] p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors mb-6 shrink-0">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Moving Average Convergence Divergence (MACD)</h2>
                  <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">
                      Rastreador de tendências globais e momentum normalizado (N-MACD).
                  </p>
              </div>
          ) : (
              <PageHeader title={currentPage.label} description="Dados analíticos e ferramentas de mercado em tempo real." />
          )}

          <div className="flex-1 min-h-[600px] relative">
            {activePage === 'MARKETCAP' && <MarketCapTable language={language} scrollContainerRef={mainScrollRef} />}
            {activePage === 'HEATMAP' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'heatmap-page', type: WidgetType.HEATMAP, title: 'Crypto Heatmap', symbol: 'MARKET', isMaximized: true }} language={language} /></div>}
            
            {activePage === 'ETF' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'etf-page', type: WidgetType.ETF_NET_FLOW, title: 'ETF Net Flow', symbol: 'GLOBAL', isMaximized: true }} language={language} /></div>}
            
            {activePage === 'RSI' && <RsiPageLayout language={language} />}
            {activePage === 'MACD' && <MacdPageLayout language={language} />}

            {activePage === 'CCT_INDEX' && <PlaceholderPage title="CCT Index" />}

            {activePage === 'LSR' && (
              <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800 relative">
                {userTier === UserTier.TIER_1 && <LockOverlay />}
                <div className={userTier === UserTier.TIER_1 ? 'blur-sm h-full' : 'h-full'}>
                  <CryptoWidget item={{ id: 'lsr-page', type: WidgetType.LONG_SHORT_RATIO, title: 'Long/Short Ratio', symbol: 'GLOBAL', isMaximized: true }} language={language} />
                </div>
              </div>
            )}
            {activePage === 'OPEN_INTEREST' && <PlaceholderPage title="Open Interest" />}
            {activePage === 'BASIS' && <PlaceholderPage title="Basis" />}
            {activePage === 'LIQ_MAP' && <PlaceholderPage title="Liquidation Map" />}
            {activePage === 'LIQ_HEATMAP' && <PlaceholderPage title="Liquidation HeatMap" />}
            {activePage === 'DERIVATIVES_TRACKING' && <PlaceholderPage title="CCT Derivatives Tracking" />}

            {activePage === 'CALENDAR' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'cal-page', type: WidgetType.CALENDAR, title: 'Calendar', symbol: 'CAL', isMaximized: true }} language={language} /></div>}
            
            {activePage === 'FNG' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'fng-page', type: WidgetType.FEAR_GREED, title: 'Fear & Greed Index', symbol: 'GLOBAL', isMaximized: true }} language={language} /></div>}
            {activePage === 'ALTSEASON' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'altseason-page', type: WidgetType.ALTCOIN_SEASON, title: 'Altcoin Season Index', symbol: 'GLOBAL', isMaximized: true }} language={language} /></div>}
            {activePage === 'TRUMP' && <div className="h-full w-full rounded-xl overflow-hidden shadow-lg border-0 dark:border dark:border-slate-800"><CryptoWidget item={{ id: 'trump-page', type: WidgetType.TRUMP_METER, title: 'Trump-o-Meter', symbol: 'SENTIMENT', isMaximized: true }} language={language} /></div>}
          </div>

          <PageFaq language={language} pageType={activePage} />
        </div>

        {activePage === 'BUBBLES' && (
          <CryptoMarketBubbles language={language} onClose={() => setActivePage('MARKETCAP')} />
        )}
      </div>
    </div>
  );
}

export default IndicatorPage;
