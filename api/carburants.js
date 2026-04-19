export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng requis' });
  const la = parseFloat(lat), lo = parseFloat(lng);
  const d = 0.045;
  const where = `geom_y(geom)>=${la-d} AND geom_y(geom)<=${la+d} AND geom_x(geom)>=${lo-d} AND geom_x(geom)<=${lo+d}`;
  const select = 'id,nom,adresse,ville,cp,geom,gazole_prix,sp95_prix,sp98_prix,e10_prix,e85_prix,gplc_prix,horaires_automate_24_24';
  const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?select=${encodeURIComponent(select)}&where=${encodeURIComponent(where)}&limit=20`;
  try {
    const r = await fetch(url, { headers:{'Accept':'application/json'}, signal:AbortSignal.timeout(8000) });
    const j = await r.json();
    const stations = (j.results||[]).map(s => ({
      id:s.id, nom:s.nom||'Station', adresse:s.adresse||'', ville:s.ville||'',
      lat:s.geom?.lat, lng:s.geom?.lon, automate:s.horaires_automate_24_24==='Oui',
      prix:{
        gazole:s.gazole_prix!=null?{val:parseFloat(s.gazole_prix)}:null,
        sp95:s.sp95_prix!=null?{val:parseFloat(s.sp95_prix)}:null,
        sp98:s.sp98_prix!=null?{val:parseFloat(s.sp98_prix)}:null,
        e10:s.e10_prix!=null?{val:parseFloat(s.e10_prix)}:null,
        e85:s.e85_prix!=null?{val:parseFloat(s.e85_prix)}:null,
        gplc:s.gplc_prix!=null?{val:parseFloat(s.gplc_prix)}:null,
      },
    }));
    return res.status(200).json({ stations, total:stations.length });
  } catch(err) {
    return res.status(200).json({ stations:[
      {id:'m1',nom:'Total Energies',adresse:'Démo',ville:'Paris',lat:la,lng:lo,automate:true,prix:{sp95:{val:1.879},e10:{val:1.829},gazole:{val:1.719},sp98:{val:1.969},e85:null,gplc:null}},
      {id:'m2',nom:'BP Station',adresse:'Démo',ville:'Paris',lat:la+0.005,lng:lo+0.003,automate:false,prix:{sp95:{val:1.849},e10:{val:1.799},gazole:{val:1.699},sp98:{val:1.939},e85:null,gplc:null}},
    ], total:2, demo:true });
  }
}
