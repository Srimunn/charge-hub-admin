import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo.jpeg';

const Login = () => {
  const [step, setStep] = useState<'google' | 'pin'>('google');
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setIsLoading(false);
    toast({
      title: 'Google Account Verified',
      description: 'Please enter your 4-digit PIN to continue.',
    });
    setStep('pin');
  };

  const handlePinDigit = (digit: string) => {
    const newPin = [...pin];
    const emptyIndex = newPin.findIndex((d) => d === '');
    if (emptyIndex !== -1) {
      newPin[emptyIndex] = digit;
      setPin(newPin);

      // Auto-submit when all 4 digits are entered
      if (emptyIndex === 3) {
        setTimeout(() => handlePinSubmit(newPin), 300);
      }
    }
  };

  const handlePinDelete = () => {
    const newPin = [...pin];
    const lastFilledIndex = newPin.map((d) => d !== '').lastIndexOf(true);
    if (lastFilledIndex !== -1) {
      newPin[lastFilledIndex] = '';
      setPin(newPin);
    }
  };

  const handlePinSubmit = async (currentPin: string[]) => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const pinStr = currentPin.join('');
    if (pinStr.length === 4) {
      toast({
        title: 'Login Successful',
        description: 'Welcome to the EV Charging Station Operator System',
      });
      navigate('/dashboard');
    } else {
      toast({
        title: 'Invalid PIN',
        description: 'Please enter a valid 4-digit PIN',
        variant: 'destructive',
      });
      setPin(['', '', '', '']);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 animate-fade-in-up">
          <img src={logo} alt="EV Charge Logo" className="w-20 h-20 rounded-2xl shadow-lg mb-4 object-cover" />
          <h1 className="text-2xl font-bold text-primary-foreground">EV Charge</h1>
          <p className="text-primary-foreground/70">Autonomous Wireless Charging</p>
        </div>

        <Card className="border-0 shadow-2xl animate-scale-in">
          {step === 'google' ? (
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl text-center">Operator Login</CardTitle>
                <CardDescription className="text-center">
                  Sign in with your Google account to continue
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full h-12 text-base gap-3 bg-white hover:bg-secondary text-foreground border border-border shadow-sm"
                  variant="outline"
                >
                  <Chrome className="w-5 h-5 text-accent" />
                  {isLoading ? 'Connecting...' : 'Continue with Google'}
                </Button>
                <div className="flex items-center gap-3 my-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">Secure enterprise login</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                  <Lock className="w-3 h-3" />
                  <span>Protected by two-factor authentication</span>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl text-center">Enter Your PIN</CardTitle>
                <CardDescription className="text-center">
                  Enter your 4-digit verification PIN
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* PIN Display */}
                <div className="flex justify-center gap-4">
                  {pin.map((digit, i) => (
                    <div
                      key={i}
                      className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all duration-200 ${
                        digit
                          ? 'border-primary bg-primary/5 text-foreground shadow-md'
                          : 'border-border bg-secondary/30 text-muted-foreground'
                      }`}
                    >
                      {digit ? '●' : ''}
                    </div>
                  ))}
                </div>

                {/* Numeric Keypad */}
                <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <Button
                      key={digit}
                      variant="outline"
                      className="h-14 text-xl font-semibold rounded-xl hover:bg-primary hover:text-primary-foreground transition-all duration-150 active:scale-95"
                      onClick={() => handlePinDigit(digit)}
                      disabled={isLoading}
                    >
                      {digit}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    className="h-14 text-sm font-medium rounded-xl text-muted-foreground"
                    onClick={() => setStep('google')}
                  >
                    Back
                  </Button>
                  <Button
                    variant="outline"
                    className="h-14 text-xl font-semibold rounded-xl hover:bg-primary hover:text-primary-foreground transition-all duration-150 active:scale-95"
                    onClick={() => handlePinDigit('0')}
                    disabled={isLoading}
                  >
                    0
                  </Button>
                  <Button
                    variant="outline"
                    className="h-14 text-lg rounded-xl text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={handlePinDelete}
                  >
                    ⌫
                  </Button>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Demo: enter any 4 digits
                </p>
              </CardContent>
            </>
          )}
        </Card>

        <p className="mt-8 text-center text-xs text-primary-foreground/60">
          © 2024 EV Charge Operator System. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
