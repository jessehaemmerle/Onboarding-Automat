import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { ArrowLeft, Calendar as CalendarIcon, Download, CheckCircle2, Circle, MessageSquare, Send, Clock, User, Mail, MapPin, FileText, Paperclip, Upload, Trash2, File, Image, UserMinus, RefreshCw, Lock } from "lucide-react";
import { format, parseISO, isPast, isWithinInterval, addDays } from "date-fns";
import { de } from "date-fns/locale";


export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, canManageContent, isManager } = useAuth();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [newStartDate, setNewStartDate] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCase();
  }, [id]);

  const fetchCase = async () => {
    try {
      const res = await api.get(`/cases/${id}`);
      setCaseData(res.data);
      if (res.data.start_date) {
        setNewStartDate(parseISO(res.data.start_date));
      }
    } catch (err) {
      toast.error("Fehler beim Laden des Cases");
      navigate("/cases");
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (taskId) => {
    try {
      const res = await api.get(`/tasks/${taskId}/comments`);
      setComments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEvidence = async (taskId) => {
    try {
      const res = await api.get(`/tasks/${taskId}/evidence`);
      setEvidence(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openTaskModal = async (task) => {
    setSelectedTask(task);
    await Promise.all([fetchComments(task.id), fetchEvidence(task.id)]);
  };

  const toggleTaskStatus = async (task) => {
    const newStatus = task.status === "done" ? "open" : "done";
    try {
      await api.patch(`/tasks/${task.id}/status?new_status=${newStatus}`);
      toast.success(newStatus === "done" ? "Task erledigt!" : "Task wieder geöffnet");
      fetchCase();
      if (selectedTask?.id === task.id) {
        setSelectedTask({ ...selectedTask, status: newStatus, evidence_uploaded: evidence.length > 0 });
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Aktualisieren");
    }
  };

  const uploadEvidence = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTask) return;
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Datei zu groß (max 10MB)");
      return;
    }
    
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      await api.post(`/tasks/${selectedTask.id}/evidence`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success("Nachweis hochgeladen");
      fetchEvidence(selectedTask.id);
      fetchCase();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Hochladen");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadEvidence = async (ev) => {
    try {
      const res = await api.get(`/evidence/${ev.id}/download`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", ev.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error("Fehler beim Download");
    }
  };

  const deleteEvidence = async (ev) => {
    if (!window.confirm("Nachweis wirklich löschen?")) return;
    try {
      await api.delete(`/evidence/${ev.id}`);
      toast.success("Nachweis gelöscht");
      fetchEvidence(selectedTask.id);
      fetchCase();
    } catch (err) {
      toast.error("Fehler beim Löschen");
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedTask) return;
    try {
      await api.post(`/tasks/${selectedTask.id}/comments`, { body: newComment });
      setNewComment("");
      fetchComments(selectedTask.id);
      toast.success("Kommentar hinzugefügt");
    } catch (err) {
      toast.error("Fehler beim Kommentieren");
    }
  };

  const reschedule = async () => {
    if (!newStartDate) return;
    try {
      await api.patch(`/cases/${id}/reschedule`, { new_start_date: newStartDate.toISOString() });
      toast.success("Datum aktualisiert");
      setShowReschedule(false);
      fetchCase();
    } catch (err) {
      toast.error("Fehler beim Verschieben");
    }
  };

  const updateCaseStatus = async (status) => {
    try {
      await api.patch(`/cases/${id}/status?new_status=${status}`);
      toast.success("Status aktualisiert");
      fetchCase();
    } catch (err) {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  const downloadReport = async () => {
    try {
      const res = await api.get(`/cases/${id}/report`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `onboarding_report_${caseData.employee_name.replace(/ /g, "_")}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Report heruntergeladen");
    } catch (err) {
      toast.error("Fehler beim Download");
    }
  };

  const getTaskPriority = (task) => {
    if (task.status === "done") return "done";
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

  if (!caseData) return null;

  const filteredTasks = caseData.tasks
    .filter(t => {
      if (filter === "my") return t.owner_email === user?.email;
      if (filter === "overdue") return t.status === "open" && isPast(parseISO(t.due_date));
      if (filter === "open") return t.status === "open";
      if (filter === "done") return t.status === "done";
      return true;
    })
    .filter(t => categoryFilter === "all" || t.category === categoryFilter)
    .sort((a, b) => a.offset_days - b.offset_days);

  const categories = [...new Set(caseData.tasks.map(t => t.category))];
  const completedCount = caseData.tasks.filter(t => t.status === "done").length;
  const progress = caseData.tasks.length > 0 ? Math.round((completedCount / caseData.tasks.length) * 100) : 0;
  const isOffboarding = caseData.case_type === "offboarding";
  const isRoleChange = caseData.case_type === "rolechange";

  return (
    <div className="space-y-6" data-testid="case-detail">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/cases")} data-testid="back-btn">
            <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
          </Button>
          <div>
            <div className="flex items-center gap-3">
              {isOffboarding && <UserMinus className="w-6 h-6 text-purple-600" />}
              {isRoleChange && <RefreshCw className="w-6 h-6 text-orange-600" />}
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{caseData.employee_name}</h1>
            </div>
            <p className="text-slate-500">
              {isOffboarding ? "Offboarding" : isRoleChange ? "Rollenwechsel" : "Onboarding"} • {caseData.template_name_snapshot}
            </p>
            {isRoleChange && caseData.old_role && caseData.new_role && (
              <p className="text-sm text-orange-600 font-medium mt-1">
                {caseData.old_role} → {caseData.new_role}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canManageContent && (
            <Button variant="outline" onClick={() => setShowReschedule(true)} data-testid="reschedule-btn">
              <CalendarIcon className="w-4 h-4 mr-2" /> Verschieben
            </Button>
          )}
          <Button variant="outline" onClick={downloadReport} data-testid="download-report-btn">
            <Download className="w-4 h-4 mr-2" /> Report
          </Button>
          {canManageContent && (caseData.status === "active" ? (
            <Button
              onClick={() => updateCaseStatus("completed")}
              className={
                isOffboarding ? "bg-purple-600 hover:bg-purple-700 text-white" :
                isRoleChange ? "bg-orange-600 hover:bg-orange-700 text-white" :
                "btn-primary"
              }
              data-testid="complete-btn"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Abschließen
            </Button>
          ) : (
            <Button onClick={() => updateCaseStatus("active")} variant="secondary" data-testid="reopen-btn">
              Wieder öffnen
            </Button>
          ))}
        </div>
      </div>

      {/* Meta Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {/* Progress */}
          <Card className={isOffboarding ? "border-l-4 border-l-purple-400" : isRoleChange ? "border-l-4 border-l-orange-400" : ""}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Fortschritt</h3>
                <span className="text-2xl font-bold text-slate-900">{progress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progress === 100 ? 'bg-emerald-500' : 
                    isOffboarding ? 'bg-purple-600' : 
                    isRoleChange ? 'bg-orange-600' : 
                    'bg-blue-600'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-slate-500 mt-2">{completedCount} von {caseData.tasks.length} Tasks erledigt</p>
            </CardContent>
          </Card>

          {/* Task Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[160px]" data-testid="task-filter">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Tasks</SelectItem>
                <SelectItem value="my">Meine Tasks</SelectItem>
                <SelectItem value="open">Offen</SelectItem>
                <SelectItem value="done">Erledigt</SelectItem>
                <SelectItem value="overdue">Überfällig</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]" data-testid="category-filter">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tasks List */}
          <div className="space-y-3">
            {filteredTasks.map(task => {
              const priority = getTaskPriority(task);
              const priorityStyles = {
                done: "border-l-emerald-500 bg-emerald-50/30",
                overdue: "border-l-rose-500 bg-rose-50/50",
                urgent: "border-l-amber-500 bg-amber-50/50",
                normal: "border-l-slate-300",
              };
              // Content managers edit any task; managers see only their department's
              // tasks here (backend-filtered) so they may edit those; users edit own.
              const canEdit = canManageContent || isManager || task.owner_email === user?.email;
              const needsEvidence = task.evidence_required && !task.evidence_uploaded && task.status === "open";
              const isBlocked = task.is_blocked;
              // Find the blocking task's title
              const blockingTask = isBlocked && task.depends_on 
                ? filteredTasks.find(t => t.id === task.depends_on)
                : null;

              return (
                <Card key={task.id} className={`border-l-4 ${priorityStyles[priority]} ${isBlocked ? "opacity-60" : ""}`} data-testid={`task-item-${task.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {canEdit && !isBlocked && (
                        <Checkbox
                          checked={task.status === "done"}
                          onCheckedChange={() => toggleTaskStatus(task)}
                          className="h-5 w-5"
                          data-testid={`task-checkbox-${task.id}`}
                        />
                      )}
                      {isBlocked && (
                        <div className="h-5 w-5 flex items-center justify-center text-slate-400" title={blockingTask ? `Warten auf: ${blockingTask.title}` : "Blockiert"}>
                          <Lock className="h-4 w-4" />
                        </div>
                      )}
                      <div className="flex-1 cursor-pointer" onClick={() => openTaskModal(task)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`font-medium ${task.status === "done" ? "text-slate-400 line-through" : isBlocked ? "text-slate-500" : "text-slate-900"}`}>
                            {task.title}
                          </h4>
                          {isBlocked && (
                            <Badge variant="outline" className="text-xs text-slate-500 border-slate-300">
                              <Lock className="w-3 h-3 mr-1" />
                              {blockingTask ? `Warten auf: ${blockingTask.title}` : "Blockiert"}
                            </Badge>
                          )}
                          {priority === "overdue" && !isBlocked && <Badge variant="destructive" className="text-xs">Überfällig</Badge>}
                          {task.evidence_required && (
                            <Badge variant={task.evidence_uploaded ? "secondary" : "outline"} className={`text-xs ${task.evidence_uploaded ? "bg-emerald-100 text-emerald-700" : needsEvidence ? "text-amber-600 border-amber-300" : ""}`}>
                              <Paperclip className="w-3 h-3 mr-1" />
                              {task.evidence_uploaded ? "Nachweis vorhanden" : "Nachweis erforderlich"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> {task.category}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" /> {task.owner_role_snapshot}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {format(parseISO(task.due_date), "dd. MMM", { locale: de })}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openTaskModal(task)} data-testid={`task-comments-${task.id}`}>
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">E-Mail</p>
                <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" /> {caseData.employee_email}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Startdatum</p>
                <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-slate-400" /> {format(parseISO(caseData.start_date), "dd. MMMM yyyy", { locale: de })}
                </p>
              </div>
              {caseData.location && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Standort</p>
                  <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400" /> {caseData.location}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Manager</p>
                <p className="text-sm font-medium text-slate-900">{caseData.manager_email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</p>
                <Badge className={caseData.status === "completed" ? "bg-emerald-100 text-emerald-700" : ""}>
                  {caseData.status === "completed" ? "Abgeschlossen" : "Aktiv"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Task Detail Modal */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedTask?.status === "done" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <Circle className="w-5 h-5 text-slate-400" />
              )}
              {selectedTask?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedTask?.category} • {selectedTask?.owner_role_snapshot}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-6">
              {selectedTask.description && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Beschreibung</p>
                  <p className="text-sm text-slate-600">{selectedTask.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Fällig am</p>
                  <p className="font-medium">{format(parseISO(selectedTask.due_date), "dd. MMMM yyyy", { locale: de })}</p>
                </div>
                <div>
                  <p className="text-slate-500">Verantwortlich</p>
                  <p className="font-medium">{selectedTask.owner_email || selectedTask.owner_role_snapshot}</p>
                </div>
              </div>

              {/* Evidence Upload Section */}
              {selectedTask.evidence_required && (
                <div className="border rounded-lg p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Nachweise ({evidence.length})
                      {selectedTask.evidence_required && <Badge variant="outline" className="text-xs">Erforderlich</Badge>}
                    </p>
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={uploadEvidence}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                        data-testid="evidence-file-input"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        data-testid="upload-evidence-btn"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? "Lädt..." : "Hochladen"}
                      </Button>
                    </div>
                  </div>
                  
                  {evidence.length > 0 ? (
                    <div className="space-y-2">
                      {evidence.map(ev => (
                        <div key={ev.id} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div className="flex items-center gap-3">
                            {ev.file_type.startsWith("image/") ? (
                              <Image className="w-5 h-5 text-blue-500" />
                            ) : (
                              <File className="w-5 h-5 text-slate-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-slate-900">{ev.filename}</p>
                              <p className="text-xs text-slate-500">
                                {(ev.file_size / 1024).toFixed(1)} KB • {ev.uploaded_by_name} • {format(parseISO(ev.uploaded_at), "dd.MM.yy HH:mm")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => downloadEvidence(ev)} data-testid={`download-evidence-${ev.id}`}>
                              <Download className="w-4 h-4" />
                            </Button>
                            {(ev.uploaded_by === user?.email || canManageContent) && (
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => deleteEvidence(ev)} data-testid={`delete-evidence-${ev.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-4">Noch keine Nachweise hochgeladen</p>
                  )}
                </div>
              )}

              {/* Comments */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">Kommentare ({comments.length})</p>
                <div className="space-y-3 max-h-40 overflow-y-auto">
                  {comments.map(c => (
                    <div key={c.id} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-900">{c.user_name}</span>
                        <span className="text-xs text-slate-400">{format(parseISO(c.created_at), "dd.MM.yy HH:mm")}</span>
                      </div>
                      <p className="text-sm text-slate-600">{c.body}</p>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">Noch keine Kommentare</p>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <Textarea
                    placeholder="Kommentar schreiben..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[60px]"
                    data-testid="comment-input"
                  />
                  <Button onClick={addComment} className="btn-primary" data-testid="send-comment">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isOffboarding ? "Austrittsdatum" : "Startdatum"} verschieben</DialogTitle>
            <DialogDescription>
              Alle offenen Tasks werden neu terminiert.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="date-picker-trigger">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newStartDate ? format(newStartDate, "dd. MMMM yyyy", { locale: de }) : "Datum wählen"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newStartDate}
                  onSelect={setNewStartDate}
                  locale={de}
                />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReschedule(false)}>Abbrechen</Button>
            <Button onClick={reschedule} className="btn-primary" data-testid="confirm-reschedule">Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
