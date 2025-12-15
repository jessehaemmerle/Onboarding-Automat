import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { AlertTriangle, Clock, Users, CheckCircle2, ArrowRight, Calendar, UserMinus } from "lucide-react";
import { format, parseISO, isPast, isWithinInterval, addDays } from "date-fns";
import { de } from "date-fns/locale";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const KPICard = ({ title, value, icon: Icon, variant = "default", onClick }) => {
  const variants = {
    default: "bg-white border-slate-200",
    warning: "bg-amber-50 border-amber-200",
    danger: "bg-rose-50 border-rose-200",
    success: "bg-emerald-50 border-emerald-200",
    purple: "bg-purple-50 border-purple-200",
  };
  const iconVariants = {
    default: "text-slate-600",
    warning: "text-amber-600",
    danger: "text-rose-600",
    success: "text-emerald-600",
    purple: "text-purple-600",
  };
  
  return (
    <Card 
      className={`${variants[variant]} border cursor-pointer card-hover`}
      onClick={onClick}
      data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">{title}</p>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
          </div>
          <div className={`p-3 rounded-xl bg-white/50 ${iconVariants[variant]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState({ overdue_tasks: 0, due_in_7_days: 0, active_cases: 0, completed_cases: 0 });
  const [cases, setCases] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, casesRes, tasksRes] = await Promise.all([
          axios.get(`${API}/dashboard/stats`),
          axios.get(`${API}/cases?status=active`),
          axios.get(`${API}/tasks/my-tasks`),
        ]);
        setStats(statsRes.data);
        setCases(casesRes.data);
        setMyTasks(tasksRes.data.filter(t => t.status === "open"));
      } catch (err) {
        toast.error("Fehler beim Laden der Daten");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getTaskPriority = (task) => {
    const due = parseISO(task.due_date);
    const now = new Date();
    if (isPast(due)) return "overdue";
    if (isWithinInterval(due, { start: now, end: addDays(now, 3) })) return "urgent";
    return "normal";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="dashboard">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-slate-500 mt-1">Übersicht über alle Onboarding-Aktivitäten</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
          title="Aktive Onboardings"
          value={stats.active_cases}
          icon={Users}
          onClick={() => navigate("/cases")}
        />
        <KPICard
          title="Abgeschlossen"
          value={stats.completed_cases}
          icon={CheckCircle2}
          variant="success"
          onClick={() => navigate("/cases?status=completed")}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cases" className="space-y-6">
        <TabsList>
          <TabsTrigger value="cases" data-testid="tab-cases">Aktive Onboardings</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">Meine Tasks ({myTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="space-y-4">
          {cases.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Keine aktiven Onboardings</h3>
                <p className="text-slate-500 mb-4">Starten Sie Ihr erstes Onboarding</p>
                <Button onClick={() => navigate("/new-onboarding")} className="btn-primary" data-testid="start-first-onboarding">
                  Onboarding starten <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {cases.slice(0, 5).map((c) => {
                const openTasks = c.tasks?.filter(t => t.status === "open").length || 0;
                const totalTasks = c.tasks?.length || 0;
                const overdueTasks = c.tasks?.filter(t => t.status === "open" && isPast(parseISO(t.due_date))).length || 0;
                
                return (
                  <Card
                    key={c.id}
                    className="cursor-pointer card-hover"
                    onClick={() => navigate(`/cases/${c.id}`)}
                    data-testid={`case-${c.id}`}
                  >
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-700 font-semibold text-sm">
                            {c.employee_name.split(" ").map(n => n[0]).join("").toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{c.employee_name}</h3>
                          <p className="text-sm text-slate-500">{c.template_name_snapshot}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Startdatum</p>
                          <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(parseISO(c.start_date), "dd. MMM yyyy", { locale: de })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {overdueTasks > 0 && (
                            <Badge variant="destructive" className="text-xs">{overdueTasks} überfällig</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">{totalTasks - openTasks}/{totalTasks}</Badge>
                        </div>
                        <ArrowRight className="w-5 h-5 text-slate-400" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {cases.length > 5 && (
                <Button variant="outline" onClick={() => navigate("/cases")} className="w-full">
                  Alle {cases.length} Onboardings anzeigen
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
                  urgent: "border-l-amber-500 bg-amber-50/50",
                  normal: "border-l-slate-300",
                };
                
                return (
                  <Card
                    key={task.id}
                    className={`border-l-4 ${priorityStyles[priority]} cursor-pointer card-hover`}
                    onClick={() => navigate(`/cases/${task.case_id}`)}
                    data-testid={`task-${task.id}`}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900">{task.title}</h4>
                        <p className="text-sm text-slate-500">{task.category} • {task.owner_role_snapshot}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Fällig</p>
                          <p className={`text-sm font-medium ${priority === "overdue" ? "text-rose-600" : priority === "urgent" ? "text-amber-600" : "text-slate-700"}`}>
                            {format(parseISO(task.due_date), "dd. MMM", { locale: de })}
                          </p>
                        </div>
                        {priority === "overdue" && <Badge variant="destructive">Überfällig</Badge>}
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
