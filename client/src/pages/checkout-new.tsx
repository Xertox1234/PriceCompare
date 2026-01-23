import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useLocation } from 'wouter';
import {
  ChevronRight,
  CreditCard,
  Truck,
  Shield,
  Lock,
  MapPin,
  User,
  Mail,
  Phone,
  Home,
  Building2,
  Check,
} from 'lucide-react';
import { TemplateHeader, TemplateFooter } from '@/components/template';
import { CartSidebar } from '@/components/template/cart-sidebar';
import { MobileMenu, CompareModal, SearchModal } from '@/components/template/modals';
import { ShopProvider, useShop } from '@/context/shop-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, getProductImageUrl, handleImageError } from '@/lib/utils';

const FREE_SHIPPING_THRESHOLD = 99;

type CheckoutStep = 'shipping' | 'payment' | 'review';

interface ShippingForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface PaymentForm {
  cardNumber: string;
  cardName: string;
  expiry: string;
  cvv: string;
}

function CheckoutContent() {
  const [, navigate] = useLocation();
  const { cartItems, cartTotal, openCart, clearCart } = useShop();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping');
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');
  const [isProcessing, setIsProcessing] = useState(false);

  const [shippingForm, setShippingForm] = useState<ShippingForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
  });

  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvv: '',
  });

  const shipping =
    cartTotal >= FREE_SHIPPING_THRESHOLD ? 0 : shippingMethod === 'express' ? 19.99 : 9.99;
  const tax = cartTotal * 0.08; // 8% tax
  const total = cartTotal + shipping + tax;

  const steps: { id: CheckoutStep; label: string; icon: React.ReactNode }[] = [
    { id: 'shipping', label: 'Shipping', icon: <Truck className="h-5 w-5" /> },
    { id: 'payment', label: 'Payment', icon: <CreditCard className="h-5 w-5" /> },
    { id: 'review', label: 'Review', icon: <Check className="h-5 w-5" /> },
  ];

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep('payment');
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep('review');
  };

  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    // Simulate order processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    clearCart();
    navigate('/');
    // In real app, would redirect to order confirmation page
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  // Redirect to cart if empty
  if (cartItems.length === 0 && !isProcessing) {
    return (
      <>
        <Helmet>
          <title>Checkout | PriceCompare</title>
          <meta name="description" content="Complete your purchase securely." />
        </Helmet>
        <div className="bg-background min-h-screen">
          <TemplateHeader
          onOpenCart={openCart}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenCompare={() => setCompareOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="mb-4 text-2xl font-bold">Your cart is empty</h1>
          <p className="text-muted-foreground mb-8">
            Add some items to your cart before checking out.
          </p>
          <Link href="/shop">
            <Button>Continue Shopping</Button>
          </Link>
          </div>
          <TemplateFooter />
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Checkout | PriceCompare</title>
        <meta name="description" content="Complete your purchase securely." />
      </Helmet>
      <div className="bg-background min-h-screen">
        <TemplateHeader
          onOpenCart={openCart}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenCompare={() => setCompareOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />

        {/* Breadcrumbs */}
      <div className="border-border border-b py-4">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <Link
              href="/cart"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Cart
            </Link>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground font-medium">Checkout</span>
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Step Progress */}
        <div className="mb-8 flex items-center justify-center">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => {
                  if (step.id === 'shipping') setCurrentStep('shipping');
                  else if (step.id === 'payment' && currentStep !== 'shipping')
                    setCurrentStep('payment');
                }}
                className={cn(
                  'flex items-center gap-2 rounded-full px-4 py-2 transition-colors',
                  currentStep === step.id
                    ? 'bg-primary text-white'
                    : steps.findIndex((s) => s.id === currentStep) > index
                      ? 'bg-success/20 text-success'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {steps.findIndex((s) => s.id === currentStep) > index ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.icon
                )}
                <span className="hidden font-medium sm:inline">{step.label}</span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 w-12',
                    steps.findIndex((s) => s.id === currentStep) > index
                      ? 'bg-success'
                      : 'bg-border'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            {/* Shipping Step */}
            {currentStep === 'shipping' && (
              <form onSubmit={handleShippingSubmit} className="space-y-6">
                <div className="bg-card border-border rounded-2xl border p-6">
                  <h2 className="text-foreground mb-6 flex items-center gap-2 text-xl font-bold">
                    <MapPin className="text-primary h-5 w-5" />
                    Shipping Address
                  </h2>

                  <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="firstName">First Name *</Label>
                        <div className="relative mt-1">
                          <User className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                          <Input
                            id="firstName"
                            required
                            className="pl-10"
                            value={shippingForm.firstName}
                            onChange={(e) =>
                              setShippingForm({ ...shippingForm, firstName: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name *</Label>
                        <div className="relative mt-1">
                          <User className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                          <Input
                            id="lastName"
                            required
                            className="pl-10"
                            value={shippingForm.lastName}
                            onChange={(e) =>
                              setShippingForm({ ...shippingForm, lastName: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <div className="relative mt-1">
                          <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                          <Input
                            id="email"
                            type="email"
                            required
                            className="pl-10"
                            value={shippingForm.email}
                            onChange={(e) =>
                              setShippingForm({ ...shippingForm, email: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone *</Label>
                        <div className="relative mt-1">
                          <Phone className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                          <Input
                            id="phone"
                            type="tel"
                            required
                            className="pl-10"
                            value={shippingForm.phone}
                            onChange={(e) =>
                              setShippingForm({ ...shippingForm, phone: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="address">Street Address *</Label>
                      <div className="relative mt-1">
                        <Home className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <Input
                          id="address"
                          required
                          className="pl-10"
                          value={shippingForm.address}
                          onChange={(e) =>
                            setShippingForm({ ...shippingForm, address: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="apartment">Apartment, suite, etc.</Label>
                      <div className="relative mt-1">
                        <Building2 className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <Input
                          id="apartment"
                          className="pl-10"
                          value={shippingForm.apartment}
                          onChange={(e) =>
                            setShippingForm({ ...shippingForm, apartment: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          required
                          className="mt-1"
                          value={shippingForm.city}
                          onChange={(e) =>
                            setShippingForm({ ...shippingForm, city: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="state">State *</Label>
                        <Input
                          id="state"
                          required
                          className="mt-1"
                          value={shippingForm.state}
                          onChange={(e) =>
                            setShippingForm({ ...shippingForm, state: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="zipCode">ZIP Code *</Label>
                        <Input
                          id="zipCode"
                          required
                          className="mt-1"
                          value={shippingForm.zipCode}
                          onChange={(e) =>
                            setShippingForm({ ...shippingForm, zipCode: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shipping Method */}
                <div className="bg-card border-border rounded-2xl border p-6">
                  <h2 className="text-foreground mb-6 flex items-center gap-2 text-xl font-bold">
                    <Truck className="text-primary h-5 w-5" />
                    Shipping Method
                  </h2>

                  <div className="space-y-3">
                    <label
                      className={cn(
                        'flex cursor-pointer items-center justify-between rounded-xl border-2 p-4 transition-colors',
                        shippingMethod === 'standard'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shipping"
                          checked={shippingMethod === 'standard'}
                          onChange={() => setShippingMethod('standard')}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded-full border-2',
                            shippingMethod === 'standard'
                              ? 'border-primary'
                              : 'border-muted-foreground'
                          )}
                        >
                          {shippingMethod === 'standard' && (
                            <div className="bg-primary h-2.5 w-2.5 rounded-full" />
                          )}
                        </div>
                        <div>
                          <p className="text-foreground font-medium">Standard Shipping</p>
                          <p className="text-muted-foreground text-sm">5-7 business days</p>
                        </div>
                      </div>
                      <span className="text-foreground font-semibold">
                        {cartTotal >= FREE_SHIPPING_THRESHOLD ? 'FREE' : '$9.99'}
                      </span>
                    </label>

                    <label
                      className={cn(
                        'flex cursor-pointer items-center justify-between rounded-xl border-2 p-4 transition-colors',
                        shippingMethod === 'express'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shipping"
                          checked={shippingMethod === 'express'}
                          onChange={() => setShippingMethod('express')}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded-full border-2',
                            shippingMethod === 'express'
                              ? 'border-primary'
                              : 'border-muted-foreground'
                          )}
                        >
                          {shippingMethod === 'express' && (
                            <div className="bg-primary h-2.5 w-2.5 rounded-full" />
                          )}
                        </div>
                        <div>
                          <p className="text-foreground font-medium">Express Shipping</p>
                          <p className="text-muted-foreground text-sm">2-3 business days</p>
                        </div>
                      </div>
                      <span className="text-foreground font-semibold">$19.99</span>
                    </label>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary-hover w-full py-6 text-base"
                >
                  Continue to Payment
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </form>
            )}

            {/* Payment Step */}
            {currentStep === 'payment' && (
              <form onSubmit={handlePaymentSubmit} className="space-y-6">
                <div className="bg-card border-border rounded-2xl border p-6">
                  <h2 className="text-foreground mb-6 flex items-center gap-2 text-xl font-bold">
                    <CreditCard className="text-primary h-5 w-5" />
                    Payment Information
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="cardNumber">Card Number *</Label>
                      <div className="relative mt-1">
                        <CreditCard className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <Input
                          id="cardNumber"
                          required
                          placeholder="1234 5678 9012 3456"
                          className="pl-10"
                          maxLength={19}
                          value={paymentForm.cardNumber}
                          onChange={(e) =>
                            setPaymentForm({
                              ...paymentForm,
                              cardNumber: formatCardNumber(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="cardName">Name on Card *</Label>
                      <Input
                        id="cardName"
                        required
                        placeholder="John Doe"
                        className="mt-1"
                        value={paymentForm.cardName}
                        onChange={(e) =>
                          setPaymentForm({ ...paymentForm, cardName: e.target.value })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expiry">Expiry Date *</Label>
                        <Input
                          id="expiry"
                          required
                          placeholder="MM/YY"
                          className="mt-1"
                          maxLength={5}
                          value={paymentForm.expiry}
                          onChange={(e) =>
                            setPaymentForm({ ...paymentForm, expiry: formatExpiry(e.target.value) })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="cvv">CVV *</Label>
                        <Input
                          id="cvv"
                          required
                          placeholder="123"
                          className="mt-1"
                          maxLength={4}
                          value={paymentForm.cvv}
                          onChange={(e) =>
                            setPaymentForm({
                              ...paymentForm,
                              cvv: e.target.value.replace(/\D/g, ''),
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 mt-6 flex items-center gap-3 rounded-xl p-4">
                    <Lock className="text-primary h-5 w-5" />
                    <p className="text-muted-foreground text-sm">
                      Your payment information is encrypted and secure
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 py-6"
                    onClick={() => setCurrentStep('shipping')}
                  >
                    Back to Shipping
                  </Button>
                  <Button type="submit" className="bg-primary hover:bg-primary-hover flex-1 py-6">
                    Review Order
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </form>
            )}

            {/* Review Step */}
            {currentStep === 'review' && (
              <div className="space-y-6">
                {/* Shipping Summary */}
                <div className="bg-card border-border rounded-2xl border p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
                      <MapPin className="text-primary h-5 w-5" />
                      Shipping Address
                    </h2>
                    <button
                      onClick={() => setCurrentStep('shipping')}
                      className="text-primary text-sm hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="text-muted-foreground">
                    <p className="text-foreground font-medium">
                      {shippingForm.firstName} {shippingForm.lastName}
                    </p>
                    <p>{shippingForm.address}</p>
                    {shippingForm.apartment && <p>{shippingForm.apartment}</p>}
                    <p>
                      {shippingForm.city}, {shippingForm.state} {shippingForm.zipCode}
                    </p>
                    <p>{shippingForm.email}</p>
                    <p>{shippingForm.phone}</p>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="bg-card border-border rounded-2xl border p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-foreground flex items-center gap-2 text-xl font-bold">
                      <CreditCard className="text-primary h-5 w-5" />
                      Payment Method
                    </h2>
                    <button
                      onClick={() => setCurrentStep('payment')}
                      className="text-primary text-sm hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex h-8 w-12 items-center justify-center rounded text-xs font-bold">
                      VISA
                    </div>
                    <p className="text-muted-foreground">
                      Ending in {paymentForm.cardNumber.slice(-4)}
                    </p>
                  </div>
                </div>

                {/* Order Items */}
                <div className="bg-card border-border rounded-2xl border p-6">
                  <h2 className="text-foreground mb-4 text-xl font-bold">Order Items</h2>
                  <div className="space-y-4">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="bg-muted h-16 w-16 overflow-hidden rounded-lg">
                          <img
                            src={getProductImageUrl(item.image)}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            onError={handleImageError}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-foreground line-clamp-1 font-medium">{item.name}</p>
                          <p className="text-muted-foreground text-sm">Qty: {item.quantity}</p>
                        </div>
                        <p className="text-foreground font-semibold">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 py-6"
                    onClick={() => setCurrentStep('payment')}
                  >
                    Back to Payment
                  </Button>
                  <Button
                    onClick={() => void handlePlaceOrder()}
                    disabled={isProcessing}
                    className="bg-primary hover:bg-primary-hover flex-1 py-6"
                  >
                    {isProcessing ? (
                      <>
                        <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-5 w-5" />
                        Place Order - ${total.toFixed(2)}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-card border-border sticky top-4 space-y-6 rounded-2xl border p-6">
              <h2 className="text-foreground text-xl font-bold">Order Summary</h2>

              {/* Items */}
              <div className="max-h-64 space-y-3 overflow-y-auto">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="bg-muted relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
                      <img
                        src={getProductImageUrl(item.image)}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        onError={handleImageError}
                      />
                      <span className="bg-primary absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs text-white">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground line-clamp-2 text-sm font-medium">
                        {item.name}
                      </p>
                      <p className="text-primary text-sm font-semibold">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div className="border-border space-y-3 border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground font-medium">${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  {shipping === 0 ? (
                    <span className="text-success font-medium">FREE</span>
                  ) : (
                    <span className="text-foreground font-medium">${shipping.toFixed(2)}</span>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (8%)</span>
                  <span className="text-foreground font-medium">${tax.toFixed(2)}</span>
                </div>
                <div className="border-border flex justify-between border-t pt-3">
                  <span className="text-foreground text-lg font-bold">Total</span>
                  <span className="text-primary text-lg font-bold">${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="border-border grid grid-cols-2 gap-3 border-t pt-4">
                <div className="bg-muted/50 flex items-center gap-2 rounded-lg p-3">
                  <Shield className="text-primary h-5 w-5" />
                  <span className="text-muted-foreground text-xs">Secure Payment</span>
                </div>
                <div className="bg-muted/50 flex items-center gap-2 rounded-lg p-3">
                  <Lock className="text-primary h-5 w-5" />
                  <span className="text-muted-foreground text-xs">SSL Encrypted</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <TemplateFooter />

      {/* Modals */}
      <CartSidebar />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <CompareModal isOpen={compareOpen} onClose={() => setCompareOpen(false)} />
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <ShopProvider>
      <CheckoutContent />
    </ShopProvider>
  );
}
