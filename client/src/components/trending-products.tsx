export function TrendingProducts() {
  return (
    <section className="bg-background py-16">
      <div className="mx-auto max-w-[1280px] px-8">
        {/* Section header */}
        <div className="mb-12 text-center">
          <h2 className="text-foreground mb-4 text-3xl font-bold">
            Trending Products and Bestsellers
          </h2>
          <p className="text-muted-foreground text-lg">
            Discover what's popular right now in the tech world
          </p>
        </div>

        {/* Two-column layout with exact spacing - 24px gap */}
        <div className="flex items-center gap-6">
          {/* Left side - Product image - exact 550x400px */}
          <div className="bg-card w-[550px] overflow-hidden rounded shadow-lg">
            <div className="h-[400px] w-[550px]">
              <img
                src="https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=550&h=400&fit=crop"
                alt="Professional Camera"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {/* Right side - Categories with exact spacing */}
          <div className="flex flex-col gap-6 pl-6">
            <h3 className="text-foreground mb-6 text-2xl font-bold">Compare Categories</h3>

            <div className="flex flex-col gap-4">
              <div className="bg-muted hover:bg-muted/80 flex cursor-pointer items-center justify-between rounded-lg p-4 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
                    <span className="text-primary font-bold">📷</span>
                  </div>
                  <div>
                    <h4 className="text-foreground mb-1 font-semibold">Cameras</h4>
                    <p className="text-muted-foreground text-sm">Professional & consumer cameras</p>
                  </div>
                </div>
                <button className="bg-background border-border hover:bg-muted cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors">
                  Compare
                </button>
              </div>

              <div className="bg-muted hover:bg-muted/80 flex cursor-pointer items-center justify-between rounded-lg p-4 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="bg-success/10 flex h-12 w-12 items-center justify-center rounded-lg">
                    <span className="text-success font-bold">📱</span>
                  </div>
                  <div>
                    <h4 className="text-foreground mb-1 font-semibold">Tablets</h4>
                    <p className="text-muted-foreground text-sm">iPad, Samsung Galaxy & more</p>
                  </div>
                </div>
                <button className="bg-background border-border hover:bg-muted cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors">
                  Compare
                </button>
              </div>

              <div className="bg-muted hover:bg-muted/80 flex cursor-pointer items-center justify-between rounded-lg p-4 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="bg-warning/10 flex h-12 w-12 items-center justify-center rounded-lg">
                    <span className="text-warning font-bold">🎵</span>
                  </div>
                  <div>
                    <h4 className="text-foreground mb-1 font-semibold">Audio</h4>
                    <p className="text-muted-foreground text-sm">Headphones, speakers & more</p>
                  </div>
                </div>
                <button className="bg-background border-border hover:bg-muted cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors">
                  Compare
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom promotional section */}
        <div className="gradient-dark text-primary-foreground mt-16 rounded-lg p-8 text-center">
          <h3 className="mb-4 text-2xl font-bold">
            When it's cost-sensitive, go grey mobile, find your game controllers and it's delivered.
          </h3>
          <p className="text-muted-foreground mx-auto mb-6 max-w-2xl">
            Get the best deals on gaming accessories and mobile devices with fast, reliable
            delivery.
          </p>
          <button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-8 py-3 font-medium shadow-lg transition-colors duration-300">
            Shop Now
          </button>
        </div>
      </div>
    </section>
  );
}
