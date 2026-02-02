
/**
 * CENTRAL DE ENDPOINTS CCT - VERSÃO VPS (RELATIVE)
 * Configurado para caminhos relativos que o Vite Proxy intercepta.
 */

export const ENDPOINTS = {
  magazine: {
    base: "/2",
    posts: "/wp-json/wp/v2/posts",
    categories: "/wp-json/wp/v2/categories"
  },
  cachecko: {
    base: "/cachecko",
    files: {
      global: "/cg_global.json",
      main: "/cachecko.json",
      fng: "/fearandgreed_data.json",
      rsiAvg: "/rsiavg.json", 
      rsiTrackerHist: "/rsitrackerhist.json", // Scatter Plot Data
      rsiTable: "/rsitracker.json",           // Table Data
      macdAvg: "/macdavg.json",
      macdTracker: "/macdtracker.json",
      trump: "/trumpometer.json",
      altseason: "/altcoinseasonindex.json",
      mktcapHist: "/mktcap-historico.json",
      calendar: "/calendar.json",
      heatmap: "/heatmap.json",
      heatmapCategories: "/heatmap-categories.json",
      etfNetFlow: "/etfnetflow.json",
      // Specific ETF Files
      etfBtcFlows: "/spot-btc-etf-flows.json",
      etfBtcVolume: "/spot-btc-etf-volumes.json", // FIXED: Plural "volumes" to match server file
      etfEthFlows: "/spot-eth-etf-flows.json",
      etfEthVolume: "/spot-eth-etf-volume.json",
      etfSolFlows: "/spot-sol-etf-flows.json",
      etfSolVolumes: "/spot-sol-etf-volumes.json",
      etfXrpFlows: "/spot-xrp-etf-flows.json",
      etfXrpVolumes: "/spot-xrp-etf-volumes.json",
      top10gnl: "/top10gnl.json",
      top10mktcap: "/top10mktcap.json"
    }
  },
  special: {
    news: "/cachecko/news.php"
  },
  // Added required endpoints
  taxonomy: "/cachecko/categories/taxonomy-master.json",
  categoryMap: "/cachecko/categories/category_coins_map.json"
};

export const ENDPOINT_FALLBACKS = {
    COINS_ANY: [ENDPOINTS.cachecko.files.main, "/cachecko/cachecko_lite.json"],
    CAT_MAP_ANY: [ENDPOINTS.categoryMap, "/cachecko/category-coin-map.json"]
};

export const getCacheckoUrl = (path: string) => `${ENDPOINTS.cachecko.base}${path}`;
export const getMagazineUrl = (path: string) => `${ENDPOINTS.magazine.base}${path}`;
