export function HeroSection() {
  return (
    <section 
      className="relative w-full h-[700px] bg-cover bg-center"
      style={{ 
        backgroundImage: "url('https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1920&h=700&fit=crop')" 
      }}
    >
      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-end">
        <div className="text-white max-w-[500px] px-8">
          <h1 className="text-5xl font-bold tracking-tight leading-tight mb-4">
            Rent the New Apple MacBook Pro
          </h1>
          <p className="text-lg mt-4 leading-relaxed mb-6">
            Experience powerful performance, stunning visuals, and sleek design, anytime you want. Flexible rentals made easy.
          </p>
          <button className="mt-6 bg-[#5A5DFF] hover:bg-[#4347FF] transition-colors duration-300 py-3 px-6 rounded">
            Discover Now
          </button>
        </div>
      </div>
    </section>
  );
}