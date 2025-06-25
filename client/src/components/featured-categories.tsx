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

  return (
    <section className="py-8 bg-gray-50">
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="grid grid-cols-3 gap-4">
          {categories.map((category) => (
            <div 
              key={category.id}
              className="relative overflow-hidden rounded-lg cursor-pointer group"
              style={{ height: '300px' }}
            >
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
          ))}
        </div>
      </div>
    </section>
  );
}