import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative h-[700px] overflow-hidden">
      {/* Large background image */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1920&h=700&fit=crop"
          alt="MacBook Pro"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>
      
      {/* Hero content overlay */}
      <div className="relative z-10 max-w-[1280px] mx-auto px-8 h-full flex items-center">
        <div className="text-white max-w-lg">
          <h1 className="text-5xl font-bold leading-tight mb-6" style={{ letterSpacing: '-0.5px' }}>
            Beat the New Apple MacBook Pro
          </h1>
          
          <p className="text-lg mb-8 text-white/90 leading-relaxed">
            Experience the ultimate in portable computing with the new MacBook Pro featuring M3 chip.
          </p>
          
          <Button 
            className="bg-[#5A5DFF] hover:bg-[#4347FF] text-white px-8 py-3 rounded text-base font-medium"
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