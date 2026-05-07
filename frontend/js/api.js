const BASE = '';

async function req(method, url, body) {
  const opts = { method, headers: {} };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + url, opts);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request gagal');
  return data;
}

const api = {
  // Pemain
  getPemain:       ()         => req('GET',    '/api/pemain'),
  getPemainById:   (id)       => req('GET',    `/api/pemain/${id}`),
  createPemain:    (body)     => req('POST',   '/api/pemain', body),
  updatePemain:    (id, body) => req('PUT',    `/api/pemain/${id}`, body),
  deletePemain:    (id)       => req('DELETE', `/api/pemain/${id}`),

  // Karakter
  getKarakter:     (pemainId) => req('GET',    `/api/karakter${pemainId ? '?pemain_id=' + pemainId : ''}`),
  getKarakterById: (id)       => req('GET',    `/api/karakter/${id}`),
  createKarakter:  (fd)       => req('POST',   '/api/karakter', fd),
  updateKarakter:  (id, fd)   => req('PUT',    `/api/karakter/${id}`, fd),
  deleteKarakter:  (id)       => req('DELETE', `/api/karakter/${id}`),

  // Atribut
  getAtribut:      (karId)    => req('GET',    `/api/atribut/${karId}`),
  createAtribut:   (body)     => req('POST',   '/api/atribut', body),
  updateAtribut:   (karId, b) => req('PUT',    `/api/atribut/${karId}`, b),

  // Session (Redis)
  startSession:    (id, force)  => req('POST',   `/api/session/${id}/start`, { force_restart: force }),
  getSession:      (id)         => req('GET',    `/api/session/${id}`),
  getAllSessions:   ()           => req('GET',    '/api/session'),
  endSession:      (id)         => req('DELETE', `/api/session/${id}`),
  updateHP:        (id, amount, type) => req('PATCH', `/api/session/${id}/hp`, { amount, type }),
  updateSpellSlot: (id, level, action, amount) => req('PATCH', `/api/session/${id}/spell-slots`, { level, action, amount }),
  updateCondition: (id, condition, action) => req('PATCH', `/api/session/${id}/conditions`, { condition, action }),
  updateDeathSave: (id, type, action) => req('PATCH', `/api/session/${id}/death-saves`, { type, action }),
  updateMisc:      (id, body)   => req('PATCH', `/api/session/${id}/misc`, body),
};
