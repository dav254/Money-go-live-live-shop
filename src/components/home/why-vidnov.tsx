import { Store, Users, Compass, Search } from 'lucide-react';

export function WhyVidnov() {
  const items = [
    {
      icon: Store,
      title: 'Discover real businesses',
      text: 'See the shops and studios behind the products you actually want.',
    },
    {
      icon: Users,
      title: 'Connect directly with sellers',
      text: 'Message, negotiate and buy from the people behind what you buy.',
    },
    {
      icon: Compass,
      title: 'Explore products, services and videos',
      text: 'From physical goods to trades and live demos, all in one place.',
    },
    {
      icon: Search,
      title: 'Find what you need through buyer requests',
      text: 'State exactly what you want and get offers from sellers who understand.',
    },
  ];

  return (
    <section className="bg-[#090909]">
      <div className="container mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-[24px] border border-white/10 bg-white/5 p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#ff5a36]/10 text-[#ff5a36]">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-grotesk text-xl font-bold text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
