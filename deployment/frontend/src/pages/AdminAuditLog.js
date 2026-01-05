import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { 
  ScrollText, Loader2, Search, RefreshCw, Filter,
  User, Calendar, Activity, ChevronLeft, ChevronRight
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminAuditLog() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const limit = 50;

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate("/admin/login");
      return;
    }
    fetchLogs();
  }, [isSuperAdmin, navigate, offset, actionFilter, resourceFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let url = `${API}/admin/audit-logs?limit=${limit}&offset=${offset}`;
      if (actionFilter) url += `&action=${actionFilter}`;
      if (resourceFilter) url += `&resource_type=${resourceFilter}`;
      
      const response = await axios.get(url);
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (err) {
      toast.error("Fehler beim Laden der Audit-Logs");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const getActionColor = (action) => {
    switch (action) {
      case "create": return "bg-green-600";
      case "update": return "bg-blue-600";
      case "delete": return "bg-red-600";
      case "login": return "bg-purple-600";
      case "login_failed": return "bg-red-800";
      case "access": return "bg-slate-600";
      default: return "bg-slate-600";
    }
  };

  const getActionLabel = (action) => {
    const labels = {
      create: "Erstellt",
      update: "Geändert",
      delete: "Gelöscht",
      login: "Login",
      login_failed: "Login fehlgeschlagen",
      access: "Zugriff"
    };
    return labels[action] || action;
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ScrollText className="w-7 h-7 text-purple-400" />
            System Audit-Log
          </h1>
          <p className="text-slate-400 mt-1">
            Alle Aktivitäten über alle Organisationen ({total} Einträge)
          </p>
        </div>
        <Button onClick={() => { setOffset(0); fetchLogs(); }} variant="outline" disabled={loading} className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-slate-400" />
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === "all" ? "" : v); setOffset(0); }}>
              <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Alle Aktionen" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="all">Alle Aktionen</SelectItem>
                <SelectItem value="create">Erstellt</SelectItem>
                <SelectItem value="update">Geändert</SelectItem>
                <SelectItem value="delete">Gelöscht</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="login_failed">Login fehlgeschlagen</SelectItem>
                <SelectItem value="access">Zugriff</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resourceFilter} onValueChange={(v) => { setResourceFilter(v === "all" ? "" : v); setOffset(0); }}>
              <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Alle Ressourcen" />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                <SelectItem value="all">Alle Ressourcen</SelectItem>
                <SelectItem value="user">Benutzer</SelectItem>
                <SelectItem value="case">Vorgang</SelectItem>
                <SelectItem value="template">Template</SelectItem>
                <SelectItem value="organization">Organisation</SelectItem>
                <SelectItem value="license">Lizenz</SelectItem>
                <SelectItem value="auth">Authentifizierung</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              Keine Audit-Log Einträge gefunden
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {logs.map((log, idx) => (
                <div key={log.id || idx} className="p-4 hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Badge className={`${getActionColor(log.action)} text-white text-xs`}>
                        {getActionLabel(log.action)}
                      </Badge>
                      <div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-white font-medium">{log.resource_type}</span>
                          {log.resource_name && (
                            <span className="text-slate-400">• {log.resource_name}</span>
                          )}
                        </div>
                        {log.details && (
                          <p className="text-sm text-slate-400 mt-1">{log.details}</p>
                        )}
                        {(log.old_value || log.new_value) && (
                          <p className="text-xs text-slate-500 mt-1">
                            {log.old_value && <span className="text-red-400 line-through mr-2">{log.old_value}</span>}
                            {log.new_value && <span className="text-green-400">{log.new_value}</span>}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="flex items-center gap-1 text-slate-400">
                        <User className="w-3 h-3" />
                        <span>{log.user_email || log.user_name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 text-xs mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDateTime(log.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Seite {currentPage} von {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              Weiter
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
