import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

export function NewPromoBanner() {
  return (
    <section className="mb-12">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white">
        {/* Mobile Layout - Stack vertically */}
        <div className="flex flex-col p-6 md:hidden">
          <div className="mb-6 text-center">
            <h3 className="mb-3 text-2xl font-bold">Capture great moments and great deals!</h3>
            <p className="mb-4 text-sm">
              Whether it's for a documentary or a birthday party, we've got the right camera at the
              right price.
            </p>
            <Link href="/products">
              <Button className="bg-card text-primary hover:bg-muted rounded-full px-6 py-2 font-semibold transition duration-300">
                Shop Cameras
              </Button>
            </Link>
          </div>
          <div className="flex justify-center">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC84ya0GbAKYVBc3SNCdtTyq9xkBPcqhEAA2g2I3BCis7ddyB_NthKjI1fyN86VjueYHwuq-i_3mA6rimjnWJDkOpxZolj5KKR-b-4mi_4DIC90UhzRULG7vSsVE_s5dQcoeVnXQhFClqC8D6q2dDqopGBdArOwutFQ08HnspCI_PGIQ5WXNMkvzsKfA26GrpFusMZBEiZCkchKyeAaVg-SOPv7_QOLoUAg6ilTkK5O-kHNkSVoVR_1hCzKfsyNXLVcvc28H4lpbMQ"
              alt="A collection of digital cameras on a sleek surface"
              className="h-32 w-full max-w-xs object-contain"
            />
          </div>
        </div>

        {/* Desktop Layout - Side by side */}
        <div className="hidden items-center p-8 md:flex lg:p-12">
          <div className="w-1/2">
            <h3 className="mb-4 text-3xl font-bold lg:text-5xl">
              Capture great moments and great deals!
            </h3>
            <p className="mb-6 text-base lg:mb-8 lg:text-lg">
              Whether it's for a documentary or a birthday party, we've got the right camera at the
              right price.
            </p>
            <Link href="/products">
              <Button className="bg-card text-primary hover:bg-muted rounded-full px-8 py-3 font-semibold transition duration-300">
                Shop Cameras
              </Button>
            </Link>
          </div>
          <div className="flex w-1/2 justify-center">
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
