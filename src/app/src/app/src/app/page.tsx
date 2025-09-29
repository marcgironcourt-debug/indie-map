'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { MapContainerProps } from 'react-leaflet'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })
const useMap = dynamic(() => import('react-leaflet').then(m => m.useMap), { ssr: false }) as unknown as () => any

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function makeIcon(color = '#60a5fa') {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:999px;background:${color};box-shadow:0 0 0 3px rgba(96,165,250,0.25)"></div>`,
    iconAnchor: [7, 7],
  })
}

type Brand = {
  id: string
  name: string
  city: string
  country: string
  coords: [number, number]
  url: string
  category: string
  values: string[]
  blurb: string
}

const ALL_BRANDS: Brand[] = [
  {
    id: 'aporie-mtl',
    name: 'APORIE',
    city: 'Montréal',
    country: 'Canada',
    coords: [45.5019, -73.5674],
    url: 'https://exemple-aporie.test',
    category: 'Streetwear',
    values: ['Upcycling', 'Local'],
    blurb: 'Pièces limitées, coupe brute, production locale.',
  },
  {
    id: 'ligne-noire-paris',
    name: 'Ligne Noire',
    city: 'Paris',
    country: 'France',
    coords: [48.8566, 2.3522],
    url: 'https://exemple-lignenoire.test',
    category: 'Streetwear',
    values: ['Artiste invité'],
    blurb: 'Capsules co-créées avec graffeurs parisiens.',
  },
  {
    id: 'kintsugi-tokyo',
    name: 'Kintsugi Cloth',
    city: 'Tokyo',
    country: 'Japon',
    coords: [35.6762, 139.6503],
    url: 'https://exemple-kintsugi.test',
    category: 'Accessoires',
    values: ['Réparé/visible', 'Upcycling'],
    blurb: 'Accessoires réparés visibles, esthétique kintsugi.',
  },
  {
    id: 'porto-atelier',
    name: 'Atelier Ria',
    city: 'Porto',
    country: 'Portugal',
    coords: [41.1579, -8.6291],
    url: 'https://exemple-atelieria.test',
    category: 'Textiles',
    values: ['Lin', 'Teintures végétales'],
    blurb: 'Textiles en lin, teinture végétale, séries courtes.',
  },
  {
    id: 'berlin-raw',
    name: 'RAW/BLN',
    city: 'Berlin',
    country: 'Allemagne',
    coords: [52.52, 13.405],
    url: 'https://exemple-rawbln.test',
    category: 'Streetwear',
    values: ['Vegan', 'Recyclé'],
    blurb: 'Coupe oversize, matières recyclées, look techno.',
  },
  {
    id: 'bruxelles-argent',
    name: 'Argent Gris',
    city: 'Bruxelles',
    country: 'Belgique',
    coords: [50.8503, 4.3517],
    url: 'https://exemple-argentgris.test',
    category: 'Bijoux',
    values: ['Argent recyclé', 'Local'],
    blurb: 'Bijoux minimalistes en argent recyclé.',
  },
]

const CATEGORIES = ['Toutes', 'Streetwear', 'Bijoux', 'Textiles', 'Accessoires']
const VALUE_TAGS = [
  'Local',
  'Upcycling',
  'Vegan',
  'Recyclé',
  'Artiste invité',
  'Teintures végétales',
  'Argent recyclé',
  'Réparé/visible',
]

function FlyTo({ center }: { center: [number, number] | null }) {
  // @ts-ignore
  const map = useMap()
  useMemo(() => {
    if (!center || !map) return
    map.flyTo(center, 5, { duration: 0.8 })
  }, [center, map])
  return null
}

export default function Page() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Toutes')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [focusCoords, setFocusCoords] = useState<[number, number]>([48.8566, 2.3522])

  const filtered = useMemo(() => {
    return ALL_BRANDS.filter((b) => {
      const q = query.trim().toLowerCase()
      const matchesQuery = !q ? true : [b.name, b.city, b.country, b.blurb].join(' ').toLowerCase().includes(q)
      const matchesCategory = category === 'Toutes' || b.category === category
      const matchesTags = activeTags.length ? activeTags.every((t) => b.values.includes(t)) : true
      return matchesQuery && matchesCategory && matchesTags
    })
  }, [query, category, activeTags])

  const tagToggle = (tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const mapProps: MapContainerProps = {
    center: focusCoords,
    zoom: 4,
    scrollWheelZoom: true,
    style: { height: '100vh', width: '100%' },
  }

  return (
    <div className="app-wrap">
      {/* Sidebar */}
      <aside className="sidebar">
        <h1>Atlas des marques indépendantes</h1>
        <p className="muted">Prototype interactif — découvre des créateurs hors réseaux sociaux.</p>

        <div style={{ marginTop: 14 }}>
          <input
            className="search"
            placeholder="Rechercher (nom, ville, pays)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div>
            <label className="muted">Catégorie</label>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="muted">Résultats</label>
            <div className="select" style={{ display: 'flex', alignItems: 'center' }}>{filtered.length} marques</div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="muted">Valeurs</label>
          <div style={{ marginTop: 6 }}>
            {VALUE_TAGS.map((t) => (
              <button key={t} className={`tag ${activeTags.includes(t) ? 'active' : ''}`} onClick={() => tagToggle(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          {filtered.map((b) => (
            <div className="brand-card" key={b.id}>
              <div className="brand-title">{b.name}</div>
              <div className="brand-meta">{b.city}, {b.country} • {b.category}</div>
              <div style={{ marginTop: 6, fontSize: 13 }}>{b.blurb}</div>
              <a className="cta" href={b.url} target="_blank" rel="noreferrer">Visiter le site →</a>
              <div style={{ marginTop: 6 }}>
                {b.values.map((v) => (
                  <span key={v} className="tag" style={{ cursor: 'default' }}>{v}</span>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <button className="tag" onClick={() => setFocusCoords(b.coords)} title="Centrer sur la carte">
                  Voir sur la carte
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Map */}
      <div>
        {/* @ts-ignore — composants importés dynamiquement côté client */}
        <MapContainer {...mapProps}>
          {/* @ts-ignore */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* @ts-ignore */}
          <FlyTo center={focusCoords as any} />
          {filtered.map((b) => (
            // @ts-ignore
            <Marker key={b.id} position={b.coords} icon={makeIcon('#60a5fa')}>
              {/* @ts-ignore */}
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 700 }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{b.city}, {b.country} • {b.category}</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>{b.blurb}</div>
                  <div style={{ marginTop: 8 }}>
                    {b.values.map((v) => (
                      <span key={v} style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        border: '1px solid #e5e7eb',
                        borderRadius: 999,
                        fontSize: 11,
                        marginRight: 6,
                        marginBottom: 4,
                      }}>{v}</span>
                    ))}
                  </div>
                  <a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>Visiter le site ↗</a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
