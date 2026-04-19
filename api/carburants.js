export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng requis' });
  const la = parseFloat(lat), lo = parseFloat(lng);

  // API v1 (legacy) — syntaxe geofilter.distance fiable
  const url = 'https://data.economie.gouv.fr/api/records/1.0/search/'
    + '?dataset=prix-des-carburants-en-france-flux-instantane-v2'
    + '&rows=20'
    + `&geofilter.distance=${la},${lo},5000`
    + '&fields=id,nom,adresse,ville,cp,coordonnees,gazole_prix,sp95_prix,sp98_prix,e10_prix,e85_prix,gplc_prix,horaires_automate_24_24';

  try {
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    const records = j.records || [];

    const stations = records.map(rec => {
      const f = rec.fields || {};
      const coord = f.coordonnees || [];
      const slat = coord[0] ?? null;
      const slng = coord[1] ?? null;
      const dx = slat ? (slat-la)*111 : 0;
      const dy = slng ? (slng-lo)*111*Math.cos(la*Math.PI/180) : 0;
      return {
        id: f.id || rec.recordid,
        nom: f.nom || 'Station',
        adresse: f.adresse || '',
        ville: f.ville || '',
        lat: slat, lng: slng,
        dist: Math.sqrt(dx*dx+dy*dy),
        automate: f.horaires_automate_24_24 === 'Oui',
        prix: {
          gazole: f.gazole_prix != null ? { val: parseFloat(f.gazole_prix) } : null,
          sp95:   f.sp95_prix   != null ? { val: parseFloat(f.sp95_prix)   } : null,
          sp98:   f.sp98_prix   != null ? { val: parseFloat(f.sp98_prix)   } : null,
          e10:    f.e10_prix    != null ? { val: parseFloat(f.e10_prix)    } : null,
          e85:    f.e85_prix    != null ? { val: parseFloat(f.e85_prix)    } : null,
          gplc:   f.gplc_prix   != null ? { val: parseFloat(f.gplc_prix)  } : null,
        },
      };
    }).sort((a,b) => a.dist - b.dist);

    return res.status(200).json({ stations, total: stations.length });

  } catch(err) {
    return res.status(200).json({ stations:[
      {id:'m1',nom:'Total Energies',adresse:'Démo - API indisponible',ville:'',lat:la,lng:lo,dist:0,automate:true,
       prix:{sp95:{val:1.879},e10:{val:1.829},gazole:{val:1.719},sp98:{val:1.969},e85:null,gplc:null}},
      {id:'m2',nom:'BP Station',adresse:'Démo',ville:'',lat:la+0.005,lng:lo+0.003,dist:0.6,automate:false,
       prix:{sp95:{val:1.849},e10:{val:1.799},gazole:{val:1.699},sp98:{val:1.939},e85:null,gplc:null}},
    ], total:2, demo:true });
  }
}
