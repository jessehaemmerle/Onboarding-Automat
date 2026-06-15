import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Users, ArrowRight, Loader2, Building2 } from "lucide-react";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await login(loginData.email, loginData.password);
      toast.success("Willkommen zurück!");

      // Erzwungener Passwortwechsel bei Initial-Passwort
      if (response.user.must_change_password) {
        navigate("/change-password");
      } else if (response.user.is_super_admin) {
        // Super-Admins zum Admin-Bereich weiterleiten
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login fehlgeschlagen");
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
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welkora</h1>
            <p className="text-slate-500 mt-2">Onboarding standardisieren, Zeit sparen.</p>
          </div>

          <Card className="border-0 shadow-none">
            <CardHeader className="px-0">
              <CardTitle className="text-xl">Anmelden</CardTitle>
              <CardDescription>Melden Sie sich mit Ihren Zugangsdaten an.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 space-y-6">
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
                <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Anmeldung läuft...
                    </>
                  ) : (
                    <>Anmelden <ArrowRight className="w-5 h-5 ml-2" /></>
                  )}
                </Button>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Passwort vergessen?
                  </button>
                </div>
              </form>

              {/* Organization Registration Link */}
              <div className="pt-4 border-t border-slate-200">
                <div className="text-center mb-3">
                  <p className="text-sm text-slate-600 mb-1">Noch keine Firma registriert?</p>
                  <p className="text-xs text-slate-500">Registrierung nur mit gültigem Lizenzschlüssel</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/register-organization")}
                  className="w-full gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  Firma registrieren
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* DSGVO Links */}
          <div className="text-center text-sm text-slate-500 space-x-4">
            <a href="/datenschutz" className="hover:text-blue-600 hover:underline">Datenschutz</a>
            <span>•</span>
            <a href="/impressum" className="hover:text-blue-600 hover:underline">Impressum</a>
          </div>
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
