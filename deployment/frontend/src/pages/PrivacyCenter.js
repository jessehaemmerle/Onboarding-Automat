import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../components/ui/alert-dialog";
import { Input } from "../components/ui/input";
import { Shield, Download, Trash2, Eye, FileText, Clock, Database, AlertTriangle, Loader2, CheckCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PrivacyCenter() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [myData, setMyData] = useState(null);
  const [consents, setConsents] = useState([]);
  const [showDataDialog, setShowDataDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dataRes, consentsRes] = await Promise.all([
        axios.get(`${API}/gdpr/my-data`),
        axios.get(`${API}/gdpr/consents`)
      ]);
      setMyData(dataRes.data);
      setConsents(consentsRes.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const exportData = async (format) => {
    setExporting(true);
    try {
      const response = await axios.get(`${API}/gdpr/export?format=${format}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `meine_daten_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Daten als ${format.toUpperCase()} exportiert`);
    } catch (err) {
      toast.error("Fehler beim Exportieren");
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== user?.email) {
      toast.error("Bitte geben Sie Ihre E-Mail-Adresse korrekt ein");
      return;
    }
    
    setDeleting(true);
    try {
      await axios.delete(`${API}/gdpr/delete-account?confirm=true`);
      toast.success("Ihr Account wurde gelöscht");
      logout();
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Löschen des Accounts");
    } finally {
      setDeleting(false);
    }
  };

  const updateConsent = async (consentType, granted) => {
    try {
      await axios.post(`${API}/gdpr/consents?consent_type=${consentType}&granted=${granted}`);
      toast.success(`Einwilligung ${granted ? 'erteilt' : 'widerrufen'}`);
      fetchData();
    } catch (err) {
      toast.error("Fehler beim Aktualisieren der Einwilligung");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          Privacy Center
        </h1>
        <p className="text-slate-500 mt-2">Verwalten Sie Ihre Daten gemäß DSGVO</p>
      </div>

      <div className="space-y-6">
        {/* Datenübersicht */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Ihre gespeicherten Daten
            </CardTitle>
            <CardDescription>Übersicht über alle zu Ihrer Person gespeicherten Daten (Art. 15 DSGVO)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="p-4 bg-slate-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">{myData?.cases_created?.length || 0}</p>
                <p className="text-sm text-slate-500">Erstellte Cases</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{myData?.tasks_assigned?.length || 0}</p>
                <p className="text-sm text-slate-500">Zugewiesene Tasks</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600">{myData?.comments?.length || 0}</p>
                <p className="text-sm text-slate-500">Kommentare</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-orange-600">{myData?.evidence_uploaded?.length || 0}</p>
                <p className="text-sm text-slate-500">Hochgeladene Dateien</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowDataDialog(true)}>
              <Eye className="w-4 h-4 mr-2" />
              Alle Daten anzeigen
            </Button>
          </CardContent>
        </Card>

        {/* Datenexport */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Datenexport
            </CardTitle>
            <CardDescription>Exportieren Sie Ihre Daten in einem portablen Format (Art. 20 DSGVO)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button onClick={() => exportData('json')} disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                Als JSON exportieren
              </Button>
              <Button variant="outline" onClick={() => exportData('csv')} disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Als CSV exportieren
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Einwilligungen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Einwilligungen
            </CardTitle>
            <CardDescription>Verwalten Sie Ihre erteilten Einwilligungen (Art. 7 DSGVO)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="font-medium">E-Mail-Benachrichtigungen</Label>
                  <p className="text-sm text-slate-500">Benachrichtigungen über neue Aufgaben und Erinnerungen</p>
                </div>
                <Switch
                  checked={consents.find(c => c.consent_type === 'email_notifications')?.granted !== false}
                  onCheckedChange={(v) => updateConsent('email_notifications', v)}
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="font-medium">Aktivitätsprotokoll</Label>
                  <p className="text-sm text-slate-500">Protokollierung Ihrer Aktivitäten für Sicherheitszwecke</p>
                </div>
                <Switch
                  checked={consents.find(c => c.consent_type === 'activity_logging')?.granted !== false}
                  onCheckedChange={(v) => updateConsent('activity_logging', v)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account löschen */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Account löschen
            </CardTitle>
            <CardDescription>Löschen Sie Ihren Account und alle damit verbundenen Daten (Art. 17 DSGVO)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Achtung: Diese Aktion kann nicht rückgängig gemacht werden!</p>
                  <ul className="text-sm text-red-700 mt-2 list-disc list-inside">
                    <li>Ihr Account wird deaktiviert</li>
                    <li>Ihre personenbezogenen Daten werden anonymisiert</li>
                    <li>Hochgeladene Dateien werden gelöscht</li>
                    <li>Sie können sich nicht mehr anmelden</li>
                  </ul>
                </div>
              </div>
            </div>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Account unwiderruflich löschen
            </Button>
          </CardContent>
        </Card>

        {/* Links */}
        <div className="flex justify-center gap-4 text-sm text-slate-500">
          <a href="/datenschutz" className="hover:text-blue-600 hover:underline">Datenschutzerklärung</a>
          <span>•</span>
          <a href="/impressum" className="hover:text-blue-600 hover:underline">Impressum</a>
        </div>
      </div>

      {/* Daten-Detail-Dialog */}
      <Dialog open={showDataDialog} onOpenChange={setShowDataDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ihre gespeicherten Daten</DialogTitle>
            <DialogDescription>Vollständige Übersicht gemäß Art. 15 DSGVO</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Stammdaten */}
            <div>
              <h4 className="font-semibold mb-2">Stammdaten</h4>
              <div className="bg-slate-50 p-4 rounded-lg text-sm">
                <p><strong>Name:</strong> {myData?.user?.name}</p>
                <p><strong>E-Mail:</strong> {myData?.user?.email}</p>
                <p><strong>Rolle:</strong> {myData?.user?.role}</p>
                <p><strong>Erstellt am:</strong> {myData?.user?.created_at}</p>
              </div>
            </div>
            
            {/* Datenkategorien */}
            <div>
              <h4 className="font-semibold mb-2">Datenkategorien</h4>
              <div className="space-y-2">
                {myData?.data_categories?.map((cat, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded">
                    <span className="font-medium">{cat.category}</span>
                    <span className="text-sm text-slate-500">{cat.description}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Aktivitäten */}
            <div>
              <h4 className="font-semibold mb-2">Letzte Aktivitäten</h4>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {myData?.recent_activities?.slice(0, 10).map((log, i) => (
                  <div key={i} className="text-sm p-2 bg-slate-50 rounded flex justify-between">
                    <span>{log.action}: {log.resource_type}</span>
                    <span className="text-slate-400">{new Date(log.timestamp).toLocaleString('de-DE')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDataDialog(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lösch-Bestätigungsdialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Account wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle Ihre personenbezogenen Daten werden anonymisiert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="text-sm">Geben Sie Ihre E-Mail-Adresse ein, um zu bestätigen:</Label>
            <Input
              className="mt-2"
              placeholder={user?.email}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <Button 
              variant="destructive" 
              onClick={deleteAccount} 
              disabled={deleting || deleteConfirm !== user?.email}
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Endgültig löschen
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
