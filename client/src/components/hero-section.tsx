export function HeroSection() {
  return (
    <section 
      style={{
        position: 'relative',
        width: '100%',
        height: '700px',
        backgroundImage: "url('https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1920&h=700&fit=crop')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end'
        }}
      >
        <div 
          style={{
            maxWidth: '1280px',
            width: '100%',
            margin: '0 auto',
            padding: '0 32px',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <div 
            style={{
              color: '#fff',
              maxWidth: '500px',
              textAlign: 'right'
            }}
          >
            <h1 
              style={{
                fontSize: '48px',
                fontWeight: '700',
                lineHeight: '1.2',
                letterSpacing: '-0.5px',
                marginBottom: '16px',
                fontFamily: 'Inter, sans-serif',
                margin: '0 0 16px 0'
              }}
            >
              Compare Prices, Save Money, Shop Smart
            </h1>
            <p 
              style={{
                fontSize: '18px',
                lineHeight: '1.6',
                marginBottom: '24px',
                fontFamily: 'Inter, sans-serif',
                margin: '0 0 24px 0'
              }}
            >
              Find the best deals across hundreds of retailers. Compare prices instantly and never overpay again.
            </p>
            <button
              style={{
                backgroundColor: '#5A5DFF',
                color: '#fff',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.3s ease',
                fontFamily: 'Inter, sans-serif'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4347FF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#5A5DFF';
              }}
            >
              Start Comparing Now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}