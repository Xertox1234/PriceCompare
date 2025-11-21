export function ProductShowcase() {
  return (
    <section className="py-16 bg-muted">
      <div className="max-w-screen-xl mx-auto px-8">



        {/* Product grid - exact mosaic layout matching reference image with proper spacing */}
        <div className="flex flex-col gap-6">
          
          {/* Row 1: Two small + Large featured start */}
          <div className="flex gap-6">
            {/* Small product 1 - 290x290 */}
            <div className="bg-background rounded-lg overflow-hidden group cursor-pointer shadow-lg w-[290px] hover:-translate-y-1 transition-transform duration-300">
              <div className="w-[290px] h-[290px]">
                <img
                  src="https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=290&h=290&fit=crop"
                  alt="iPhone 15 Pro"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm m-0 text-foreground">
                  iPhone 15 Pro
                </h3>
              </div>
            </div>

            {/* Small product 2 - 290x290 */}
            <div className="bg-background rounded-lg overflow-hidden group cursor-pointer shadow-lg w-[290px] hover:-translate-y-1 transition-transform duration-300">
              <div className="w-[290px] h-[290px]">
                <img
                  src="https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=290&h=290&fit=crop"
                  alt="AirPods Pro"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm">AirPods Pro</h3>
              </div>
            </div>

            {/* Large featured product - 600x600 */}
            <div className="bg-background rounded-lg overflow-hidden group cursor-pointer shadow-lg w-[600px] hover:-translate-y-1 transition-transform duration-300">
              <div className="w-[600px] h-[600px]">
                <img
                  src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop"
                  alt="MacBook Pro M3"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-6">
                <h3 className="font-bold text-xl">MacBook Pro M3</h3>
                <p className="text-gray-600 text-sm mt-1">Starting at $1,599</p>
              </div>
            </div>
          </div>

          {/* Row 2: Medium product spanning width under small items */}
          <div className="flex gap-6">
            {/* Medium product 1 - spans width of two small items + gap */}
            <div className="bg-background rounded-lg overflow-hidden group cursor-pointer shadow-lg w-[604px] hover:-translate-y-1 transition-transform duration-300">
              <div className="w-[604px] h-[290px]">
                <img
                  src="https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=604&h=290&fit=crop"
                  alt="iMac 24-inch"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold">iMac 24-inch</h3>
              </div>
            </div>
          </div>

          {/* Row 3: Small + Medium products */}
          <div className="flex gap-6">
            {/* Small product 3 - 290x290 */}
            <div className="bg-background rounded-lg overflow-hidden group cursor-pointer shadow-lg w-[290px] hover:-translate-y-1 transition-transform duration-300">
              <div className="w-[290px] h-[290px]">
                <img
                  src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=290&h=290&fit=crop"
                  alt="Apple Watch Series 9"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm">Apple Watch Series 9</h3>
              </div>
            </div>

            {/* Medium product 2 - 604px width */}
            <div className="bg-background rounded-lg overflow-hidden group cursor-pointer shadow-lg w-[604px] hover:-translate-y-1 transition-transform duration-300">
              <div className="w-[604px] h-[290px]">
                <img
                  src="https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=604&h=290&fit=crop"
                  alt="Gaming Setup"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold">Gaming Setup</h3>
              </div>
            </div>

            {/* Small product 4 - 290x290 */}
            <div className="bg-background rounded-lg overflow-hidden group cursor-pointer shadow-lg w-[290px] hover:-translate-y-1 transition-transform duration-300">
              <div className="w-[290px] h-[290px]">
                <img
                  src="https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=290&h=290&fit=crop"
                  alt="PS5 Controller"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm">PS5 Controller</h3>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}