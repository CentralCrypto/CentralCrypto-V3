import { CoinData, WPPost } from './types';

// Simulate Sparkline Data
const generateSparkline = (start: number) => {
  let current = start;
  return Array.from({ length: 20 }, (_, i) => {
    const change = (Math.random() - 0.5) * (start * 0.05);
    current += change;
    return { time: `T${i}`, value: current };
  });
};

export const MOCK_COINS: CoinData[] = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
    price: 64231.45,
    change24h: 2.34,
    volume: '34.2B',
    marketCap: '1.2T',
    data: generateSparkline(64000),
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    price: 3452.12,
    change24h: -1.12,
    volume: '15.8B',
    marketCap: '400B',
    data: generateSparkline(3500),
  },
  {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    price: 145.67,
    change24h: 5.67,
    volume: '4.2B',
    marketCap: '65B',
    data: generateSparkline(140),
  },
  {
    id: 'chainlink',
    name: 'Chainlink',
    symbol: 'LINK',
    price: 18.23,
    change24h: 0.45,
    volume: '890M',
    marketCap: '10B',
    data: generateSparkline(18),
  },
  {
    id: 'polkadot',
    name: 'Polkadot',
    symbol: 'DOT',
    price: 7.89,
    change24h: -2.30,
    volume: '230M',
    marketCap: '9B',
    data: generateSparkline(8),
  }
];

// Simulate WordPress REST API Response
export const MOCK_WP_POSTS: WPPost[] = [
  {
    id: 1,
    title: { rendered: "Bitcoin Halving: Análise Técnica para 2024" },
    excerpt: { rendered: "<p>O próximo evento de halving apresenta métricas on-chain únicas que diferem estritamente dos ciclos anteriores...</p>" },
    date: "2023-10-24T10:00:00",
    author: 1,
    featured_media_url: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&q=80&w=600",
    categories: [12]
  },
  {
    id: 2,
    title: { rendered: "Guerra das Camadas 2: Arbitrum vs Optimism" },
    excerpt: { rendered: "<p>Um mergulho profundo no throughput de transações, centralização de sequenciadores e o futuro do escalonamento Ethereum...</p>" },
    date: "2023-10-23T14:30:00",
    author: 1,
    featured_media_url: "https://images.unsplash.com/photo-1620321023374-d1a68fddadb3?auto=format&fit=crop&q=80&w=600",
    categories: [14, 15]
  },
  {
    id: 3,
    title: { rendered: "Entendendo Provas de Conhecimento Zero em DeFi" },
    excerpt: { rendered: "<p>Privacidade está se tornando o luxo final em um mundo de ledger transparente. Como os ZK-Rollups mudam o jogo...</p>" },
    date: "2023-10-22T09:15:00",
    author: 2,
    featured_media_url: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=600",
    categories: [12]
  },
    {
    id: 4,
    title: { rendered: "Fluxo Institucional: O Efeito ETF" },
    excerpt: { rendered: "<p>Analisando o impacto potencial da aprovação do ETF spot da BlackRock nos mercados globais de liquidez...</p>" },
    date: "2023-10-21T11:00:00",
    author: 1,
    featured_media_url: "https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&q=80&w=600",
    categories: [10]
  }
];