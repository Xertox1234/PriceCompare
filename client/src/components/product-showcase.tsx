import { Button } from "@/components/ui/button";

export function ProductShowcase() {
  const products = [
    {
      id: 1,
      name: "iPhone 15 Pro",
      image: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=290&h=290&fit=crop",
      size: "small"
    },
    {
      id: 2,
      name: "AirPods Pro",
      image: "https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=290&h=290&fit=crop",
      size: "small"
    },
    {
      id: 3,
      name: "MacBook Pro M3",
      image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop",
      size: "large"
    },
    {
      id: 4,
      name: "iMac 24-inch",
      image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=550&h=400&fit=crop",
      size: "medium"
    },
    {
      id: 5,
      name: "Apple Watch Series 9",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=290&h=290&fit=crop",
      size: "small"
    },
    {
      id: 6,
      name: "Gaming Setup",
      image: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=550&h=400&fit=crop",
      size: "medium"
    },
    {
      id: 7,
      name: "PS5 Controller",
      image: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=290&h=290&fit=crop",
      size: "small"
    }
  ];

  return (
    <section className="py-16 bg-[#F7F7F7]">
      <div className="max-w-[1280px] mx-auto px-8">
        
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-black mb-4">
            Save More With Our Best Deals
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Discover unbeatable prices on top technology products from leading brands.
          </p>
        </div>

        {/* Product grid - mosaic style */}
        <div className="grid grid-cols-4 grid-rows-3 gap-6 h-[800px]">
          
          {/* iPhone 15 Pro - small */}
          <div className="bg-white rounded-lg overflow-hidden group cursor-pointer" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div className="h-full flex flex-col">
              <div className="flex-1">
                <img
                  src={products[0].image}
                  alt={products[0].name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm">{products[0].name}</h3>
              </div>
            </div>
          </div>

          {/* AirPods Pro - small */}
          <div className="bg-white rounded-lg overflow-hidden group cursor-pointer" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div className="h-full flex flex-col">
              <div className="flex-1">
                <img
                  src={products[1].image}
                  alt={products[1].name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm">{products[1].name}</h3>
              </div>
            </div>
          </div>

          {/* MacBook Pro - large (spans 2x2) */}
          <div className="col-span-2 row-span-2 bg-white rounded-lg overflow-hidden group cursor-pointer" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div className="h-full flex flex-col">
              <div className="flex-1">
                <img
                  src={products[2].image}
                  alt={products[2].name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-6">
                <h3 className="font-bold text-xl">{products[2].name}</h3>
                <p className="text-gray-600 text-sm mt-1">Starting at $1,599</p>
              </div>
            </div>
          </div>

          {/* iMac - medium */}
          <div className="col-span-2 bg-white rounded-lg overflow-hidden group cursor-pointer" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div className="h-full flex flex-col">
              <div className="flex-1">
                <img
                  src={products[3].image}
                  alt={products[3].name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{products[3].name}</h3>
              </div>
            </div>
          </div>

          {/* Apple Watch - small */}
          <div className="bg-white rounded-lg overflow-hidden group cursor-pointer" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div className="h-full flex flex-col">
              <div className="flex-1">
                <img
                  src={products[4].image}
                  alt={products[4].name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm">{products[4].name}</h3>
              </div>
            </div>
          </div>

          {/* Gaming Setup - medium */}
          <div className="col-span-2 bg-white rounded-lg overflow-hidden group cursor-pointer" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div className="h-full flex flex-col">
              <div className="flex-1">
                <img
                  src={products[5].image}
                  alt={products[5].name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{products[5].name}</h3>
              </div>
            </div>
          </div>

          {/* PS5 Controller - small */}
          <div className="bg-white rounded-lg overflow-hidden group cursor-pointer" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div className="h-full flex flex-col">
              <div className="flex-1">
                <img
                  src={products[6].image}
                  alt={products[6].name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm">{products[6].name}</h3>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}