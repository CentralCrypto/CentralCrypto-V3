
import React, { useMemo } from 'react';
import { WidgetType, DashboardItem, Language } from '../../../types';
import WidgetErrorBoundary from '../widgets/WidgetErrorBoundary';

// Main Board Widgets (Untouched, loaded from their own files)
import RsiWidget from '../widgets/RsiWidget';
import MacdWidget from '../widgets/MacdWidget';
import FearGreedWidget from '../widgets/FearGreedWidget';
import LsrWidget from '../widgets/LsrWidget';
import AltcoinSeasonWidget from '../widgets/AltcoinSeasonWidget';
import TrumpMeterWidget from '../widgets/TrumpMeterWidget';
import EtfFlowWidget from '../widgets/EtfFlowWidget';
import GainersLosersWidget from '../widgets/GainersLosersWidget';
import CalendarWidget from '../widgets/CalendarWidget';
import HeatmapWidget from '../widgets/HeatmapWidget';
import BubbleHeatmapWidget from '../widgets/BubbleHeatmapWidget';

// Board 2 Widgets (Restored from your backup into separate files)
import PriceWidget from '../widgets/PriceWidget';
import VolumeWidget from '../widgets/VolumeWidget';
import TrendWidget from '../widgets/TrendWidget';
import SentimentWidget from '../widgets/SentimentWidget';
import NewsWidget from '../widgets/NewsWidget';
import OrderBookWidget from '../widgets/OrderBookWidget';

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
      case WidgetType.BUBBLE_HEATMAP:
        return <BubbleHeatmapWidget item={item} language={language} />;
      
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
        {renderContent()}
      </div>
    </WidgetErrorBoundary>
  );
};

export default CryptoWidget;
