export function HeroSection() {
  return (
    <section 
      className="relative w-full h-[700px] bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1920&h=700&fit=crop')"
      }}
    >
      <div className="absolute inset-0 bg-black/50 flex items-center justify-end">
        <div className="max-w-[1280px] w-full mx-auto px-8 flex justify-end">
          <div className="text-white max-w-[500px] text-right">
            <h1 className="text-5xl font-bold leading-tight tracking-tight mb-4 font-sans">
              Compare Prices, Save Money, Shop Smart
            </h1>
            <p className="text-lg leading-relaxed mb-6 font-sans">
              Find the best deals across hundreds of retailers. Compare prices instantly and never overpay again.
            </p>
            <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 text-base font-semibold border-0 rounded cursor-pointer transition-colors duration-300 font-sans">
              Start Comparing Now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}