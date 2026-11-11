export const EXTRACTOR_VERSION='pdfjs-text-optional-ocr-v2';
export const SCHEMA_VERSION='1';
export const cacheKey=(hash:string)=>`${hash}:${EXTRACTOR_VERSION}:${SCHEMA_VERSION}`;
