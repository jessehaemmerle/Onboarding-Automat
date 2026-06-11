import { useState, useEffect } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, Trash2, Edit, Save, Users, Building2, Loader2, Tags, Briefcase, Webhook, ExternalLink, ToggleLeft, ToggleRight, Zap } from "lucide-react";


const COLOR_OPTIONS = [
  { value: "#3b82f6", label: "Blau" },
  { value: "#8b5cf6", label: "Violett" },
  { value: "#10b981", label: "Grün" },
  { value: "#f59e0b", label: "Orange" },
  { value: "#ef4444", label: "Rot" },
  { value: "#ec4899", label: "Pink" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#6b7280", label: "Grau" },
];

export default function Settings() {
  const [settings, setSettings] = useState({ org_name: "", org_timezone: "Europe/Berlin", reminder_days_before: 3, reminder_days_after: 2 });
  const [ownerRoles, setOwnerRoles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Role dialog state
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: "", emails: "", department_id: "" });
  
  // Category dialog state
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", color: "#3b82f6" });
  
  // Department dialog state
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [departmentForm, setDepartmentForm] = useState({ name: "", color: "#3b82f6" });

  // Webhook state
  const [webhooks, setWebhooks] = useState([]);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ url: "", events: [], secret: "", description: "" });
  const WEBHOOK_EVENTS = [
    { value: "case.created",   label: "Vorgang erstellt" },
    { value: "case.completed", label: "Vorgang abgeschlossen" },
    { value: "task.completed", label: "Task abgeschlossen" },
  ];

  useEffect(() => {
    fetchData();
    fetchWebhooks();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, rolesRes, categoriesRes, departmentsRes] = await Promise.all([
        api.get(`/settings`),
        api.get(`/owner-roles`),
        api.get(`/categories`),
        api.get(`/departments`),
      ]);
      setSettings(settingsRes.data);
      setOwnerRoles(rolesRes.data);
      setCategories(categoriesRes.data);
      setDepartments(departmentsRes.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Einstellungen");
    } finally {
      setLoading(false);
    }
  };

  const fetchWebhooks = async () => {
    try {
      const res = await api.get("/webhooks");
      setWebhooks(res.data);
    } catch { /* admin-only — silently ignore for non-admins */ }
  };

  const saveWebhook = async () => {
    if (!webhookForm.url || !webhookForm.events.length) {
      toast.error("URL und mindestens ein Event sind erforderlich");
      return;
    }
    try {
      await api.post("/webhooks", webhookForm);
      toast.success("Webhook erstellt");
      setShowWebhookDialog(false);
      setWebhookForm({ url: "", events: [], secret: "", description: "" });
      fetchWebhooks();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Erstellen");
    }
  };

  const deleteWebhook = async (id) => {
    if (!window.confirm("Webhook wirklich löschen?")) return;
    try {
      await api.delete(`/webhooks/${id}`);
      toast.success("Webhook gelöscht");
      fetchWebhooks();
    } catch { toast.error("Fehler beim Löschen"); }
  };

  const toggleWebhook = async (id) => {
    try {
      const res = await api.patch(`/webhooks/${id}/toggle`);
      fetchWebhooks();
    } catch { toast.error("Fehler"); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put(`/settings`, settings);
      toast.success("Einstellungen gespeichert");
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  // Department functions
  const openDepartmentDialog = (dept = null) => {
    if (dept) {
      setEditingDepartment(dept);
      setDepartmentForm({ name: dept.name, color: dept.color });
    } else {
      setEditingDepartment(null);
      setDepartmentForm({ name: "", color: "#3b82f6" });
    }
    setShowDepartmentDialog(true);
  };

  const saveDepartment = async () => {
    if (!departmentForm.name.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }
    
    try {
      if (editingDepartment) {
        await api.put(`/departments/${editingDepartment.id}`, departmentForm);
        toast.success("Abteilung aktualisiert");
      } else {
        await api.post(`/departments`, departmentForm);
        toast.success("Abteilung erstellt");
      }
      setShowDepartmentDialog(false);
      fetchData();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    }
  };

  const deleteDepartment = async (id) => {
    if (!window.confirm("Abteilung wirklich löschen?")) return;
    try {
      await api.delete(`/departments/${id}`);
      toast.success("Abteilung gelöscht");
      fetchData();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  // Owner Role functions
  const openRoleDialog = (role = null) => {
    if (role) {
      setEditingRole(role);
      setRoleForm({ name: role.name, emails: role.emails.join(", "), department_id: role.department_id || "" });
    } else {
      setEditingRole(null);
      setRoleForm({ name: "", emails: "", department_id: "" });
    }
    setShowRoleDialog(true);
  };

  const saveRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }

    const emails = roleForm.emails.split(",").map(e => e.trim()).filter(e => e);
    const payload = { 
      name: roleForm.name, 
      emails,
      department_id: roleForm.department_id || null
    };
    
    try {
      if (editingRole) {
        await api.put(`/owner-roles/${editingRole.id}`, payload);
        toast.success("Rolle aktualisiert");
      } else {
        await api.post(`/owner-roles`, payload);
        toast.success("Rolle erstellt");
      }
      setShowRoleDialog(false);
      fetchData();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    }
  };

  const deleteRole = async (id) => {
    if (!window.confirm("Rolle wirklich löschen?")) return;
    try {
      await api.delete(`/owner-roles/${id}`);
      toast.success("Rolle gelöscht");
      fetchData();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  // Category functions
  const openCategoryDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({ name: category.name, color: category.color });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: "", color: "#3b82f6" });
    }
    setShowCategoryDialog(true);
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }
    
    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, categoryForm);
        toast.success("Kategorie aktualisiert");
      } else {
        await api.post(`/categories`, categoryForm);
        toast.success("Kategorie erstellt");
      }
      setShowCategoryDialog(false);
      fetchData();
    } catch (err) {
      toast.error("Fehler beim Speichern");
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm("Kategorie wirklich löschen?")) return;
    try {
      await api.delete(`/categories/${id}`);
      toast.success("Kategorie gelöscht");
      fetchData();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  // Helper to get department name
  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Einstellungen</h1>
        <p className="text-slate-500 mt-1">Organisations- und Systemeinstellungen</p>
      </div>

      {/* Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" /> Organisation
          </CardTitle>
          <CardDescription>Allgemeine Firmendaten</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org_name">Firmenname</Label>
              <Input
                id="org_name"
                value={settings.org_name}
                onChange={(e) => setSettings({ ...settings, org_name: e.target.value })}
                placeholder="Meine Firma GmbH"
                data-testid="org-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Zeitzone</Label>
              <Input
                id="timezone"
                value={settings.org_timezone}
                onChange={(e) => setSettings({ ...settings, org_timezone: e.target.value })}
                placeholder="Europe/Berlin"
                data-testid="org-timezone"
              />
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium text-slate-900 mb-3">Reminder-Einstellungen (nur Log im MVP)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tage vor Fälligkeit</Label>
                <Input
                  type="number"
                  value={settings.reminder_days_before}
                  onChange={(e) => setSettings({ ...settings, reminder_days_before: parseInt(e.target.value) || 0 })}
                  data-testid="reminder-before"
                />
              </div>
              <div className="space-y-2">
                <Label>Tage nach Fälligkeit</Label>
                <Input
                  type="number"
                  value={settings.reminder_days_after}
                  onChange={(e) => setSettings({ ...settings, reminder_days_after: parseInt(e.target.value) || 0 })}
                  data-testid="reminder-after"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={saveSettings} disabled={saving} className="btn-primary" data-testid="save-settings">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Speichern</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Departments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" /> Abteilungen
            </CardTitle>
            <CardDescription>Abteilungen für Benutzer und Task-Filterung</CardDescription>
          </div>
          <Button onClick={() => openDepartmentDialog()} variant="outline" size="sm" data-testid="add-department">
            <Plus className="w-4 h-4 mr-2" /> Neue Abteilung
          </Button>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>Keine Abteilungen definiert</p>
              <p className="text-sm mt-1">Erstellen Sie Abteilungen wie IT, HR, Management...</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {departments.map(dept => (
                <div 
                  key={dept.id} 
                  className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-slate-50 group"
                  data-testid={`department-${dept.id}`}
                >
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: dept.color }}
                  />
                  <span className="font-medium text-slate-900">{dept.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={() => openDepartmentDialog(dept)} 
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700" 
                      onClick={() => deleteDepartment(dept.id)} 
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tags className="w-5 h-5" /> Kategorien
            </CardTitle>
            <CardDescription>Kategorien für Aufgaben in Templates</CardDescription>
          </div>
          <Button onClick={() => openCategoryDialog()} variant="outline" size="sm" data-testid="add-category">
            <Plus className="w-4 h-4 mr-2" /> Neue Kategorie
          </Button>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Tags className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>Keine Kategorien definiert</p>
              <p className="text-sm mt-1">Erstellen Sie Kategorien wie IT, Admin, HR...</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {categories.map(cat => (
                <div 
                  key={cat.id} 
                  className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-slate-50 group"
                  data-testid={`category-${cat.id}`}
                >
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-medium text-slate-900">{cat.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={() => openCategoryDialog(cat)} 
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700" 
                      onClick={() => deleteCategory(cat.id)} 
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Owner Roles */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" /> Owner-Rollen
            </CardTitle>
            <CardDescription>Zuordnung von Verantwortlichkeiten zu E-Mail-Adressen und Abteilungen</CardDescription>
          </div>
          <Button onClick={() => openRoleDialog()} variant="outline" size="sm" data-testid="add-role">
            <Plus className="w-4 h-4 mr-2" /> Neue Rolle
          </Button>
        </CardHeader>
        <CardContent>
          {ownerRoles.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>Keine Owner-Rollen definiert</p>
              <p className="text-sm mt-1">Erstellen Sie Rollen wie IT, HR, Office...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ownerRoles.map(role => (
                <div key={role.id} className="flex items-center justify-between p-4 border rounded-lg bg-slate-50" data-testid={`role-${role.id}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-900">{role.name}</h4>
                      {role.department_id && (
                        <Badge variant="outline" className="text-xs">
                          <Briefcase className="w-3 h-3 mr-1" />
                          {getDepartmentName(role.department_id)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {role.emails.length > 0 ? (
                        role.emails.map((email, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{email}</Badge>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">Keine E-Mails zugewiesen</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openRoleDialog(role)} data-testid={`edit-role-${role.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => deleteRole(role.id)} data-testid={`delete-role-${role.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Dialog */}
      <Dialog open={showDepartmentDialog} onOpenChange={setShowDepartmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDepartment ? "Abteilung bearbeiten" : "Neue Abteilung"}</DialogTitle>
            <DialogDescription>
              Definieren Sie eine Abteilung für Benutzer und Task-Filterung
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="department-name">Name *</Label>
              <Input
                id="department-name"
                placeholder="z.B. IT, HR, Management"
                value={departmentForm.name}
                onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                data-testid="department-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      departmentForm.color === color.value 
                        ? "border-slate-900 scale-110" 
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setDepartmentForm({ ...departmentForm, color: color.value })}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepartmentDialog(false)}>Abbrechen</Button>
            <Button onClick={saveDepartment} className="btn-primary" data-testid="save-department">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Rolle bearbeiten" : "Neue Rolle"}</DialogTitle>
            <DialogDescription>
              Definieren Sie eine Verantwortlichkeit und weisen Sie E-Mail-Adressen und Abteilung zu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name *</Label>
              <Input
                id="role-name"
                placeholder="z.B. IT, HR, Office"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                data-testid="role-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-department">Abteilung</Label>
              <Select 
                value={roleForm.department_id || "none"} 
                onValueChange={(v) => setRoleForm({ ...roleForm, department_id: v === "none" ? "" : v })}
              >
                <SelectTrigger data-testid="role-department-select">
                  <SelectValue placeholder="Abteilung wählen (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Abteilung</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dept.color }} />
                        {dept.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Tasks mit dieser Rolle werden Benutzern der gewählten Abteilung angezeigt</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-emails">E-Mail-Adressen (kommagetrennt)</Label>
              <Input
                id="role-emails"
                placeholder="it@firma.de, admin@firma.de"
                value={roleForm.emails}
                onChange={(e) => setRoleForm({ ...roleForm, emails: e.target.value })}
                data-testid="role-emails-input"
              />
              <p className="text-xs text-slate-500">Die erste E-Mail wird als primärer Empfänger verwendet</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Abbrechen</Button>
            <Button onClick={saveRole} className="btn-primary" data-testid="save-role">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      {/* Webhooks Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" /> Webhooks
            </CardTitle>
            <CardDescription>Externe Systeme bei Ereignissen benachrichtigen</CardDescription>
          </div>
          <Button onClick={() => setShowWebhookDialog(true)} variant="outline" size="sm" data-testid="add-webhook">
            <Plus className="w-4 h-4 mr-2" /> Webhook hinzufügen
          </Button>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Webhook className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Noch keine Webhooks konfiguriert</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map(wh => (
                <div key={wh.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm font-medium text-slate-900 truncate">{wh.url}</span>
                      {wh.active ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 shrink-0">Aktiv</Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 shrink-0">Inaktiv</Badge>
                      )}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {wh.events.map(e => (
                        <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                      ))}
                    </div>
                    {wh.description && <p className="text-xs text-slate-500 mt-1">{wh.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <button
                      className="text-slate-400 hover:text-slate-700 transition-colors"
                      onClick={() => toggleWebhook(wh.id)}
                      title={wh.active ? "Deaktivieren" : "Aktivieren"}
                    >
                      {wh.active ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => deleteWebhook(wh.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Dialog */}
      <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Webhook</DialogTitle>
            <DialogDescription>Empfänger-URL und Events konfigurieren</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input
                placeholder="https://example.com/webhook"
                value={webhookForm.url}
                onChange={e => setWebhookForm({ ...webhookForm, url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Events *</Label>
              {WEBHOOK_EVENTS.map(ev => (
                <label key={ev.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={webhookForm.events.includes(ev.value)}
                    onChange={e => {
                      const evts = e.target.checked
                        ? [...webhookForm.events, ev.value]
                        : webhookForm.events.filter(v => v !== ev.value);
                      setWebhookForm({ ...webhookForm, events: evts });
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-slate-700">{ev.label}</span>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Secret (optional, für HMAC-Signatur)</Label>
              <Input
                placeholder="Geheimer Schlüssel"
                value={webhookForm.secret}
                onChange={e => setWebhookForm({ ...webhookForm, secret: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Input
                placeholder="z.B. Slack-Benachrichtigung"
                value={webhookForm.description}
                onChange={e => setWebhookForm({ ...webhookForm, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWebhookDialog(false)}>Abbrechen</Button>
            <Button onClick={saveWebhook} className="btn-primary">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Kategorie bearbeiten" : "Neue Kategorie"}</DialogTitle>
            <DialogDescription>
              Definieren Sie eine Kategorie für Aufgaben
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Name *</Label>
              <Input
                id="category-name"
                placeholder="z.B. IT, Admin, HR"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                data-testid="category-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      categoryForm.color === color.value 
                        ? "border-slate-900 scale-110" 
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setCategoryForm({ ...categoryForm, color: color.value })}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Abbrechen</Button>
            <Button onClick={saveCategory} className="btn-primary" data-testid="save-category">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
