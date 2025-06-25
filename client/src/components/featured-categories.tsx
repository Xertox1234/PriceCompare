export function FeaturedCategories() {
  const categories = [
    {
      id: "headphones",
      name: "Headphones",
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"
    },
    {
      id: "smartwatches", 
      name: "Smart Watch",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop"
    },
    {
      id: "cameras",
      name: "Cameras", 
      image: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=300&fit=crop"
    },
    {
      id: "vr",
      name: "Smartphones",
      image: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=400&h=300&fit=crop"
    }
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-[1280px] mx-auto px-8">
        
        {/* Categories grid - exact 300x300px dimensions with 24px spacing */}
        <div className="flex justify-between gap-6">
          {categories.map((category) => (
            <div 
              key={category.id}
              className="cursor-pointer transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="w-[300px] h-[300px] rounded-lg overflow-hidden relative shadow-lg">
                <img
                  src={category.image}
                  alt={category.name}
                  className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/20 hover:bg-black/30 transition-colors duration-300" />
                <div className="absolute bottom-6 left-6">
                  <h3 className="text-white text-xl font-bold m-0 font-sans">
                    {category.name}
                  </h3>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}