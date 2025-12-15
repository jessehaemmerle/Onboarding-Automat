import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Users, ArrowRight, Loader2 } from "lucide-react";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ name: "", email: "", password: "" });
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(loginData.email, loginData.password);
      toast.success("Willkommen zurück!");
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login fehlgeschlagen");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await register(registerData.name, registerData.email, registerData.password);
      toast.success("Konto erstellt! Willkommen!");
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registrierung fehlgeschlagen");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left - Form */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Onboarding-Automat</h1>
            <p className="text-slate-500 mt-2">Onboarding standardisieren, Zeit sparen.</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" data-testid="login-tab">Anmelden</TabsTrigger>
              <TabsTrigger value="register" data-testid="register-tab">Registrieren</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="border-0 shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-xl">Anmelden</CardTitle>
                  <CardDescription>Melden Sie sich mit Ihren Zugangsdaten an.</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">E-Mail</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="name@firma.de"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        required
                        data-testid="login-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Passwort</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                        data-testid="login-password"
                      />
                    </div>
                    <Button type="submit" className="w-full btn-primary" disabled={isLoading} data-testid="login-submit">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Anmelden <ArrowRight className="w-4 h-4 ml-2" /></>}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="border-0 shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-xl">Konto erstellen</CardTitle>
                  <CardDescription>Der erste Benutzer wird automatisch Administrator.</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name">Name</Label>
                      <Input
                        id="register-name"
                        type="text"
                        placeholder="Max Mustermann"
                        value={registerData.name}
                        onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                        required
                        data-testid="register-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">E-Mail</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="name@firma.de"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        required
                        data-testid="register-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Passwort</Label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="••••••••"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                        required
                        data-testid="register-password"
                      />
                    </div>
                    <Button type="submit" className="w-full btn-primary" disabled={isLoading} data-testid="register-submit">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Registrieren <ArrowRight className="w-4 h-4 ml-2" /></>}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right - Hero Image */}
      <div className="hidden lg:block relative bg-gradient-to-br from-blue-50 to-slate-100">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-lg text-center">
            <img
              src="https://images.unsplash.com/photo-1758691736975-9f7f643d178e?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"
              alt="Team Collaboration"
              className="rounded-2xl shadow-2xl mb-8"
            />
            <h2 className="text-2xl font-bold text-slate-900 mb-3">In 5 Minuten eingerichtet</h2>
            <p className="text-slate-600">
              Keine HR-Suite-Komplexität. Fokussiert auf Aufgaben-Execution.
              Weniger No-Shows, weniger Chaos, weniger Security-Risiken.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
