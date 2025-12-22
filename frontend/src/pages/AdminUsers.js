import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { 
  Users, Loader2, Search, Ban, CheckCircle, Key, Trash2, 
  Building2, Mail, Calendar, Shield, UserX, UserCheck
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminUsers() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate("/admin/login");
      return;
    }
    fetchUsers();
  }, [isSuperAdmin, navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/admin/users`);
      setUsers(response.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Benutzer");
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (user) => {
    const newStatus = user.status === "blocked" ? "active" : "blocked";
    try {
      await axios.patch(`${API}/admin/users/${user.id}/status?new_status=${newStatus}`);
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
      await axios.post(`${API}/admin/users/${selectedUser.id}/reset-password?new_password=${encodeURIComponent(newPassword)}`);
      toast.success("Passwort erfolgreich zurückgesetzt");
      setShowPasswordDialog(false);
      setNewPassword("");
      setSelectedUser(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Zurücksetzen des Passworts");
    }
  };

  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.organization_name?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-purple-400" />
            Benutzerverwaltung
          </h1>
          <p className="text-slate-400 mt-1">
            Alle Benutzer über alle Organisationen verwalten
          </p>
        </div>
        <Button onClick={fetchUsers} variant="outline" disabled={loading} className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
          <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Gesamt</p>
                <p className="text-2xl font-bold text-white">{users.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Aktiv</p>
                <p className="text-2xl font-bold text-green-400">{users.filter(u => u.status !== "blocked").length}</p>
              </div>
              <UserCheck className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Gesperrt</p>
                <p className="text-2xl font-bold text-red-400">{users.filter(u => u.status === "blocked").length}</p>
              </div>
              <UserX className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Super-Admins</p>
                <p className="text-2xl font-bold text-purple-400">{users.filter(u => u.is_super_admin).length}</p>
              </div>
              <Shield className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="Benutzer suchen (Name, E-Mail, Organisation)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-8 text-center text-slate-400">
              Keine Benutzer gefunden
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id} className={`bg-slate-800 border-slate-700 ${user.status === "blocked" ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.is_super_admin ? "bg-purple-600" : "bg-slate-600"}`}>
                      {user.is_super_admin ? (
                        <Shield className="w-5 h-5 text-white" />
                      ) : (
                        <span className="text-white font-semibold">
                          {user.name?.charAt(0).toUpperCase() || "?"}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">{user.name}</p>
                        {user.is_super_admin && (
                          <Badge className="bg-purple-600 text-white text-xs">Super Admin</Badge>
                        )}
                        {user.status === "blocked" && (
                          <Badge variant="destructive" className="text-xs">Gesperrt</Badge>
                        )}
                        <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
                          {user.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {user.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {user.organization_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(user.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowPasswordDialog(true);
                      }}
                      className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                      disabled={user.is_super_admin}
                    >
                      <Key className="w-4 h-4 mr-1" />
                      Passwort
                    </Button>
                    <Button
                      size="sm"
                      variant={user.status === "blocked" ? "default" : "destructive"}
                      onClick={() => toggleUserStatus(user)}
                      disabled={user.is_super_admin}
                      className={user.status === "blocked" ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {user.status === "blocked" ? (
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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Passwort zurücksetzen</DialogTitle>
            <DialogDescription className="text-slate-400">
              Neues Passwort für {selectedUser?.email} setzen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="password"
              placeholder="Neues Passwort (mind. 8 Zeichen)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)} className="bg-slate-700 border-slate-600 text-white">
              Abbrechen
            </Button>
            <Button onClick={resetPassword} className="bg-purple-600 hover:bg-purple-700">
              Passwort setzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
