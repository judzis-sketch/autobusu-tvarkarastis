import type { TimetableEntry } from './types';
import type { Map, Marker, LatLngBounds, LatLngTuple, Polyline } from 'leaflet';

type Leaflet = typeof import('leaflet');
type StopWithCoords = TimetableEntry & { coords: [number, number] };

export class MapController {
  private map: Map | null = null;
  private L: Leaflet;
  private markers: Marker[] = [];
  private routeLine: Polyline | null = null;
  private defaultCenter: LatLngTuple = [54.6872, 25.2797]; // Vilnius center
  private defaultZoom = 12;

  constructor(containerId: string, leaflet: Leaflet) {
    this.L = leaflet;
    const container = document.getElementById(containerId);
    if (container && !(container as any)._leaflet_id) {
      this.map = this.L.map(containerId).setView(this.defaultCenter, this.defaultZoom);

      this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(this.map);
    }
  }

  private clearMarkers() {
    this.markers.forEach(marker => marker.remove());
    this.markers = [];
  }

  private clearRouteLine() {
    if (this.routeLine) {
      this.routeLine.remove();
      this.routeLine = null;
    }
  }

  public updateStops(stops: StopWithCoords[]) {
    if (!this.map) return;
    this.clearMarkers();
    this.clearRouteLine();

    if (stops.length === 0) {
      this.map.setView(this.defaultCenter, this.defaultZoom);
      return;
    }
    
    const latLngs = stops.map(s => s.coords);

    stops.forEach(stop => {
      const popupContent = `
        <div class="font-bold font-headline">${stop.stop}</div>
        <div class="text-sm text-muted-foreground flex items-center gap-2 mt-1">
          ${(stop.times || []).join(', ')}
        </div>
      `;
      const marker = this.L.marker(stop.coords).addTo(this.map!).bindPopup(popupContent);
      this.markers.push(marker);
    });
    
    if (latLngs.length > 1) {
      this.routeLine = this.L.polyline(latLngs, { color: 'hsl(var(--primary))', weight: 4 }).addTo(this.map);
    }

    const bounds = this.L.latLngBounds(latLngs);
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  public destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
