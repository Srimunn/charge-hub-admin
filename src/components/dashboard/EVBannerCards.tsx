import { Card, CardContent } from '@/components/ui/card';
import evBanner1 from '@/assets/ev-banner-1.jpg';
import evBanner2 from '@/assets/ev-banner-2.jpg';
import evBanner3 from '@/assets/ev-banner-3.jpg';

const banners = [
  {
    image: evBanner1,
    quote: 'Drive the future. Charge electric.',
  },
  {
    image: evBanner2,
    quote: 'Every charge saves the planet.',
  },
  {
    image: evBanner3,
    quote: 'Clean energy. Smart mobility.',
  },
];

export function EVBannerCards() {
  return (
    <>
      {banners.map((banner, i) => (
        <Card
          key={i}
          className="relative overflow-hidden group cursor-pointer animate-fade-in-up"
          style={{ animationDelay: `${i * 0.15}s` }}
        >
          <CardContent className="p-0 relative">
            <img
              src={banner.image}
              alt={banner.quote}
              className="w-full h-40 object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-4">
              <p className="text-white text-sm font-semibold drop-shadow-lg">
                "{banner.quote}"
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
