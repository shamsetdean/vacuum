export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng requis' });
  const la = parseFloat(lat), lo = parseFloat(lng);

  // Tentative 1 : API v2 avec referer navigateur simulé
  const urls = [
    // v2 avec geofilter natif ODS
    `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?limit=20&geofilter.distance=${la}%2C${lo}%2C5000&select=id%2Cnom%2Cadresse%2Cville%2Ccp%2Cgeom%2Cgazole_prix%2Csp95_prix%2Csp98_prix%2Ce10_prix%2Ce85_prix%2Cgplc_prix%2Choraires_automate_24_24`,
    // v1 legacy
    `https://data.economie.gouv.fr/api/records/1.0/search/?dataset=prix-des-carburants-en-france-flux-instantane-v2&rows=20&geofilter.distance=${la}%2C${lo}%2C5000&fields=id%2Cnom%2Cadresse%2Cville%2Ccoordonnees%2Cgazole_prix%2Csp95_prix%2Csp98_prix%2Ce10_prix%2Ce85_prix%2Cgplc_prix%2Choraires_automate_24_24`,
    // opendatasoft miroir public
    `https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2@economie-gouv/records?limit=20&geofilter.distance=${la}%2C${lo}%2C5000`,
  ];

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; VacuumApp/1.0)',
    'Referer': 'https://www.prix-carburants.gouv.fr/',
    'Origin': 'https://www.prix-carburants.gouv.fr',
  };

  for (const url of urls) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const j = await r.json();

      // Format v2
      if (j.results?.length) {
        const stations = j.results.map(s => ({
          id: s.id, nom: s.nom||'Station', adresse: s.adresse||'', ville: s.ville||'',
          lat: s.geom?.lat, lng: s.geom?.lon,
          automate: s.horaires_automate_24_24==='Oui',
          prix: {
            gazole: s.gazole_prix!=null ? {val:parseFloat(s.gazole_prix)} : null,
            sp95:   s.sp95_prix!=null   ? {val:parseFloat(s.sp95_prix)}   : null,
            sp98:   s.sp98_prix!=null   ? {val:parseFloat(s.sp98_prix)}   : null,
            e10:    s.e10_prix!=null    ? {val:parseFloat(s.e10_prix)}    : null,
            e85:    s.e85_prix!=null    ? {val:parseFloat(s.e85_prix)}    : null,
            gplc:   s.gplc_prix!=null   ? {val:parseFloat(s.gplc_prix)}  : null,
          },
        }));
        return res.status(200).json({ stations, total: stations.length });
      }

      // Format v1
      if (j.records?.length) {
        const stations = j.records.map(rec => {
          const f = rec.fields||{};
          const c = f.coordonnees||[];
          return {
            id: f.id||rec.recordid, nom: f.nom||'Station',
            adresse: f.adresse||'', ville: f.ville||'',
            lat: c[0]||null, lng: c[1]||null,
            automate: f.horaires_automate_24_24==='Oui',
            prix: {
              gazole: f.gazole_prix!=null ? {val:parseFloat(f.gazole_prix)} : null,
              sp95:   f.sp95_prix!=null   ? {val:parseFloat(f.sp95_prix)}   : null,
              sp98:   f.sp98_prix!=null   ? {val:parseFloat(f.sp98_prix)}   : null,
              e10:    f.e10_prix!=null    ? {val:parseFloat(f.e10_prix)}    : null,
              e85:    f.e85_prix!=null    ? {val:parseFloat(f.e85_prix)}    : null,
              gplc:   f.gplc_prix!=null   ? {val:parseFloat(f.gplc_prix)}  : null,
            },
          };
        });
        return res.status(200).json({ stations, total: stations.length });
      }
    } catch(e) { continue; }
  }

  // Toutes les APIs ont échoué → données démo réalistes
  return res.status(200).json({
    demo: true,
    stations: [
      { id:'d1', nom:'Total Energies', adresse:'12 rue de la Paix', ville:'Paris', lat:la+0.003, lng:lo+0.002, automate:true,
        prix:{ gazole:{val:1.718}, sp95:{val:1.878}, sp98:{val:1.968}, e10:{val:1.828}, e85:{val:0.898}, gplc:null }},
      { id:'d2', nom:'BP', adresse:'45 bd Haussmann', ville:'Paris', lat:la-0.004, lng:lo+0.006, automate:false,
        prix:{ gazole:{val:1.698}, sp95:{val:1.858}, sp98:{val:1.948}, e10:{val:1.808}, e85:null, gplc:null }},
      { id:'d3', nom:'Carrefour', adresse:'8 av. République', ville:'Paris', lat:la+0.008, lng:lo-0.004, automate:true,
        prix:{ gazole:{val:1.678}, sp95:{val:1.828}, sp98:{val:1.918}, e10:{val:1.778}, e85:{val:0.868}, gplc:null }},
      { id:'d4', nom:'E.Leclerc', adresse:'22 rue du Commerce', ville:'Paris', lat:la-0.007, lng:lo-0.003, automate:true,
        prix:{ gazole:{val:1.659}, sp95:{val:1.809}, sp98:{val:1.899}, e10:{val:1.759}, e85:{val:0.849}, gplc:{val:0.979} }},
    ],
    total: 4,
  });
}
