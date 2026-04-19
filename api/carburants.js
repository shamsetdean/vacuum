// api/carburants.js · Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng requis' });

  const la = parseFloat(lat);
  const lo = parseFloat(lng);

  // Bounding box ±0.045° ≈ 5km — pas de filtre géo complexe
  const latMin = (la - 0.045).toFixed(6);
  const latMax = (la + 0.045).toFixed(6);
  const lngMin = (lo - 0.045).toFixed(6);
  const lngMax = (lo + 0.045).toFixed(6);

  const base = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';
  const select = 'id,nom,adresse,ville,cp,geom,gazole_prix,sp95_prix,sp98_prix,e10_prix,e85_prix,gplc_prix,horaires_automate_24_24';

  // Construction manuelle de l'URL — sans new URL() pour éviter le bug
  const qs = [
    `select=${encodeURIComponent(select)}`,
    `where=${encodeURIComponent(`geom_y(geom)>=${latMin} AND geom_y(geom)<=${latMax} AND geom_x(geom)>=${lngMin} AND geom_x(geom)<=${lngMax}`)}`,
    `limit=30`,
  ].join('&');

  const fullUrl = `${base}?${qs}`;

  try {
    const r = await fetch(fullUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    const j = await r.json();
    const raw = Array.isArray(j.results) ? j.results : [];

    const stations = raw.map(s => {
      const slat = s.geom?.lat ?? null;
      const slng = s.geom?.lon ?? null;
      const dx = slat ? (slat - la) * 111 : 0;
      const dy = slng ? (slng - lo) * 111 * Math.cos(la * Math.PI / 180) : 0;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return {
        id: s.id,
        nom: s.nom || 'Station',
        adresse: s.adresse || '',
        ville: s.ville || '',
        lat: slat, lng: slng, dist,
        automate: s.horaires_automate_24_24 === 'Oui',
        prix: {
          gazole: s.gazole_prix != null ? { val: parseFloat(s.gazole_prix) } : null,
          sp95:   s.sp95_prix   != null ? { val: parseFloat(s.sp95_prix)   } : null,
          sp98:   s.sp98_prix   != null ? { val: parseFloat(s.sp98_prix)   } : null,
          e10:    s.e10_prix    != null ? { val: parseFloat(s.e10_prix)    } : null,
          e85:    s.e85_prix    != null ? { val: parseFloat(s.e85_prix)    } : null,
          gplc:   s.gplc_prix   != null ? { val: parseFloat(s.gplc_prix)  } : null,
        },
      };
    })
    .filter(s => s.dist < 6)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 10);

    return res.status(200).json({ stations, total: stations.length });

  } catch (err) {
    // Fallback : données démo si API indisponible
    return res.status(200).json({
      stations: mockStations(la, lo),
      total: 3,
      demo: true,
    });
  }
}

function mockStations(la, lo) {
  return [
    { id:'m1', nom:'Total Energies', adresse:'12 rue de la Paix', ville:'Paris', lat:la+0.005, lng:lo+0.003, dist:0.6, automate:true,
      prix:{ sp95:{val:1.879}, sp98:{val:1.969}, e10:{val:1.829}, gazole:{val:1.719}, e85:{val:0.899}, gplc:null }},
    { id:'m2', nom:'BP Station', adresse:'45 bd Haussmann', ville:'Paris', lat:la-0.006, lng:lo+0.008, dist:0.9, automate:false,
      prix:{ sp95:{val:1.859}, sp98:{val:1.949}, e10:{val:1.809}, gazole:{val:1.699}, e85:null, gplc:null }},
    { id:'m3', nom:'Carrefour', adresse:'8 av. République', ville:'Paris', lat:la+0.010, lng:lo-0.005, dist:1.2, automate:true,
      prix:{ sp95:{val:1.829}, sp98:{val:1.919}, e10:{val:1.779}, gazole:{val:1.679}, e85:{val:0.869}, gplc:null }},
  ];
}
