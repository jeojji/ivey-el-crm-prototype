// Lists, in plain words, what a deletion does to linked records. Items with a zero count are hidden.
export function LinkedImpact({ intro, items }: { intro: string; items: [count: number, text: string][] }) {
  const shown = items.filter(([n]) => n > 0);
  return (
    <div className="space-y-2">
      <p>{intro}</p>
      {shown.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5">
          {shown.map(([, text]) => <li key={text}>{text}</li>)}
        </ul>
      ) : (
        <p className="text-neutral-600">Nothing else is linked to it.</p>
      )}
      <p className="text-neutral-600">This can't be undone. Download a backup from Import &amp; export first if you might need it.</p>
    </div>
  );
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
