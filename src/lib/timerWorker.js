// src/lib/timerWorker.js
// Um Web Worker simples para executar temporizadores em background sem que
// o navegador (Chrome/Edge) engasgue quando a aba estiver minimizada.

let timerId;

self.onmessage = function(e) {
  if (e.data.command === 'start') {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      self.postMessage('tick');
    }, e.data.delay);
  } else if (e.data.command === 'stop') {
    clearTimeout(timerId);
  }
};
