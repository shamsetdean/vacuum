// api/bornes.js · Vercel Serverless Function
// Proxy CORS → IRVE (Infrastructure de Recharge Véhicules Électriques)
// Source : data.gouv.fr · Licence Ouverte v2.0

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300'); // cache 5min

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lng, rayon = 3 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng requis' });

  try {
    // API IRVE consolidée - data.gouv.fr
    const url = new URL(
      'https://data.gouv.fr/api/explore/v2.1/catalog/datasets/consolidation-etalab-schema-irve-statique-v-2-3-0-20230615/records'
    );
    url.searchParams.set('where', `distance(coordonneesXY, geom'POINT(${lng} ${lat})', ${rayon}km)`);
    url.searchParams.set('select', [
      'id_station_itinerance',
      'nom_station',
      'adresse_station',
      'coordonneesXY',
      'nbre_pdc',
      'puissance_nominale',
      'prise_type_combo_ccs',
      'prise_type_chademo',
      'prise_type_ef',
      'prise_type_2',
      'nom_operateur',
      'nom_enseigne',
      'tarification',
      'gratuit',
      'paiement_cb',
      'station_deux_roues',
    ].join(','));
    url.searchParams.set('order_by', `dist(coordonneesXY, geom'POINT(${lng} ${lat})')`);
    url.searchParams.set('limit', '15');

    const upstream = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) throw new Error('API IRVE ' + upstream.status);
    const data = await upstream.json();

    const bornes = (data.results || []).map(s => {
      const coord = s.coordonneesXY;
      // Détecter types de prises
      const types = [];
      if (s.prise_type_combo_ccs) types.push('CCS');
      if (s.prise_type_chademo)   types.push('CHAdeMO');
      if (s.prise_type_2)         types.push('Type 2');
      if (s.prise_type_ef)        types.push('EF');

      // Détecter AC/DC
      const puissance = parseFloat(s.puissance_nominale) || 0;
      const typeCharge = puissance >= 50 ? 'DC Rapide' : puissance >= 22 ? 'AC Semi-rapide' : 'AC Lente';

      return {
        id:          s.id_station_itinerance || Math.random().toString(36).slice(2),
        nom:         s.nom_station || s.nom_enseigne || 'Borne',
        adresse:     s.adresse_station || '',
        lat:         coord?.lat || coord?.[1],
        lng:         coord?.lon || coord?.[0],
        nbre_pdc:    s.nbre_pdc || 1,
        puissance:   puissance,
        type_charge: typeCharge,
        types_prise: types,
        operateur:   s.nom_operateur || s.nom_enseigne || 'Inconnu',
        gratuit:     s.gratuit === true || s.gratuit === 'true',
        tarif:       s.tarification || null,
        paiement_cb: s.paiement_cb === true || s.paiement_cb === 'true',
        deux_roues:  s.station_deux_roues === true,
      };
    });

    return res.status(200).json({
      bornes,
      total: bornes.length,
      source: 'data.gouv.fr IRVE · Licence Ouverte v2.0',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
