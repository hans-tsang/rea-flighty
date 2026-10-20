import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { greatCirclePoints, distanceKm } from '../domain/geo';
import type { Airport } from '../domain/types';
import { useTheme } from './theme';

const WIDTH = 340;
const HEIGHT = 190;
const PAD = 28;

/**
 * Schematic great-circle route (equirectangular projection, no basemap tiles).
 * Works offline and in Expo Go / web without map API keys. A real basemap
 * (Apple Maps via react-native-maps or MapLibre) is a later phase.
 */
export function RouteMap({ from, to, progress }: { from: Airport; to: Airport; progress: number | null }) {
  const t = useTheme();
  const pts = greatCirclePoints(from, to);
  const lats = pts.map((p) => p.latitude);
  const lons = pts.map((p) => p.longitude);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLon = Math.min(...lons);
  let maxLon = Math.max(...lons);
  // Keep a sensible minimum extent and preserve aspect ratio.
  const spanLon = Math.max(maxLon - minLon, 10);
  const spanLat = Math.max(maxLat - minLat, 6);
  const scale = Math.min((WIDTH - 2 * PAD) / spanLon, (HEIGHT - 2 * PAD) / spanLat);
  const cx = (minLon + maxLon) / 2;
  const cy = (minLat + maxLat) / 2;
  minLon = cx - (WIDTH / 2) / scale;
  maxLon = cx + (WIDTH / 2) / scale;
  minLat = cy - (HEIGHT / 2) / scale;
  maxLat = cy + (HEIGHT / 2) / scale;
  const project = (lat: number, lon: number) => ({
    x: (lon - minLon) * scale,
    y: (maxLat - lat) * scale,
  });
  const path = pts.map((p) => project(p.latitude, p.longitude));
  const a = path[0];
  const b = path[path.length - 1];

  const gridStep = spanLon > 120 ? 30 : spanLon > 40 ? 15 : 5;
  const gridLons: number[] = [];
  for (let lon = Math.ceil(minLon / gridStep) * gridStep; lon <= maxLon; lon += gridStep) gridLons.push(lon);
  const gridLats: number[] = [];
  for (let lat = Math.ceil(minLat / gridStep) * gridStep; lat <= maxLat; lat += gridStep) gridLats.push(lat);

  const plane = progress !== null && progress > 0 && progress < 1 ? path[Math.round(progress * (path.length - 1))] : null;
  const km = Math.round(distanceKm(from, to));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Route map from ${from.city} to ${to.city}, great-circle distance about ${km.toLocaleString()} kilometres${
        plane ? `, about ${Math.round((progress ?? 0) * 100)} percent complete` : ''
      }.`}
    >
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {gridLons.map((lon) => {
          const x = project(0, lon).x;
          return <Line key={`lon${lon}`} x1={x} y1={0} x2={x} y2={HEIGHT} stroke={t.colors.border} strokeWidth={0.5} />;
        })}
        {gridLats.map((lat) => {
          const y = project(lat, 0).y;
          return <Line key={`lat${lat}`} x1={0} y1={y} x2={WIDTH} y2={y} stroke={t.colors.border} strokeWidth={0.5} />;
        })}
        <Polyline
          points={path.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={t.colors.accent}
          strokeWidth={2.5}
          strokeDasharray={progress === null ? '6,4' : undefined}
        />
        <Circle cx={a.x} cy={a.y} r={5} fill={t.colors.accent} />
        <Circle cx={b.x} cy={b.y} r={5} fill={t.colors.accent} />
        <SvgText x={a.x} y={a.y - 10} fill={t.colors.text} fontSize={13} fontWeight="bold" textAnchor="middle">
          {from.iata}
        </SvgText>
        <SvgText x={b.x} y={b.y - 10} fill={t.colors.text} fontSize={13} fontWeight="bold" textAnchor="middle">
          {to.iata}
        </SvgText>
        {plane ? <Circle cx={plane.x} cy={plane.y} r={6} fill={t.colors.warning} stroke={t.colors.card} strokeWidth={2} /> : null}
      </Svg>
      <Text style={[styles.caption, { color: t.colors.textMuted }]}>
        Schematic great-circle route · {km.toLocaleString()} km
        {plane ? ' · position estimated from times, not tracked' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 12, marginTop: 4, textAlign: 'center' },
});
