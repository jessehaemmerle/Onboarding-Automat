import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, ArrowRight, Calendar as CalendarIcon, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function NewOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [formData, setFormData] = useState({
    employee_name: "",
    employee_email: "",
    template_id: "",
    start_date: null,
    location: "",
    manager_email: "",
  });
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API}/templates`);
      setTemplates(res.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Templates");
    }
  };

  const selectedTemplate = templates.find(t => t.id === formData.template_id);

  const generatePreview = () => {
    if (!selectedTemplate || !formData.start_date) return;
    
    const startDate = formData.start_date;
    const tasks = selectedTemplate.tasks.map(t => {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + t.offset_days);
      return {
        ...t,
        due_date: dueDate,
        warning: t.offset_days < 0 && dueDate < new Date(),
      };
    }).sort((a, b) => a.offset_days - b.offset_days);

    setPreview(tasks);
    setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/cases`, {
        ...formData,
        start_date: formData.start_date.toISOString(),
      });
      toast.success("Onboarding erfolgreich erstellt!");
      navigate(`/cases/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Erstellen");
    } finally {
      setLoading(false);
    }
  };

  const isStep1Valid = formData.employee_name && formData.employee_email && formData.template_id && formData.start_date && formData.manager_email;

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="new-onboarding">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Neues Onboarding</h1>
          <p className="text-slate-500">Schritt {step} von 2</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-slate-200'}`} />
        <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Mitarbeiterinformationen</CardTitle>
            <CardDescription>Geben Sie die Daten des neuen Mitarbeiters ein</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Max Mustermann"
                  value={formData.employee_name}
                  onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                  data-testid="employee-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="max.mustermann@firma.de"
                  value={formData.employee_email}
                  onChange={(e) => setFormData({ ...formData, employee_email: e.target.value })}
                  data-testid="employee-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Template / Rolle *</Label>
                <Select value={formData.template_id} onValueChange={(v) => setFormData({ ...formData, template_id: v })}>
                  <SelectTrigger data-testid="template-select">
                    <SelectValue placeholder="Template auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.tasks.length} Tasks)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Startdatum *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="start-date-picker">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.start_date ? format(formData.start_date, "dd. MMMM yyyy", { locale: de }) : "Datum wählen"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.start_date}
                      onSelect={(date) => setFormData({ ...formData, start_date: date })}
                      locale={de}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Standort</Label>
                <Input
                  id="location"
                  placeholder="z.B. Berlin, Remote"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  data-testid="location"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manager">Manager E-Mail *</Label>
                <Input
                  id="manager"
                  type="email"
                  placeholder="manager@firma.de"
                  value={formData.manager_email}
                  onChange={(e) => setFormData({ ...formData, manager_email: e.target.value })}
                  data-testid="manager-email"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={generatePreview} disabled={!isStep1Valid} className="btn-primary" data-testid="next-step">
                Weiter <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && preview && (
        <Card>
          <CardHeader>
            <CardTitle>Vorschau der Tasks</CardTitle>
            <CardDescription>
              {preview.length} Tasks werden für {formData.employee_name} erstellt
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Warnings */}
            {preview.some(t => t.warning) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Achtung: Einige Tasks liegen in der Vergangenheit</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Tasks mit negativem Offset werden vor dem Startdatum fällig. Bitte prüfen Sie das Startdatum.
                  </p>
                </div>
              </div>
            )}

            {/* Task Preview */}
            <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
              {preview.map((task, idx) => (
                <div key={idx} className={`p-4 ${task.warning ? 'bg-amber-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{task.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        <Badge variant="outline">{task.category}</Badge>
                        <span>{task.owner_role}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${task.warning ? 'text-amber-600' : 'text-slate-700'}`}>
                        {format(task.due_date, "dd. MMM yyyy", { locale: de })}
                      </p>
                      <p className="text-xs text-slate-400">
                        {task.offset_days === 0 ? "Am Starttag" : task.offset_days > 0 ? `+${task.offset_days} Tage` : `${task.offset_days} Tage`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="btn-primary" data-testid="create-onboarding">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Onboarding erstellen
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
