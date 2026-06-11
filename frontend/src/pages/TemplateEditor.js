import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Loader2 } from "lucide-react";


export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === undefined || id === "new";
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [ownerRoles, setOwnerRoles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [template, setTemplate] = useState({
    name: "",
    description: "",
    template_type: "onboarding",
    tasks: [],
  });

  useEffect(() => {
    fetchOwnerRolesAndCategories();
    if (!isNew) {
      fetchTemplate();
    }
  }, [id]);

  const fetchOwnerRolesAndCategories = async () => {
    try {
      const [rolesRes, categoriesRes] = await Promise.all([
        api.get(`/owner-roles`),
        api.get(`/categories`)
      ]);
      setOwnerRoles(rolesRes.data);
      setCategories(categoriesRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTemplate = async () => {
    try {
      const res = await api.get(`/templates/${id}`);
      setTemplate(res.data);
    } catch (err) {
      toast.error("Template nicht gefunden");
      navigate("/templates");
    } finally {
      setLoading(false);
    }
  };

  const addTask = () => {
    setTemplate({
      ...template,
      tasks: [
        ...template.tasks,
        {
          id: `new-${Date.now()}`,
          title: "",
          description: "",
          category: categories[0]?.name || "IT",
          owner_role: ownerRoles[0]?.name || "IT",
          offset_days: 0,
          evidence_required: false,
          sort_order: template.tasks.length,
          depends_on: null,
        },
      ],
    });
  };

  const updateTask = (index, field, value) => {
    const newTasks = [...template.tasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setTemplate({ ...template, tasks: newTasks });
  };

  const removeTask = (index) => {
    setTemplate({
      ...template,
      tasks: template.tasks.filter((_, i) => i !== index),
    });
  };

  const moveTask = (index, direction) => {
    const newTasks = [...template.tasks];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newTasks.length) return;
    [newTasks[index], newTasks[newIndex]] = [newTasks[newIndex], newTasks[index]];
    newTasks.forEach((t, i) => (t.sort_order = i));
    setTemplate({ ...template, tasks: newTasks });
  };

  const handleSave = async () => {
    if (!template.name.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }

    const invalidTasks = template.tasks.filter(t => !t.title.trim());
    if (invalidTasks.length > 0) {
      toast.error("Alle Tasks benötigen einen Titel");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: template.name,
        description: template.description,
        template_type: template.template_type || "onboarding",
        tasks: template.tasks.map((t, i) => ({
          id: t.id,  // Preserve task ID for dependency mapping
          title: t.title,
          description: t.description || "",
          category: t.category,
          owner_role: t.owner_role,
          offset_days: parseInt(t.offset_days) || 0,
          evidence_required: t.evidence_required || false,
          sort_order: i,
          depends_on: t.depends_on || null,
        })),
      };

      if (isNew) {
        await api.post(`/templates`, payload);
        toast.success("Template erstellt");
      } else {
        await api.put(`/templates/${id}`, payload);
        toast.success("Template gespeichert");
      }
      navigate("/templates");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="template-editor">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/templates")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
          </Button>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {isNew ? "Neues Template" : "Template bearbeiten"}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving} className="btn-primary" data-testid="save-template">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Speichern</>}
        </Button>
      </div>

      {/* Template Info */}
      <Card>
        <CardHeader>
          <CardTitle>Template-Informationen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="z.B. Entwickler"
                value={template.name}
                onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                data-testid="template-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Beschreibung</Label>
              <Input
                id="desc"
                placeholder="Kurze Beschreibung"
                value={template.description}
                onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                data-testid="template-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Template-Typ *</Label>
              <Select
                value={template.template_type || "onboarding"}
                onValueChange={(v) => setTemplate({ ...template, template_type: v })}
              >
                <SelectTrigger id="type" data-testid="template-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="offboarding">Offboarding</SelectItem>
                  <SelectItem value="rolechange">Rollenwechsel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tasks ({template.tasks.length})</CardTitle>
          <Button onClick={addTask} variant="outline" size="sm" data-testid="add-task">
            <Plus className="w-4 h-4 mr-2" /> Task hinzufügen
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {template.tasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>Noch keine Tasks. Klicken Sie auf "Task hinzufügen".</p>
            </div>
          ) : (
            template.tasks.map((task, index) => (
              <div key={task.id} className="border rounded-lg p-4 bg-slate-50" data-testid={`task-row-${index}`}>
                <div className="flex items-start gap-4">
                  <div className="flex flex-col gap-1 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => moveTask(index, -1)}
                      disabled={index === 0}
                    >
                      ↑
                    </Button>
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => moveTask(index, 1)}
                      disabled={index === template.tasks.length - 1}
                    >
                      ↓
                    </Button>
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <Label>Titel *</Label>
                      <Input
                        placeholder="z.B. Laptop bereitstellen"
                        value={task.title}
                        onChange={(e) => updateTask(index, "title", e.target.value)}
                        data-testid={`task-title-${index}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kategorie</Label>
                      <Select value={task.category} onValueChange={(v) => updateTask(index, "category", v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Verantwortlich</Label>
                      <Select value={task.owner_role} onValueChange={(v) => updateTask(index, "owner_role", v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ownerRoles.map(role => (
                            <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tage vor Startdatum</Label>
                      <Input
                        type="number"
                        value={task.offset_days}
                        onChange={(e) => updateTask(index, "offset_days", e.target.value)}
                        data-testid={`task-offset-${index}`}
                      />
                      <p className="text-xs text-slate-500">Positiv = vor Startdatum, Negativ = nach Startdatum</p>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Beschreibung</Label>
                      <Textarea
                        placeholder="Optionale Details..."
                        value={task.description || ""}
                        onChange={(e) => updateTask(index, "description", e.target.value)}
                        className="min-h-[60px]"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={task.evidence_required}
                        onCheckedChange={(v) => updateTask(index, "evidence_required", v)}
                      />
                      <Label className="text-sm">Nachweis erforderlich</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>Abhängig von</Label>
                      <Select 
                        value={task.depends_on || "none"} 
                        onValueChange={(v) => updateTask(index, "depends_on", v === "none" ? null : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Keine Abhängigkeit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Keine Abhängigkeit</SelectItem>
                          {template.tasks
                            .filter((t, i) => i !== index && t.id !== task.id)
                            .map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.title || `Aufgabe ${template.tasks.indexOf(t) + 1}`}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">Task wird erst freigeschaltet wenn der Vorgänger abgeschlossen ist</p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => removeTask(index)}
                    data-testid={`delete-task-${index}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
