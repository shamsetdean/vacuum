// api/carburants.js · Vercel Serverless Function
// Proxy CORS → data.economie.gouv.fr · Licence Ouverte v2.0

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng requis' });

  const la = parseFloat(lat), lo = parseFloat(lng);
  const SELECT = 'id,nom,adresse,ville,cp,geom,gazole_prix,gazole_maj,sp95_prix,sp95_maj,sp98_prix,sp98_maj,e10_prix,e10_maj,e85_prix,e85_maj,gplc_prix,gplc_maj,horaires_automate_24_24';
  const BASE = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';

  // 3 syntaxes en fallback
  const queries = [
    `distance(geom, geom'POINT(${lo} ${la})', 5km)`,
    `geom_y(geom) >= ${la-0.05} AND geom_y(geom) <= ${la+0.05} AND geom_x(geom) >= ${lo-0.05} AND geom_x(geom) <= ${lo+0.05}`,
    `cp like '${String(Math.round(la)).padStart(2,'0')}%'`,
  ];

  let results = [];
  for (const where of queries) {
    try {
      const p = new URLSearchParams({ where, select: SELECT, limit: '20' });
      const r = await fetch(`${BASE}?${p}`, { headers:{Accept:'application/json'}, signal: AbortSignal.timeout(7000) });
      const j = await r.json();
      if (r.ok && j.results?.length) { results = j.results; break; }
    } catch(e) {}
  }

  const stations = results.map(s => {
    const slat = s.geom?.lat, slng = s.geom?.lon;
    const dx = slat ? (slat-la)*111 : 0, dy = slng ? (slng-lo)*111*Math.cos(la*Math.PI/180) : 0;
    return {
      id: s.id, nom: s.nom||'Station', adresse: s.adresse||'', ville: s.ville||'', cp: s.cp||'',
      lat: slat, lng: slng, dist: Math.sqrt(dx*dx+dy*dy),
      automate: s.horaires_automate_24_24 === 'Oui',
      prix: {
        gazole: s.gazole_prix ? {val:parseFloat(s.gazole_prix),maj:s.gazole_maj} : null,
        sp95:   s.sp95_prix   ? {val:parseFloat(s.sp95_prix),  maj:s.sp95_maj}   : null,
        sp98:   s.sp98_prix   ? {val:parseFloat(s.sp98_prix),  maj:s.sp98_maj}   : null,
        e10:    s.e10_prix    ? {val:parseFloat(s.e10_prix),   maj:s.e10_maj}    : null,
        e85:    s.e85_prix    ? {val:parseFloat(s.e85_prix),   maj:s.e85_maj}    : null,
        gplc:   s.gplc_prix   ? {val:parseFloat(s.gplc_prix),  maj:s.gplc_maj}  : null,
      },
    };
  }).filter(s=>s.dist<6).sort((a,b)=>a.dist-b.dist).slice(0,10);

  return res.status(200).json({ stations, total: stations.length });
}
