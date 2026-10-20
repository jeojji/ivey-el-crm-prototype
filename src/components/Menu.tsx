import { useEffect, useId, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

export interface MenuItem {
  label: string;
  description?: string;
  icon?: IconName;
  danger?: boolean;
  onSelect: () => void;
}

export interface MenuGroup {
  label?: string;
  items: MenuItem[];
}

/**
 * A button that opens a short list of actions (WAI-ARIA menu button pattern).
 * Keyboard: Enter/Space/↓ opens and focuses the first item, ↑/↓ move, Home/End jump, Esc closes
 * and returns focus to the button, Tab closes. Choosing an item puts focus back on the button
 * first, so a dialog the item opens returns focus there when it closes.
 */
export function MenuButton({ label, icon, primary = false, groups, heading, ariaLabel }: {
  label: string;
  icon?: IconName;
  primary?: boolean;
  groups: MenuGroup[];
  /** Short context line at the top of the menu, e.g. "For Aster Labs". */
  heading?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const items = groups.flatMap((g) => g.items);

  const focusItem = (i: number) => {
    const els = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    if (!els?.length) return;
    els[(i + els.length) % els.length].focus();
  };
  const current = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])].indexOf(document.activeElement as Element);

  useEffect(() => {
    if (!open) return;
    focusItem(0);
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function close(refocus = true) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); }
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivey-600 ${
          primary ? 'bg-ivey-700 text-white shadow-sm hover:bg-ivey-800' : 'border border-neutral-300 bg-white text-neutral-800 shadow-xs hover:bg-neutral-50'
        }`}
      >
        {icon && <Icon name={icon} className="h-4 w-4" />}
        {label}
        <Icon name="chevronDown" className="h-3.5 w-3.5 opacity-80" />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={ariaLabel ?? label}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(current() + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(current() - 1); }
            else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
            else if (e.key === 'End') { e.preventDefault(); focusItem(items.length - 1); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
            else if (e.key === 'Tab') close(false);
          }}
          className="absolute right-0 z-30 mt-1.5 w-72 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {heading && <p className="border-b border-neutral-100 px-3.5 pt-1.5 pb-2 text-xs text-neutral-500">{heading}</p>}
          {groups.map((g, gi) => (
            <div key={g.label ?? gi} role="group" aria-label={g.label} className={gi > 0 ? 'mt-1 border-t border-neutral-100 pt-1' : ''}>
              {g.label && <p className="px-3.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase" aria-hidden="true">{g.label}</p>}
              {g.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => { close(); item.onSelect(); }}
                  className={`flex w-full items-start gap-3 px-3.5 py-2 text-left focus:outline-none ${item.danger ? 'text-red-800 hover:bg-red-50 focus:bg-red-50' : 'text-neutral-900 hover:bg-neutral-50 focus:bg-ivey-50'}`}
                >
                  {item.icon && <Icon name={item.icon} className={`mt-0.5 h-4 w-4 shrink-0 ${item.danger ? 'text-red-700' : 'text-ivey-700'}`} />}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.label}</span>
                    {item.description && <span className="block text-xs text-neutral-600">{item.description}</span>}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** "More" menu for less frequent record actions such as Delete. */
export function MoreActions({ items }: { items: MenuItem[] }) {
  return <MenuButton label="More" groups={[{ items }]} ariaLabel="More actions" />;
}
