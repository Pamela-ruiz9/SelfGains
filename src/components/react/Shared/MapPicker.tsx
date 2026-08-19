import { useEffect, useRef, useState } from 'react';
import type * as LeafletTypes from 'leaflet';

type Leaflet = typeof LeafletTypes;

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

interface MapPickerProps {
  center: [number, number];
  zoom?: number;
  draggableMarker?: [number, number] | null;
  onDraggableMarkerMove?: (lat: number, lng: number) => void;
  markers?: MapMarker[];
  onMarkerClick?: (id: string) => void;
  onMapMove?: (lat: number, lng: number) => void;
  height?: number;
}

function makePinIcon(L: Leaflet) {
  return L.divIcon({
    className: '',
    html: '<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:var(--color-acid);border:2px solid var(--color-ink);transform:rotate(-45deg);"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 20],
  });
}

export default function MapPicker({
  center,
  zoom = 12,
  draggableMarker = null,
  onDraggableMarkerMove,
  markers = [],
  onMarkerClick,
  onMapMove,
  height = 300,
}: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const draggableMarkerRef = useRef<LeafletTypes.Marker | null>(null);
  const markerLayerRef = useRef<LeafletTypes.LayerGroup | null>(null);
  // Se pone en true recién cuando el mapa/tile layer/marker layer terminaron
  // de crearse (después del import dinámico) — los efectos de marcadores de
  // abajo esperan a esto en vez de intentar crear el marcador inicial ellos
  // mismos dentro del .then() de montaje, que usaría un closure de props
  // potencialmente obsoleto si `draggableMarker`/`markers` cambian mientras
  // Leaflet todavía se está cargando.
  const [ready, setReady] = useState(false);

  // Import dinámico: Leaflet toca `window`/`document` al cargarse, y Astro
  // pre-renderiza este componente en el servidor durante `astro build` antes
  // de hidratarlo (`client:load`) — un `import` estático de 'leaflet' arriba
  // del archivo rompería el build con "window is not defined". El CSS se
  // importa acá adentro por el mismo motivo.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([mod]) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const L = mod.default;
      leafletRef.current = L;

      const map = L.map(containerRef.current).setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      markerLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      if (onMapMove) {
        map.on('moveend', () => {
          const c = map.getCenter();
          onMapMove(c.lat, c.lng);
        });
      }

      setReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      draggableMarkerRef.current = null;
      markerLayerRef.current = null;
    };
    // Se monta una sola vez: Leaflet no está pensado para recrear el mapa en
    // cada render — los cambios de props se sincronizan en los efectos de
    // abajo, sobre el mapa ya creado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Responsable de todo el ciclo de vida del pin arrastrable: lo crea la
  // primera vez que `ready` es true y hay un `draggableMarker`, y lo mueve
  // en renders siguientes — nunca se crea desde el efecto de montaje de
  // arriba, así siempre lee el valor más reciente de la prop.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !draggableMarker) return;
    if (!draggableMarkerRef.current) {
      const marker = L.marker(draggableMarker, { icon: makePinIcon(L), draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onDraggableMarkerMove?.(pos.lat, pos.lng);
      });
      draggableMarkerRef.current = marker;
    } else {
      draggableMarkerRef.current.setLatLng(draggableMarker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, draggableMarker]);

  // Mismo motivo que el efecto de arriba: responsable de todos los
  // marcadores de solo lectura, gateado por `ready` para no depender del
  // closure del efecto de montaje.
  useEffect(() => {
    const L = leafletRef.current;
    const layer = markerLayerRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], { icon: makePinIcon(L) }).bindTooltip(m.label);
      if (onMarkerClick) marker.on('click', () => onMarkerClick(m.id));
      marker.addTo(layer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = map.getCenter();
    // Sin este chequeo, un center que llega desde el propio onMapMove del
    // mapa (el usuario paneó) dispara un setView redundante, que Leaflet
    // vuelve a resolver como un nuevo moveend — duplicando el fetch de
    // entrenadores cercanos en Connections.tsx por cada pan.
    const EPSILON = 1e-6;
    if (Math.abs(current.lat - center[0]) < EPSILON && Math.abs(current.lng - center[1]) < EPSILON) return;
    map.setView(center, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);

  return <div ref={containerRef} style={{ height, width: '100%' }} className="border-2 border-paper-dim/40" />;
}
