import { Check } from 'lucide-react';

export function FeaturedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ff5a36]/30 bg-[#ff5a36]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#ffcfbf]">
      <Check className="h-3 w-3" />
      Featured
    </span>
  );
}
