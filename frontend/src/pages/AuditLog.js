import { useState, useEffect } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { ScrollText, Download, Calendar as CalendarIcon, Search, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";


const ACTION_LABELS = {
  create: { label: "Erstellt", color: "bg-emerald-100 text-emerald-700" },
  update: { label: "Geändert", color: "bg-blue-100 text-blue-700" },
  delete: { label: "Gelöscht", color: "bg-rose-100 text-rose-700" },
  access: { label: "Zugriff", color: "bg-slate-100 text-slate-700" },
  export: { label: "Export", color: "bg-purple-100 text-purple-700" },
  login: { label: "Login", color: "bg-emerald-100 text-emerald-700" },
  login_failed: { label: "Login fehlgeschlagen", color: "bg-rose-100 text-rose-700" },
};

const RESOURCE_LABELS = {
  user: "Benutzer",
  case: "Onboarding",
  task: "Task",
  template: "Template",
  evidence: "Nachweis",
  settings: "Einstellungen",
  audit_log: "Audit-Log",
  auth: "Authentifizierung",
  personal_data: "Personendaten",
  consent: "Einwilligung",
  deletion_request: "Löschantrag",
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: "",
    resource_type: "",
    from_date: null,
    to_date: null,
  });

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  const fetchLogs = async () => {
    try {
      let url = `/audit-logs?page=${page}&page_size=${pageSize}`;
      if (filters.action) url += `&action=${filters.action}`;
      if (filters.resource_type) url += `&resource_type=${filters.resource_type}`;
      if (filters.from_date) url += `&from_date=${filters.from_date.toISOString()}`;
      if (filters.to_date) url += `&to_date=${filters.to_date.toISOString()}`;
      
      const res = await api.get(url);
      setLogs(res.data.entries);
      setTotal(res.data.total);
    } catch (err) {
      toast.error("Fehler beim Laden der Audit-Logs");
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = async () => {
    try {
      let url = `/audit-logs/export?`;
      if (filters.from_date) url += `from_date=${filters.from_date.toISOString()}&`;
      if (filters.to_date) url += `to_date=${filters.to_date.toISOString()}`;
      
      const res = await api.get(url, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", `audit_log_${format(new Date(), "yyyyMMdd")}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Audit-Log exportiert");
    } catch (err) {
      toast.error("Fehler beim Export");
    }
  };

  const resetFilters = () => {
    setFilters({ action: "", resource_type: "", from_date: null, to_date: null });
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="audit-log-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <ScrollText className="w-8 h-8 text-slate-600" />
            Audit-Log
          </h1>
          <p className="text-slate-500 mt-1">DSGVO Art. 30 - Verzeichnis von Verarbeitungstätigkeiten</p>
        </div>
        <Button onClick={exportLogs} variant="outline" className="gap-2" data-testid="export-audit-log">
          <Download className="w-4 h-4" /> CSV Export
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" /> Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={filters.action || "all"} onValueChange={(v) => setFilters({ ...filters, action: v === "all" ? "" : v })}>
              <SelectTrigger className="w-[180px]" data-testid="filter-action">
                <SelectValue placeholder="Aktion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Aktionen</SelectItem>
                <SelectItem value="create">Erstellt</SelectItem>
                <SelectItem value="update">Geändert</SelectItem>
                <SelectItem value="delete">Gelöscht</SelectItem>
                <SelectItem value="access">Zugriff</SelectItem>
                <SelectItem value="export">Export</SelectItem>
                <SelectItem value="login">Login</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.resource_type || "all"} onValueChange={(v) => setFilters({ ...filters, resource_type: v === "all" ? "" : v })}>
              <SelectTrigger className="w-[180px]" data-testid="filter-resource">
                <SelectValue placeholder="Ressource" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Ressourcen</SelectItem>
                <SelectItem value="user">Benutzer</SelectItem>
                <SelectItem value="case">Onboarding</SelectItem>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="template">Template</SelectItem>
                <SelectItem value="evidence">Nachweis</SelectItem>
                <SelectItem value="auth">Authentifizierung</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.from_date ? format(filters.from_date, "dd.MM.yyyy") : "Von"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.from_date}
                  onSelect={(date) => setFilters({ ...filters, from_date: date })}
                  locale={de}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.to_date ? format(filters.to_date, "dd.MM.yyyy") : "Bis"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.to_date}
                  onSelect={(date) => setFilters({ ...filters, to_date: date })}
                  locale={de}
                />
              </PopoverContent>
            </Popover>

            <Button variant="ghost" onClick={resetFilters}>Filter zurücksetzen</Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Zeitstempel</TableHead>
                <TableHead>Benutzer</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>Ressource</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Änderung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} data-testid={`log-${log.id}`}>
                  <TableCell className="font-mono text-sm">
                    {format(parseISO(log.timestamp), "dd.MM.yyyy HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">{log.user_name}</p>
                      <p className="text-xs text-slate-500">{log.user_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={ACTION_LABELS[log.action]?.color || "bg-slate-100"}>
                      {ACTION_LABELS[log.action]?.label || log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{RESOURCE_LABELS[log.resource_type] || log.resource_type}</p>
                      {log.resource_name && <p className="text-xs text-slate-500">{log.resource_name}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="text-sm text-slate-600 truncate">{log.details || "-"}</p>
                  </TableCell>
                  <TableCell>
                    {(log.old_value || log.new_value) && (
                      <div className="text-xs">
                        {log.old_value && <p className="text-rose-600 line-through">{log.old_value}</p>}
                        {log.new_value && <p className="text-emerald-600">{log.new_value}</p>}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    Keine Einträge gefunden
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Zeige {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} von {total} Einträgen
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">Seite {page} von {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
