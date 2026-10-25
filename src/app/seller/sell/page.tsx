'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ImagePlus, LoaderCircle, MapPin, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type Analysis = {
  waste_type: string;
  sub_category: string;
  condition: string;
  price_per_kg_range: { min: number; max: number };
  suggested_total_price: number;
  recyclability_note: string;
  hazardous_flag: boolean;
  confidence: number;
};

type ScrapRate = { categoryId: string; category?: { name: string }; itemName: string };

export default function SellListingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rates, setRates] = useState<ScrapRate[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisToken, setAnalysisToken] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [priceEdited, setPriceEdited] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', quantity: '', expectedPrice: '', categoryId: '',
    condition: '', location: '', pickupAddress: '', saleType: 'FIXED',
    reservePrice: '', endsAt: '', pickupSlot: '',
    latitude: '', longitude: '',
  });
  const total = Number(form.quantity) * (analysis
    ? (analysis.price_per_kg_range.min + analysis.price_per_kg_range.max) / 2
    : 0);

  useEffect(() => {
    if (!loading && (!user || (user.role !== 'SELLER' && user.role !== 'ADMIN'))) {
      router.replace('/login?role=seller&redirect=%2Fseller%2Fsell');
    }
  }, [loading, user, router]);

  useEffect(() => {
    fetch('/api/scrap-rates').then((response) => response.json()).then((data) => {
      const items: ScrapRate[] = data.rates || [];
      setRates(items);
      if (items[0]) setForm((current) => ({ ...current, categoryId: items[0].categoryId }));
    }).catch((fetchError) => console.error('Unable to load scrap categories:', fetchError));
    fetch('/api/location').then((response) => response.json()).then((data) => {
      if (data.city) setForm((current) => ({ ...current, location: data.city }));
    }).catch((fetchError) => console.error('Unable to detect pickup city:', fetchError));
    const gpsTimer = window.setTimeout(() => {
      navigator.geolocation?.getCurrentPosition(async ({ coords }) => {
        let area = '';
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`);
          if (response.ok) {
            const data = await response.json();
            area = data.address?.city || data.address?.town || data.address?.suburb || '';
          }
        } catch (fetchError) {
          console.error('Could not reverse-geocode seller location:', fetchError);
        }
        setForm((current) => ({
          ...current,
          ...(area ? { location: area } : {}),
          latitude: String(coords.latitude),
          longitude: String(coords.longitude),
        }));
      }, () => {}, { maximumAge: 60000, timeout: 5000 });
    }, 2500);
    return () => window.clearTimeout(gpsTimer);
  }, []);

  const categories = useMemo(() => Array.from(
    new Map(rates.map((item) => [item.categoryId, { id: item.categoryId, name: item.category?.name || item.itemName }])).values(),
  ), [rates]);

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    const selected = Array.from(files).slice(0, 5 - images.length);
    if (!selected.length) {
      setError('You can add up to 5 photos.');
      return;
    }
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      setError('Photo upload is not configured. Set the Cloudinary public cloud name and unsigned upload preset in .env.local.');
      return;
    }
    if (selected.some((file) => !file.type.startsWith('image/') || file.size > 8 * 1024 * 1024)) {
      setError('Choose image files under 8 MB each.');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await Promise.all(selected.map(async (file) => {
        const body = new FormData();
        body.append('file', file);
        body.append('upload_preset', uploadPreset);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: 'POST', body });
        const result = await response.json();
        if (!response.ok || !result.secure_url) throw new Error(result.error?.message || 'Photo upload failed.');
        return result.secure_url as string;
      }));
      setImages((current) => [...current, ...uploaded].slice(0, 5));
      setAnalysis(null);
      setAnalysisToken('');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function analyzePhotos() {
    setError('');
    setAnalyzing(true);
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: images, weightKg: Number(form.quantity) || 1 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis could not be completed.');
      setAnalysis(data.analysis);
      setAnalysisToken(data.analysisToken);
      const suggestedTotal = Math.round(
        (data.analysis.price_per_kg_range.min + data.analysis.price_per_kg_range.max) / 2 *
        (Number(form.quantity) || 1),
      );
      setForm((current) => ({
        ...current,
        title: current.title || `${data.analysis.waste_type} - ${data.analysis.sub_category}`,
        condition: data.analysis.condition,
        expectedPrice: priceEdited ? current.expectedPrice : String(suggestedTotal),
      }));
      if (data.analysis.hazardous_flag) setError('This appears to be hazardous waste and cannot be listed. Contact your local hazardous-waste authority for safe disposal advice.');
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Analysis could not be completed.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function submitListing(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!images.length || !analysis) return setError('Upload and analyze at least one photo before listing.');
    if (analysis.hazardous_flag) return setError('This hazardous item cannot be listed. Contact your local hazardous-waste authority for safe disposal advice.');
    if (!form.pickupSlot) return setError('Choose a pickup time slot.');
    setSaving(true);
    try {
      const response = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          expectedPrice: Number(form.expectedPrice),
          latitude: form.latitude,
          longitude: form.longitude,
          imageUrls: images,
          aiAnalysis: analysis,
          analysisToken,
          description: form.description,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not publish listing.');
      setNotice('Your listing was submitted for admin review.');
      router.push(`/listings/${data.listing.id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not publish listing.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return <div className="mx-auto p-12 text-emerald-800">Loading seller workspace…</div>;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-semibold text-emerald-700">SELL ON WASTE TO WORTH</p>
        <h1 className="mt-1 text-3xl font-black text-slate-900">Create a scrap listing</h1>
        <p className="mt-2 text-sm text-slate-600">Add photos and we’ll identify the material. AI pricing is an estimate, not a guaranteed offer.</p>
      </div>
      <form onSubmit={submitListing} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <section>
          <h2 className="font-bold text-slate-900">1. Add up to five photos</h2>
          <p className="mt-1 text-xs text-slate-500">Photos are analyzed to suggest the waste type and an indicative price.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {images.map((url, index) => (
              <div className="relative aspect-square overflow-hidden rounded-xl border" key={url}>
                <img className="h-full w-full object-cover" src={url} alt={`Waste photo ${index + 1}`} />
                <button type="button" onClick={() => { setImages(images.filter((image) => image !== url)); setAnalysis(null); }} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white" aria-label="Remove photo"><X size={16} /></button>
              </div>
            ))}
            {images.length < 5 && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-800">
              {uploading ? <LoaderCircle className="animate-spin" /> : <><ImagePlus /><span>Photo / camera</span></>}
              <input className="sr-only" type="file" accept="image/*" capture="environment" multiple onChange={(event) => { void uploadPhotos(event.target.files); event.currentTarget.value = ''; }} />
            </label>}
          </div>
          <button type="button" disabled={!images.length || analyzing || uploading} onClick={analyzePhotos} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {analyzing ? <LoaderCircle className="animate-spin" size={16} /> : <Sparkles size={16} />} Analyze photos
          </button>
        </section>

        {analysis && <section className={`rounded-xl border p-4 ${analysis.hazardous_flag ? 'border-red-300 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <h2 className="font-bold text-slate-900">AI analysis <span className="ml-2 text-xs font-medium text-slate-500">Estimate only</span></h2>
          <p className="mt-2 font-semibold">{analysis.waste_type} · {analysis.sub_category} · {analysis.condition}</p>
          <p className="mt-1 text-sm">Indicative range: ₹{analysis.price_per_kg_range.min}–₹{analysis.price_per_kg_range.max} per kg · Estimated total at current weight: ₹{Math.round(total || analysis.suggested_total_price).toLocaleString('en-IN')}</p>
          <p className="mt-1 text-sm text-slate-600">{analysis.recyclability_note}</p>
          {analysis.hazardous_flag && <p className="mt-2 text-sm font-bold text-red-700">Not allowed: contact your local hazardous-waste authority for safe disposal.</p>}
          <p className="mt-2 text-xs text-slate-500">Confidence: {Math.round(analysis.confidence * 100)}% · Values are estimates and may vary by location and quality.</p>
        </section>}

        <section className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Listing title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
          <label className="text-sm font-semibold">Category<select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Weight (kg)<input required min="0.1" step="0.1" type="number" value={form.quantity} onChange={(event) => {
            const quantity = event.target.value;
            setForm((current) => ({ ...current, quantity, ...(!priceEdited && analysis ? { expectedPrice: String(Math.round(Number(quantity || 0) * (analysis.price_per_kg_range.min + analysis.price_per_kg_range.max) / 2)) } : {}) }));
          }} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />{analysis && form.quantity && <span className="mt-1 block text-xs text-emerald-800">AI estimate at this weight: ₹{Math.round(total).toLocaleString('en-IN')}</span>}</label>
          <label className="text-sm font-semibold">Your asking price (₹ total)<input required min="1" type="number" value={form.expectedPrice} onChange={(event) => { setPriceEdited(true); setForm({ ...form, expectedPrice: event.target.value }); }} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
          <label className="text-sm font-semibold sm:col-span-2">Condition / details<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Nearby city / area
            <span className="mt-1 flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 font-normal"><MapPin size={16} className="text-emerald-700" /><input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="w-full bg-transparent outline-none" /></span>
            <span className="mt-1 block text-xs font-normal text-slate-500">Only this approximate area is shown publicly.</span>
          </label>
          <label className="text-sm font-semibold">Exact pickup address (private)<input required value={form.pickupAddress} onChange={(event) => setForm({ ...form, pickupAddress: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /><span className="mt-1 block text-xs font-normal text-slate-500">Shared with the buyer only after payment.</span></label>
          <label className="text-sm font-semibold">Pickup time slot<select required value={form.pickupSlot} onChange={(event) => setForm({ ...form, pickupSlot: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"><option value="">Choose a slot</option><option>Tomorrow, 9 AM–12 PM</option><option>Tomorrow, 12 PM–4 PM</option><option>Tomorrow, 4 PM–7 PM</option><option>Within 3 days - coordinate later</option></select></label>
          <label className="text-sm font-semibold">Sale type<select value={form.saleType} onChange={(event) => setForm({ ...form, saleType: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"><option value="FIXED">Fixed price</option><option value="AUCTION">Auction</option></select></label>
          {form.saleType === 'AUCTION' && <>
            <label className="text-sm font-semibold">Reserve price (₹)<input min="1" type="number" value={form.reservePrice} onChange={(event) => setForm({ ...form, reservePrice: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
            <label className="text-sm font-semibold">Auction ends<input required type="datetime-local" min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)} value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
          </>}
        </section>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <button type="submit" disabled={saving || !analysis || analysis.hazardous_flag} className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Publishing…' : 'List it now'}</button>
      </form>
    </div>
  );
}
