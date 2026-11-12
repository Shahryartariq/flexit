export function FeedSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="card overflow-hidden">
          <div className="skeleton aspect-[4/5]" />
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2.5">
              <span className="skeleton size-8 rounded-full" />
              <span className="skeleton h-3 w-28 rounded" />
            </div>
            <span className="skeleton h-4 w-3/4 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}
