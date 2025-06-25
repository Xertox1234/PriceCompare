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
        
        {/* Categories grid - exact 400x300px dimensions with 24px spacing */}
        <div className="flex justify-between" style={{ gap: '24px' }}>
          {categories.map((category) => (
            <div 
              key={category.id}
              className="group cursor-pointer"
            >
              <div 
                className="rounded overflow-hidden relative"
                style={{ 
                  width: '300px',
                  height: '300px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              >
                <img
                  src={category.image}
                  alt={category.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors duration-300"></div>
                <div className="absolute bottom-6 left-6">
                  <h3 className="text-white text-xl font-bold">
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