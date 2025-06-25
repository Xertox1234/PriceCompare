export function FeaturedCategories() {
  const categories = [
    {
      id: "headphones",
      name: "Headphones",
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop",
      bgColor: "#4A90E2"
    },
    {
      id: "smartwatches", 
      name: "Smart Watch",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop",
      bgColor: "#7ED321"
    },
    {
      id: "cameras",
      name: "Cameras",
      image: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=300&fit=crop",
      bgColor: "#BD10E0"
    },
    {
      id: "vr",
      name: "VR & AR",
      image: "https://images.unsplash.com/photo-1592478411213-6153e4ebc696?w=400&h=300&fit=crop", 
      bgColor: "#F5A623"
    }
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-[1280px] mx-auto px-8">
        
        {/* Categories grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((category) => (
            <div 
              key={category.id}
              className="group cursor-pointer"
            >
              <div 
                className="h-[300px] rounded-lg overflow-hidden relative"
                style={{ backgroundColor: category.bgColor }}
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

        {/* Explore section */}
        <div className="text-center mt-16 mb-16">
          <h2 className="text-3xl font-bold text-black mb-4">
            Explore Our Product Range
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Discover the latest technology products and compare prices across multiple retailers to find the best deals.
          </p>
        </div>

      </div>
    </section>
  );
}