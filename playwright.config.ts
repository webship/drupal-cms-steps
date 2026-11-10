import type { LaunchOptions, BrowserContextOptions } from 'playwright';

type BrowserName = 'chromium' | 'firefox' | 'webkit';

const browser = (process.env.BROWSER || 'chromium') as BrowserName;
// HEADLESS=false opens a visible browser (what `npm run test:headed` sets);
// SLOW_MO=<ms> slows every action down, 300 by default and 800 when headed.
const headless = process.env.HEADLESS !== 'false';
const slowMo = (() => {
  const raw = parseInt(process.env.SLOW_MO || '', 10);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return headless ? 300 : 800;
})();

const chromiumArgs: string[] = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-setuid-sandbox',
  '--disable-web-security',
  '--ignore-certificate-errors',
  '--disable-extensions',
  '--incognito',
  '--disable-infobars',
];

interface PlaywrightConfig {
  browser: BrowserName;
  launchOptions: LaunchOptions;
  contextOptions: BrowserContextOptions;
}

const config: PlaywrightConfig = {
  browser,
  launchOptions: {
    headless,
    slowMo,
    args: browser === 'chromium' ? chromiumArgs : [],
  },
  contextOptions: {
    viewport: { width: 1600, height: 1200 },
    ignoreHTTPSErrors: true,
  },
};

export = config;
