import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { 
  CheckCircle2, Users, Clock, Shield, FileText, Bell, 
  BarChart3, Lock, Zap, ArrowRight, ChevronRight, 
  Building2, UserPlus, UserMinus, RefreshCw, Briefcase,
  ClipboardCheck, Calendar, Eye
} from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <UserPlus className="w-6 h-6" />,
      title: "Onboarding",
      description: "Strukturierte Checklisten für neue Mitarbeiter. Nichts wird vergessen.",
      color: "text-green-600 bg-green-100"
    },
    {
      icon: <UserMinus className="w-6 h-6" />,
      title: "Offboarding",
      description: "Sichere Austrittsprozesse mit vollständiger Dokumentation.",
      color: "text-red-600 bg-red-100"
    },
    {
      icon: <RefreshCw className="w-6 h-6" />,
      title: "Rollenwechsel",
      description: "Interne Wechsel effizient managen - Berechtigungen, Zugänge, Schulungen.",
      color: "text-orange-600 bg-orange-100"
    },
    {
      icon: <ClipboardCheck className="w-6 h-6" />,
      title: "Task-Management",
      description: "Aufgaben automatisch zuweisen mit Abhängigkeiten und Fristen.",
      color: "text-blue-600 bg-blue-100"
    },
    {
      icon: <Briefcase className="w-6 h-6" />,
      title: "Abteilungen",
      description: "Aufgaben nach Abteilungen filtern - jeder sieht nur seine Tasks.",
      color: "text-purple-600 bg-purple-100"
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Nachweise",
      description: "Dokumente hochladen und archivieren für Compliance-Anforderungen.",
      color: "text-cyan-600 bg-cyan-100"
    }
  ];

  const benefits = [
    {
      icon: <Clock className="w-8 h-8 text-blue-600" />,
      title: "Bis zu 70% Zeitersparnis",
      description: "Automatisierte Prozesse statt manueller Listen und E-Mails."
    },
    {
      icon: <CheckCircle2 className="w-8 h-8 text-green-600" />,
      title: "100% Vollständigkeit",
      description: "Keine vergessenen Aufgaben mehr durch strukturierte Templates."
    },
    {
      icon: <Shield className="w-8 h-8 text-purple-600" />,
      title: "DSGVO-konform",
      description: "Volle Datenschutz-Compliance mit Audit-Trail und Löschfunktionen."
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-orange-600" />,
      title: "Volle Transparenz",
      description: "Dashboard mit Echtzeit-Übersicht über alle laufenden Prozesse."
    }
  ];

  const stats = [
    { value: "500+", label: "Prozesse automatisiert" },
    { value: "70%", label: "Weniger Fehler" },
    { value: "3x", label: "Schnelleres Onboarding" },
    { value: "100%", label: "DSGVO-konform" }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">Onboarding-Automat</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/login")}>
                Anmelden
              </Button>
              <Button onClick={() => navigate("/register-organization")}>
                Kostenlos starten
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">
                🚀 HR-Prozesse automatisieren
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
                Onboarding & Offboarding{" "}
                <span className="text-blue-600">automatisieren</span>
              </h1>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed">
                Strukturierte Checklisten, automatische Aufgabenverteilung und volle Transparenz. 
                Der Onboarding-Automat macht Ihre HR-Prozesse effizienter und DSGVO-konform.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button size="lg" onClick={() => navigate("/register-organization")} className="gap-2">
                  Jetzt starten <ArrowRight className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/login")}>
                  Demo ansehen
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Keine Kreditkarte
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  DSGVO-konform
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Sofort einsatzbereit
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-1 shadow-2xl">
                <img 
                  src="https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=800" 
                  alt="Team Collaboration" 
                  className="rounded-xl w-full h-auto"
                />
              </div>
              {/* Floating Cards */}
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-lg p-4 border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">12 Tasks erledigt</p>
                    <p className="text-sm text-slate-500">Heute</p>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-4 border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">3 neue Mitarbeiter</p>
                    <p className="text-sm text-slate-500">Diese Woche</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-white">{stat.value}</p>
                <p className="text-slate-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-purple-100 text-purple-700 hover:bg-purple-100">
              Features
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Alles was Sie für HR-Prozesse brauchen
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Von der Einstellung bis zum Austritt - der Onboarding-Automat begleitet Sie durch jeden Schritt.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Card key={i} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.color}`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-green-100 text-green-700 hover:bg-green-100">
              So funktioniert's
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              In 3 Schritten zum automatisierten Prozess
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Template erstellen</h3>
              <p className="text-slate-600">
                Definieren Sie Ihre Aufgaben, Verantwortlichkeiten und Fristen in wiederverwendbaren Templates.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Prozess starten</h3>
              <p className="text-slate-600">
                Starten Sie ein Onboarding oder Offboarding - alle Tasks werden automatisch verteilt.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Fortschritt verfolgen</h3>
              <p className="text-slate-600">
                Behalten Sie den Überblick über alle Aufgaben im Dashboard und im Audit-Log.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-orange-100 text-orange-700 hover:bg-orange-100">
                Vorteile
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-8">
                Warum Unternehmen uns vertrauen
              </h2>
              <div className="space-y-6">
                {benefits.map((benefit, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0">
                      {benefit.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">{benefit.title}</h3>
                      <p className="text-slate-600">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?auto=format&fit=crop&w=800&q=80" 
                alt="Workflow Organization" 
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* DSGVO Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-white/10 text-white hover:bg-white/10">
                <Shield className="w-4 h-4 mr-1" /> DSGVO-Konform
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                100% Datenschutz-konform
              </h2>
              <p className="text-slate-300 text-lg mb-8">
                Der Onboarding-Automat wurde von Grund auf mit Datenschutz im Fokus entwickelt. 
                Alle Funktionen entsprechen den Anforderungen der DSGVO.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span>Auskunftsrecht (Art. 15)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span>Löschrecht (Art. 17)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span>Datenportabilität (Art. 20)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span>Audit-Trail</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span>Privacy Center</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span>Keine Tracking-Cookies</span>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-64 h-64 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Shield className="w-32 h-32 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Bereit für effizientere HR-Prozesse?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Starten Sie noch heute kostenlos und erleben Sie, wie einfach Onboarding sein kann.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/register-organization")} className="gap-2">
              Kostenlos registrieren <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/login")}>
              Anmelden
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">Onboarding-Automat</span>
              </div>
              <p className="text-slate-400">
                HR-Prozesse automatisieren, Zeit sparen, Compliance sichern.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produkt</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="/login" className="hover:text-white">Anmelden</a></li>
                <li><a href="/register-organization" className="hover:text-white">Registrieren</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Rechtliches</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="/datenschutz" className="hover:text-white">Datenschutz</a></li>
                <li><a href="/impressum" className="hover:text-white">Impressum</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Kontakt</h4>
              <ul className="space-y-2 text-slate-400">
                <li>[E-Mail einfügen]</li>
                <li>[Telefon einfügen]</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-slate-400">
            <p>© 2025 Onboarding-Automat. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
