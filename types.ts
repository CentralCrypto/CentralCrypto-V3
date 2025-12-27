
import React from 'react';

// Define Layout manualmente to avoid type confusion with react-grid-layout exports
export interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface CoinData {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  volume: string;
  marketCap: string;
  data: { time: string; value: number }[];
}

export interface WPPost {
  id: number;
  title: { rendered: string };
  excerpt: { rendered: string };
  date: string;
  author: number;
  featured_media_url?: string;
  categories: number[];
  _embedded?: {
    'wp:featuredmedia'?: Array<{ source_url: string }>;
    'author'?: Array<{ name: string }>;
  };
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  MARKET = 'MARKET',
  MAGAZINE = 'MAGAZINE',
  POST = 'POST',
  SEARCH = 'SEARCH',
  PROFILE = 'PROFILE',
  ACADEMY = 'ACADEMY',
  INDICATORS = 'INDICATORS',
  WORKSPACE = 'WORKSPACE',
  COCKPIT = 'COCKPIT'
}

export interface NavItem {
  label: string;
  mode: ViewMode;
  icon: React.ReactNode;
}

export interface UserProfileData {
  id: number;
  username: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  description: string;
  avatar_url?: string;
  roles: string[];
}

// --- ACADEMY TYPES ---
export interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export enum AcademyLanguage {
  PT = 'PT',
  EN = 'EN',
  ES = 'ES'
}

export interface TopicContent {
  [AcademyLanguage.PT]?: string;
  [AcademyLanguage.EN]?: string;
  [AcademyLanguage.ES]?: string;
}

export interface Topic {
  id: string;
  title: string;
  displayTitle: TopicContent;
  content: TopicContent;
  children: Topic[];
  parentId: string | null;
  tier: 0 | 1 | 2 | 3;
}

export interface TopicDraft {
  parentId: string | null;
  title: string;
  displayTitles: TopicContent;
  contents: TopicContent;
  tier: 0 | 1 | 2 | 3;
}


export type Language = 'pt' | 'en' | 'es';

export interface Indicator {
  id: string;
  title: string;
  
  // Conteúdo Padrão (PT)
  description: string;
  fullDescription?: string;

  // Conteúdo Inglês (EN)
  description_en?: string;
  fullDescription_en?: string;

  // Conteúdo Espanhol (ES)
  description_es?: string;
  fullDescription_es?: string;

  price: string; 
  tags: string[];
  imageUrl: string;
  features: string[];
  originalUrl: string; 
  type: 'Indicator' | 'Strategy';
  likes: number;
  comments: number;
  badge?: 'VIP' | 'Editor\'s Pick' | 'New';
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  avatarUrl: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export enum WidgetType {
  PRICE = 'PRICE',
  VOLUME = 'VOLUME',
  TREND = 'TREND',
  SENTIMENT = 'SENTIMENT',
  NEWS = 'NEWS',
  ORDER_BOOK = 'ORDER_BOOK',
  FEAR_GREED = 'FEAR_GREED',
  RSI_AVG = 'RSI_AVG',
  MACD_AVG = 'MACD_AVG',
  TRUMP_METER = 'TRUMP_METER',
  LONG_SHORT_RATIO = 'LONG_SHORT_RATIO',
  ALTCOIN_SEASON = 'ALTCOIN_SEASON',
  ETF_NET_FLOW = 'ETF_NET_FLOW',
  GAINERS_LOSERS = 'GAINERS_LOSERS',
  CALENDAR = 'CALENDAR',
  HEATMAP = 'HEATMAP',
  BUBBLE_HEATMAP = 'BUBBLE_HEATMAP',
  TV_CHART = 'TV_CHART'
}

export enum UserTier {
  TIER_1 = 'TIER_1', 
  TIER_2 = 'TIER_2', 
  TIER_3 = 'TIER_3', 
}

export interface DashboardItem {
  id: string;
  type: WidgetType;
  title: string;
  symbol: string;
  isMaximized?: boolean;
  originalLayout?: Layout;
}

export interface Dashboard {
  id: string;
  name: string;
  items: DashboardItem[];
  layouts: { [key: string]: Layout[] };
  lastUpdated: number;
  isLocked?: boolean; 
}

export interface DashboardState {
  dashboards: Dashboard[];
  activeDashboardId: string;
  userTier: UserTier;
}

export interface WorkspaceCoinData {
  name: string;
  symbol: string;
  price: number;
  change: number;
  data: { name: string; value: number; volume?: number; sentiment?: number }[];
}

export interface HeatmapCrypto {
  id: number;
  symbol: string;
  slug: string;
  price: number;
  dominance: number;
  volDominance: number;
  percentChange24h: number;
  marketCap: number;
  volume24h: number;
  categories: string[];
}

export interface ApiCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  market_cap_rank?: number;
  total_volume: number;
  circulating_supply?: number;
  image: string;
  ath: number;
  ath_change_percentage: number;
  atl: number;
  atl_change_percentage: number;
  high_24h: number;
  low_24h: number;
  sparkline_in_7d?: {
    price: number[];
  };
}
