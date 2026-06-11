import { useState, useEffect } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { CheckCircle2, Users, TrendingUp, AlertTriangle, BarChart2, PieChart } from "lucide-react";

const BAR_COLORS = { onboarding: "#3b82f6", offboarding: "#8b5cf6", rolechange: "#f59e0b" };
const CATEGORY_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#6b7280"];

const StatCard = ({ title, value, icon: Icon, variant = "default", subtitle }) => {
  const bg = { default: "bg-white", info: "bg-blue-50", success: "bg-emerald-50", warning: "bg-amber-50", danger: "bg-rose-50" }[variant];
  const ic = { default: "text-slate-600", info: "text-blue-600", success: "text-emerald-600", warning: "text-amber-600", danger: "text-rose-600" }[variant];
  return (
    <Card className={`${bg} border`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1">{title}</p>
            <p className="text-3xl font-bold text-slate-900">{value}</p>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-xl bg-white/60 ${ic}`}><Icon className="w-6 h-6" /></div>
        </div>
      </CardContent>
    </Card>
  );
};

const HorizontalBar = ({ label, value, max, color = "#3b82f6", showValue = true }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-600 w-32 truncate shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      {showValue && <span className="text-sm font-semibold text-slate-700 w-8 text-right shrink-0">{value}</span>}
    </div>
  );
};

const MonthlyChart = ({ data }) => {
  if (!data?.length) return <p className="text-sm text-slate-400 text-center py-8">Noch keine Daten</p>;
  const maxVal = Math.max(...data.map(d => d.onboarding + d.offboarding + d.rolechange), 1);
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d, i) => {
        const total = d.onboarding + d.offboarding + d.rolechange;
        const height = maxVal > 0 ? (total / maxVal) * 100 : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-slate-500">{total > 0 ? total : ""}</span>
            <div className="w-full flex flex-col justify-end rounded overflow-hidden" style={{ height: 120 }}>
              {/* stacked bar */}
              <div style={{ height: `${height}%`, display: "flex", flexDirection: "column-reverse" }}>
                {d.rolechange > 0 && (
                  <div style={{ flex: d.rolechange, background: BAR_COLORS.rolechange, minHeight: 3 }} />
                )}
                {d.offboarding > 0 && (
                  <div style={{ flex: d.offboarding, background: BAR_COLORS.offboarding, minHeight: 3 }} />
                )}
                {d.onboarding > 0 && (
                  <div style={{ flex: d.onboarding, background: BAR_COLORS.onboarding, minHeight: 3 }} />
                )}
                {total === 0 && (
                  <div style={{ height: 4, background: "#e5e7eb", borderRadius: 2 }} />
                )}
              </div>
            </div>
            <span className="text-xs text-slate-400">{d.month?.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
};

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/analytics/overview")
      .then(r => setData(r.data))
      .catch(() => toast.error("Fehler beim Laden der Analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const s = data?.summary || {};
  const catMax = Math.max(...(data?.category_breakdown || []).map(c => c.count), 1);
  const overdueMax = Math.max(...(data?.overdue_by_category || []).map(c => c.count), 1);
  const templateMax = Math.max(...(data?.avg_by_template || []).map(t => t.count), 1);

  return (
    <div className="space-y-8" data-testid="analytics-page">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Analytics</h1>
        <p className="text-slate-500 mt-1">Auswertungen und Kennzahlen für alle HR-Prozesse</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Aktive Vorgänge" value={s.total_active ?? 0} icon={Users} variant="info" />
        <StatCard title="Abgeschlossen" value={s.total_completed ?? 0} icon={CheckCircle2} variant="success" />
        <StatCard
          title="Task-Abschlussrate"
          value={`${s.task_completion_rate ?? 0}%`}
          icon={TrendingUp}
          variant={s.task_completion_rate >= 80 ? "success" : "warning"}
          subtitle={`${s.done_tasks ?? 0} / ${s.total_tasks ?? 0} Tasks`}
        />
        <StatCard
          title="Offene Überfällige"
          value={(data?.overdue_by_category || []).reduce((a, c) => a + c.count, 0)}
          icon={AlertTriangle}
          variant="danger"
        />
      </div>

      {/* Monthly chart + Template performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart2 className="w-4 h-4 text-blue-600" /> Abschlüsse je Monat (letzte 6 Monate)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyChart data={data?.monthly_completions} />
            <div className="flex gap-4 mt-4 justify-center">
              {Object.entries(BAR_COLORS).map(([key, color]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
                  <span className="text-xs text-slate-500 capitalize">
                    {key === "onboarding" ? "Onboarding" : key === "offboarding" ? "Offboarding" : "Rollenwechsel"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Abschlüsse je Template
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.avg_by_template?.length ? (
              data.avg_by_template.map((t, i) => (
                <HorizontalBar key={i} label={t.template} value={t.count} max={templateMax} color="#10b981" />
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">Noch keine abgeschlossenen Vorgänge</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown + Overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="w-4 h-4 text-blue-600" /> Offene Tasks nach Kategorie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.category_breakdown?.length ? (
              data.category_breakdown.map((c, i) => (
                <HorizontalBar
                  key={i}
                  label={c.category}
                  value={c.count}
                  max={catMax}
                  color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                />
              ))
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">Keine offenen Tasks</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-4 h-4 text-rose-600" /> Überfällige Tasks nach Kategorie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.overdue_by_category?.length ? (
              data.overdue_by_category.map((c, i) => (
                <HorizontalBar key={i} label={c.category} value={c.count} max={overdueMax} color="#ef4444" />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <p className="text-sm text-slate-500">Keine überfälligen Tasks 🎉</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
