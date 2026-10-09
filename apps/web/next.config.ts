import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Um único .env.local na raiz do monorepo, compartilhado com worker e scripts.
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadEnvConfig(rootDir);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@chavi/core', '@chavi/db'],
};

export default nextConfig;
