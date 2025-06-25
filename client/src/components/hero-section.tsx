import { Button } from "@/components/ui/button";
import { ArrowRight, Search, Zap } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Background image overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10"></div>
      
      {/* Hero content */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[600px] py-16">
          
          {/* Left content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-black leading-tight hero-text-shadow">
                Beat the New 
                <span className="text-gradient block">Apple MacBook Pro</span>
              </h1>
              
              <p className="text-xl text-gray-300 max-w-lg leading-relaxed">
                Compare prices across top retailers and find the best deals on technology products. Save money with our intelligent price tracking.
              </p>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="btn-modern bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold"
              >
                <Zap className="mr-2 h-5 w-5" />
                Start Shopping
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="btn-modern border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg"
              >
                <Search className="mr-2 h-5 w-5" />
                Browse Products
              </Button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-white/20">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">10K+</div>
                <div className="text-sm text-gray-400 mt-1">Products</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">50+</div>
                <div className="text-sm text-gray-400 mt-1">Retailers</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">$2M+</div>
                <div className="text-sm text-gray-400 mt-1">Saved</div>
              </div>
            </div>
          </div>
          
          {/* Right content - Product showcase */}
          <div className="relative">
            <div className="relative transform rotate-6 hover:rotate-3 transition-transform duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl blur-xl"></div>
              <div className="relative bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
                <img
                  src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&h=300&fit=crop"
                  alt="MacBook Pro"
                  className="w-full h-64 object-cover rounded-2xl"
                />
                <div className="mt-6 space-y-4">
                  <h3 className="text-2xl font-bold">Best Price</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold text-green-400">$1,299</div>
                      <div className="text-sm text-gray-400 line-through">$1,799</div>
                    </div>
                    <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                      Save $500
                    </div>
                  </div>
                  <Button className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600">
                    View Deal
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full blur-3xl"></div>
    </section>
  );
}