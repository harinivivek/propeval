export function BrandPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-center px-16 py-12">
      <div className="max-w-md">
        <div className="w-12 h-1 bg-blue-500 mb-8" />
        <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
          PropEval
        </h1>
        <p className="text-xl text-slate-300 mb-6 font-medium">
          Property Valuation &amp; Legal Reports Marketplace
        </p>
        <p className="text-slate-400 text-base leading-relaxed">
          The B2B platform connecting lenders with trusted property valuers and
          legal experts — faster turnarounds, transparent workflows, and
          compliance built in.
        </p>
        <div className="mt-12 space-y-4">
          {[
            "Instant lender–vendor matching",
            "End-to-end report tracking",
            "Role-based access for every team",
          ].map((feature) => (
            <div key={feature} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="text-slate-300 text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
