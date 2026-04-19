// api/carburants.js · Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lng, rayon = 5 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng requis' });

  try {
    // API v2 — syntaxe correcte pour le filtre géospatial
    const params = new URLSearchParams({
      where: `within_distance(geom, GEOM'POINT(${lng} ${lat})', ${rayon}km)`,
      select: 'id,nom,adresse,ville,cp,geom,gazole_prix,gazole_maj,sp95_prix,sp95_maj,sp98_prix,sp98_maj,e10_prix,e10_maj,e85_prix,e85_maj,gplc_prix,gplc_maj,horaires_automate_24_24',
      order_by: `distance(geom, GEOM'POINT(${lng} ${lat})')`,
      limit: '20',
    });

    const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?${params}`;

    const upstream = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    const text = await upstream.text();
    if (!upstream.ok) return res.status(upstream.status).json({ error: 'API upstream', detail: text.slice(0,200) });

    const data = JSON.parse(text);
    const stations = (data.results || []).map(s => ({
      id: s.id, nom: s.nom || 'Station',
      adresse: s.adresse || '', ville: s.ville || '', cp: s.cp || '',
      lat: s.geom?.lat, lng: s.geom?.lon,
      automate: s.horaires_automate_24_24 === 'Oui',
      prix: {
        gazole: s.gazole_prix ? { val: parseFloat(s.gazole_prix), maj: s.gazole_maj } : null,
        sp95:   s.sp95_prix   ? { val: parseFloat(s.sp95_prix),   maj: s.sp95_maj   } : null,
        sp98:   s.sp98_prix   ? { val: parseFloat(s.sp98_prix),   maj: s.sp98_maj   } : null,
        e10:    s.e10_prix    ? { val: parseFloat(s.e10_prix),    maj: s.e10_maj    } : null,
        e85:    s.e85_prix    ? { val: parseFloat(s.e85_prix),    maj: s.e85_maj    } : null,
        gplc:   s.gplc_prix   ? { val: parseFloat(s.gplc_prix),  maj: s.gplc_maj   } : null,
      },
    }));

    return res.status(200).json({ stations, total: stations.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
