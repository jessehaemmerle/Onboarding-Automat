import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Building2, Mail, Phone, Globe, Scale, FileText } from "lucide-react";

export default function Impressum() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Impressum</h1>
        <p className="text-slate-500 mt-2">Angaben gemäß § 5 TMG</p>
      </div>

      <div className="space-y-6">
        {/* Anbieter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Anbieter
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              <strong>[Firmenname einfügen]</strong><br />
              [Rechtsform, z.B. GmbH]<br />
              [Straße und Hausnummer]<br />
              [PLZ Ort]<br />
              Deutschland
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
                  <p className="font-medium">[E-Mail-Adresse]</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">Website</p>
                  <p className="font-medium">[Website-URL]</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vertretung */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-purple-600" />
              Vertretungsberechtigte
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              <strong>Geschäftsführer:</strong><br />
              [Name des/der Geschäftsführer(s)]
            </p>
          </CardContent>
        </Card>

        {/* Register */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Registereintrag
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              <strong>Registergericht:</strong> [Amtsgericht Ort]<br />
              <strong>Registernummer:</strong> HRB [Nummer]<br />
              <strong>USt-IdNr.:</strong> DE[Nummer]
            </p>
          </CardContent>
        </Card>

        {/* Haftungsausschluss */}
        <Card>
          <CardHeader>
            <CardTitle>Haftungsausschluss</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>Haftung für Inhalte</h4>
            <p>
              Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. 
              Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
            </p>
            
            <h4>Haftung für Links</h4>
            <p>
              Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben. 
              Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
            </p>
          </CardContent>
        </Card>

        {/* Online-Streitbeilegung */}
        <Card>
          <CardHeader>
            <CardTitle>Online-Streitbeilegung</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: 
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

        {/* Stand */}
        <div className="text-center text-sm text-slate-500 mt-8">
          Stand: Dezember 2025
        </div>
      </div>
    </div>
  );
}
