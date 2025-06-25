export function FeaturedCategories() {
  const categories = [
    {
      id: "headphones",
      name: "Headphones",
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop"
    },
    {
      id: "smartwatches", 
      name: "Smart Watch",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop"
    },
    {
      id: "cameras",
      name: "Cameras", 
      image: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&h=300&fit=crop"
    },
    {
      id: "vr",
      name: "Smartphones",
      image: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=400&h=300&fit=crop"
    }
  ];

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
        
        {/* Categories grid - exact 300x300px dimensions with 24px spacing */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '24px'
          }}
        >
          {categories.map((category) => (
            <div 
              key={category.id}
              style={{
                cursor: 'pointer',
                transition: 'transform 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div 
                style={{
                  width: '300px',
                  height: '300px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}
              >
                <img
                  src={category.image}
                  alt={category.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                />
                <div 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    transition: 'background-color 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                  }}
                />
                <div 
                  style={{
                    position: 'absolute',
                    bottom: '24px',
                    left: '24px'
                  }}
                >
                  <h3 
                    style={{
                      color: '#fff',
                      fontSize: '20px',
                      fontWeight: '700',
                      margin: 0,
                      fontFamily: 'Inter, sans-serif'
                    }}
                  >
                    {category.name}
                  </h3>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}