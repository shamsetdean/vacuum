// api/bornes.js · Vercel Serverless Function — IRVE data.gouv.fr
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lng, rayon = 3 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng requis' });

  try {
    const params = new URLSearchParams({
      where: `within_distance(coordonneesXY, GEOM'POINT(${lng} ${lat})', ${rayon}km)`,
      select: 'id_station_itinerance,nom_station,adresse_station,coordonneesXY,nbre_pdc,puissance_nominale,prise_type_combo_ccs,prise_type_chademo,prise_type_ef,prise_type_2,nom_operateur,nom_enseigne,tarification,gratuit,paiement_cb',
      order_by: `distance(coordonneesXY, GEOM'POINT(${lng} ${lat})')`,
      limit: '15',
    });

    const url = `https://data.gouv.fr/api/explore/v2.1/catalog/datasets/consolidation-etalab-schema-irve-statique-v-2-3-0-20230615/records?${params}`;

    const upstream = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    const text = await upstream.text();
    if (!upstream.ok) return res.status(upstream.status).json({ error: 'API IRVE', detail: text.slice(0,200) });

    const data = JSON.parse(text);
    const bornes = (data.results || []).map(s => {
      const coord = s.coordonneesXY;
      const types = [];
      if (s.prise_type_combo_ccs) types.push('CCS');
      if (s.prise_type_chademo)   types.push('CHAdeMO');
      if (s.prise_type_2)         types.push('Type 2');
      if (s.prise_type_ef)        types.push('EF');
      const puissance = parseFloat(s.puissance_nominale) || 0;
      return {
        id:          s.id_station_itinerance || Math.random().toString(36).slice(2),
        nom:         s.nom_station || s.nom_enseigne || 'Borne',
        adresse:     s.adresse_station || '',
        lat:         coord?.lat ?? coord?.[1],
        lng:         coord?.lon ?? coord?.[0],
        nbre_pdc:    s.nbre_pdc || 1,
        puissance,
        type_charge: puissance >= 50 ? 'DC Rapide' : puissance >= 22 ? 'AC Semi-rapide' : 'AC Lente',
        types_prise: types,
        operateur:   s.nom_operateur || s.nom_enseigne || 'Inconnu',
        gratuit:     s.gratuit === true || s.gratuit === 'true',
        tarif:       s.tarification || null,
        paiement_cb: s.paiement_cb === true || s.paiement_cb === 'true',
      };
    });

    return res.status(200).json({ bornes, total: bornes.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
