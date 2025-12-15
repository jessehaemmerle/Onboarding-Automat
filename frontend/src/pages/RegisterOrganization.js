import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Building2, Key, User, Mail, Lock, Loader2, CheckCircle2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RegisterOrganization() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    license_key: "",
    admin_name: "",
    admin_email: "",
    admin_password: "",
    confirm_password: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.admin_password !== formData.confirm_password) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }

    if (formData.admin_password.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/register-organization`, {
        name: formData.name,
        license_key: formData.license_key,
        admin_name: formData.admin_name,
        admin_email: formData.admin_email,
        admin_password: formData.admin_password,
      });

      // Store token
      localStorage.setItem("token", res.data.access_token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.access_token}`;

      toast.success("Firma erfolgreich registriert!");
      navigate("/");
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Fehler bei der Registrierung";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const isValid =
    formData.name &&
    formData.license_key &&
    formData.admin_name &&
    formData.admin_email &&
    formData.admin_password &&
    formData.confirm_password;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold text-slate-900">Firma registrieren</CardTitle>
            <CardDescription className="text-base mt-2">
              Registrieren Sie Ihre Firma mit einem gültigen Lizenzschlüssel
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Firmeninformationen
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="name">Firmenname *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="z.B. Meine Firma GmbH"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="license_key" className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Lizenzschlüssel *
                  </Label>
                  <Input
                    id="license_key"
                    type="text"
                    placeholder="OA-XXXX-XXXX-XXXX"
                    value={formData.license_key}
                    onChange={(e) => setFormData({ ...formData, license_key: e.target.value.toUpperCase() })}
                    className="font-mono"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Geben Sie den Lizenzschlüssel ein, den Sie erhalten haben
                  </p>
                </div>
              </div>
            </div>

            {/* Admin User Info */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5" />
                Administrator-Account
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="admin_name">Name *</Label>
                  <Input
                    id="admin_name"
                    type="text"
                    placeholder="Max Mustermann"
                    value={formData.admin_name}
                    onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="admin_email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    E-Mail *
                  </Label>
                  <Input
                    id="admin_email"
                    type="email"
                    placeholder="admin@firma.de"
                    value={formData.admin_email}
                    onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="admin_password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Passwort *
                  </Label>
                  <Input
                    id="admin_password"
                    type="password"
                    placeholder="Mindestens 8 Zeichen"
                    value={formData.admin_password}
                    onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="confirm_password">Passwort bestätigen *</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    placeholder="Passwort wiederholen"
                    value={formData.confirm_password}
                    onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex flex-col gap-3 pt-4">
              <Button
                type="submit"
                disabled={!isValid || loading}
                className="w-full btn-primary h-12 text-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Registriere...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Firma registrieren
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/login")}
                disabled={loading}
                className="w-full"
              >
                Zurück zum Login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
