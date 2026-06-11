import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Search, Plus, Calendar, ArrowUpDown, Users, UserMinus, Paperclip, RefreshCw, FilterX, Download, CheckSquare, XSquare } from "lucide-react";
import { format, parseISO, isPast } from "date-fns";
import { de } from "date-fns/locale";


export default function Cases() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("start_date");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "all";
  const caseTypeFilter = searchParams.get("case_type") || "all";
  const navigate = useNavigate();

  useEffect(() => {
    setSelectedIds(new Set());
    fetchCases();
  }, [statusFilter, caseTypeFilter]);

  const fetchCases = async () => {
    try {
      let url = `/cases?`;
      if (statusFilter !== "all") url += `case_status=${statusFilter}&`;
      if (caseTypeFilter !== "all") url += `case_type=${caseTypeFilter}`;
      const res = await api.get(url);
      setCases(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    setSearchParams(params);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCases.map(c => c.id)));
    }
  };

  const bulkComplete = async () => {
    if (!selectedIds.size) return;
    setBulkLoading(true);
    let ok = 0;
    for (const id of selectedIds) {
      try {
        await api.patch(`/cases/${id}/status?new_status=completed`);
        ok++;
      } catch { /* continue */ }
    }
    toast.success(`${ok} Vorgang${ok !== 1 ? "e" : ""} abgeschlossen`);
    setSelectedIds(new Set());
    fetchCases();
    setBulkLoading(false);
  };

  const exportCSV = async () => {
    try {
      let url = `/cases/export?`;
      if (statusFilter !== "all") url += `case_status=${statusFilter}&`;
      if (caseTypeFilter !== "all") url += `case_type=${caseTypeFilter}`;
      const res = await api.get(url, { responseType: "blob" });
      const href = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = href;
      a.download = `vorgaenge_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(href);
      toast.success("CSV heruntergeladen");
    } catch {
      toast.error("Export fehlgeschlagen");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setSearchParams({});
  };

  const hasActiveFilters = search !== "" || statusFilter !== "all" || caseTypeFilter !== "all";

  const filteredCases = cases
    .filter(c => 
      c.employee_name.toLowerCase().includes(search.toLowerCase()) ||
      c.employee_email.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "start_date") return new Date(b.start_date) - new Date(a.start_date);
      if (sortBy === "name") return a.employee_name.localeCompare(b.employee_name);
      return 0;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="cases-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {caseTypeFilter === "offboarding" ? "Offboardings" : caseTypeFilter === "onboarding" ? "Onboardings" : caseTypeFilter === "rolechange" ? "Rollenwechsel" : "Alle Vorgänge"}
          </h1>
          <p className="text-slate-500 mt-1">{filteredCases.length} Ergebnisse</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportCSV} variant="outline" className="gap-2" data-testid="export-csv">
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button onClick={() => navigate("/new-onboarding")} className="btn-primary gap-2" data-testid="new-onboarding">
            <Plus className="w-4 h-4" /> Onboarding
          </Button>
          <Button onClick={() => navigate("/new-offboarding")} variant="outline" className="gap-2" data-testid="new-offboarding">
            <UserMinus className="w-4 h-4" /> Offboarding
          </Button>
          <Button onClick={() => navigate("/new-rolechange")} variant="outline" className="gap-2 bg-orange-50 hover:bg-orange-100 border-orange-200" data-testid="new-rolechange">
            <RefreshCw className="w-4 h-4" /> Rollenwechsel
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 animate-in slide-in-from-top-2">
          <CheckSquare className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">{selectedIds.size} ausgewählt</span>
          <div className="flex-1" />
          <Button size="sm" onClick={bulkComplete} disabled={bulkLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" /> Alle abschließen
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-slate-600 gap-1.5">
            <XSquare className="w-3.5 h-3.5" /> Auswahl aufheben
          </Button>
        </div>
      )}

      {/* Type Tabs */}
      <Tabs value={caseTypeFilter} onValueChange={(v) => updateFilter("case_type", v)}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">Alle</TabsTrigger>
          <TabsTrigger value="onboarding" data-testid="tab-onboarding">Onboardings</TabsTrigger>
          <TabsTrigger value="offboarding" data-testid="tab-offboarding">Offboardings</TabsTrigger>
          <TabsTrigger value="rolechange" data-testid="tab-rolechange">Rollenwechsel</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Name oder E-Mail suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="search-input"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => updateFilter("status", v)}>
          <SelectTrigger className="w-[180px]" data-testid="status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="completed">Abgeschlossen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]" data-testid="sort-select">
            <ArrowUpDown className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Sortieren" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="start_date">Datum</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cases List */}
      {filteredCases.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            {hasActiveFilters ? (
              <>
                <FilterX className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-700 mb-2">Keine Ergebnisse für diesen Filter</h3>
                <p className="text-slate-500 mb-6">Versuchen Sie einen anderen Filter oder setzen Sie die Filter zurück.</p>
                <Button onClick={resetFilters} variant="outline" className="gap-2" data-testid="reset-filters">
                  <FilterX className="w-4 h-4" /> Filter zurücksetzen
                </Button>
              </>
            ) : (
              <>
                {caseTypeFilter === "offboarding" ? (
                  <UserMinus className="w-16 h-16 text-slate-300 mb-4" />
                ) : caseTypeFilter === "rolechange" ? (
                  <RefreshCw className="w-16 h-16 text-slate-300 mb-4" />
                ) : (
                  <Users className="w-16 h-16 text-slate-300 mb-4" />
                )}
                <h3 className="text-xl font-semibold text-slate-700 mb-2">
                  {caseTypeFilter === "offboarding" ? "Keine Offboardings gefunden" :
                   caseTypeFilter === "rolechange" ? "Keine Rollenwechsel gefunden" :
                   "Keine Vorgänge gefunden"}
                </h3>
                <p className="text-slate-500 mb-6">
                  {caseTypeFilter === "offboarding" ? "Starten Sie ein Offboarding" :
                   caseTypeFilter === "rolechange" ? "Starten Sie einen Rollenwechsel" :
                   "Starten Sie Ihr erstes Onboarding"}
                </p>
                <Button
                  onClick={() => navigate(
                    caseTypeFilter === "offboarding" ? "/new-offboarding" :
                    caseTypeFilter === "rolechange" ? "/new-rolechange" : "/new-onboarding"
                  )}
                  className="btn-primary"
                  data-testid="start-case"
                >
                  {caseTypeFilter === "offboarding" ? "Offboarding starten" :
                   caseTypeFilter === "rolechange" ? "Rollenwechsel starten" :
                   "Onboarding starten"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Select-all row */}
        <div className="flex items-center gap-3 px-2">
          <Checkbox
            checked={selectedIds.size === filteredCases.length && filteredCases.length > 0}
            onCheckedChange={toggleSelectAll}
            data-testid="select-all"
          />
          <span className="text-sm text-slate-500">Alle auswählen ({filteredCases.length})</span>
        </div>

        <div className="grid gap-4">
          {filteredCases.map((c) => {
            const openTasks      = c.tasks?.filter((t) => t.status === "open").length || 0;
            const totalTasks     = c.tasks?.length || 0;
            const completedTasks = totalTasks - openTasks;
            const overdueTasks   = c.tasks?.filter((t) => t.status === "open" && isPast(parseISO(t.due_date))).length || 0;
            const progress       = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const hasEvidenceMissing = c.tasks?.some((t) => t.evidence_required && !t.evidence_uploaded && t.status === "open");
            const typeConfig = {
              onboarding:  { avatarBg: "bg-blue-100",   avatarText: "text-blue-700",   bar: "bg-blue-600",   border: "",                           dateLabel: "Startdatum",      typeLabel: null },
              offboarding: { avatarBg: "bg-purple-100", avatarText: "text-purple-700", bar: "bg-purple-600", border: "border-l-4 border-l-purple-400", dateLabel: "Austrittsdatum", typeLabel: "Offboarding" },
              rolechange:  { avatarBg: "bg-orange-100", avatarText: "text-orange-700", bar: "bg-orange-500", border: "border-l-4 border-l-orange-400", dateLabel: "Startdatum",    typeLabel: "Rollenwechsel" },
            }[c.case_type] || { avatarBg: "bg-blue-100", avatarText: "text-blue-700", bar: "bg-blue-600", border: "", dateLabel: "Startdatum", typeLabel: null };

            return (
              <Card
                key={c.id}
                className={`card-hover ${typeConfig.border} ${selectedIds.has(c.id) ? "ring-2 ring-blue-400" : ""}`}
                data-testid={`case-card-${c.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedIds.has(c.id)}
                    onCheckedChange={() => toggleSelect(c.id)}
                    onClick={e => e.stopPropagation()}
                    className="shrink-0"
                    data-testid={`select-${c.id}`}
                  />
                  <div className="flex-1 flex items-center justify-between cursor-pointer" onClick={() => navigate(`/cases/${c.id}`)}>

                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full ${typeConfig.avatarBg} flex items-center justify-center shrink-0`}>
                        <span className={`${typeConfig.avatarText} font-bold`}>
                          {c.employee_name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-slate-900">{c.employee_name}</h3>
                        <p className="text-sm text-slate-500">{c.employee_email}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {typeConfig.typeLabel && (
                            <Badge variant="secondary" className={`text-xs ${
                              c.case_type === "offboarding" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
                            }`}>
                              {typeConfig.typeLabel}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">{c.template_name_snapshot}</Badge>
                          {c.location && <Badge variant="secondary" className="text-xs">{c.location}</Badge>}
                          {hasEvidenceMissing && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              <Paperclip className="w-3 h-3 mr-1" />Nachweis fehlt
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 md:gap-8">
                      <div className="text-center hidden sm:block">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">{typeConfig.dateLabel}</p>
                        <p className="text-sm font-medium text-slate-700 flex items-center gap-1 mt-1">
                          <Calendar className="w-4 h-4" />
                          {format(parseISO(c.start_date), "dd. MMM yyyy", { locale: de })}
                        </p>
                      </div>

                      <div className="text-center hidden md:block">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Fortschritt</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${progress === 100 ? "bg-emerald-500" : typeConfig.bar}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-700">{progress}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {overdueTasks > 0 && (
                          <Badge variant="destructive">{overdueTasks} überfällig</Badge>
                        )}
                        <Badge
                          variant={c.status === "completed" ? "default" : "secondary"}
                          className={c.status === "completed" ? "bg-emerald-100 text-emerald-700" : ""}
                        >
                          {c.status === "completed" ? "Abgeschlossen" : "Aktiv"}
                        </Badge>
                      </div>
                    </div>
                  </div>{/* flex-1 inner */}
                  </div>{/* flex items-center gap-3 */}
                </CardContent>
              </Card>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
