'use client';

import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';

type MapListing = {
  id: string;
  title: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  expectedPrice: number | null;
  currentBid?: number;
};

const markerIcon = L.divIcon({
  className: 'listing-map-marker',
  html: '<span></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function ListingsMap({
  listings,
  position,
}: {
  listings: MapListing[];
  position: { latitude: number; longitude: number } | null;
}) {
  const located = listings.flatMap((listing) => {
    const { latitude, longitude } = listing;
    if (latitude == null || longitude == null) return [];
    const position: [number, number] = [latitude, longitude];
    return [{ listing, position }];
  });
  const first = located[0];
  const center: [number, number] = position
    ? [position.latitude, position.longitude]
    : first
      ? first.position
      : [20.5937, 78.9629];
  return <MapContainer center={center} zoom={position || first ? 10 : 5} scrollWheelZoom className="h-[460px] w-full rounded-2xl">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {position && <Marker position={[position.latitude, position.longitude]} icon={markerIcon}><Popup>Your approximate location</Popup></Marker>}
    {located.map(({ listing, position: listingPosition }) => <Marker key={listing.id} position={listingPosition} icon={markerIcon}>
      <Popup><Link href={`/listings/${listing.id}`} className="font-bold text-emerald-800">{listing.title}</Link><br />{listing.location}<br />₹{(listing.currentBid ?? listing.expectedPrice ?? 0).toLocaleString('en-IN')}</Popup>
    </Marker>)}
  </MapContainer>;
}
