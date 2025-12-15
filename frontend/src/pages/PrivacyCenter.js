import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Checkbox } from "../components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Shield, Download, Trash2, FileText, Eye, CheckCircle2, XCircle, AlertTriangle, Scale, Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PrivacyCenter() {
  const { user, isAdmin } = useAuth();
  const [privacyInfo, setPrivacyInfo] = useState(null);
  const [consents, setConsents] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [myData, setMyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [privacyRes, consentsRes] = await Promise.all([
        axios.get(`${API}/gdpr/privacy-info`),
        axios.get(`${API}/gdpr/consents`),
      ]);
      setPrivacyInfo(privacyRes.data);
      setConsents(consentsRes.data);
      
      if (isAdmin) {
        const deletionRes = await axios.get(`${API}/gdpr/deletion-requests`);
        setDeletionRequests(deletionRes.data);
      }
    } catch (err) {
      toast.error("Fehler beim Laden der Datenschutz-Informationen");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyData = async () => {
    try {
      const res = await axios.get(`${API}/gdpr/my-data`);
      setMyData(res.data);
      toast.success("Ihre Daten wurden geladen");
    } catch (err) {
      toast.error("Fehler beim Laden Ihrer Daten");
    }
  };

  const exportData = async (format = "json") => {
    try {
      const res = await axios.get(`${API}/gdpr/export?format=${format}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `meine_daten_${new Date().toISOString().split('T')[0]}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Daten exportiert");
    } catch (err) {
      toast.error("Fehler beim Export");
    }
  };

  const requestDeletion = async () => {
    if (!deleteConfirm) {
      toast.error("Bitte bestätigen Sie den Löschantrag");
      return;
    }
    try {
      await axios.post(`${API}/gdpr/delete-request`, { confirm: true, reason: deleteReason });
      toast.success("Löschantrag eingereicht");
      setShowDeleteDialog(false);
      setDeleteConfirm(false);
      setDeleteReason("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Einreichen");
    }
  };

  const revokeConsent = async (consentType) => {
    try {
      await axios.post(`${API}/gdpr/consents/${consentType}/revoke`);
      toast.success("Einwilligung widerrufen");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Widerrufen");
    }
  };

  const processDeletionRequest = async (requestId, action) => {
    try {
      await axios.post(`${API}/gdpr/deletion-requests/${requestId}/process?action=${action}`);
      toast.success(action === "approve" ? "Löschantrag genehmigt" : "Löschantrag abgelehnt");
      fetchData();
    } catch (err) {
      toast.error("Fehler bei der Bearbeitung");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="privacy-center">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          Datenschutz-Center
        </h1>
        <p className="text-slate-500 mt-1">DSGVO-konforme Verwaltung Ihrer Daten</p>
      </div>

      <Tabs defaultValue="rights" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rights" data-testid="tab-rights">Ihre Rechte</TabsTrigger>
          <TabsTrigger value="data" data-testid="tab-data">Meine Daten</TabsTrigger>
          <TabsTrigger value="consents" data-testid="tab-consents">Einwilligungen</TabsTrigger>
          {isAdmin && <TabsTrigger value="requests" data-testid="tab-requests">Löschanträge</TabsTrigger>}
        </TabsList>

        {/* Rights Tab */}
        <TabsContent value="rights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Ihre Rechte nach DSGVO
              </CardTitle>
              <CardDescription>
                Die DSGVO garantiert Ihnen umfassende Rechte bezüglich Ihrer personenbezogenen Daten
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {privacyInfo?.rights?.map((right, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900">{right.right}</h4>
                        <Badge variant="outline" className="text-xs">{right.article}</Badge>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{right.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                Datenverarbeitung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead>Aufbewahrung</TableHead>
                    <TableHead>Rechtsgrundlage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {privacyInfo?.data_categories?.map((cat, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{cat.category}</TableCell>
                      <TableCell>{cat.description}</TableCell>
                      <TableCell>{cat.retention}</TableCell>
                      <TableCell className="text-sm">{cat.legal_basis}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {privacyInfo?.data_controller && (
            <Card>
              <CardHeader>
                <CardTitle>Verantwortlicher</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{privacyInfo.data_controller.name}</p>
                {privacyInfo.data_controller.dpo_email && (
                  <p className="text-sm text-slate-600 mt-1">
                    Datenschutzbeauftragter: <a href={`mailto:${privacyInfo.data_controller.dpo_email}`} className="text-blue-600 hover:underline">{privacyInfo.data_controller.dpo_email}</a>
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* My Data Tab */}
        <TabsContent value="data" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={fetchMyData}>
              <CardContent className="p-6 text-center">
                <Eye className="w-10 h-10 mx-auto text-blue-600 mb-3" />
                <h3 className="font-semibold">Daten einsehen</h3>
                <p className="text-sm text-slate-500 mt-1">Art. 15 DSGVO - Auskunftsrecht</p>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => exportData("json")}>
              <CardContent className="p-6 text-center">
                <Download className="w-10 h-10 mx-auto text-emerald-600 mb-3" />
                <h3 className="font-semibold">Daten exportieren</h3>
                <p className="text-sm text-slate-500 mt-1">Art. 20 DSGVO - Datenübertragbarkeit</p>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowDeleteDialog(true)}>
              <CardContent className="p-6 text-center">
                <Trash2 className="w-10 h-10 mx-auto text-rose-600 mb-3" />
                <h3 className="font-semibold">Löschung beantragen</h3>
                <p className="text-sm text-slate-500 mt-1">Art. 17 DSGVO - Recht auf Vergessenwerden</p>
              </CardContent>
            </Card>
          </div>

          {myData && (
            <Card>
              <CardHeader>
                <CardTitle>Ihre gespeicherten Daten</CardTitle>
                <CardDescription>Exportiert am {format(parseISO(myData.exported_at), "dd.MM.yyyy HH:mm", { locale: de })}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* User Data */}
                <div>
                  <h4 className="font-semibold mb-2">Stammdaten</h4>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-slate-500">Name:</span> {myData.user?.name}</div>
                      <div><span className="text-slate-500">E-Mail:</span> {myData.user?.email}</div>
                      <div><span className="text-slate-500">Rolle:</span> {myData.user?.role}</div>
                      <div><span className="text-slate-500">Registriert:</span> {myData.user?.created_at && format(parseISO(myData.user.created_at), "dd.MM.yyyy")}</div>
                    </div>
                  </div>
                </div>

                {/* Cases Created */}
                <div>
                  <h4 className="font-semibold mb-2">Erstellte Onboardings ({myData.cases_created?.length || 0})</h4>
                  {myData.cases_created?.length > 0 ? (
                    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {myData.cases_created.map(c => (
                        <div key={c.id} className="p-3 text-sm">
                          <span className="font-medium">{c.employee_name}</span>
                          <span className="text-slate-500 ml-2">({c.template_name_snapshot})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Keine Onboardings erstellt</p>
                  )}
                </div>

                {/* Tasks */}
                <div>
                  <h4 className="font-semibold mb-2">Zugewiesene Tasks ({myData.tasks_assigned?.length || 0})</h4>
                  {myData.tasks_assigned?.length > 0 ? (
                    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {myData.tasks_assigned.slice(0, 10).map(t => (
                        <div key={t.id} className="p-3 text-sm flex justify-between">
                          <span>{t.title}</span>
                          <Badge variant={t.status === "done" ? "secondary" : "outline"}>{t.status}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Keine Tasks zugewiesen</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => exportData("json")} variant="outline" className="gap-2">
                    <Download className="w-4 h-4" /> JSON Export
                  </Button>
                  <Button onClick={() => exportData("csv")} variant="outline" className="gap-2">
                    <FileText className="w-4 h-4" /> CSV Export
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Consents Tab */}
        <TabsContent value="consents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ihre Einwilligungen</CardTitle>
              <CardDescription>Art. 7 DSGVO - Sie können Einwilligungen jederzeit widerrufen</CardDescription>
            </CardHeader>
            <CardContent>
              {consents.length > 0 ? (
                <div className="space-y-4">
                  {consents.map(consent => (
                    <div key={consent.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium capitalize">{consent.consent_type.replace("_", " ")}</h4>
                        <p className="text-sm text-slate-500">
                          Erteilt am: {format(parseISO(consent.consented_at), "dd.MM.yyyy HH:mm", { locale: de })}
                        </p>
                        {consent.revoked_at && (
                          <p className="text-sm text-rose-600">
                            Widerrufen am: {format(parseISO(consent.revoked_at), "dd.MM.yyyy HH:mm", { locale: de })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {consent.revoked_at ? (
                          <Badge variant="destructive">Widerrufen</Badge>
                        ) : (
                          <>
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Aktiv</Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => revokeConsent(consent.consent_type)}
                              className="text-rose-600"
                            >
                              Widerrufen
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">Keine Einwilligungen vorhanden</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deletion Requests Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="requests" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Löschanträge verwalten</CardTitle>
                <CardDescription>Bearbeitung innerhalb von 30 Tagen erforderlich (Art. 12 Abs. 3 DSGVO)</CardDescription>
              </CardHeader>
              <CardContent>
                {deletionRequests.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Benutzer</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Grund</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletionRequests.map(req => (
                        <TableRow key={req.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{req.user_name}</p>
                              <p className="text-sm text-slate-500">{req.user_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{format(parseISO(req.requested_at), "dd.MM.yyyy HH:mm")}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{req.reason || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={req.status === "pending" ? "outline" : req.status === "completed" ? "secondary" : "destructive"}>
                              {req.status === "pending" ? "Ausstehend" : req.status === "completed" ? "Abgeschlossen" : "Abgelehnt"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {req.status === "pending" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-emerald-600"
                                  onClick={() => processDeletionRequest(req.id, "approve")}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-rose-600"
                                  onClick={() => processDeletionRequest(req.id, "reject")}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-slate-500 text-center py-8">Keine Löschanträge vorhanden</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              Löschung beantragen
            </DialogTitle>
            <DialogDescription>
              Art. 17 DSGVO - Recht auf Löschung ("Recht auf Vergessenwerden")
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 mb-2">Hinweis</h4>
              <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                <li>Ihre Daten werden anonymisiert, nicht vollständig gelöscht</li>
                <li>Dies ist erforderlich für Audit-Trails und gesetzliche Aufbewahrungspflichten</li>
                <li>Ein Administrator wird Ihren Antrag innerhalb von 30 Tagen bearbeiten</li>
                <li>Nach der Löschung können Sie sich nicht mehr anmelden</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Grund für die Löschung (optional)</label>
              <Textarea
                placeholder="Warum möchten Sie Ihre Daten löschen lassen?"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="confirm"
                checked={deleteConfirm}
                onCheckedChange={setDeleteConfirm}
              />
              <label htmlFor="confirm" className="text-sm">
                Ich verstehe, dass mein Konto nach Genehmigung nicht mehr nutzbar ist
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Abbrechen</Button>
            <Button onClick={requestDeletion} variant="destructive" disabled={!deleteConfirm}>
              Löschung beantragen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
