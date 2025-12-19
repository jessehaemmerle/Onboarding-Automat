import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { 
  Zap, Mail, Phone, Building2, Users, Send, 
  CheckCircle2, ArrowLeft, Loader2, MessageSquare
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Kontakt() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    company: "",
    name: "",
    email: "",
    phone: "",
    employees: "",
    message: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.company || !form.name || !form.email) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/contact/sales`, form);
      setSubmitted(true);
      toast.success("Vielen Dank! Wir melden uns in Kürze bei Ihnen.");
    } catch (err) {
      toast.error("Fehler beim Senden. Bitte versuchen Sie es erneut.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-12 pb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Anfrage gesendet!</h2>
            <p className="text-slate-600 mb-6">
              Vielen Dank für Ihr Interesse an OnboardIQ. Unser Vertriebsteam wird sich 
              innerhalb von 24 Stunden bei Ihnen melden.
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate("/home")} className="w-full">
                Zurück zur Startseite
              </Button>
              <Button variant="outline" onClick={() => navigate("/login")} className="w-full">
                Zur Anmeldung
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button onClick={() => navigate("/home")} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">OnboardIQ</span>
            </button>
            <Button variant="ghost" onClick={() => navigate("/login")}>
              Anmelden
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <button 
          onClick={() => navigate("/home")} 
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück zur Startseite
        </button>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left Side - Info */}
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Vertrieb kontaktieren
            </h1>
            <p className="text-lg text-slate-600 mb-8">
              Erfahren Sie, wie OnboardIQ Ihre HR-Prozesse automatisieren kann. 
              Unser Team berät Sie gerne und erstellt ein individuelles Angebot.
            </p>

            <div className="space-y-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Persönliche Demo</h3>
                  <p className="text-slate-600">Wir zeigen Ihnen OnboardIQ live und beantworten alle Fragen.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Bedarfsanalyse</h3>
                  <p className="text-slate-600">Gemeinsam finden wir die optimale Lösung für Ihr Unternehmen.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Individuelles Angebot</h3>
                  <p className="text-slate-600">Sie erhalten ein maßgeschneidertes Angebot mit Lizenzschlüssel.</p>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <Card className="bg-slate-50 border-0">
              <CardContent className="p-6">
                <h4 className="font-semibold text-slate-900 mb-4">Direkter Kontakt</h4>
                <div className="space-y-3">
                  <a href="mailto:jesse@haemmerle.at" className="flex items-center gap-3 text-slate-600 hover:text-blue-600">
                    <Mail className="w-5 h-5" />
                    jesse@haemmerle.at
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Form */}
          <div>
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle>Kontaktformular</CardTitle>
                <CardDescription>
                  Füllen Sie das Formular aus und wir melden uns innerhalb von 24 Stunden.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Unternehmen *</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="company"
                        placeholder="Muster GmbH"
                        className="pl-10"
                        value={form.company}
                        onChange={(e) => setForm({ ...form, company: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Ihr Name *</Label>
                      <Input
                        id="name"
                        placeholder="Max Mustermann"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employees">Mitarbeiteranzahl</Label>
                      <Select value={form.employees} onValueChange={(v) => setForm({ ...form, employees: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Bitte wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-10">1-10 Mitarbeiter</SelectItem>
                          <SelectItem value="11-25">11-25 Mitarbeiter</SelectItem>
                          <SelectItem value="26-50">26-50 Mitarbeiter</SelectItem>
                          <SelectItem value="51-100">51-100 Mitarbeiter</SelectItem>
                          <SelectItem value="100+">Über 100 Mitarbeiter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">E-Mail *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="max@muster.de"
                          className="pl-10"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefon</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+49 123 456789"
                          className="pl-10"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Ihre Nachricht</Label>
                    <Textarea
                      id="message"
                      placeholder="Erzählen Sie uns von Ihren Anforderungen..."
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                    />
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Wird gesendet...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Anfrage senden
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-slate-500 text-center">
                    Mit dem Absenden stimmen Sie unserer{" "}
                    <a href="/datenschutz" className="text-blue-600 hover:underline">Datenschutzerklärung</a> zu.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8 px-4 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">OnboardIQ</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <a href="/datenschutz" className="hover:text-white">Datenschutz</a>
            <a href="/impressum" className="hover:text-white">Impressum</a>
          </div>
          <p className="text-sm text-slate-400">© 2025 OnboardIQ</p>
        </div>
      </footer>
    </div>
  );
}
