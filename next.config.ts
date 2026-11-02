import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Paquetes que deben ejecutarse en Node tal cual (no empaquetados)
  serverExternalPackages: ['transbank-sdk', 'exceljs', 'sharp', 'postgres', 'nodemailer', 'bcryptjs'],
  experimental: {
    serverActions: { bodySizeLimit: '25mb' }, // subida de fotos y Excel desde el admin
  },
  poweredByHeader: false,
};

export default nextConfig;
