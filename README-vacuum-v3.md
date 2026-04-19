# Vacuum · v3 · Déploiement

## Structure du projet

```
vacuum/
├── index.html          ← frontend (GitHub Pages)
├── api/
│   └── carburants.js   ← Vercel Function (proxy CORS)
├── vercel.json         ← config Vercel
└── README.md
```

---

## Étape 1 · Déployer la Vercel Function (5 min)

```bash
# Installer Vercel CLI
npm i -g vercel

# Dans le dossier du projet
vercel

# Suivre les prompts :
# - Set up and deploy? Y
# - Which scope? ton compte
# - Link to existing project? N
# - Project name: vacuum
# - Directory: ./
# - Override settings? N
```

Après déploiement, Vercel te donne une URL :
`https://vacuum-xxx.vercel.app`

---

## Étape 2 · Mettre à jour l'URL dans index.html

Ouvrir `index.html`, ligne ~180 :

```js
const API_BASE = 'https://TON_PROJET.vercel.app';
```

Remplacer par ton URL Vercel réelle.

---

## Étape 3 · Déployer sur GitHub Pages

```bash
git init
git add .
git commit -m "Vacuum v3"
git remote add origin https://github.com/TON_USER/vacuum.git
git push -u origin main
```

GitHub → Settings → Pages → Source: `main` / `root`

URL finale : `https://TON_USER.github.io/vacuum/`

---

## Gamification · Barème des points

| Action | Points |
|--------|--------|
| Signal fort | +3 pts |
| Signal faible | +1 pt |
| Signal implicite (clic carte) | +0.5 pt |
| Streak × 3 signaux d'affilée | ×1.5 multiplier |
| Spam détecté | -5 pts |

## Rayon de vision

```
rayon = floor( log2(1 + points) × 2 )
```

| Points | Rayon | Zones visibles |
|--------|-------|---------------|
| 0      | 0     | Carte bloquée |
| 3      | 3     | ~3 cellules   |
| 10     | 6     | ~6 cellules   |
| 20     | 9     | ~9 cellules   |
| 50+    | 12    | Large zone    |

## Données carburants

Source : `data.economie.gouv.fr` · Licence Ouverte v2.0
Mise à jour : toutes les 10 minutes
Carburants : Gazole, SP95, SP98, E10, E85, GPLc
