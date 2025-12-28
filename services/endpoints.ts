
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
      rsiTracker: "/rsitrackerhist.json",
      macdAvg: "/macdavg.json",
      macdTracker: "/macdtracker.json",
      trump: "/trumpometer.json",
      altseason: "/altcoinseasonindex.json",
      mktcapHist: "/mktcap-historico.json",
      calendar: "/calendar.json",
      heatmap: "/heatmap.json",
      etfBtc: "/spot-btc-etf-flows.json",
      etfEth: "/spot-eth-etf-flows.json",
      etfNetFlow: "/etfnetflow.json",
      news: "/news.php"
    }
  }
};

export const getCacheckoUrl = (path: string) => `${ENDPOINTS.cachecko.base}${path}`;
export const getMagazineUrl = (path: string) => `${ENDPOINTS.magazine.base}${path}`;
