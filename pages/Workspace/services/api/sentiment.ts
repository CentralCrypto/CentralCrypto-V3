
import { fetchWithFallback } from './utils';

// URLs de Sentimento
const FNG_URL = 'https://centralcrypto.com.br/cachecko/fearandgreed_data.json';
const TRUMP_URL = 'https://centralcrypto.com.br/cachecko/trumpometer.json';
const ALTSEASON_URL = 'https://centralcrypto.com.br/cachecko/altcoinseasonindex.json';
const ALTSEASON_HIST_URL = 'https://centralcrypto.com.br/cachecko/altcoinseasonhistorico.json';

export interface FngData { value: string; timestamp: string; }
export interface TrumpData { author_name: string; image_url: string; post_text: string; post_url: string; impact_value: number; impact_label: string; impact_color: string; impact_direction: string; impact_magnitude: string; }
export interface AltSeasonData { index: number; yesterday: number; lastWeek: number; lastMonth: number; }

export const fetchFearAndGreed = async (): Promise<FngData[]> => {
    try {
        const data = await fetchWithFallback(FNG_URL);
        return Array.isArray(data) ? data : (data?.data || []);
    } catch (e) { return []; }
};

export const fetchTrumpData = async (): Promise<TrumpData | null> => {
    return await fetchWithFallback(TRUMP_URL);
};

export const fetchAltcoinSeason = async (): Promise<AltSeasonData | null> => {
    return await fetchWithFallback(ALTSEASON_URL);
};

export const fetchAltcoinSeasonHistory = async (): Promise<any[]> => {
    const data = await fetchWithFallback(ALTSEASON_HIST_URL);
    return Array.isArray(data) ? data : [];
};
