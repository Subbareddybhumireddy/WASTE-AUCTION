export default function ProhibitedItemsPage() {
  return <main className="mx-auto w-full max-w-3xl px-4 py-12">
    <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Marketplace safety</p>
    <h1 className="mt-2 text-3xl font-black">Prohibited items</h1>
    <p className="mt-4 text-slate-600">These materials must not be listed, sold, transported, or handled through Waste to Worth:</p>
    <ul className="mt-5 list-disc space-y-2 pl-6 text-slate-700">
      <li>Medical, clinical, infectious, or sharps waste</li><li>Unknown or hazardous chemicals, pesticides, and solvents</li>
      <li>Radioactive materials and contaminated equipment</li><li>Asbestos-containing materials</li>
      <li>Pressurized, explosive, or otherwise dangerous waste</li>
    </ul>
    <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <h2 className="font-bold">Safe disposal</h2>
      <p className="mt-2">Do not put hazardous materials in household recycling or handle unknown substances. Keep people away and contact your local municipal hazardous-waste program or licensed waste operator for approved collection and disposal instructions. For immediate danger, contact local emergency services.</p>
    </div>
  </main>;
}
