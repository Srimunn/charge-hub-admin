import { Card, CardContent } from '@/components/ui/card';
import { Zap, Globe, BatteryCharging } from 'lucide-react';
import evBanner1 from '@/assets/ev-banner-1.jpg';
import evBanner2 from '@/assets/ev-banner-2.jpg';
import evBanner3 from '@/assets/ev-banner-3.jpg';

const banners = [
  {
    image: evBanner1,
    quote: 'Drive the future. Charge electric.',
    icon: Zap,
    accent: 'from-primary/90',
  },
  {
    image: evBanner2,
    quote: 'Every charge powers a cleaner tomorrow.',
    icon: Globe,
    accent: 'from-success/80',
  },
  {
    image: evBanner3,
    quote: 'Smart charging. Smarter mobility.',
    icon: BatteryCharging,
    accent: 'from-accent/90',
  },
];

export function EVBannerCards() {
  return (
    <>
      {banners.map((banner, i) => (
        <Card
          key={i}
          className="relative overflow-hidden group cursor-pointer border-0 animate-fade-in-up premium-card"
          style={{ animationDelay: `${0.5 + i * 0.12}s` }}
        >
          <CardContent className="p-0 relative">
            <img
              src={banner.image}
              alt={banner.quote}
              className="w-full h-44 object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className={`absolute inset-0 bg-gradient-to-t ${banner.accent} via-black/40 to-transparent flex flex-col justify-end p-5`}>
              <div className="flex items-center gap-2 mb-1.5">
                <banner.icon className="w-4 h-4 text-white/80" />
                <span className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">Insight</span>
              </div>
              <p className="text-white text-sm font-semibold leading-snug drop-shadow-lg">
                "{banner.quote}"
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
