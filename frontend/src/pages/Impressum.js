import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Building2, Mail, Phone, Globe, Scale, FileText } from "lucide-react";

export default function Impressum() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Impressum</h1>
        <p className="text-slate-500 mt-2">
          Offenlegung gemäß § 5 ECG (E-Commerce-Gesetz) und § 25 MedienG
        </p>
      </div>

      <div className="space-y-6">
        {/* Anbieter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Diensteanbieter / Medieninhaber
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              <strong>Jesse Haemmerle</strong> (Welkora)<br />
              [Rechtsform, z.B. Einzelunternehmen]<br />
              [Straße und Hausnummer]<br />
              [PLZ Ort]<br />
              Österreich
            </p>
          </CardContent>
        </Card>

        {/* Kontakt */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-green-600" />
              Kontakt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">Telefon</p>
                  <p className="font-medium">[Telefonnummer]</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">E-Mail</p>
                  <a href="mailto:jesse@haemmerle.at" className="font-medium text-blue-600 hover:underline">
                    jesse@haemmerle.at
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">Website</p>
                  <a href="https://welkora.net" className="font-medium text-blue-600 hover:underline">
                    welkora.net
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unternehmensdaten */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Unternehmensdaten
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              <strong>Unternehmensgegenstand:</strong> Software-as-a-Service für HR-Prozessautomatisierung<br />
              <strong>UID-Nummer:</strong> [ATU-Nummer, falls umsatzsteuerpflichtig]<br />
              <strong>Firmenbuchnummer:</strong> [FN-Nummer, falls eingetragen]<br />
              <strong>Firmenbuchgericht:</strong> [zuständiges Gericht, falls eingetragen]<br />
              <strong>Mitgliedschaft:</strong> [z.B. WKO – Wirtschaftskammer Österreich, falls zutreffend]
            </p>
          </CardContent>
        </Card>

        {/* Vertretung */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-purple-600" />
              Verantwortlich für den Inhalt
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>Jesse Haemmerle</p>
          </CardContent>
        </Card>

        {/* Online-Streitbeilegung */}
        <Card>
          <CardHeader>
            <CardTitle>Online-Streitbeilegung</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
              <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                https://ec.europa.eu/consumers/odr
              </a>
            </p>
            <p>
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </CardContent>
        </Card>

        {/* Haftungsausschluss */}
        <Card>
          <CardHeader>
            <CardTitle>Haftung für Inhalte und Links</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Haftung für Inhalte</h4>
            <p>
              Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
              Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
            </p>

            <h4>Haftung für Links</h4>
            <p>
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
              Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter
              verantwortlich.
            </p>

            <h4>Urheberrecht</h4>
            <p>
              Die auf dieser Website veröffentlichten Inhalte unterliegen dem österreichischen
              Urheberrecht. Jede Verwertung außerhalb der Grenzen des Urheberrechts bedarf der
              vorherigen schriftlichen Zustimmung des jeweiligen Urhebers.
            </p>
          </CardContent>
        </Card>

        {/* Stand */}
        <div className="text-center text-sm text-slate-500 mt-8">
          Stand: Juni 2026
        </div>
      </div>
    </div>
  );
}
