import { Button } from "@/components/ui/button";

export function TrendingProducts() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-[1280px] mx-auto px-8">
        
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-black mb-4">
            Trending Products and Bestsellers
          </h2>
          <p className="text-gray-600 text-lg">
            Discover what's popular right now in the tech world
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left side - Product image */}
          <div className="relative">
            <div className="bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg p-8 h-[400px] flex items-center justify-center">
              <img
                src="https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=550&h=400&fit=crop"
                alt="Professional Camera"
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          </div>

          {/* Right side - Categories */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-black mb-6">
              Compare Categories
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold">📷</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-black">Cameras</h4>
                    <p className="text-gray-600 text-sm">Professional & consumer cameras</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Compare
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 font-bold">⌚</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-black">Tablets</h4>
                    <p className="text-gray-600 text-sm">iPad, Samsung Galaxy & more</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Compare
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-orange-600 font-bold">🎵</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-black">Audio</h4>
                    <p className="text-gray-600 text-sm">Headphones, speakers & more</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Compare
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom promotional section */}
        <div className="mt-16 bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg p-8 text-center text-white">
          <h3 className="text-2xl font-bold mb-4">
            When it's cost-sensitive, go grey mobile, 
            find your game controllers and it's delivered.
          </h3>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Get the best deals on gaming accessories and mobile devices with fast, reliable delivery.
          </p>
          <Button 
            className="bg-[#5A5DFF] hover:bg-[#4347FF] text-white px-8 py-3"
            style={{ 
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              transition: 'all 0.3s ease'
            }}
          >
            Shop Now
          </Button>
        </div>

      </div>
    </section>
  );
}