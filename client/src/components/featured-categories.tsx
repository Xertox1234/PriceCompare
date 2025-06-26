import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function FeaturedCategories() {
  const categories = [
    {
      id: "headphones",
      name: "Headphones",
      description: "Best Headphones for Every Day",
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop"
    },
    {
      id: "smartphones", 
      name: "Smartphones",
      description: "Newest Smartphones",
      image: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&h=400&fit=crop"
    },
    {
      id: "smartwatches",
      name: "Smartwatches",
      description: "The Ultimate Accessory",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=400&fit=crop"
    }
  ];

  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    align: 'center',
    breakpoints: {
      '(min-width: 768px)': { active: false }
    }
  });
  
  const [prevBtnEnabled, setPrevBtnEnabled] = useState(false);
  const [nextBtnEnabled, setNextBtnEnabled] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setPrevBtnEnabled(emblaApi.canScrollPrev());
    setNextBtnEnabled(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
  }, [emblaApi, onSelect]);

  const CategoryCard = ({ category }: { category: typeof categories[0] }) => (
    <div className="relative overflow-hidden rounded-lg cursor-pointer group h-[300px]">
      <img
        src={category.image}
        alt={category.name}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 p-6 text-white">
        <h3 className="text-2xl font-bold mb-2">
          {category.name}
        </h3>
        <p className="text-sm text-gray-200 mb-4">
          {category.description}
        </p>
        <button className="text-sm font-medium text-white border-b border-white/50 hover:border-white transition-colors">
          View Collection
        </button>
      </div>
    </div>
  );

  return (
    <section className="py-8 bg-muted">
      <div className="max-w-[1280px] mx-auto px-8">
        {/* Desktop: Grid Layout */}
        <div className="hidden md:grid md:grid-cols-3 gap-4">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>

        {/* Mobile: Carousel Layout */}
        <div className="md:hidden relative -mx-8">
          <div className="overflow-hidden px-8" ref={emblaRef}>
            <div className="flex">
              {categories.map((category) => (
                <div key={category.id} className="flex-[0_0_90%] min-w-0 mr-4 first:ml-0">
                  <CategoryCard category={category} />
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center transition-opacity ${
              prevBtnEnabled ? 'opacity-100' : 'opacity-50'
            }`}
            onClick={scrollPrev}
            disabled={!prevBtnEnabled}
          >
            <ChevronLeft className="w-5 h-5 text-gray-800" />
          </button>
          
          <button
            className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center transition-opacity ${
              nextBtnEnabled ? 'opacity-100' : 'opacity-50'
            }`}
            onClick={scrollNext}
            disabled={!nextBtnEnabled}
          >
            <ChevronRight className="w-5 h-5 text-gray-800" />
          </button>

          {/* Dot Indicators */}
          <div className="flex justify-center mt-6 space-x-2">
            {categories.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === selectedIndex ? 'bg-blue-600' : 'bg-gray-300'
                }`}
                onClick={() => emblaApi && emblaApi.scrollTo(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}