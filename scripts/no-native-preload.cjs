// Test-only fault injection: prove PDF text extraction does not need native canvas.
const Module = require('node:module');
const original = Module._load;
Module._load = function (request, ...args) {
  if (request.startsWith('@napi-rs/canvas') || request === 'canvas') {
    const error = new Error('Native canvas intentionally unavailable in production rehearsal');
    error.code = 'MODULE_NOT_FOUND';
    throw error;
  }
  return original.call(this, request, ...args);
};
