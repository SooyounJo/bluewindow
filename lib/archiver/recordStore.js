// Record에서 저장한 창을 브라우저(IndexedDB)에 보관 — 사진·음악 dataURL이 커서 localStorage 대신 사용
const DB = 'spatial-archiver', STORE = 'records';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req && req.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

const FIELDS = ['id', 'savedAt', 'name', 'date', 'memory', 'motion', 'vivid', 'clarity', 'pal', 'photo', 'audio', 'loopA', 'loopZ', 'bpm'];

export function putRecord(pl) {
  const row = {};
  FIELDS.forEach(k => { if (pl[k] !== undefined) row[k] = pl[k]; });
  return run('readwrite', s => s.put(row));
}

// 최신 저장이 앞에 오도록 정렬해서 돌려줌
export async function loadRecords() {
  if (typeof indexedDB === 'undefined') return [];
  const rows = (await run('readonly', s => s.getAll())) || [];
  return rows.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}
