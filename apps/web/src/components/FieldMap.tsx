import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { GrazingStatus } from '../types';

export interface MapField {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  grazing: { status: GrazingStatus; days: number | null; groups: string[] };
}

function ClickToPick({ onPick }: { onPick?: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Fits the view to the pinned fields once they're known. */
function FitToFields({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    const pts = JSON.parse(key) as Array<[number, number]>;
    if (pts.length >= 2) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
  }, [map, key]);
  return null;
}

/** OpenStreetMap with a marker per pinned field, labelled with its name. */
export function FieldMap({
  center,
  fields,
  onPick,
}: {
  center: { latitude: number; longitude: number };
  fields: MapField[];
  onPick?: (latitude: number, longitude: number) => void;
}) {
  const pinned = fields.filter(
    (f): f is MapField & { latitude: number; longitude: number } =>
      f.latitude !== null && f.longitude !== null,
  );
  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={14}
      className="map"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToFields points={pinned.map((f) => [f.latitude, f.longitude])} />
      <ClickToPick onPick={onPick} />
      {pinned.map((f) => (
        <CircleMarker
          key={f.id}
          center={[f.latitude, f.longitude]}
          radius={11}
          // Colours come from the stylesheet (SVG attributes can't read CSS variables).
          pathOptions={{
            className: `map-marker map-marker--${f.grazing.status.toLowerCase()}`,
            weight: 2,
            fillOpacity: 1,
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]} className="map-label">
            {f.name}
          </Tooltip>
          <Popup>
            <strong>{f.name}</strong>
            <br />
            {f.grazing.status === 'GRAZED'
              ? `${f.grazing.groups.join(', ')} · ${f.grazing.days ?? '?'} days in`
              : f.grazing.status === 'RESTING'
                ? `Resting${f.grazing.days !== null ? ` · ${f.grazing.days} days` : ''}`
                : 'Not used yet'}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
