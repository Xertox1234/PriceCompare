import { Button } from "@/components/ui/button";
import { ArrowRight, Search } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/10 py-24 px-4 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <div className="container mx-auto max-w-7xl relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Hero Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Best the New{" "}
                <span className="text-primary bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  Apple MacBook Pro
                </span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
                Compare prices across top retailers and find the best deals on technology products. 
                Save money with our intelligent price tracking.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="bg-primary hover:bg-primary-hover text-primary-foreground px-8 py-4 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Start Shopping
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              
              <Button 
                variant="outline" 
                size="lg"
                className="px-8 py-4 rounded-lg font-semibold border-border hover:bg-muted transition-all duration-200"
              >
                <Search className="mr-2 h-5 w-5" />
                Browse Products
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-border">
              <div className="text-center sm:text-left">
                <div className="text-2xl font-bold text-foreground">10K+</div>
                <div className="text-sm text-muted-foreground">Products</div>
              </div>
              <div className="text-center sm:text-left">
                <div className="text-2xl font-bold text-foreground">50+</div>
                <div className="text-sm text-muted-foreground">Retailers</div>
              </div>
              <div className="text-center sm:text-left">
                <div className="text-2xl font-bold text-foreground">$2M+</div>
                <div className="text-sm text-muted-foreground">Saved</div>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative">
            <div className="relative bg-gradient-to-br from-muted to-muted/50 rounded-2xl p-8 shadow-2xl">
              {/* Product Showcase */}
              <div className="aspect-[4/3] bg-white rounded-xl shadow-lg flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  {/* MacBook Illustration */}
                  <div className="w-3/4 h-3/4 bg-gradient-to-br from-gray-300 to-gray-400 rounded-lg shadow-xl transform -rotate-12 hover:rotate-0 transition-transform duration-500">
                    <div className="w-full h-3/4 bg-gradient-to-br from-gray-800 to-black rounded-t-lg"></div>
                    <div className="w-full h-1/4 bg-gradient-to-br from-gray-200 to-gray-300 rounded-b-lg flex items-center justify-center">
                      <div className="w-1/3 h-1/3 bg-gray-100 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Price Cards */}
              <div className="absolute -top-4 -right-4 bg-white rounded-lg shadow-lg p-3 border border-border">
                <div className="text-xs text-muted-foreground">Best Price</div>
                <div className="text-lg font-bold text-primary">$1,299</div>
              </div>

              <div className="absolute -bottom-4 -left-4 bg-success rounded-lg shadow-lg p-3 text-success-foreground">
                <div className="text-xs">Save up to</div>
                <div className="text-lg font-bold">$300</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}