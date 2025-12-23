
import { fetchWithFallback } from './utils';

// URLs Globais
const CALENDAR_URL = 'https://centralcrypto.com.br/cachecko/calendar.json';
const MKTCAP_HISTORY_URL = 'https://centralcrypto.com.br/cachecko/mktcap-historico.json';
const ETF_BTC_URL = 'https://centralcrypto.com.br/cachecko/etf-btc-flows.json';
const ETF_ETH_URL = 'https://centralcrypto.com.br/cachecko/etf-eth-flows.json';

export interface EconEvent { date: string; country: string; impact: string; title: string; previous: string; forecast: string; actual: string; time: string; }
export interface MktCapHistoryData { current: number; history: { date: number; value: number }[]; yesterday: number; lastWeek: number; lastMonth: number; }
export interface EtfFlowData { btcValue: number; ethValue: number; timestamp: number; chartDataBTC: any[]; chartDataETH: any[]; history: { lastWeek: number; lastMonth: number; last90d: number; }; solValue?: number; xrpValue?: number; }

export const fetchEconomicCalendar = async (): Promise<EconEvent[]> => {
    const data = await fetchWithFallback(CALENDAR_URL);
    return Array.isArray(data) ? data : [];
};

export const fetchMarketCapHistory = async (): Promise<MktCapHistoryData | null> => {
    return await fetchWithFallback(MKTCAP_HISTORY_URL);
};

export const fetchEtfFlow = async (): Promise<EtfFlowData | null> => {
    try {
        const [btc, eth] = await Promise.all([
            fetchWithFallback(ETF_BTC_URL),
            fetchWithFallback(ETF_ETH_URL)
        ]);
        if (!btc || !eth) return null;
        return {
            btcValue: btc.net_flow || 0,
            ethValue: eth.net_flow || 0,
            timestamp: btc.timestamp || eth.timestamp,
            chartDataBTC: btc.history || [],
            chartDataETH: eth.history || [],
            history: btc.aggregates || { lastWeek: 0, lastMonth: 0, last90d: 0 },
            solValue: btc.sol_net_flow || 0,
            xrpValue: btc.xrp_net_flow || 0
        };
    } catch (e) { return null; }
};
