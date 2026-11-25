export default function Loading() {
  return (
    <div aria-busy="true" aria-label="جارٍ التحميل" className="space-y-4">
      <div className="skeleton h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}
      </div>
      <div className="skeleton h-64" />
      <div className="skeleton h-40" />
    </div>
  );
}
