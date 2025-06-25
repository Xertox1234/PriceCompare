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

        {/* Two-column layout with exact spacing */}
        <div className="grid grid-cols-2 gap-6 items-center">
          
          {/* Left side - Product image - exact 550x400px */}
          <div className="bg-white rounded overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div className="w-[550px] h-[400px]">
              <img
                src="https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=550&h=400&fit=crop"
                alt="Professional Camera"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Right side - Categories with exact spacing */}
          <div className="space-y-6 pl-6">
            <h3 className="text-2xl font-bold text-black mb-6">
              Compare Categories
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#F7F7F7] rounded hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center">
                    <span className="text-blue-600 font-bold">📷</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-black">Cameras</h4>
                    <p className="text-gray-600 text-sm">Professional & consumer cameras</p>
                  </div>
                </div>
                <button className="bg-white border border-[#EAEAEA] hover:bg-[#F7F7F7] transition-colors px-4 py-2 rounded text-sm font-medium">
                  Compare
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#F7F7F7] rounded hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded flex items-center justify-center">
                    <span className="text-green-600 font-bold">📱</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-black">Tablets</h4>
                    <p className="text-gray-600 text-sm">iPad, Samsung Galaxy & more</p>
                  </div>
                </div>
                <button className="bg-white border border-[#EAEAEA] hover:bg-[#F7F7F7] transition-colors px-4 py-2 rounded text-sm font-medium">
                  Compare
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-[#F7F7F7] rounded hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-orange-100 rounded flex items-center justify-center">
                    <span className="text-orange-600 font-bold">🎵</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-black">Audio</h4>
                    <p className="text-gray-600 text-sm">Headphones, speakers & more</p>
                  </div>
                </div>
                <button className="bg-white border border-[#EAEAEA] hover:bg-[#F7F7F7] transition-colors px-4 py-2 rounded text-sm font-medium">
                  Compare
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom promotional section */}
        <div className="mt-16 bg-gradient-to-r from-gray-900 to-gray-800 rounded p-8 text-center text-white">
          <h3 className="text-2xl font-bold mb-4">
            When it's cost-sensitive, go grey mobile, 
            find your game controllers and it's delivered.
          </h3>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Get the best deals on gaming accessories and mobile devices with fast, reliable delivery.
          </p>
          <button 
            className="bg-[#5A5DFF] hover:bg-[#4347FF] transition-colors duration-300 text-white px-8 py-3 rounded font-medium"
            style={{ 
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            Shop Now
          </button>
        </div>

      </div>
    </section>
  );
}