import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Lock, Loader2, KeyRound, AlertTriangle } from "lucide-react";

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const mustChange = user?.must_change_password;

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mustChange && !currentPassword) {
      toast.error("Bitte geben Sie Ihr aktuelles Passwort ein");
      return;
    }
    if (password.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen haben");
      return;
    }
    if (password !== confirm) {
      toast.error("Die Passwörter stimmen nicht überein");
      return;
    }
    setLoading(true);
    try {
      const payload = { new_password: password };
      if (!mustChange) payload.current_password = currentPassword;
      await api.post("/auth/change-password", payload);
      toast.success("Passwort erfolgreich geändert");
      const updated = await refreshUser();
      // Route the user onward after a forced change
      if (updated?.is_super_admin) {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Ändern des Passworts");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white mb-4">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welkora</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Passwort ändern</CardTitle>
            <CardDescription>
              {mustChange
                ? "Bitte legen Sie ein neues Passwort fest, bevor Sie fortfahren."
                : "Aktualisieren Sie Ihr Passwort."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mustChange && (
              <div className="mb-4 flex gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>Ihr Konto verwendet ein Initial-Passwort. Aus Sicherheitsgründen müssen Sie es jetzt ändern.</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!mustChange && (
                <div className="space-y-2">
                  <Label htmlFor="current">Aktuelles Passwort</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="current"
                      type="password"
                      className="pl-10"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required={!mustChange}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">Neues Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mindestens 8 Zeichen"
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Passwort bestätigen</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Passwort wiederholen"
                    className="pl-10"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                Passwort ändern
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { logout(); navigate("/login"); }}
                className="w-full"
              >
                Abmelden
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
