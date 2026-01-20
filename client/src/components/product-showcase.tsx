export function ProductShowcase() {
  return (
    <section className="bg-muted py-16">
      <div className="mx-auto max-w-screen-xl px-8">
        {/* Product grid - exact mosaic layout matching reference image with proper spacing */}
        <div className="flex flex-col gap-6">
          {/* Row 1: Two small + Large featured start */}
          <div className="flex gap-6">
            {/* Small product 1 - 290x290 */}
            <div className="bg-background group w-[290px] cursor-pointer overflow-hidden rounded-lg shadow-lg transition-transform duration-300 hover:-translate-y-1">
              <div className="h-[290px] w-[290px]">
                <img
                  src="https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=290&h=290&fit=crop"
                  alt="iPhone 15 Pro"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <h3 className="text-foreground m-0 text-sm font-semibold">iPhone 15 Pro</h3>
              </div>
            </div>

            {/* Small product 2 - 290x290 */}
            <div className="bg-background group w-[290px] cursor-pointer overflow-hidden rounded-lg shadow-lg transition-transform duration-300 hover:-translate-y-1">
              <div className="h-[290px] w-[290px]">
                <img
                  src="https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=290&h=290&fit=crop"
                  alt="AirPods Pro"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold">AirPods Pro</h3>
              </div>
            </div>

            {/* Large featured product - 600x600 */}
            <div className="bg-background group w-[600px] cursor-pointer overflow-hidden rounded-lg shadow-lg transition-transform duration-300 hover:-translate-y-1">
              <div className="h-[600px] w-[600px]">
                <img
                  src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=600&fit=crop"
                  alt="MacBook Pro M3"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold">MacBook Pro M3</h3>
                <p className="mt-1 text-sm text-muted-foreground">Starting at $1,599</p>
              </div>
            </div>
          </div>

          {/* Row 2: Medium product spanning width under small items */}
          <div className="flex gap-6">
            {/* Medium product 1 - spans width of two small items + gap */}
            <div className="bg-background group w-[604px] cursor-pointer overflow-hidden rounded-lg shadow-lg transition-transform duration-300 hover:-translate-y-1">
              <div className="h-[290px] w-[604px]">
                <img
                  src="https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=604&h=290&fit=crop"
                  alt="iMac 24-inch"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
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
            <div className="bg-background group w-[290px] cursor-pointer overflow-hidden rounded-lg shadow-lg transition-transform duration-300 hover:-translate-y-1">
              <div className="h-[290px] w-[290px]">
                <img
                  src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=290&h=290&fit=crop"
                  alt="Apple Watch Series 9"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold">Apple Watch Series 9</h3>
              </div>
            </div>

            {/* Medium product 2 - 604px width */}
            <div className="bg-background group w-[604px] cursor-pointer overflow-hidden rounded-lg shadow-lg transition-transform duration-300 hover:-translate-y-1">
              <div className="h-[290px] w-[604px]">
                <img
                  src="https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=604&h=290&fit=crop"
                  alt="Gaming Setup"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold">Gaming Setup</h3>
              </div>
            </div>

            {/* Small product 4 - 290x290 */}
            <div className="bg-background group w-[290px] cursor-pointer overflow-hidden rounded-lg shadow-lg transition-transform duration-300 hover:-translate-y-1">
              <div className="h-[290px] w-[290px]">
                <img
                  src="https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=290&h=290&fit=crop"
                  alt="PS5 Controller"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold">PS5 Controller</h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
