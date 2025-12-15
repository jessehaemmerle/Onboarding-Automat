import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Search, Plus, Calendar, ArrowUpDown, Users, UserMinus, Paperclip } from "lucide-react";
import { format, parseISO, isPast } from "date-fns";
import { de } from "date-fns/locale";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Cases() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("start_date");
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "all";
  const caseTypeFilter = searchParams.get("case_type") || "all";
  const navigate = useNavigate();

  useEffect(() => {
    fetchCases();
  }, [statusFilter, caseTypeFilter]);

  const fetchCases = async () => {
    try {
      let url = `${API}/cases?`;
      if (statusFilter !== "all") url += `status=${statusFilter}&`;
      if (caseTypeFilter !== "all") url += `case_type=${caseTypeFilter}`;
      const res = await axios.get(url);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {caseTypeFilter === "offboarding" ? "Offboardings" : caseTypeFilter === "onboarding" ? "Onboardings" : "Alle Vorgänge"}
          </h1>
          <p className="text-slate-500 mt-1">{filteredCases.length} Ergebnisse</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => navigate("/new-onboarding")} className="btn-primary gap-2" data-testid="new-onboarding">
            <Plus className="w-4 h-4" /> Onboarding
          </Button>
          <Button onClick={() => navigate("/new-offboarding")} variant="outline" className="gap-2" data-testid="new-offboarding">
            <UserMinus className="w-4 h-4" /> Offboarding
          </Button>
        </div>
      </div>

      {/* Type Tabs */}
      <Tabs value={caseTypeFilter} onValueChange={(v) => updateFilter("case_type", v)}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">Alle</TabsTrigger>
          <TabsTrigger value="onboarding" data-testid="tab-onboarding">Onboardings</TabsTrigger>
          <TabsTrigger value="offboarding" data-testid="tab-offboarding">Offboardings</TabsTrigger>
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
            <Users className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">Keine Onboardings gefunden</h3>
            <p className="text-slate-500 mb-6">
              {search ? "Versuchen Sie eine andere Suche" : "Starten Sie Ihr erstes Onboarding"}
            </p>
            {!search && (
              <Button onClick={() => navigate("/new-onboarding")} className="btn-primary" data-testid="start-onboarding">
                Onboarding starten
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredCases.map((c) => {
            const openTasks = c.tasks?.filter(t => t.status === "open").length || 0;
            const totalTasks = c.tasks?.length || 0;
            const completedTasks = totalTasks - openTasks;
            const overdueTasks = c.tasks?.filter(t => t.status === "open" && isPast(parseISO(t.due_date))).length || 0;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <Card
                key={c.id}
                className="cursor-pointer card-hover"
                onClick={() => navigate(`/cases/${c.id}`)}
                data-testid={`case-card-${c.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-700 font-bold">
                          {c.employee_name.split(" ").map(n => n[0]).join("").toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-slate-900">{c.employee_name}</h3>
                        <p className="text-sm text-slate-500">{c.employee_email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{c.template_name_snapshot}</Badge>
                          {c.location && <Badge variant="secondary" className="text-xs">{c.location}</Badge>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Startdatum</p>
                        <p className="text-sm font-medium text-slate-700 flex items-center gap-1 mt-1">
                          <Calendar className="w-4 h-4" />
                          {format(parseISO(c.start_date), "dd. MMM yyyy", { locale: de })}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Fortschritt</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
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
                        <Badge variant={c.status === "completed" ? "default" : "secondary"} className={c.status === "completed" ? "bg-emerald-100 text-emerald-700" : ""}>
                          {c.status === "completed" ? "Abgeschlossen" : "Aktiv"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
