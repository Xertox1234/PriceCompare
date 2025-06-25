import { Button } from "@/components/ui/button";
import { 
  Smartphone, 
  Laptop, 
  Headphones, 
  Camera, 
  Watch, 
  GamepadIcon,
  ArrowRight 
} from "lucide-react";

const categories = [
  {
    name: "Smartphones",
    icon: Smartphone,
    color: "bg-blue-500",
    description: "Latest mobile devices",
    count: "2,341"
  },
  {
    name: "Laptops",
    icon: Laptop,
    color: "bg-purple-500",
    description: "Gaming & productivity",
    count: "1,856"
  },
  {
    name: "Headphones",
    icon: Headphones,
    color: "bg-green-500",
    description: "Audio excellence",
    count: "934"
  },
  {
    name: "Cameras",
    icon: Camera,
    color: "bg-orange-500",
    description: "Professional photography",
    count: "567"
  },
  {
    name: "Smartwatches",
    icon: Watch,
    color: "bg-pink-500",
    description: "Wearable technology",
    count: "423"
  },
  {
    name: "Gaming",
    icon: GamepadIcon,
    color: "bg-red-500",
    description: "Console & PC gaming",
    count: "789"
  }
];

export function FeaturedCategories() {
  return (
    <section className="py-16 px-4 bg-muted/50">
      <div className="container mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Explore Our Product Range
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover the best deals across all major technology categories. 
            Compare prices from top retailers and save on your next purchase.
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-12">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <div
                key={category.name}
                className="group cursor-pointer"
              >
                <div className="bg-card rounded-xl p-6 shadow-sm border border-border hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                  {/* Icon */}
                  <div className={`${category.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  
                  {/* Content */}
                  <div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">
                      {category.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      {category.description}
                    </p>
                    <div className="text-xs font-medium text-primary">
                      {category.count} products
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Featured Deals Section */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Deal Card 1 */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-primary/20 px-3 py-1 rounded-full">
                <span className="text-xs font-medium text-primary">Hot Deal</span>
              </div>
              <span className="text-2xl">📱</span>
            </div>
            <h3 className="font-semibold text-foreground mb-2">iPhone 15 Pro</h3>
            <p className="text-sm text-muted-foreground mb-4">Save up to $200</p>
            <Button variant="outline" size="sm" className="w-full">
              View Deals
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Deal Card 2 */}
          <div className="bg-gradient-to-br from-success/10 to-success/5 rounded-xl p-6 border border-success/20">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-success/20 px-3 py-1 rounded-full">
                <span className="text-xs font-medium text-success">Best Price</span>
              </div>
              <span className="text-2xl">💻</span>
            </div>
            <h3 className="font-semibold text-foreground mb-2">MacBook Air M3</h3>
            <p className="text-sm text-muted-foreground mb-4">Starting at $999</p>
            <Button variant="outline" size="sm" className="w-full">
              Compare Prices
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Deal Card 3 */}
          <div className="bg-gradient-to-br from-warning/10 to-warning/5 rounded-xl p-6 border border-warning/20">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-warning/20 px-3 py-1 rounded-full">
                <span className="text-xs font-medium text-warning">Limited Time</span>
              </div>
              <span className="text-2xl">🎧</span>
            </div>
            <h3 className="font-semibold text-foreground mb-2">AirPods Pro</h3>
            <p className="text-sm text-muted-foreground mb-4">30% off today</p>
            <Button variant="outline" size="sm" className="w-full">
              Shop Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {/* Deal Card 4 */}
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl p-6 border border-purple-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-500/20 px-3 py-1 rounded-full">
                <span className="text-xs font-medium text-purple-700">Gaming</span>
              </div>
              <span className="text-2xl">🎮</span>
            </div>
            <h3 className="font-semibold text-foreground mb-2">PS5 Console</h3>
            <p className="text-sm text-muted-foreground mb-4">Back in stock</p>
            <Button variant="outline" size="sm" className="w-full">
              Check Availability
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}