/**
 * Market catalogue for the landing page's market overview.
 *
 * Our own ids are canonical: the app passes `MarketInstrument.id` around and
 * only this table knows the chart provider's symbol strings. When the chart
 * moves from the TradingView widget to Advanced Charts, this lookup is the
 * only thing retired (see tradingview-widget-integration.md).
 */

export type MarketCategoryId = 'fx' | 'crypto' | 'stocks' | 'commodities' | 'indices' | 'bonds'

export interface MarketInstrument {
  /** Our id, stable across chart providers */
  id: string
  /** Short label for the picker, e.g. "EUR/USD" */
  label: string
  /** Full name, e.g. "Euro / US Dollar" */
  name: string
  /** TradingView symbol, EXCHANGE:TICKER */
  tvSymbol: string
}

export interface MarketCategory {
  id: MarketCategoryId
  label: string
  instruments: MarketInstrument[]
}

export const MARKET_CATEGORIES: MarketCategory[] = [
  {
    id: 'crypto',
    label: 'Crypto',
    instruments: [
      { id: 'btc-usd', label: 'BTC', name: 'Bitcoin', tvSymbol: 'BINANCE:BTCUSDT' },
      { id: 'eth-usd', label: 'ETH', name: 'Ethereum', tvSymbol: 'BINANCE:ETHUSDT' },
      { id: 'sol-usd', label: 'SOL', name: 'Solana', tvSymbol: 'BINANCE:SOLUSDT' },
      { id: 'bnb-usd', label: 'BNB', name: 'BNB', tvSymbol: 'BINANCE:BNBUSDT' },
      { id: 'xrp-usd', label: 'XRP', name: 'XRP', tvSymbol: 'BINANCE:XRPUSDT' },
      { id: 'doge-usd', label: 'DOGE', name: 'Dogecoin', tvSymbol: 'BINANCE:DOGEUSDT' },
    ],
  },
  {
    id: 'fx',
    label: 'FX',
    instruments: [
      { id: 'eur-usd', label: 'EUR/USD', name: 'Euro / US Dollar', tvSymbol: 'OANDA:EURUSD' },
      { id: 'gbp-usd', label: 'GBP/USD', name: 'British Pound / US Dollar', tvSymbol: 'OANDA:GBPUSD' },
      { id: 'usd-jpy', label: 'USD/JPY', name: 'US Dollar / Japanese Yen', tvSymbol: 'OANDA:USDJPY' },
      { id: 'aud-usd', label: 'AUD/USD', name: 'Australian Dollar / US Dollar', tvSymbol: 'OANDA:AUDUSD' },
      { id: 'usd-cad', label: 'USD/CAD', name: 'US Dollar / Canadian Dollar', tvSymbol: 'OANDA:USDCAD' },
      { id: 'usd-chf', label: 'USD/CHF', name: 'US Dollar / Swiss Franc', tvSymbol: 'OANDA:USDCHF' },
    ],
  },
  {
    id: 'stocks',
    label: 'Stocks',
    instruments: [
      { id: 'aapl', label: 'AAPL', name: 'Apple', tvSymbol: 'NASDAQ:AAPL' },
      { id: 'nvda', label: 'NVDA', name: 'NVIDIA', tvSymbol: 'NASDAQ:NVDA' },
      { id: 'msft', label: 'MSFT', name: 'Microsoft', tvSymbol: 'NASDAQ:MSFT' },
      { id: 'tsla', label: 'TSLA', name: 'Tesla', tvSymbol: 'NASDAQ:TSLA' },
      { id: 'amzn', label: 'AMZN', name: 'Amazon', tvSymbol: 'NASDAQ:AMZN' },
      { id: 'googl', label: 'GOOGL', name: 'Alphabet', tvSymbol: 'NASDAQ:GOOGL' },
    ],
  },
  {
    id: 'commodities',
    label: 'Commodities',
    instruments: [
      { id: 'gold', label: 'Gold', name: 'Gold spot', tvSymbol: 'OANDA:XAUUSD' },
      { id: 'silver', label: 'Silver', name: 'Silver spot', tvSymbol: 'OANDA:XAGUSD' },
      { id: 'wti', label: 'WTI', name: 'WTI crude oil', tvSymbol: 'TVC:USOIL' },
      { id: 'brent', label: 'Brent', name: 'Brent crude oil', tvSymbol: 'TVC:UKOIL' },
      { id: 'natgas', label: 'Nat Gas', name: 'Natural gas', tvSymbol: 'OANDA:NATGASUSD' },
      { id: 'copper', label: 'Copper', name: 'Copper', tvSymbol: 'OANDA:XCUUSD' },
    ],
  },
  {
    id: 'indices',
    label: 'Indices',
    instruments: [
      { id: 'spx', label: 'S&P 500', name: 'US S&P 500', tvSymbol: 'OANDA:SPX500USD' },
      { id: 'ndx', label: 'Nasdaq 100', name: 'US Nasdaq 100', tvSymbol: 'OANDA:NAS100USD' },
      { id: 'dji', label: 'Dow 30', name: 'US Dow Jones 30', tvSymbol: 'OANDA:US30USD' },
      { id: 'ftse', label: 'FTSE 100', name: 'UK FTSE 100', tvSymbol: 'OANDA:UK100GBP' },
      { id: 'dax', label: 'DAX', name: 'Germany DAX', tvSymbol: 'OANDA:DE30EUR' },
      { id: 'nikkei', label: 'Nikkei 225', name: 'Japan Nikkei 225', tvSymbol: 'OANDA:JP225USD' },
    ],
  },
  {
    id: 'bonds',
    label: 'Bonds',
    instruments: [
      { id: 'us10y', label: 'US 10Y', name: 'US 10-year Treasury yield', tvSymbol: 'TVC:US10Y' },
      { id: 'us02y', label: 'US 2Y', name: 'US 2-year Treasury yield', tvSymbol: 'TVC:US02Y' },
      { id: 'us30y', label: 'US 30Y', name: 'US 30-year Treasury yield', tvSymbol: 'TVC:US30Y' },
      { id: 'de10y', label: 'Germany 10Y', name: 'German 10-year Bund yield', tvSymbol: 'TVC:DE10Y' },
      { id: 'gb10y', label: 'UK 10Y', name: 'UK 10-year Gilt yield', tvSymbol: 'TVC:GB10Y' },
      { id: 'jp10y', label: 'Japan 10Y', name: 'Japan 10-year government bond yield', tvSymbol: 'TVC:JP10Y' },
    ],
  },
]

const INSTRUMENTS_BY_ID = new Map(
  MARKET_CATEGORIES.flatMap((c) => c.instruments).map((i) => [i.id, i] as const)
)

export function getInstrument(id: string): MarketInstrument | undefined {
  return INSTRUMENTS_BY_ID.get(id)
}
