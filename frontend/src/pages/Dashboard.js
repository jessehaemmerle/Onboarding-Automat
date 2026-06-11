import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import {
  AlertTriangle, Clock, CheckCircle2, ArrowRight, Calendar,
  UserMinus, RefreshCw, Eye, EyeOff, Users, Circle,
} from "lucide-react";
import { format, parseISO, isPast, isWithinInterval, addDays } from "date-fns";
import { de } from "date-fns/locale";

const CASE_TYPE_CONFIG = {
  onboarding:  { label: "Onboarding",    color: "bg-blue-100",   textColor: "text-blue-700",   badgeClass: "text-blue-600 border-blue-300",   barColor: "bg-blue-500" },
  offboarding: { label: "Offboarding",   color: "bg-purple-100", textColor: "text-purple-700", badgeClass: "text-purple-600 border-purple-300", barColor: "bg-purple-500" },
  rolechange:  { label: "Rollenwechsel", color: "bg-orange-100", textColor: "text-orange-700", badgeClass: "text-orange-600 border-orange-300", barColor: "bg-orange-500" },
};

const KPICard = ({ title, value, icon: Icon, variant = "default", subtitle, onClick }) => {
  const cardCls = {
    default: "bg-white border-slate-200",
    warning: "bg-amber-50 border-amber-200",
    danger:  "bg-rose-50 border-rose-200",
    success: "bg-emerald-50 border-emerald-200",
    info:    "bg-blue-50 border-blue-200",
  };
  const iconCls = {
    default: "text-slate-600",
    warning: "text-amber-600",
    danger:  "text-rose-600",
    success: "text-emerald-600",
    info:    "text-blue-600",
  };
  return (
    <Card
      className={`${cardCls[variant]} border cursor-pointer card-hover`}
      onClick={onClick}
      data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">{title}</p>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-slate-400 mt-1 truncate max-w-[140px]">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-xl bg-white/50 ${iconCls[variant]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const CaseCard = ({ c, onClick }) => {
  const openTasks      = c.tasks?.filter((t) => t.status === "open").length || 0;
  const totalTasks     = c.tasks?.length || 0;
  const completedTasks = totalTasks - openTasks;
  const overdueTasks   = c.tasks?.filter((t) => t.status === "open" && isPast(parseISO(t.due_date))).length || 0;
  const progress       = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const isCompleted    = c.status === "completed";
  const cfg            = CASE_TYPE_CONFIG[c.case_type] || CASE_TYPE_CONFIG.onboarding;

  return (
    <Card
      className={`cursor-pointer card-hover ${isCompleted ? "bg-slate-50 opacity-80" : ""}`}
      onClick={onClick}
      data-testid={`case-${c.id}`}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          {/* Avatar + info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isCompleted ? "bg-green-100" : cfg.color}`}>
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <span className={`font-semibold text-sm ${cfg.textColor}`}>
                  {c.employee_name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-semibold truncate ${isCompleted ? "text-slate-500" : "text-slate-900"}`}>
                  {c.employee_name}
                </h3>
                {isCompleted ? (
                  <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 shrink-0">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Abgeschlossen
                  </Badge>
                ) : c.case_type !== "onboarding" ? (
                  <Badge variant="outline" className={`shrink-0 ${cfg.badgeClass}`}>{cfg.label}</Badge>
                ) : null}
              </div>
              <p className="text-sm text-slate-500 truncate">{c.template_name_snapshot || c.template_name}</p>
            </div>
          </div>

          {/* Right side: date + progress + overdue badge */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500">{isCompleted ? "Abgeschlossen" : "Startdatum"}</p>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {format(parseISO(c.start_date), "dd. MMM yyyy", { locale: de })}
              </p>
            </div>

            {/* Progress bar */}
            <div className="hidden md:flex flex-col items-end gap-1 w-24">
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progress === 100 ? "bg-emerald-500" : cfg.barColor}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-slate-500">{completedTasks}/{totalTasks}</span>
            </div>

            {overdueTasks > 0 && !isCompleted && (
              <Badge variant="destructive" className="text-xs">{overdueTasks} überfällig</Badge>
            )}
            <ArrowRight className="w-5 h-5 text-slate-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    overdue_tasks: 0, due_in_7_days: 0,
    active_cases: 0, completed_cases: 0,
    active_offboardings: 0, completed_offboardings: 0,
    active_rolechanges: 0, completed_rolechanges: 0,
  });
  const [cases, setCases] = useState([]);
  const [completedCases, setCompletedCases] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, activeCasesRes, completedCasesRes, tasksRes] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/cases?case_status=active"),
          api.get("/cases?case_status=completed"),
          api.get("/tasks/my-tasks"),
        ]);
        setStats(statsRes.data);
        setCases(activeCasesRes.data);
        setCompletedCases(completedCasesRes.data);
        setMyTasks(tasksRes.data.filter((t) => t.status === "open"));
      } catch {
        toast.error("Fehler beim Laden der Dashboard-Daten");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const displayedCases = showCompleted
    ? [...cases, ...completedCases].sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
    : cases;

  const getTaskPriority = (task) => {
    const due = parseISO(task.due_date);
    const now = new Date();
    if (isPast(due)) return "overdue";
    if (isWithinInterval(due, { start: now, end: addDays(now, 3) })) return "urgent";
    return "normal";
  };

  const totalActive    = stats.active_cases + stats.active_offboardings + stats.active_rolechanges;
  const totalCompleted = stats.completed_cases + stats.completed_offboardings + stats.completed_rolechanges;

  const activeSubtitle = [
    stats.active_cases > 0        && `${stats.active_cases} Onb.`,
    stats.active_offboardings > 0  && `${stats.active_offboardings} Offb.`,
    stats.active_rolechanges > 0   && `${stats.active_rolechanges} Rollenwechsel`,
  ].filter(Boolean).join(" · ") || undefined;

  const completedSubtitle = [
    stats.completed_cases > 0        && `${stats.completed_cases} Onb.`,
    stats.completed_offboardings > 0  && `${stats.completed_offboardings} Offb.`,
    stats.completed_rolechanges > 0   && `${stats.completed_rolechanges} Rollenwechsel`,
  ].filter(Boolean).join(" · ") || undefined;

  const multipleTypes = (stats.active_offboardings > 0 || stats.active_rolechanges > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="dashboard">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-slate-500 mt-1">Übersicht über alle HR-Prozesse</p>
      </div>

      {/* 4 consolidated KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Überfällige Tasks"
          value={stats.overdue_tasks}
          icon={AlertTriangle}
          variant={stats.overdue_tasks > 0 ? "danger" : "default"}
          onClick={() => navigate("/cases")}
        />
        <KPICard
          title="Fällig in 7 Tagen"
          value={stats.due_in_7_days}
          icon={Clock}
          variant={stats.due_in_7_days > 5 ? "warning" : "default"}
          onClick={() => navigate("/cases")}
        />
        <KPICard
          title="Aktive Vorgänge"
          value={totalActive}
          icon={Users}
          variant={totalActive > 0 ? "info" : "default"}
          subtitle={activeSubtitle}
          onClick={() => navigate("/cases")}
        />
        <KPICard
          title="Abgeschlossen"
          value={totalCompleted}
          icon={CheckCircle2}
          variant="success"
          subtitle={completedSubtitle}
          onClick={() => navigate("/cases?status=completed")}
        />
      </div>

      {/* Type breakdown — only shown when offboarding/rolechange are in use */}
      {multipleTypes && (
        <div className="grid grid-cols-3 gap-3">
          <div
            className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={() => navigate("/cases?case_type=onboarding")}
          >
            <Users className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <p className="text-xs text-blue-600 font-medium">Onboardings</p>
              <p className="text-lg font-bold text-blue-900">{stats.active_cases}</p>
            </div>
          </div>
          <div
            className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-purple-100 transition-colors"
            onClick={() => navigate("/cases?case_type=offboarding")}
          >
            <UserMinus className="w-4 h-4 text-purple-600 shrink-0" />
            <div>
              <p className="text-xs text-purple-600 font-medium">Offboardings</p>
              <p className="text-lg font-bold text-purple-900">{stats.active_offboardings}</p>
            </div>
          </div>
          <div
            className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-orange-100 transition-colors"
            onClick={() => navigate("/cases?case_type=rolechange")}
          >
            <RefreshCw className="w-4 h-4 text-orange-600 shrink-0" />
            <div>
              <p className="text-xs text-orange-600 font-medium">Rollenwechsel</p>
              <p className="text-lg font-bold text-orange-900">{stats.active_rolechanges}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="cases" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="cases" data-testid="tab-cases">
              Vorgänge ({showCompleted ? displayedCases.length : cases.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">
              Meine Tasks ({myTasks.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-lg">
            <Switch id="show-completed" checked={showCompleted} onCheckedChange={setShowCompleted} />
            <Label htmlFor="show-completed" className="text-sm text-slate-600 cursor-pointer flex items-center gap-2">
              {showCompleted ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              Abgeschlossene anzeigen
              {completedCases.length > 0 && (
                <Badge variant="secondary" className="ml-1">{completedCases.length}</Badge>
              )}
            </Label>
          </div>
        </div>

        <TabsContent value="cases" className="space-y-4">
          {displayedCases.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Keine aktiven Vorgänge</h3>
                <p className="text-slate-500 mb-4">Starten Sie Ihr erstes Onboarding</p>
                <Button onClick={() => navigate("/new-onboarding")} className="btn-primary" data-testid="start-first-onboarding">
                  Onboarding starten <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {displayedCases.slice(0, showCompleted ? 10 : 5).map((c) => (
                <CaseCard key={c.id} c={c} onClick={() => navigate(`/cases/${c.id}`)} />
              ))}
              {displayedCases.length > (showCompleted ? 10 : 5) && (
                <Button variant="outline" onClick={() => navigate("/cases")} className="w-full">
                  Alle {displayedCases.length} Vorgänge anzeigen
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          {myTasks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Keine offenen Tasks</h3>
                <p className="text-slate-500">Sie haben alle Aufgaben erledigt!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myTasks.slice(0, 10).map((task) => {
                const priority = getTaskPriority(task);
                const priorityStyles = {
                  overdue: "border-l-rose-500 bg-rose-50/50",
                  urgent:  "border-l-amber-500 bg-amber-50/50",
                  normal:  "border-l-slate-300",
                };
                return (
                  <Card
                    key={task.id}
                    className={`border-l-4 ${priorityStyles[priority]}`}
                    data-testid={`task-${task.id}`}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      {/* Quick complete button */}
                      <button
                        className="shrink-0 text-slate-300 hover:text-emerald-500 transition-colors"
                        title="Als erledigt markieren"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await api.patch(`/tasks/${task.id}/status?new_status=done`);
                            toast.success("Task erledigt!");
                            setMyTasks(prev => prev.filter(t => t.id !== task.id));
                          } catch (err) {
                            toast.error(err.response?.data?.detail || "Fehler");
                          }
                        }}
                        data-testid={`quick-complete-${task.id}`}
                      >
                        <Circle className="w-5 h-5" />
                      </button>

                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/cases/${task.case_id}`)}>
                        <h4 className="font-medium text-slate-900 truncate">{task.title}</h4>
                        <p className="text-sm text-slate-500">{task.category} · {task.owner_role_snapshot}</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Fällig</p>
                          <p className={`text-sm font-medium ${
                            priority === "overdue" ? "text-rose-600" : priority === "urgent" ? "text-amber-600" : "text-slate-700"
                          }`}>
                            {format(parseISO(task.due_date), "dd. MMM", { locale: de })}
                          </p>
                        </div>
                        {priority === "overdue" && <Badge variant="destructive">Überfällig</Badge>}
                        <ArrowRight
                          className="w-4 h-4 text-slate-300 cursor-pointer hover:text-slate-600 transition-colors"
                          onClick={() => navigate(`/cases/${task.case_id}`)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
