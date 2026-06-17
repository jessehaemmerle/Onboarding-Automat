import { useState, useEffect } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { 
  Users, Loader2, Key, Ban, CheckCircle, Trash2, 
  Mail, Calendar, UserPlus, Shield, Search, RefreshCw, UserCog, Briefcase
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

// Fine-grained roles
const ROLE_OPTIONS = [
  { value: "user", label: "Benutzer", hint: "Sieht nur eigene Aufgaben" },
  { value: "manager", label: "Manager", hint: "Sieht & bearbeitet alle Aufgaben seiner Abteilung" },
  { value: "superior", label: "Superior", hint: "Verwaltet Templates & Onboardings" },
  { value: "admin", label: "Administrator", hint: "Vollzugriff" },
];
const ROLE_LABELS = ROLE_OPTIONS.reduce((acc, r) => ({ ...acc, [r.value]: r.label }), {});
const roleLabel = (role) => ROLE_LABELS[role] || "Benutzer";


export default function OrgUserManagement() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [orgInfo, setOrgInfo] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Dialogs
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  
  // Form states
  const [newPassword, setNewPassword] = useState("");
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "user", department_id: "" });
  const [newRole, setNewRole] = useState("user");
  const [newDepartmentId, setNewDepartmentId] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Nur für Administratoren");
      navigate("/");
      return;
    }
    fetchData();
  }, [isAdmin, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, orgRes, deptsRes] = await Promise.all([
        api.get(`/org/users`),
        api.get(`/org/info`),
        api.get(`/departments`)
      ]);
      setUsers(usersRes.data);
      setOrgInfo(orgRes.data);
      setDepartments(deptsRes.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }
    if (newUser.password.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen haben");
      return;
    }
    try {
      const payload = {
        ...newUser,
        department_id: newUser.department_id || null
      };
      await api.post(`/org/users`, payload);
      toast.success(`Benutzer "${newUser.name}" erfolgreich erstellt`);
      setShowAddUserDialog(false);
      setNewUser({ name: "", email: "", password: "", role: "user", department_id: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Erstellen des Benutzers");
    }
  };

  const updateDepartment = async () => {
    if (!selectedUser) return;
    try {
      await api.patch(`/org/users/${selectedUser.id}/department?department_id=${newDepartmentId || ""}`);
      toast.success("Abteilung erfolgreich geändert");
      setShowDepartmentDialog(false);
      setSelectedUser(null);
      setNewDepartmentId("");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Ändern der Abteilung");
    }
  };

  const toggleUserStatus = async (targetUser) => {
    const newStatus = targetUser.status === "blocked" ? "active" : "blocked";
    try {
      await api.patch(`/org/users/${targetUser.id}/status?new_status=${newStatus}`);
      toast.success(`Benutzer ${newStatus === "blocked" ? "gesperrt" : "aktiviert"}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Ändern des Status");
    }
  };

  const resetPassword = async () => {
    if (!selectedUser || newPassword.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen haben");
      return;
    }
    try {
      await api.post(`/org/users/${selectedUser.id}/reset-password?new_password=${encodeURIComponent(newPassword)}`);
      toast.success("Passwort erfolgreich zurückgesetzt");
      setShowPasswordDialog(false);
      setNewPassword("");
      setSelectedUser(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Zurücksetzen des Passworts");
    }
  };

  const updateRole = async () => {
    if (!selectedUser) return;
    try {
      await api.patch(`/org/users/${selectedUser.id}/role?role=${newRole}`);
      toast.success(`Rolle auf "${newRole}" geändert`);
      setShowRoleDialog(false);
      setSelectedUser(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Ändern der Rolle");
    }
  };

  const deleteUser = async () => {
    if (!selectedUser) return;
    try {
      await api.delete(`/org/users/${selectedUser.id}`);
      toast.success("Benutzer erfolgreich gelöscht");
      setShowDeleteDialog(false);
      setSelectedUser(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Löschen des Benutzers");
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const canAddUsers = orgInfo && orgInfo.user_count < orgInfo.user_limit;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            Benutzerverwaltung
          </h1>
          <p className="text-slate-500 mt-1">
            Verwalten Sie die Benutzer Ihrer Organisation
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Button 
            onClick={() => setShowAddUserDialog(true)} 
            className="gap-2"
            disabled={!canAddUsers}
          >
            <UserPlus className="w-4 h-4" />
            Neuer Benutzer
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Benutzer</p>
                <p className="text-3xl font-bold text-slate-900">
                  {orgInfo?.user_count || 0}
                  <span className="text-lg text-slate-400 font-normal">/{orgInfo?.user_limit || 10}</span>
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            {!canAddUsers && (
              <p className="text-xs text-amber-600 mt-2">Limit erreicht</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Aktiv</p>
                <p className="text-3xl font-bold text-green-600">{users.filter(u => u.status !== "blocked").length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Gesperrt</p>
                <p className="text-3xl font-bold text-red-600">{users.filter(u => u.status === "blocked").length}</p>
              </div>
              <Ban className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Admins</p>
                <p className="text-3xl font-bold text-purple-600">{users.filter(u => u.role === "admin").length}</p>
              </div>
              <Shield className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="Benutzer suchen (Name, E-Mail)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Benutzer ({filteredUsers.length})</CardTitle>
          <CardDescription>
            Klicken Sie auf die Aktionen, um Benutzer zu verwalten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Keine Benutzer gefunden
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((targetUser) => (
                <div 
                  key={targetUser.id} 
                  className={`p-4 border rounded-lg ${targetUser.status === "blocked" ? "bg-red-50 border-red-200" : "bg-white border-slate-200"} ${targetUser.id === user?.id ? "ring-2 ring-blue-500" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${targetUser.role === "admin" ? "bg-purple-100" : "bg-slate-100"}`}>
                        {targetUser.role === "admin" ? (
                          <Shield className="w-5 h-5 text-purple-600" />
                        ) : (
                          <span className="text-slate-600 font-semibold">
                            {targetUser.name?.charAt(0).toUpperCase() || "?"}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900">{targetUser.name}</p>
                          {targetUser.id === user?.id && (
                            <Badge variant="outline" className="text-xs">Sie</Badge>
                          )}
                          <Badge variant={targetUser.role === "admin" ? "default" : "secondary"} className="text-xs">
                            {roleLabel(targetUser.role)}
                          </Badge>
                          {targetUser.department_name && (
                            <Badge variant="outline" className="text-xs">
                              <Briefcase className="w-3 h-3 mr-1" />
                              {targetUser.department_name}
                            </Badge>
                          )}
                          {targetUser.status === "blocked" && (
                            <Badge variant="destructive" className="text-xs">Gesperrt</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {targetUser.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formatDate(targetUser.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {targetUser.id !== user?.id && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(targetUser);
                            setNewDepartmentId(targetUser.department_id || "");
                            setShowDepartmentDialog(true);
                          }}
                        >
                          <Briefcase className="w-4 h-4 mr-1" />
                          Abteilung
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(targetUser);
                            setNewRole(targetUser.role);
                            setShowRoleDialog(true);
                          }}
                        >
                          <UserCog className="w-4 h-4 mr-1" />
                          Rolle
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(targetUser);
                            setShowPasswordDialog(true);
                          }}
                        >
                          <Key className="w-4 h-4 mr-1" />
                          Passwort
                        </Button>
                        <Button
                          size="sm"
                          variant={targetUser.status === "blocked" ? "default" : "outline"}
                          onClick={() => toggleUserStatus(targetUser)}
                          className={targetUser.status === "blocked" ? "bg-green-600 hover:bg-green-700" : ""}
                        >
                          {targetUser.status === "blocked" ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Aktivieren
                            </>
                          ) : (
                            <>
                              <Ban className="w-4 h-4 mr-1" />
                              Sperren
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedUser(targetUser);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Benutzer hinzufügen</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen neuen Benutzer für Ihre Organisation
              {orgInfo && (
                <span className="block mt-1 text-sm">
                  Verfügbar: {orgInfo.user_limit - orgInfo.user_count} von {orgInfo.user_limit} Plätzen
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                placeholder="Max Mustermann"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">E-Mail</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="max@beispiel.de"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Passwort</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Mindestens 8 Zeichen"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">Rolle</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {ROLE_OPTIONS.find((r) => r.value === newUser.role)?.hint}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-department">Abteilung</Label>
              <Select value={newUser.department_id || "none"} onValueChange={(v) => setNewUser({ ...newUser, department_id: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Abteilung wählen (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Abteilung</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Benutzer sehen nur Tasks ihrer Abteilung</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={createUser}>
              Benutzer erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Department Change Dialog */}
      <Dialog open={showDepartmentDialog} onOpenChange={setShowDepartmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abteilung ändern</DialogTitle>
            <DialogDescription>
              Abteilung für {selectedUser?.name} ändern
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={newDepartmentId || "none"} onValueChange={(v) => setNewDepartmentId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Abteilung wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Abteilung</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500">
              Benutzer in einer Abteilung sehen nur Tasks, deren Owner-Rolle derselben Abteilung zugeordnet ist.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepartmentDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={updateDepartment}>
              Abteilung ändern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passwort zurücksetzen</DialogTitle>
            <DialogDescription>
              Neues Passwort für {selectedUser?.email} setzen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="password"
              placeholder="Neues Passwort (mind. 8 Zeichen)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={resetPassword}>
              Passwort setzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rolle ändern</DialogTitle>
            <DialogDescription>
              Rolle für {selectedUser?.name} ändern
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              {ROLE_OPTIONS.find((r) => r.value === newRole)?.hint}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={updateRole}>
              Rolle ändern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie {selectedUser?.name} ({selectedUser?.email}) löschen möchten? 
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser} className="bg-red-600 hover:bg-red-700">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
