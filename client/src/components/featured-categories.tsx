import { Button } from "@/components/ui/button";
import { 
  Smartphone, 
  Laptop, 
  Headphones, 
  Camera, 
  Watch, 
  Gamepad2,
  ArrowRight 
} from "lucide-react";

const categories = [
  {
    id: "smartphones",
    name: "Smartphones",
    icon: Smartphone,
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-gradient-to-br from-blue-50 to-cyan-50",
    count: "2,341",
    description: "Latest mobile devices"
  },
  {
    id: "laptops",
    name: "Laptops",
    icon: Laptop,
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-gradient-to-br from-purple-50 to-pink-50",
    count: "1,892",
    description: "Computing powerhouses"
  },
  {
    id: "headphones",
    name: "Headphones",
    icon: Headphones,
    color: "from-green-500 to-emerald-500",
    bgColor: "bg-gradient-to-br from-green-50 to-emerald-50",
    count: "3,124",
    description: "Audio excellence"
  },
  {
    id: "cameras",
    name: "Cameras",
    icon: Camera,
    color: "from-orange-500 to-red-500",
    bgColor: "bg-gradient-to-br from-orange-50 to-red-50",
    count: "987",
    description: "Capture every moment"
  },
  {
    id: "smartwatches",
    name: "Smartwatches",
    icon: Watch,
    color: "from-indigo-500 to-blue-500",
    bgColor: "bg-gradient-to-br from-indigo-50 to-blue-50",
    count: "1,456",
    description: "Wearable technology"
  },
  {
    id: "gaming",
    name: "Gaming",
    icon: Gamepad2,
    color: "from-red-500 to-pink-500",
    bgColor: "bg-gradient-to-br from-red-50 to-pink-50",
    count: "2,789",
    description: "Gaming gear & consoles"
  }
];

export function FeaturedCategories() {
  return (
    <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-gray-900 mb-4">
            Explore Our Product Range
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover the best deals across all major technology categories. 
            From cutting-edge smartphones to powerful gaming rigs.
          </p>
        </div>

        {/* Categories grid */}
        <div className="category-grid mb-12">
          {categories.map((category) => {
            const IconComponent = category.icon;
            
            return (
              <div 
                key={category.id}
                className={`category-card rounded-3xl p-8 cursor-pointer group ${category.bgColor}`}
              >
                {/* Icon with gradient background */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${category.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <IconComponent className="h-8 w-8 text-white" />
                </div>
                
                {/* Category info */}
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-gray-900 group-hover:text-gray-700 transition-colors">
                    {category.name}
                  </h3>
                  
                  <p className="text-gray-600 text-sm">
                    {category.description}
                  </p>
                  
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm font-semibold text-gray-500">
                      {category.count} products
                    </span>
                    
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Best deals section */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-8 md:p-12 text-white">
          <div className="text-center space-y-6">
            <h3 className="text-3xl font-black">
              Save More With Our Best Deals
            </h3>
            
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Get exclusive access to limited-time offers and price drops. 
              Never miss a great deal again.
            </p>
            
            {/* Deal highlights grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="text-3xl font-bold text-blue-400 mb-2">24/7</div>
                <div className="text-sm text-gray-300">Price Monitoring</div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="text-3xl font-bold text-green-400 mb-2">50%</div>
                <div className="text-sm text-gray-300">Average Savings</div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="text-3xl font-bold text-purple-400 mb-2">1M+</div>
                <div className="text-sm text-gray-300">Happy Customers</div>
              </div>
            </div>
            
            <Button 
              size="lg" 
              className="btn-modern bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg font-semibold mt-6"
            >
              View All Deals
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}