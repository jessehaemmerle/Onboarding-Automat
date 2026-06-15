import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Slider } from "../components/ui/slider";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "../components/ui/accordion";
import {
  CheckCircle2, Clock, Shield, FileText, BarChart3, Zap,
  ArrowRight, UserPlus, UserMinus, RefreshCw, Briefcase, ClipboardCheck,
  Lock, Sparkles,
} from "lucide-react";
import Seo, { SITE_URL } from "../components/Seo";
import {
  calculatePrice, formatEuro, PRESET_PLANS, MIN_USERS, MAX_SLIDER_USERS, DEFAULT_USERS,
} from "../lib/pricing";

const FAQS = [
  {
    q: "Brauche ich einen Lizenzschlüssel, um Welkora zu nutzen?",
    a: "Ja. Welkora wird pro Organisation lizenziert. Nach dem Kauf erhalten Sie einen Lizenzschlüssel, mit dem Sie Ihre Organisation registrieren und Benutzer anlegen können.",
  },
  {
    q: "Wie wird der Preis berechnet?",
    a: "Der Preis richtet sich nach der Anzahl Ihrer Benutzer. Je mehr Benutzer, desto günstiger der Preis pro Benutzer. Nutzen Sie den Preisrechner, um Ihren individuellen Monatspreis zu sehen.",
  },
  {
    q: "Ist Welkora DSGVO-konform?",
    a: "Ja. Welkora wurde von Grund auf mit Datenschutz im Fokus entwickelt: vollständiger Audit-Trail, Auskunfts- und Löschrechte, Datenportabilität und ein integriertes Privacy Center.",
  },
  {
    q: "Kann ich zwischen monatlicher und jährlicher Zahlung wählen?",
    a: "Ja. Bei jährlicher Zahlung erhalten Sie 2 Monate geschenkt – Sie zahlen also nur 10 statt 12 Monate.",
  },
  {
    q: "Welche Prozesse deckt Welkora ab?",
    a: "Onboarding, Offboarding und interne Rollenwechsel – jeweils mit strukturierten Checklisten, automatischer Aufgabenverteilung, Abhängigkeiten, Fristen und Nachweis-Dokumentation.",
  },
  {
    q: "Gibt es eine Mindestlaufzeit?",
    a: "Kontaktieren Sie unser Vertriebsteam für individuelle Konditionen. Wir bieten flexible Modelle für Unternehmen jeder Größe.",
  },
];

const FEATURES = [
  { icon: <UserPlus className="w-6 h-6" />, title: "Onboarding", description: "Strukturierte Checklisten für neue Mitarbeiter. Nichts wird vergessen.", color: "text-green-600 bg-green-100" },
  { icon: <UserMinus className="w-6 h-6" />, title: "Offboarding", description: "Sichere Austrittsprozesse mit vollständiger Dokumentation.", color: "text-red-600 bg-red-100" },
  { icon: <RefreshCw className="w-6 h-6" />, title: "Rollenwechsel", description: "Interne Wechsel effizient managen – Berechtigungen, Zugänge, Schulungen.", color: "text-orange-600 bg-orange-100" },
  { icon: <ClipboardCheck className="w-6 h-6" />, title: "Task-Management", description: "Aufgaben automatisch zuweisen mit Abhängigkeiten und Fristen.", color: "text-blue-600 bg-blue-100" },
  { icon: <Briefcase className="w-6 h-6" />, title: "Abteilungen", description: "Aufgaben nach Abteilungen filtern – jeder sieht nur seine Tasks.", color: "text-purple-600 bg-purple-100" },
  { icon: <FileText className="w-6 h-6" />, title: "Nachweise", description: "Dokumente hochladen und archivieren für Compliance-Anforderungen.", color: "text-cyan-600 bg-cyan-100" },
];

const BENEFITS = [
  { icon: <Clock className="w-8 h-8 text-blue-600" />, title: "Bis zu 70% Zeitersparnis", description: "Automatisierte Prozesse statt manueller Listen und E-Mails." },
  { icon: <CheckCircle2 className="w-8 h-8 text-green-600" />, title: "100% Vollständigkeit", description: "Keine vergessenen Aufgaben mehr durch strukturierte Templates." },
  { icon: <Shield className="w-8 h-8 text-purple-600" />, title: "DSGVO-konform", description: "Volle Datenschutz-Compliance mit Audit-Trail und Löschfunktionen." },
  { icon: <BarChart3 className="w-8 h-8 text-orange-600" />, title: "Volle Transparenz", description: "Dashboard mit Echtzeit-Übersicht über alle laufenden Prozesse." },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [annual, setAnnual] = useState(false);

  const price = useMemo(() => calculatePrice(users), [users]);

  const jsonLd = useMemo(() => {
    const low = calculatePrice(PRESET_PLANS[0]).monthly;
    const high = calculatePrice(PRESET_PLANS[PRESET_PLANS.length - 1]).monthly;
    return [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Welkora",
        url: SITE_URL,
        logo: `${SITE_URL}/logo512.png`,
        email: "kontakt@welkora.net",
        description: "Welkora automatisiert HR-Prozesse: Onboarding, Offboarding und Rollenwechsel – strukturiert, transparent und DSGVO-konform.",
      },
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Welkora",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "EUR",
          lowPrice: low,
          highPrice: high,
          offerCount: PRESET_PLANS.length,
        },
        description: "HR-Automatisierung für Onboarding, Offboarding und Rollenwechsel. DSGVO-konform, mit Audit-Trail und Task-Management.",
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ];
  }, []);

  const onUsersInput = (val) => {
    const n = parseInt(val, 10);
    if (Number.isNaN(n)) { setUsers(MIN_USERS); return; }
    setUsers(Math.min(9999, Math.max(MIN_USERS, n)));
  };

  return (
    <div className="min-h-screen bg-white">
      <Seo
        title="Welkora – HR-Prozesse automatisieren: Onboarding, Offboarding & Rollenwechsel"
        description="Welkora automatisiert Onboarding, Offboarding und Rollenwechsel mit strukturierten Checklisten, automatischer Aufgabenverteilung und vollem Audit-Trail. DSGVO-konform. Jetzt Preis berechnen."
        keywords="Onboarding Software, Offboarding, HR Automatisierung, Mitarbeiter Onboarding, DSGVO, Checklisten, Task Management, Rollenwechsel"
        path="/"
        jsonLd={jsonLd}
      />

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Hauptnavigation">
          <div className="flex justify-between items-center h-16">
            <a href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">Welkora</span>
            </a>
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <a href="#features" className="hover:text-blue-600">Features</a>
              <a href="#pricing" className="hover:text-blue-600">Preise</a>
              <a href="#faq" className="hover:text-blue-600">FAQ</a>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" onClick={() => navigate("/login")}>Anmelden</Button>
              <Button onClick={() => navigate("/kontakt")}>Vertrieb kontaktieren</Button>
            </div>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
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
                  Welkora macht Ihre HR-Prozesse effizienter und DSGVO-konform.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <Button size="lg" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} className="gap-2">
                    Preis berechnen <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/login")}>
                    Anmelden
                  </Button>
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-slate-500">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Sofort einsatzbereit</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> DSGVO-konform</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Made for Teams</div>
                </div>
              </div>
              <div className="relative">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-1 shadow-2xl">
                  <img
                    src="https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=800"
                    alt="Team bei der Zusammenarbeit am Onboarding-Prozess mit Welkora"
                    className="rounded-xl w-full h-auto"
                    loading="eager"
                    width="800"
                    height="534"
                  />
                </div>
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
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 bg-slate-900" aria-label="Kennzahlen">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: "500+", label: "Prozesse automatisiert" },
                { value: "70%", label: "Weniger Fehler" },
                { value: "3x", label: "Schnelleres Onboarding" },
                { value: "100%", label: "DSGVO-konform" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-3xl sm:text-4xl font-bold text-white">{stat.value}</p>
                  <p className="text-slate-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-4" id="features">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-purple-100 text-purple-700 hover:bg-purple-100">Features</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                Alles was Sie für HR-Prozesse brauchen
              </h2>
              <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
                Von der Einstellung bis zum Austritt – Welkora begleitet Sie durch jeden Schritt.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((feature, i) => (
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
        <section className="py-20 px-4 bg-slate-50" aria-label="So funktioniert es">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-green-100 text-green-700 hover:bg-green-100">So funktioniert's</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                In 3 Schritten zum automatisierten Prozess
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { n: 1, t: "Template erstellen", d: "Definieren Sie Aufgaben, Verantwortlichkeiten und Fristen in wiederverwendbaren Templates." },
                { n: 2, t: "Prozess starten", d: "Starten Sie ein Onboarding oder Offboarding – alle Tasks werden automatisch verteilt." },
                { n: 3, t: "Fortschritt verfolgen", d: "Behalten Sie den Überblick über alle Aufgaben im Dashboard und im Audit-Log." },
              ].map((step) => (
                <div key={step.n} className="text-center">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                    {step.n}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{step.t}</h3>
                  <p className="text-slate-600">{step.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing with dynamic calculator */}
        <section className="py-20 px-4" id="pricing">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">Preise & Lizenzen</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                Transparente, nutzerbasierte Preise
              </h2>
              <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
                Wählen Sie die Anzahl Ihrer Benutzer – der Preis aktualisiert sich automatisch.
              </p>
            </div>

            {/* Calculator */}
            <Card className="border-2 border-blue-100 shadow-xl">
              <CardContent className="p-6 sm:p-10">
                <div className="grid md:grid-cols-2 gap-10 items-center">
                  {/* Controls */}
                  <div>
                    {/* Billing toggle */}
                    <div className="inline-flex items-center bg-slate-100 rounded-lg p-1 mb-8">
                      <button
                        type="button"
                        onClick={() => setAnnual(false)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${!annual ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
                      >
                        Monatlich
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnnual(true)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-2 ${annual ? "bg-white shadow text-slate-900" : "text-slate-500"}`}
                      >
                        Jährlich
                        <span className="text-xs font-semibold text-green-600">−2 Monate</span>
                      </button>
                    </div>

                    <label htmlFor="user-count" className="block text-sm font-medium text-slate-700 mb-2">
                      Anzahl Benutzer
                    </label>
                    <div className="flex items-center gap-4 mb-6">
                      <Input
                        id="user-count"
                        type="number"
                        min={MIN_USERS}
                        value={users}
                        onChange={(e) => onUsersInput(e.target.value)}
                        className="w-24 text-lg font-semibold"
                      />
                      <span className="text-slate-500 text-sm">Benutzer</span>
                    </div>

                    <Slider
                      value={[Math.min(users, MAX_SLIDER_USERS)]}
                      min={MIN_USERS}
                      max={MAX_SLIDER_USERS}
                      step={1}
                      onValueChange={([v]) => setUsers(v)}
                      aria-label="Anzahl Benutzer"
                      className="mb-2"
                    />
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{MIN_USERS}</span>
                      <span>{MAX_SLIDER_USERS}+</span>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      {PRESET_PLANS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setUsers(p)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition ${users === p ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-blue-300"}`}
                        >
                          {p} Nutzer
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price display */}
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 text-white text-center">
                    {price.isEnterprise ? (
                      <div className="py-4">
                        <Sparkles className="w-10 h-10 mx-auto mb-4 text-blue-200" />
                        <p className="text-2xl font-bold mb-2">Enterprise</p>
                        <p className="text-blue-100 mb-6">Mehr als {MAX_SLIDER_USERS} Benutzer? Wir erstellen Ihnen ein individuelles Angebot.</p>
                        <Button size="lg" variant="secondary" className="w-full" onClick={() => navigate("/kontakt")}>
                          Angebot anfragen
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-blue-100 text-sm mb-2">Ihr Preis für {price.users} Benutzer</p>
                        <div className="flex items-end justify-center gap-1">
                          <span className="text-5xl font-bold">
                            {formatEuro(annual ? price.annualMonthly : price.monthly)}
                          </span>
                          <span className="text-blue-100 mb-2">/Monat</span>
                        </div>
                        <p className="text-blue-200 text-sm mt-2">
                          {formatEuro(price.perUser)} pro Benutzer
                        </p>
                        {annual ? (
                          <p className="text-blue-100 text-sm mt-1">
                            {formatEuro(price.annual)} jährlich abgerechnet
                          </p>
                        ) : (
                          <p className="text-blue-100 text-sm mt-1">monatlich abgerechnet</p>
                        )}
                        <Button size="lg" variant="secondary" className="w-full mt-6" onClick={() => navigate("/kontakt")}>
                          Jetzt starten
                        </Button>
                        <p className="text-blue-200 text-xs mt-3">Lizenzschlüssel inklusive · alle Features</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Included features */}
            <div className="mt-12">
              <h3 className="text-center text-lg font-semibold text-slate-900 mb-8">
                Alle Lizenzen beinhalten:
              </h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  "Unbegrenzte Onboardings", "Unbegrenzte Templates", "Abteilungen & Rollen",
                  "Task-Abhängigkeiten", "Vollständiges Audit-Log", "DSGVO-Konformität",
                  "Privacy Center", "E-Mail-Support",
                ].map((feat) => (
                  <div key={feat} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20 px-4 bg-slate-50" aria-label="Vorteile">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-orange-100 text-orange-700 hover:bg-orange-100">Vorteile</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                Warum Unternehmen auf Welkora setzen
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {BENEFITS.map((b, i) => (
                <Card key={i} className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="mb-4">{b.icon}</div>
                    <h3 className="font-semibold text-slate-900 mb-1">{b.title}</h3>
                    <p className="text-slate-600 text-sm">{b.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* DSGVO */}
        <section className="py-20 px-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white" aria-label="Datenschutz">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge className="mb-4 bg-white/10 text-white hover:bg-white/10">
                  <Shield className="w-4 h-4 mr-1" /> DSGVO-Konform
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">100% Datenschutz-konform</h2>
                <p className="text-slate-300 text-lg mb-8">
                  Welkora wurde von Grund auf mit Datenschutz im Fokus entwickelt.
                  Alle Funktionen entsprechen den Anforderungen der DSGVO.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    "Auskunftsrecht (Art. 15)", "Löschrecht (Art. 17)",
                    "Datenportabilität (Art. 20)", "Audit-Trail",
                    "Privacy Center", "Keine Tracking-Cookies",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-center">
                <div className="w-64 h-64 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Lock className="w-32 h-32 text-white" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 px-4" id="faq">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">FAQ</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Häufige Fragen</h2>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-slate-900">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-slate-600">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 bg-slate-50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Bereit für effizientere HR-Prozesse?
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              Starten Sie noch heute und erleben Sie, wie einfach Onboarding sein kann.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => navigate("/kontakt")} className="gap-2">
                Vertrieb kontaktieren <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/login")}>
                Anmelden
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">Welkora</span>
              </div>
              <p className="text-slate-400">HR-Prozesse automatisieren, Zeit sparen, Compliance sichern.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Produkt</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#pricing" className="hover:text-white">Preise</a></li>
                <li><a href="/login" className="hover:text-white">Anmelden</a></li>
                <li><a href="/register-organization" className="hover:text-white">Registrieren</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Rechtliches</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="/datenschutz" className="hover:text-white">Datenschutz</a></li>
                <li><a href="/impressum" className="hover:text-white">Impressum</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Kontakt</h3>
              <ul className="space-y-2 text-slate-400">
                <li><a href="/kontakt" className="hover:text-white">Vertrieb kontaktieren</a></li>
                <li><a href="mailto:kontakt@welkora.net" className="hover:text-white">kontakt@welkora.net</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-slate-400">
            <p>© {new Date().getFullYear()} Welkora. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
