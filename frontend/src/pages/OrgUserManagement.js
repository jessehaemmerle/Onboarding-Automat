import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { 
  Users, Loader2, Key, Ban, CheckCircle, Trash2, 
  Mail, Calendar, UserPlus, Shield, Search
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function OrgUserManagement() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Nur für Administratoren");
      navigate("/");
      return;
    }
    fetchUsers();
  }, [isAdmin, navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/org/users`);
      setUsers(response.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Benutzer");
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (targetUser) => {
    const newStatus = targetUser.status === "blocked" ? "active" : "blocked";
    try {
      await axios.patch(`${API}/org/users/${targetUser.id}/status?status=${newStatus}`);
      toast.success(`Benutzer ${newStatus === "blocked" ? "gesperrt" : "aktiviert"}`);
      fetchUsers();
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
      await axios.post(`${API}/org/users/${selectedUser.id}/reset-password?new_password=${encodeURIComponent(newPassword)}`);
      toast.success("Passwort erfolgreich zurückgesetzt");
      setShowPasswordDialog(false);
      setNewPassword("");
      setSelectedUser(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Zurücksetzen des Passworts");
    }
  };

  const deleteUser = async () => {
    if (!selectedUser) return;
    try {
      await axios.delete(`${API}/org/users/${selectedUser.id}`);
      toast.success("Benutzer erfolgreich gelöscht");
      setShowDeleteDialog(false);
      setSelectedUser(null);
      fetchUsers();
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
          <Button onClick={fetchUsers} variant="outline" disabled={loading}>
            <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Button onClick={() => navigate("/settings")} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Neuer Benutzer
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Gesamt Benutzer</p>
                <p className="text-3xl font-bold text-slate-900">{users.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
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
            Klicken Sie auf einen Benutzer, um Aktionen durchzuführen
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
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{targetUser.name}</p>
                          {targetUser.id === user?.id && (
                            <Badge variant="outline" className="text-xs">Sie</Badge>
                          )}
                          <Badge variant={targetUser.role === "admin" ? "default" : "secondary"} className="text-xs">
                            {targetUser.role}
                          </Badge>
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
