import { useEffect, useRef } from 'react';
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
    html: '<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:#d7ff3f;border:2px solid #0c0c0a;transform:rotate(-45deg);"></div>',
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

      if (draggableMarker) {
        const marker = L.marker(draggableMarker, { icon: makePinIcon(L), draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onDraggableMarkerMove?.(pos.lat, pos.lng);
        });
        draggableMarkerRef.current = marker;
      }

      for (const m of markers) {
        const marker = L.marker([m.lat, m.lng], { icon: makePinIcon(L) }).bindTooltip(m.label);
        if (onMarkerClick) marker.on('click', () => onMarkerClick(m.id));
        marker.addTo(markerLayerRef.current!);
      }

      if (onMapMove) {
        map.on('moveend', () => {
          const c = map.getCenter();
          onMapMove(c.lat, c.lng);
        });
      }
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

  useEffect(() => {
    if (draggableMarkerRef.current && draggableMarker) {
      draggableMarkerRef.current.setLatLng(draggableMarker);
    }
  }, [draggableMarker]);

  useEffect(() => {
    const L = leafletRef.current;
    const layer = markerLayerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();
    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], { icon: makePinIcon(L) }).bindTooltip(m.label);
      if (onMarkerClick) marker.on('click', () => onMarkerClick(m.id));
      marker.addTo(layer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  useEffect(() => {
    mapRef.current?.setView(center, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);

  return <div ref={containerRef} style={{ height, width: '100%' }} className="border-2 border-paper-dim/40" />;
}
