
import * as React from 'react';
import { Suspense, useMemo } from 'react';
import { WidgetType, DashboardItem, Language } from '../../../types';
import WidgetErrorBoundary from '../widgets/WidgetErrorBoundary';
import { Loader2 } from 'lucide-react';
import CryptoMarketBubbles from '../widgets/CryptoMarketBubbles';

// Lazy load widgets to ensure the shell loads even if a widget fails to import (e.g. Highcharts issues)
// Casting to any to avoid IntrinsicAttributes errors during lazy load type inference
const RsiWidget = React.lazy(() => import('../widgets/RsiWidget')) as unknown as React.ComponentType<any>;
const MacdWidget = React.lazy(() => import('../widgets/MacdWidget')) as unknown as React.ComponentType<any>;
const FearGreedWidget = React.lazy(() => import('../widgets/FearGreedWidget')) as unknown as React.ComponentType<any>;
const LsrWidget = React.lazy(() => import('../widgets/LsrWidget')) as unknown as React.ComponentType<any>;
const AltcoinSeasonWidget = React.lazy(() => import('../widgets/AltcoinSeasonWidget')) as unknown as React.ComponentType<any>;
const TrumpMeterWidget = React.lazy(() => import('../widgets/TrumpMeterWidget')) as unknown as React.ComponentType<any>;
const EtfFlowWidget = React.lazy(() => import('../widgets/EtfFlowWidget')) as unknown as React.ComponentType<any>;
const GainersLosersWidget = React.lazy(() => import('../widgets/GainersLosersWidget')) as unknown as React.ComponentType<any>;
const CalendarWidget = React.lazy(() => import('../widgets/CalendarWidget')) as unknown as React.ComponentType<any>;
const HeatmapWidget = React.lazy(() => import('../widgets/HeatmapWidget')) as unknown as React.ComponentType<any>;

const PriceWidget = React.lazy(() => import('../widgets/PriceWidget')) as unknown as React.ComponentType<any>;
const VolumeWidget = React.lazy(() => import('../widgets/VolumeWidget')) as unknown as React.ComponentType<any>;
const TrendWidget = React.lazy(() => import('../widgets/TrendWidget')) as unknown as React.ComponentType<any>;
const SentimentWidget = React.lazy(() => import('../widgets/SentimentWidget')) as unknown as React.ComponentType<any>;
const NewsWidget = React.lazy(() => import('../widgets/NewsWidget')) as unknown as React.ComponentType<any>;
const OrderBookWidget = React.lazy(() => import('../widgets/OrderBookWidget')) as unknown as React.ComponentType<any>;

interface Props {
  item: DashboardItem;
  currentPrice?: number;
  priceChange?: number;
  sparkline?: number[];
  totalVolume?: number;
  marketCap?: number;
  coinName?: string;
  language?: Language;
}

const LoadingWidget = () => (
    <div className="flex items-center justify-center h-full w-full bg-white/50 dark:bg-black/20">
        <Loader2 className="animate-spin text-gray-400" size={24} />
    </div>
);

const CryptoWidget: React.FC<Props> = (props) => {
  const { item, currentPrice, priceChange, sparkline, totalVolume, marketCap, coinName, language = 'pt' } = props;

  const renderContent = () => {
    switch (item.type) {
      // --- MAIN BOARD WIDGETS ---
      case WidgetType.FEAR_GREED:
        return <FearGreedWidget item={item} language={language} />;
      case WidgetType.RSI_AVG:
        return <RsiWidget item={item} language={language} />;
      case WidgetType.MACD_AVG:
        return <MacdWidget item={item} language={language} />;
      case WidgetType.LONG_SHORT_RATIO:
        return <LsrWidget item={item} language={language} />;
      case WidgetType.ALTCOIN_SEASON:
        return <AltcoinSeasonWidget item={item} language={language} />;
      case WidgetType.TRUMP_METER:
        return <TrumpMeterWidget item={item} language={language} />;
      case WidgetType.ETF_NET_FLOW:
        return <EtfFlowWidget item={item} language={language} />;
      case WidgetType.GAINERS_LOSERS:
        return <GainersLosersWidget item={item} language={language} />;
      case WidgetType.CALENDAR:
        return <CalendarWidget item={item} language={language} />;
      case WidgetType.HEATMAP:
        return <HeatmapWidget item={item} language={language} />;
      
      // REPLACED HIGHCHARTS BUBBLES WITH PHYSICS BUBBLES (CryptoMarketBubbles)
      case WidgetType.BUBBLE_HEATMAP:
        return <CryptoMarketBubbles language={language} isWidget={true} item={item} />;
      
      // --- "BOARD 2" WIDGETS ---
      case WidgetType.PRICE:
        return <PriceWidget item={item} currentPrice={currentPrice} priceChange={priceChange} sparkline={sparkline} marketCap={marketCap} totalVolume={totalVolume} language={language} />;
      case WidgetType.VOLUME:
        return <VolumeWidget item={item} sparkline={sparkline} totalVolume={totalVolume} language={language} />;
      case WidgetType.TREND:
        return <TrendWidget item={item} sparkline={sparkline} language={language} />;
      case WidgetType.SENTIMENT:
        return <SentimentWidget item={item} sparkline={sparkline} language={language} />;
      case WidgetType.NEWS:
        return <NewsWidget item={item} coinName={coinName} language={language} />;
      case WidgetType.ORDER_BOOK:
        return <OrderBookWidget item={item} language={language} />;

      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-4">
               <h3 className="font-bold text-slate-300">{item.title}</h3>
               <p className="text-xs">({item.type})</p>
               <p className="mt-4 text-xs italic">Widget not implemented.</p>
          </div>
        );
    }
  };

  return (
    <WidgetErrorBoundary>
      <div className="flex-1 w-full h-full min-h-0 overflow-hidden relative bg-white dark:bg-[#2f3032] transition-colors">
        <Suspense fallback={<LoadingWidget />}>
            {renderContent()}
        </Suspense>
      </div>
    </WidgetErrorBoundary>
  );
};

export default CryptoWidget;
