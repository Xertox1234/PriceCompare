import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

export function NewPromoBanner() {
  return (
    <section className="mb-12">
      <div className="relative bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl overflow-hidden text-white p-12 flex items-center">
        <div className="w-1/2">
          <h3 className="text-5xl font-bold mb-4">
            Capture great moments and great deals!
          </h3>
          <p className="text-lg mb-8">
            Whether it's for a documentary or a birthday party, we've got the right camera at the right price.
          </p>
          <Link href="/products">
            <Button className="bg-white text-indigo-600 font-semibold py-3 px-8 rounded-full hover:bg-gray-100 transition duration-300">
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
    </section>
  );
}