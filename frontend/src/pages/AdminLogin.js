import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Shield, ArrowRight, Loader2, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AdminLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await login(loginData.email, loginData.password);
      
      // Check if user is super admin
      if (!response.user.is_super_admin) {
        toast.error("Keine Admin-Berechtigung. Dieser Login ist nur für System-Administratoren.");
        setIsLoading(false);
        return;
      }

      toast.success("Willkommen zurück, Administrator!");
      navigate("/admin");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login fehlgeschlagen");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-2xl border-purple-200">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-purple-900">System Administration</CardTitle>
          <CardDescription>Nur für autorisierte System-Administratoren</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">E-Mail</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@example.com"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                required
                data-testid="admin-login-email"
                className="border-purple-200 focus:border-purple-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Passwort</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                required
                data-testid="admin-login-password"
                className="border-purple-200 focus:border-purple-500"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 text-lg bg-purple-600 hover:bg-purple-700" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Anmeldung läuft...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5 mr-2" />
                  Admin-Login <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex gap-2">
              <Shield className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <div className="text-sm text-purple-800">
                <p className="font-semibold mb-1">Hinweis:</p>
                <p>Dieser Login ist nur für System-Administratoren mit Super-Admin-Rechten.</p>
                <p className="mt-2">
                  Für die normale App:{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="underline font-semibold hover:text-purple-900"
                  >
                    Zum normalen Login
                  </button>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
