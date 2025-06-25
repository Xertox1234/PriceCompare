export function TrendingProducts() {
  return (
    <section 
      style={{
        padding: '64px 0',
        backgroundColor: '#fff'
      }}
    >
      <div 
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 32px'
        }}
      >
        
        {/* Section header */}
        <div 
          style={{
            textAlign: 'center',
            marginBottom: '48px'
          }}
        >
          <h2 
            style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#000',
              marginBottom: '16px',
              fontFamily: 'Inter, sans-serif',
              margin: '0 0 16px 0'
            }}
          >
            Trending Products and Bestsellers
          </h2>
          <p 
            style={{
              color: '#6b7280',
              fontSize: '18px',
              fontFamily: 'Inter, sans-serif',
              margin: 0
            }}
          >
            Discover what's popular right now in the tech world
          </p>
        </div>

        {/* Two-column layout with exact spacing - 24px gap */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          
          {/* Left side - Product image - exact 550x400px */}
          <div className="bg-white rounded overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)', width: '550px' }}>
            <div style={{ width: '550px', height: '400px' }}>
              <img
                src="https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=550&h=400&fit=crop"
                alt="Professional Camera"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Right side - Categories with exact spacing */}
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              paddingLeft: '24px'
            }}
          >
            <h3 
              style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#000',
                marginBottom: '24px',
                fontFamily: 'Inter, sans-serif',
                margin: '0 0 24px 0'
              }}
            >
              Compare Categories
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  backgroundColor: '#F7F7F7',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F7F7F7';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div 
                    style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: '#dbeafe',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <span style={{ color: '#2563eb', fontWeight: '700' }}>📷</span>
                  </div>
                  <div>
                    <h4 
                      style={{
                        fontWeight: '600',
                        color: '#000',
                        margin: '0 0 4px 0',
                        fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      Cameras
                    </h4>
                    <p 
                      style={{
                        color: '#6b7280',
                        fontSize: '14px',
                        margin: 0,
                        fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      Professional & consumer cameras
                    </p>
                  </div>
                </div>
                <button 
                  style={{
                    backgroundColor: '#fff',
                    border: '1px solid #EAEAEA',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s ease',
                    fontFamily: 'Inter, sans-serif'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F7F7F7';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#fff';
                  }}
                >
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