import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { 
  Plus, Trash2, Edit, Shield, FileCheck, FileX, Clock, Files,
  Loader2, AlertCircle, CheckCircle2, Settings2, Info
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FILE_TYPE_OPTIONS = [
  { value: "application/pdf", label: "PDF", icon: "📄" },
  { value: "image/jpeg", label: "JPEG Bild", icon: "🖼️" },
  { value: "image/png", label: "PNG Bild", icon: "🖼️" },
  { value: "image/gif", label: "GIF Bild", icon: "🖼️" },
  { value: "application/msword", label: "Word (DOC)", icon: "📝" },
  { value: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word (DOCX)", icon: "📝" },
  { value: "application/vnd.ms-excel", label: "Excel (XLS)", icon: "📊" },
  { value: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel (XLSX)", icon: "📊" },
];

export default function EvidencePolicies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: "",
    description: "",
    allowed_file_types: ["application/pdf", "image/jpeg", "image/png"],
    max_file_size_mb: 10,
    min_files_required: 1,
    max_files_allowed: 10,
    require_description: false,
    auto_approve: true,
    notify_on_upload: false,
    retention_days: 1095
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const res = await axios.get(`${API}/evidence-policies`);
      setPolicies(res.data);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (policy = null) => {
    if (policy) {
      setEditingPolicy(policy);
      setForm({
        name: policy.name,
        description: policy.description || "",
        allowed_file_types: policy.allowed_file_types || [],
        max_file_size_mb: policy.max_file_size_mb || 10,
        min_files_required: policy.min_files_required || 1,
        max_files_allowed: policy.max_files_allowed || 10,
        require_description: policy.require_description || false,
        auto_approve: policy.auto_approve !== false,
        notify_on_upload: policy.notify_on_upload || false,
        retention_days: policy.retention_days || 1095
      });
    } else {
      setEditingPolicy(null);
      setForm({
        name: "",
        description: "",
        allowed_file_types: ["application/pdf", "image/jpeg", "image/png"],
        max_file_size_mb: 10,
        min_files_required: 1,
        max_files_allowed: 10,
        require_description: false,
        auto_approve: true,
        notify_on_upload: false,
        retention_days: 1095
      });
    }
    setShowDialog(true);
  };

  const toggleFileType = (type) => {
    setForm(prev => ({
      ...prev,
      allowed_file_types: prev.allowed_file_types.includes(type)
        ? prev.allowed_file_types.filter(t => t !== type)
        : [...prev.allowed_file_types, type]
    }));
  };

  const savePolicy = async () => {
    if (!form.name.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }

    if (form.allowed_file_types.length === 0) {
      toast.error("Wählen Sie mindestens einen Dateityp aus");
      return;
    }

    setSaving(true);
    try {
      if (editingPolicy) {
        await axios.put(`${API}/evidence-policies/${editingPolicy.id}`, form);
        toast.success("Policy aktualisiert");
      } else {
        await axios.post(`${API}/evidence-policies`, form);
        toast.success("Policy erstellt");
      }
      setShowDialog(false);
      fetchPolicies();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const deletePolicy = async (id) => {
    if (!window.confirm("Policy wirklich löschen?")) return;
    try {
      await axios.delete(`${API}/evidence-policies/${id}`);
      toast.success("Policy gelöscht");
      fetchPolicies();
    } catch (err) {
      toast.error("Fehler beim Löschen");
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            Nachweis-Richtlinien
          </h1>
          <p className="text-slate-600 mt-1">
            Definieren Sie Regeln für den Upload von Nachweisdateien
          </p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Neue Policy
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Was sind Nachweis-Richtlinien?</p>
              <p className="mt-1">
                Mit Richtlinien können Sie festlegen, welche Dateitypen, Größen und Mengen 
                für Nachweise erlaubt sind. Policies können Tasks in Templates zugewiesen werden.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default Policy Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Standard-Richtlinie
          </CardTitle>
          <CardDescription>
            Wird verwendet, wenn keine spezifische Policy zugewiesen ist
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Files className="w-4 h-4 text-slate-500" />
              <span>Max. 10 Dateien</span>
            </div>
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-slate-500" />
              <span>Max. 10 MB/Datei</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>Auto-Genehmigung</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>3 Jahre Aufbewahrung</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Policies */}
      {policies.length > 0 ? (
        <div className="grid gap-4">
          {policies.map(policy => (
            <Card key={policy.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{policy.name}</h3>
                      {!policy.auto_approve && (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          Manuelle Prüfung
                        </Badge>
                      )}
                    </div>
                    {policy.description && (
                      <p className="text-slate-600 text-sm mb-4">{policy.description}</p>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">Dateitypen:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {policy.allowed_file_types?.slice(0, 3).map(type => (
                            <Badge key={type} variant="secondary" className="text-xs">
                              {FILE_TYPE_OPTIONS.find(o => o.value === type)?.label || type.split('/')[1]}
                            </Badge>
                          ))}
                          {policy.allowed_file_types?.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{policy.allowed_file_types.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Max. Größe:</span>
                        <p className="font-medium">{policy.max_file_size_mb} MB</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Dateien:</span>
                        <p className="font-medium">{policy.min_files_required} - {policy.max_files_allowed}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Aufbewahrung:</span>
                        <p className="font-medium">{Math.round(policy.retention_days / 365)} Jahre</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(policy)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700" onClick={() => deletePolicy(policy.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600 mb-4">Noch keine benutzerdefinierten Richtlinien</p>
            <Button onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Erste Policy erstellen
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Policy Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy ? "Policy bearbeiten" : "Neue Policy erstellen"}
            </DialogTitle>
            <DialogDescription>
              Definieren Sie die Regeln für den Nachweis-Upload
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="z.B. Strenge Compliance-Policy"
                />
              </div>
              <div>
                <Label htmlFor="description">Beschreibung</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Optionale Beschreibung der Richtlinie"
                />
              </div>
            </div>

            {/* File Types */}
            <div>
              <Label className="mb-3 block">Erlaubte Dateitypen *</Label>
              <div className="grid grid-cols-2 gap-2">
                {FILE_TYPE_OPTIONS.map(option => (
                  <div
                    key={option.value}
                    onClick={() => toggleFileType(option.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.allowed_file_types.includes(option.value)
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span>{option.icon}</span>
                    <span className="text-sm">{option.label}</span>
                    {form.allowed_file_types.includes(option.value) && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Size and Count Limits */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="max_size">Max. Dateigröße (MB)</Label>
                <Input
                  id="max_size"
                  type="number"
                  min="1"
                  max="50"
                  value={form.max_file_size_mb}
                  onChange={e => setForm({ ...form, max_file_size_mb: parseInt(e.target.value) || 10 })}
                />
              </div>
              <div>
                <Label htmlFor="min_files">Min. Dateien</Label>
                <Input
                  id="min_files"
                  type="number"
                  min="0"
                  max="20"
                  value={form.min_files_required}
                  onChange={e => setForm({ ...form, min_files_required: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="max_files">Max. Dateien</Label>
                <Input
                  id="max_files"
                  type="number"
                  min="1"
                  max="50"
                  value={form.max_files_allowed}
                  onChange={e => setForm({ ...form, max_files_allowed: parseInt(e.target.value) || 10 })}
                />
              </div>
            </div>

            {/* Retention */}
            <div>
              <Label htmlFor="retention">Aufbewahrungsdauer (Tage)</Label>
              <Input
                id="retention"
                type="number"
                min="30"
                max="3650"
                value={form.retention_days}
                onChange={e => setForm({ ...form, retention_days: parseInt(e.target.value) || 1095 })}
              />
              <p className="text-xs text-slate-500 mt-1">
                ≈ {Math.round(form.retention_days / 365)} Jahre (DSGVO empfiehlt min. 3 Jahre)
              </p>
            </div>

            {/* Toggles */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Beschreibung erforderlich</Label>
                  <p className="text-xs text-slate-500">Benutzer müssen eine Beschreibung eingeben</p>
                </div>
                <Switch
                  checked={form.require_description}
                  onCheckedChange={checked => setForm({ ...form, require_description: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Automatische Genehmigung</Label>
                  <p className="text-xs text-slate-500">Nachweise sofort genehmigen</p>
                </div>
                <Switch
                  checked={form.auto_approve}
                  onCheckedChange={checked => setForm({ ...form, auto_approve: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Benachrichtigung bei Upload</Label>
                  <p className="text-xs text-slate-500">Admin per E-Mail benachrichtigen</p>
                </div>
                <Switch
                  checked={form.notify_on_upload}
                  onCheckedChange={checked => setForm({ ...form, notify_on_upload: checked })}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={savePolicy} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                editingPolicy ? "Aktualisieren" : "Erstellen"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
