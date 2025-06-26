export function TrendingProducts() {
  return (
    <section className="py-16 bg-background">
      <div className="max-w-[1280px] mx-auto px-8">
        
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Trending Products and Bestsellers
          </h2>
          <p className="text-muted-foreground text-lg">
            Discover what's popular right now in the tech world
          </p>
        </div>

        {/* Two-column layout with exact spacing - 24px gap */}
        <div className="flex gap-6 items-center">
          
          {/* Left side - Product image - exact 550x400px */}
          <div className="bg-card rounded overflow-hidden shadow-lg w-[550px]">
            <div className="w-[550px] h-[400px]">
              <img
                src="https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=550&h=400&fit=crop"
                alt="Professional Camera"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Right side - Categories with exact spacing */}
          <div className="flex flex-col gap-6 pl-6">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Compare Categories
            </h3>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg cursor-pointer transition-colors hover:bg-muted/80">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold">📷</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      Cameras
                    </h4>
                    <p className="text-muted-foreground text-sm">
                      Professional & consumer cameras
                    </p>
                  </div>
                </div>
                <button className="bg-background border border-border rounded-lg px-4 py-2 text-sm font-medium cursor-pointer transition-colors hover:bg-muted">
                  Compare
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg cursor-pointer transition-colors hover:bg-muted/80">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 font-bold">📱</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Tablets</h4>
                    <p className="text-muted-foreground text-sm">iPad, Samsung Galaxy & more</p>
                  </div>
                </div>
                <button className="bg-background border border-border rounded-lg px-4 py-2 text-sm font-medium cursor-pointer transition-colors hover:bg-muted">
                  Compare
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg cursor-pointer transition-colors hover:bg-muted/80">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-orange-600 font-bold">🎵</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Audio</h4>
                    <p className="text-muted-foreground text-sm">Headphones, speakers & more</p>
                  </div>
                </div>
                <button className="bg-background border border-border rounded-lg px-4 py-2 text-sm font-medium cursor-pointer transition-colors hover:bg-muted">
                  Compare
                </button>
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
          <button className="bg-primary hover:bg-primary/90 transition-colors duration-300 text-primary-foreground px-8 py-3 rounded-lg font-medium shadow-lg">
            Shop Now
          </button>
        </div>

      </div>
    </section>
  );
}