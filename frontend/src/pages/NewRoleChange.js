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
import { ArrowLeft, ArrowRight, Calendar as CalendarIcon, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function NewRoleChange() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [searchEmployee, setSearchEmployee] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formData, setFormData] = useState({
    employee_name: "",
    employee_email: "",
    template_id: "",
    start_date: null, // transition date
    location: "",
    manager_email: "",
    linked_case_id: null,
    old_role: "",
    new_role: "",
  });
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [templatesRes, employeesRes] = await Promise.all([
        axios.get(`${API}/templates?template_type=rolechange`),
        axios.get(`${API}/employees/for-offboarding`), // Reuse same endpoint (all employees)
      ]);
      setTemplates(templatesRes.data);
      setEmployees(employeesRes.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Daten");
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.employee_name.toLowerCase().includes(searchEmployee.toLowerCase()) ||
    e.employee_email.toLowerCase().includes(searchEmployee.toLowerCase())
  );

  const selectEmployee = (emp) => {
    setSelectedEmployee(emp);
    setFormData({
      ...formData,
      employee_name: emp.employee_name,
      employee_email: emp.employee_email,
      location: emp.location || "",
      manager_email: emp.manager_email,
      linked_case_id: emp.onboarding_case_id,
    });
  };

  const selectedTemplate = templates.find(t => t.id === formData.template_id);

  const generatePreview = () => {
    if (!selectedTemplate || !formData.start_date) return;
    
    const transitionDate = formData.start_date;
    const tasks = selectedTemplate.tasks.map(t => {
      const dueDate = new Date(transitionDate);
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
        case_type: "rolechange",
      });
      toast.success("Rollenwechsel erfolgreich erstellt!");
      navigate(`/cases/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Erstellen");
    } finally {
      setLoading(false);
    }
  };

  const isStep1Valid = formData.employee_name && formData.employee_email && formData.template_id && formData.start_date && formData.manager_email && formData.old_role && formData.new_role;

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="new-rolechange">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <RefreshCw className="w-8 h-8 text-orange-600" />
            Neuer Rollenwechsel
          </h1>
          <p className="text-slate-500">Schritt {step} von 2</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-orange-600' : 'bg-slate-200'}`} />
        <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-orange-600' : 'bg-slate-200'}`} />
      </div>

      {step === 1 && (
        <div className="space-y-6">
          {/* Select from existing employees */}
          {employees.length > 0 && !selectedEmployee && (
            <Card>
              <CardHeader>
                <CardTitle>Mitarbeiter auswählen</CardTitle>
                <CardDescription>Wählen Sie einen bestehenden Mitarbeiter für den Rollenwechsel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Mitarbeiter suchen..."
                    value={searchEmployee}
                    onChange={(e) => setSearchEmployee(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {filteredEmployees.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">Keine Mitarbeiter gefunden</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredEmployees.map(emp => (
                      <Card 
                        key={emp.onboarding_case_id}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => selectEmployee(emp)}
                      >
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{emp.employee_name}</p>
                            <p className="text-sm text-slate-500">{emp.employee_email}</p>
                          </div>
                          <Badge variant={emp.status === "completed" ? "success" : "secondary"}>
                            {emp.status === "completed" ? "Abgeschlossen" : "Aktiv"}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Main Form */}
          <Card>
            <CardHeader>
              <CardTitle>Rollenwechsel-Details</CardTitle>
              <CardDescription>Geben Sie die Informationen für den internen Rollenwechsel ein</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedEmployee && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-900">Ausgewählter Mitarbeiter</p>
                    <p className="text-sm text-orange-700">{selectedEmployee.employee_name}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setSelectedEmployee(null);
                      setFormData({
                        employee_name: "",
                        employee_email: "",
                        template_id: "",
                        start_date: null,
                        location: "",
                        manager_email: "",
                        linked_case_id: null,
                        old_role: "",
                        new_role: "",
                      });
                    }}
                  >
                    Ändern
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Mitarbeitername *</Label>
                  <Input
                    value={formData.employee_name}
                    onChange={(e) => setFormData({...formData, employee_name: e.target.value})}
                    placeholder="Max Mustermann"
                    disabled={!!selectedEmployee}
                  />
                </div>
                <div>
                  <Label>E-Mail *</Label>
                  <Input
                    type="email"
                    value={formData.employee_email}
                    onChange={(e) => setFormData({...formData, employee_email: e.target.value})}
                    placeholder="max@firma.de"
                    disabled={!!selectedEmployee}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Alte Rolle *</Label>
                  <Input
                    value={formData.old_role}
                    onChange={(e) => setFormData({...formData, old_role: e.target.value})}
                    placeholder="z.B. Junior Developer"
                  />
                </div>
                <div>
                  <Label>Neue Rolle *</Label>
                  <Input
                    value={formData.new_role}
                    onChange={(e) => setFormData({...formData, new_role: e.target.value})}
                    placeholder="z.B. Senior Developer"
                  />
                </div>
              </div>

              <div>
                <Label>Template *</Label>
                <Select value={formData.template_id} onValueChange={(v) => setFormData({...formData, template_id: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Template auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <div className="p-2 text-sm text-slate-500">
                        Keine Rollenwechsel-Templates vorhanden. Bitte erstellen Sie zuerst ein Template.
                      </div>
                    ) : (
                      templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Erstellen Sie ein Template mit dem Typ "Rollenwechsel" unter Templates
                  </p>
                )}
              </div>

              <div>
                <Label>Übergangsdatum *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.start_date ? format(formData.start_date, "PPP", { locale: de }) : "Datum wählen"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.start_date}
                      onSelect={(date) => setFormData({...formData, start_date: date})}
                      locale={de}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Standort</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    placeholder="Berlin"
                  />
                </div>
                <div>
                  <Label>Verantwortlicher Manager *</Label>
                  <Input
                    type="email"
                    value={formData.manager_email}
                    onChange={(e) => setFormData({...formData, manager_email: e.target.value})}
                    placeholder="manager@firma.de"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Abbrechen
            </Button>
            <Button 
              onClick={generatePreview}
              disabled={!isStep1Valid}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Weiter <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && preview && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-orange-600" />
                Vorschau & Bestätigung
              </CardTitle>
              <CardDescription>
                Überprüfen Sie die Rollenwechsel-Details und die generierten Aufgaben
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">Mitarbeiter</p>
                  <p className="font-medium">{formData.employee_name}</p>
                  <p className="text-sm text-slate-600">{formData.employee_email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Rollenwechsel</p>
                  <p className="font-medium text-slate-700">
                    {formData.old_role} → {formData.new_role}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Template</p>
                  <p className="font-medium">{selectedTemplate?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Übergangsdatum</p>
                  <p className="font-medium">{format(formData.start_date, "PPP", { locale: de })}</p>
                </div>
              </div>

              {/* Tasks Preview */}
              <div>
                <h3 className="font-semibold mb-3 text-slate-900">Aufgaben ({preview.length})</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {preview.map((task, idx) => (
                    <Card key={idx} className={task.warning ? "border-amber-300 bg-amber-50" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">{task.category}</Badge>
                              <Badge variant="secondary" className="text-xs">{task.owner_role}</Badge>
                            </div>
                            <h4 className="font-medium text-slate-900">{task.title}</h4>
                            {task.description && (
                              <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-xs text-slate-500">Fällig am</p>
                            <p className={`text-sm font-medium ${task.warning ? "text-amber-700" : "text-slate-900"}`}>
                              {format(task.due_date, "dd. MMM yyyy", { locale: de })}
                            </p>
                            {task.offset_days !== 0 && (
                              <p className="text-xs text-slate-500">
                                Tag {task.offset_days > 0 ? `+${task.offset_days}` : task.offset_days}
                              </p>
                            )}
                          </div>
                        </div>
                        {task.warning && (
                          <div className="flex items-center gap-2 mt-2 text-amber-700">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-xs">Achtung: Fälligkeitsdatum liegt in der Vergangenheit</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Erstelle...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Rollenwechsel erstellen
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
