export default function PrivacyPage() {
  return <main className="mx-auto w-full max-w-3xl px-4 py-12">
    <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Your information</p><h1 className="mt-2 text-3xl font-black">Privacy policy</h1>
    <section className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
      <p>Waste to Worth uses account details to provide marketplace access, verify accounts, process orders, and support safety reports. Authentication secrets are kept on the server.</p>
      <h2 className="text-lg font-bold text-slate-900">Location use</h2>
      <p>We first use city-level location provided by the hosting platform or an IP-geolocation provider. After a short delay, the browser may ask permission for GPS to calculate distances and improve nearby results. If permission is denied, the IP-based city remains in use. We do not show exact seller addresses publicly; pickup addresses are shared with the buyer only after payment authorization.</p>
      <p>Listing photographs may be uploaded to Cloudinary and sent to the configured AI provider for material identification. Do not upload faces, documents, or private information in listing photos.</p>
      <p>Payments are processed by the configured payment provider in test/live mode. We do not store card numbers. If WasteBot cannot answer a question, the question text may be stored for the administrator to review. Contact the platform administrator to request account or data assistance.</p>
    </section>
  </main>;
}
