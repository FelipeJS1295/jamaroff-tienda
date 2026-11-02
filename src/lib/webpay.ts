import 'server-only';
import { WebpayPlus, IntegrationCommerceCodes, IntegrationApiKeys } from 'transbank-sdk';

/**
 * Webpay Plus (Transbank).
 * - WEBPAY_ENV=integration usa el ambiente de pruebas oficial (tarjetas de prueba de Transbank).
 * - WEBPAY_ENV=production usa tu código de comercio y API key reales.
 */
export function webpayTx() {
  if (process.env.WEBPAY_ENV === 'production') {
    const code = process.env.WEBPAY_COMMERCE_CODE;
    const key = process.env.WEBPAY_API_KEY;
    if (!code || !key) throw new Error('Faltan WEBPAY_COMMERCE_CODE o WEBPAY_API_KEY para producción');
    return WebpayPlus.Transaction.buildForProduction(code, key);
  }
  return WebpayPlus.Transaction.buildForIntegration(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY);
}

export const isWebpayTestMode = () => process.env.WEBPAY_ENV !== 'production';
