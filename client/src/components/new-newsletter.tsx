import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function NewNewsletter() {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement newsletter signup API call
    // For now, just clear the input
    setEmail('');
  };

  return (
    <section className="bg-card rounded-2xl shadow-lg p-10 flex items-center justify-between">
      <div className="w-1/3">
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNy9T1FiVA3gmb7KR1D0eJ7Kqx2m5da7q40f4swY3FZejQNeuR--_gec0DVY_VI7blHcQOC8fEkSazQiPOB4IjpJoNkWuqhK2_0kAMipdnDNzX8z6vmyLty93jP9bFP2rbMQE59B_DB8Udh6ht0Umc6jAWHJa6LFyhpM5pnpJmgoBvnFOlKwiWjd440lcabBFiqpCQt_HIMgc-N90QOQphQvbdhwZefIJX7CygbznizhaG5GIMAiXKGOewcbZaJcvawErIJaeB23c"
          alt="Newsletter promotion image"
          className="rounded-lg"
        />
      </div>
      
      <div className="w-2/3 ml-10">
        <h3 className="text-3xl font-bold text-muted-foreground mb-2">
          Weekly Newsletter - Great Deals Delivered!
        </h3>
        <p className="text-muted-foreground mb-6">
          See HUGE discounts and GREAT deals on the HOTTEST new items of the season! 
          Become a PriceGrabber Insider and get deals delivered right to your inbox.
        </p>
        
        <form className="flex" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full py-3 px-5 rounded-l-full border-2 border-border focus:outline-none focus:ring-2 focus:ring-indigo-400 transition duration-300"
            required
          />
          <Button 
            type="submit"
            className="bg-primary text-white font-semibold py-3 px-8 rounded-r-full hover:bg-primary transition duration-300"
          >
            Sign Up
          </Button>
        </form>
      </div>
    </section>
  );
}