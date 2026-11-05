/** De dónde llegó la visita, a partir de la página anterior (document.referrer) */
export function sourceOf(ref: string | null | undefined, site: string): string | null {
  if (!ref) return null;
  let host: string;
  try {
    host = new URL(ref).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
  const own = (() => {
    try {
      return new URL(site).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  if (!host || host === own || host === 'localhost') return null;
  const known: [RegExp, string][] = [
    [/(^|\.)google\./, 'Google'],
    [/(^|\.)bing\.com$|duckduckgo\.com$|search\.yahoo|ecosia\.org$/, 'Otros buscadores'],
    [/(^|\.)instagram\.com$/, 'Instagram'],
    [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, 'Facebook'],
    [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'],
    [/(^|\.)tiktok\.com$/, 'TikTok'],
    [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, 'Pinterest'],
    [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
    [/(^|\.)(t\.co|x\.com|twitter\.com)$/, 'X / Twitter'],
    [/(^|\.)linkedin\.com$/, 'LinkedIn'],
    [/mercadolibre\./, 'Mercado Libre'],
    [/falabella\./, 'Falabella'],
    [/(paris\.cl|cencosud)/, 'Paris'],
    [/ripley\./, 'Ripley'],
    [/(chatgpt\.com|openai\.com|claude\.ai|perplexity\.ai|gemini\.google)/, 'Asistentes de IA'],
  ];
  for (const [re, name] of known) if (re.test(host)) return name;
  return host.slice(0, 80);
}

export function deviceOf(ua: string) {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'movil';
  return 'escritorio';
}

/** Robots, vistas previas de enlaces y herramientas: no son personas */
export const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|meta-externalagent|whatsapp|telegram|discord|skype|embedly|quora|pinterest|vkshare|w3c_validator|lighthouse|pagespeed|headless|phantom|curl|wget|python|axios|node-fetch|go-http|java\/|httpclient|monitor|uptime|scan/i;
