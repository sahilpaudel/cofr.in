// Polyfill Promise.withResolvers for iOS Safari < 17.4 / Chrome < 119.
// Must be at the top of this module. pdfjs calls this API lazily (inside
// constructors/methods, not at module evaluation time), so installing it
// here — before the import below is executed — is sufficient.
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    var resolve, reject;
    var promise = new Promise(function (res, rej) { resolve = res; reject = rej; });
    return { promise: promise, resolve: resolve, reject: reject };
  };
}
// structuredClone: Safari < 15.4
if (typeof structuredClone !== 'function') {
  // eslint-disable-next-line no-restricted-globals
  self.structuredClone = function (obj) { return JSON.parse(JSON.stringify(obj)); };
}

import 'pdfjs-dist/build/pdf.worker.min.mjs';
