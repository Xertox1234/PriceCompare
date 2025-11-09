import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

export function NewPromoBanner() {
  return (
    <section className="mb-12">
      <div className="relative bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl overflow-hidden text-white">
        {/* Mobile Layout - Stack vertically */}
        <div className="flex flex-col md:hidden p-6">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold mb-3">
              Capture great moments and great deals!
            </h3>
            <p className="text-sm mb-4">
              Whether it's for a documentary or a birthday party, we've got the right camera at the right price.
            </p>
            <Link href="/products">
              <Button className="bg-card text-primary font-semibold py-2 px-6 rounded-full hover:bg-muted transition duration-300">
                Shop Cameras
              </Button>
            </Link>
          </div>
          <div className="flex justify-center">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC84ya0GbAKYVBc3SNCdtTyq9xkBPcqhEAA2g2I3BCis7ddyB_NthKjI1fyN86VjueYHwuq-i_3mA6rimjnWJDkOpxZolj5KKR-b-4mi_4DIC90UhzRULG7vSsVE_s5dQcoeVnXQhFClqC8D6q2dDqopGBdArOwutFQ08HnspCI_PGIQ5WXNMkvzsKfA26GrpFusMZBEiZCkchKyeAaVg-SOPv7_QOLoUAg6ilTkK5O-kHNkSVoVR_1hCzKfsyNXLVcvc28H4lpbMQ"
              alt="A collection of digital cameras on a sleek surface"
              className="w-full max-w-xs h-32 object-contain"
            />
          </div>
        </div>

        {/* Desktop Layout - Side by side */}
        <div className="hidden md:flex items-center p-8 lg:p-12">
          <div className="w-1/2">
            <h3 className="text-3xl lg:text-5xl font-bold mb-4">
              Capture great moments and great deals!
            </h3>
            <p className="text-base lg:text-lg mb-6 lg:mb-8">
              Whether it's for a documentary or a birthday party, we've got the right camera at the right price.
            </p>
            <Link href="/products">
              <Button className="bg-card text-primary font-semibold py-3 px-8 rounded-full hover:bg-muted transition duration-300">
                Shop Cameras
              </Button>
            </Link>
          </div>
          <div className="w-1/2 flex justify-center">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC84ya0GbAKYVBc3SNCdtTyq9xkBPcqhEAA2g2I3BCis7ddyB_NthKjI1fyN86VjueYHwuq-i_3mA6rimjnWJDkOpxZolj5KKR-b-4mi_4DIC90UhzRULG7vSsVE_s5dQcoeVnXQhFClqC8D6q2dDqopGBdArOwutFQ08HnspCI_PGIQ5WXNMkvzsKfA26GrpFusMZBEiZCkchKyeAaVg-SOPv7_QOLoUAg6ilTkK5O-kHNkSVoVR_1hCzKfsyNXLVcvc28H4lpbMQ"
              alt="A collection of digital cameras on a sleek surface"
              className="max-w-md transform transition duration-500 hover:scale-105"
            />
          </div>
        </div>
      </div>
    </section>
  );
}