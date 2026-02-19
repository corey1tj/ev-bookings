export default function SitesLoading() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Book EV Charging</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="block animate-pulse rounded-lg border bg-white p-4 shadow-sm"
          >
            <div className="h-5 w-2/3 rounded bg-gray-200" />
            <div className="mt-3 h-4 w-full rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
