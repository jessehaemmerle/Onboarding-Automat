import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Shield, Mail, Database, Clock, FileText, UserX, Download, Lock } from "lucide-react";

export default function Datenschutz() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Datenschutzerklärung</h1>
        <p className="text-slate-500 mt-2">Informationen gemäß Art. 13, 14 DSGVO</p>
      </div>

      <div className="space-y-6">
        {/* Verantwortlicher */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              1. Verantwortlicher
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              <strong>[Firmenname einfügen]</strong><br />
              [Straße und Hausnummer]<br />
              [PLZ Ort]<br />
              Deutschland
            </p>
            <p>
              <strong>Kontakt:</strong><br />
              Telefon: [Telefonnummer]<br />
              E-Mail: [E-Mail-Adresse]<br />
              Website: [Website-URL]
            </p>
            <p>
              <strong>Datenschutzbeauftragter:</strong><br />
              [Name des DSB]<br />
              E-Mail: [DSB E-Mail]
            </p>
          </CardContent>
        </Card>

        {/* Datenverarbeitung */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-green-600" />
              2. Welche Daten wir verarbeiten
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <h4>2.1 Stammdaten</h4>
            <ul>
              <li>Name, E-Mail-Adresse</li>
              <li>Rolle in der Organisation</li>
              <li>Zugehörige Abteilung</li>
            </ul>
            <p><strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)</p>

            <h4>2.2 Onboarding-/Offboarding-Daten</h4>
            <ul>
              <li>Mitarbeitername, E-Mail</li>
              <li>Startdatum, Standort</li>
              <li>Zugewiesene Aufgaben und deren Status</li>
              <li>Hochgeladene Nachweise</li>
            </ul>
            <p><strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (Berechtigtes Interesse an effizienten HR-Prozessen)</p>

            <h4>2.3 Protokolldaten</h4>
            <ul>
              <li>Login-Zeitpunkte</li>
              <li>IP-Adressen (anonymisiert)</li>
              <li>Änderungshistorie</li>
            </ul>
            <p><strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (Sicherheit und Nachvollziehbarkeit)</p>
          </CardContent>
        </Card>

        {/* Speicherdauer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              3. Speicherdauer
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left">Datenkategorie</th>
                  <th className="text-left">Speicherdauer</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Stammdaten</td>
                  <td>Bis zur Löschung des Accounts</td>
                </tr>
                <tr>
                  <td>Onboarding-Daten</td>
                  <td>3 Jahre nach Abschluss des Onboardings</td>
                </tr>
                <tr>
                  <td>Hochgeladene Nachweise</td>
                  <td>3 Jahre nach Upload</td>
                </tr>
                <tr>
                  <td>Protokolldaten</td>
                  <td>1 Jahr</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Ihre Rechte */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              4. Ihre Rechte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Auskunftsrecht (Art. 15)
                </h4>
                <p className="text-sm text-slate-600 mt-1">
                  Sie können jederzeit Auskunft über Ihre gespeicherten Daten verlangen.
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold flex items-center gap-2">
                  <UserX className="w-4 h-4" /> Löschungsrecht (Art. 17)
                </h4>
                <p className="text-sm text-slate-600 mt-1">
                  Sie können die Löschung Ihrer Daten verlangen.
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold flex items-center gap-2">
                  <Download className="w-4 h-4" /> Datenübertragbarkeit (Art. 20)
                </h4>
                <p className="text-sm text-slate-600 mt-1">
                  Sie können Ihre Daten in einem portablen Format erhalten.
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Widerspruchsrecht (Art. 21)
                </h4>
                <p className="text-sm text-slate-600 mt-1">
                  Sie können der Verarbeitung Ihrer Daten widersprechen.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Zur Ausübung Ihrer Rechte nutzen Sie bitte das Privacy Center in Ihren Profileinstellungen 
              oder kontaktieren Sie unseren Datenschutzbeauftragten.
            </p>
          </CardContent>
        </Card>

        {/* Beschwerderecht */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-red-600" />
              5. Beschwerderecht
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, 
              wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer Daten gegen die DSGVO verstößt.
            </p>
            <p>
              Die für uns zuständige Aufsichtsbehörde ist:<br />
              <strong>[Name der Aufsichtsbehörde]</strong><br />
              [Adresse]<br />
              [Kontaktdaten]
            </p>
          </CardContent>
        </Card>

        {/* Cookies */}
        <Card>
          <CardHeader>
            <CardTitle>6. Cookies und Tracking</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <p>
              Diese Anwendung verwendet ausschließlich technisch notwendige Cookies für:
            </p>
            <ul>
              <li>Session-Management (Anmeldestatus)</li>
              <li>Sicherheitsfunktionen (CSRF-Schutz)</li>
            </ul>
            <p>
              Es werden <strong>keine</strong> Tracking-Cookies oder Analyse-Tools von Drittanbietern eingesetzt.
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
