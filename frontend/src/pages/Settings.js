import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Plus, Trash2, Edit, Save, Users, Building2, Loader2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Settings() {
  const [settings, setSettings] = useState({ org_name: "", org_timezone: "Europe/Berlin", reminder_days_before: 3, reminder_days_after: 2 });
  const [ownerRoles, setOwnerRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: "", emails: "" });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, rolesRes] = await Promise.all([
        axios.get(`${API}/settings`),
        axios.get(`${API}/owner-roles`),
      ]);
      setSettings(settingsRes.data);
      setOwnerRoles(rolesRes.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Einstellungen");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, settings);
      toast.success("Einstellungen gespeichert");
    } catch (err) {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const openRoleDialog = (role = null) => {
    if (role) {
      setEditingRole(role);
      setRoleForm({ name: role.name, emails: role.emails.join(", ") });
    } else {
      setEditingRole(null);
      setRoleForm({ name: "", emails: "" });
    }
    setShowRoleDialog(true);
  };

  const saveRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }

    const emails = roleForm.emails.split(",").map(e => e.trim()).filter(e => e);
    
    try {
      if (editingRole) {
        await axios.put(`${API}/owner-roles/${editingRole.id}`, { name: roleForm.name, emails });
        toast.success("Rolle aktualisiert");
      } else {
        await axios.post(`${API}/owner-roles`, { name: roleForm.name, emails });
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
      await axios.delete(`${API}/owner-roles/${id}`);
      toast.success("Rolle gelöscht");
      fetchData();
    } catch (err) {
      toast.error("Fehler beim Löschen");
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

      {/* Owner Roles */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" /> Owner-Rollen
            </CardTitle>
            <CardDescription>Zuordnung von Verantwortlichkeiten zu E-Mail-Adressen</CardDescription>
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
                    <h4 className="font-medium text-slate-900">{role.name}</h4>
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

      {/* Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Rolle bearbeiten" : "Neue Rolle"}</DialogTitle>
            <DialogDescription>
              Definieren Sie eine Verantwortlichkeit und weisen Sie E-Mail-Adressen zu
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
    </div>
  );
}
