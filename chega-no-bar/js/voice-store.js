/* Armazenamento das vozes gravadas por você (IndexedDB do navegador).
   O estúdio (gravar-vozes.html) grava aqui e o jogo lê daqui ao iniciar. */
(function () {
  const DB = 'chega-no-bar', STORE = 'vozes';
  function open() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('sem IndexedDB'));
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, mode), st = t.objectStore(STORE);
      const out = fn(st);
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  };
  CNB.VoiceStore = {
    put: (text, rec) => tx('readwrite', (s) => s.put(rec, text)),
    del: (text) => tx('readwrite', (s) => s.delete(text)),
    async all() {
      const db = await open();
      return new Promise((res) => {
        const out = {}, t = db.transaction(STORE, 'readonly'), c = t.objectStore(STORE).openCursor();
        c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
        t.oncomplete = () => res(out);
        t.onerror = () => res(out);
      });
    }
  };
})();
