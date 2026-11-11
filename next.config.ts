import type { NextConfig } from 'next';
const config: NextConfig = { serverExternalPackages: ['pg','pdfjs-dist','@thednp/dommatrix'], outputFileTracingIncludes: {'/*': ['./migrations/**/*', './test_data/**/*', './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs']}, outputFileTracingExcludes: {'/*':['./node_modules/embedded-postgres/**/*','./node_modules/@embedded-postgres/**/*','./node_modules/@napi-rs/canvas*/**/*']}, poweredByHeader: false };
export default config;
