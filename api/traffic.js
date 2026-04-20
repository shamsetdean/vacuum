// api/traffic.js · Vercel Serverless Function
// La clé TomTom reste côté serveur, jamais exposée au navigateur

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=90'); // cache 90s
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng requis' });

  // Clé lue depuis variable d'environnement Vercel (jamais dans le code)
  const key = process.env.TOMTOM_API_KEY;
  if (!key) return res.status(500).json({ error: 'Clé non configurée' });

  try {
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/14/json?point=${lat},${lng}&key=${key}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error('TomTom ' + r.status);
    const data = await r.json();
    const seg = data.flowSegmentData;
    if (!seg) throw new Error('Pas de données');

    const ratio  = seg.currentSpeed / seg.freeFlowSpeed;
    const status = ratio > 0.75 ? 'ok' : ratio > 0.4 ? 'warn' : 'bad';
    const delay  = Math.max(0, Math.round((1 / ratio - 1) * 5));

    return res.status(200).json({
      status,
      currentSpeed: Math.round(seg.currentSpeed),
      freeFlowSpeed: Math.round(seg.freeFlowSpeed),
      delay,
      ratio: +ratio.toFixed(2),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
