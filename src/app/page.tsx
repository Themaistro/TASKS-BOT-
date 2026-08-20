'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, LayoutList, Calendar as CalendarIcon, Trash2, Send, Clock, UserPlus, Check, Copy, GripVertical, AlertCircle, Info, Loader2, ChevronDown, EyeOff, Settings, Eye, X as XIcon } from 'lucide-react';
import { DndContext, closestCenter, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableCategory, DroppableCategoryCard, DraggableAssignment, DraggableEmployee, AssignmentCardUI } from './dnd-components';

export type BreakSchedule = { id: string; employeeId: string; dayOfWeek: number; startTime: string; endTime: string };
export type Employee = { id: string; name: string; slackId: string; onLeaveDays: string; breakSchedules?: BreakSchedule[] };
export type Category = { id: string; name: string; order: number; excludedDays?: string; icon?: string };
export type Assignment = { id: string; categoryId: string; employeeId: string; dayOfWeek: number; note: string | null; employee: Employee; category?: Category };

const DAYS = [
  { val: 1, label: 'Monday' }, { val: 2, label: 'Tuesday' }, { val: 3, label: 'Wednesday' },
  { val: 4, label: 'Thursday' }, { val: 5, label: 'Friday' }, { val: 6, label: 'Saturday' }, { val: 0, label: 'Sunday' }
];

const getInitials = (name: string) => (name || '').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
const getAvatarColor = (name: string) => {
  const gradients = [
    'bg-gradient-to-br from-blue-400 to-indigo-600',
    'bg-gradient-to-br from-emerald-400 to-teal-600',
    'bg-gradient-to-br from-rose-400 to-red-600',
    'bg-gradient-to-br from-amber-400 to-orange-600',
    'bg-gradient-to-br from-fuchsia-400 to-purple-600',
    'bg-gradient-to-br from-cyan-400 to-blue-600'
  ];
  const index = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[index % gradients.length];
};

export default function Dashboard() {
  const [activeDay, setActiveDay] = useState(new Date().getDay() === 0 ? 0 : new Date().getDay());
  const [postTime, setPostTime] = useState('08:00');
  const [isAutoActive, setIsAutoActive] = useState(true);
  const [timezone, setTimezone] = useState('Asia/Dubai');
  const [slackChannel, setSlackChannel] = useState('');
  const [slackMessageHeader, setSlackMessageHeader] = useState("🚀 *Today's Task Assignments*");
  const [workingDays, setWorkingDays] = useState("1,2,3,4,5");
  const [timeUntilNext, setTimeUntilNext] = useState('');
  const [isAutomationExpanded, setIsAutomationExpanded] = useState(false);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('📌');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  
  const [activeCatForAssign, setActiveCatForAssign] = useState<string | null>(null);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [note, setNote] = useState('');

  const [newEmpSlack, setNewEmpSlack] = useState('');
  
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editNoteVal, setEditNoteVal] = useState('');

  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editingEmpName, setEditingEmpName] = useState('');
  const [editingEmpSlack, setEditingEmpSlack] = useState('');

  // Break schedule state
  const [breakSchedules, setBreakSchedules] = useState<any[]>([]);
  const [breakPicker, setBreakPicker] = useState<{ empId: string; day: number } | null>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [bpStartHour, setBpStartHour] = useState('1');
  const [bpStartMin, setBpStartMin] = useState('00');
  const [bpStartAmPm, setBpStartAmPm] = useState<'AM'|'PM'>('PM');
  const [bpEndHour, setBpEndHour] = useState('2');
  const [bpEndMin, setBpEndMin] = useState('00');
  const [bpEndAmPm, setBpEndAmPm] = useState<'AM'|'PM'>('PM');

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);
  
  const [saveStatus, setSaveStatus] = useState('');
  const [toast, setToast] = useState({ message: '', show: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Slack settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [slackCfg, setSlackCfg] = useState({ SLACK_BOT_TOKEN: '', SLACK_APP_TOKEN: '', SLACK_CHANNEL_ID: '' });
  const [showBotToken, setShowBotToken] = useState(false);
  const [showAppToken, setShowAppToken] = useState(false);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgMsg, setCfgMsg] = useState<{ text: string; type: 'success' | 'warn' | 'error' } | null>(null);
  const [dbConfig, setDbConfig] = useState<any>({});

  const showToast = (message: string) => {
    setToast({ message, show: true });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const openSettings = async () => {
    setCfgMsg(null);
    setShowBotToken(false);
    setShowAppToken(false);
    try {
      const res = await fetch('/api/slack-config');
      const data = await res.json();
      setSlackCfg({
        SLACK_BOT_TOKEN: data.SLACK_BOT_TOKEN || '',
        SLACK_APP_TOKEN: data.SLACK_APP_TOKEN || '',
        SLACK_CHANNEL_ID: data.SLACK_CHANNEL_ID || '',
      });
    } catch {
      setSlackCfg({ SLACK_BOT_TOKEN: '', SLACK_APP_TOKEN: '', SLACK_CHANNEL_ID: '' });
    }
    setShowSettings(true);
  };

  const saveSlackConfig = async () => {
    setCfgSaving(true);
    setCfgMsg(null);
    try {
      const res = await fetch('/api/slack-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackCfg),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setCfgMsg(data.needsRestart
        ? { text: '✅ Saved! Restart the server for token changes to take effect.', type: 'warn' }
        : { text: '✅ Channel ID saved successfully.', type: 'success' }
      );
    } catch (e: any) {
      setCfgMsg({ text: `❌ ${e.message}`, type: 'error' });
    } finally {
      setCfgSaving(false);
    }
  };

  // DnD state
  const [activeDragCat, setActiveDragCat] = useState<Category | null>(null);
  const [activeDragAssign, setActiveDragAssign] = useState<Assignment | null>(null);
  const [activeDragEmp, setActiveDragEmp] = useState<Employee | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    const calc = () => {
      try {
        const now = new Date();
        const [targetH, targetM] = postTime.split(':').map(Number);
        const target = new Date();
        target.setHours(targetH, targetM, 0, 0);
        if (target < now) target.setDate(target.getDate() + 1);
        
        const diff = target.getTime() - now.getTime();
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeUntilNext(`${h}h ${m}m ${s}s`);
      } catch (e) {}
    };
    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [postTime]);

  const fetchData = async () => {
    setIsSyncing(true);
    const [catRes, empRes, assignRes, confRes, breakRes] = await Promise.all([
      fetch('/api/categories'), fetch('/api/employees'), fetch('/api/assignments'), 
      fetch('/api/config'), fetch('/api/break-schedule')
    ]);
    setCategories(await catRes.json());
    setEmployees(await empRes.json());
    setAssignments(await assignRes.json());
    setBreakSchedules(await breakRes.json());
    const conf = await confRes.json();
    if(conf) {
      setDbConfig(conf);
      if(conf.postTime) setPostTime(conf.postTime);
      if(conf.isAutomationActive !== undefined) setIsAutoActive(conf.isAutomationActive);
      if(conf.timezone) setTimezone(conf.timezone);
      if(conf.slackChannel) setSlackChannel(conf.slackChannel);
      if(conf.slackMessageHeader) setSlackMessageHeader(conf.slackMessageHeader);
      if(conf.workingDays) setWorkingDays(conf.workingDays);
    }
    setIsLoading(false);
    setIsSyncing(false);
  };

  useEffect(() => { fetchData(); }, []);

  const saveConfig = async (overrides: any = {}, successMsg?: string) => {
    setSaveStatus('Saving...');
    const payload = { postTime, isAutomationActive: isAutoActive, timezone, slackChannel, slackMessageHeader, workingDays, ...overrides };
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setDbConfig((prev: any) => ({ ...prev, ...payload }));
    setSaveStatus('Saved!');
    
    // Show toast
    setToast({ show: true, message: successMsg || 'Settings saved successfully' });
    setTimeout(() => setToast(t => ({...t, show: false})), 3000);
    setTimeout(() => setSaveStatus(''), 2000);
  };

  const [dialog, setDialog] = useState<{ isOpen: boolean, type: 'alert' | 'confirm', title: string, message: string, onConfirm?: () => void }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const showAlert = (title: string, message: string) => setDialog({ isOpen: true, type: 'alert', title, message });
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setDialog({ isOpen: true, type: 'confirm', title, message, onConfirm });
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const addEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName || !newEmpSlack) return;
    const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newEmpName, slackId: newEmpSlack }) });
    setEmployees([...employees, await res.json()]);
    setNewEmpName('');
    setNewEmpSlack('');
    fetchData();
  };
  
  const deleteEmployee = (id: string) => {
    showConfirm('Remove Team Member', 'Are you sure you want to remove this team member? This will delete all their current assignments.', async () => {
      await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      fetchData();
    });
  };

  const saveEditedEmployee = async (id: string) => {
    if (!editingEmpName.trim()) return setEditingEmpId(null);
    await fetch(`/api/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingEmpName, slackId: editingEmpSlack })
    });
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, name: editingEmpName, slackId: editingEmpSlack } : e));
    setEditingEmpId(null);
  };

  // Convert 24h "HH:MM" to human-readable "1:30 PM"
  const formatBreakTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  // Convert hour/min/ampm to "HH:MM" 24h
  const to24h = (hour: string, min: string, ampm: 'AM'|'PM') => {
    let h = parseInt(hour);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2,'0')}:${min}`;
  };

  const openBreakPicker = (empId: string, day: number, buttonEl: HTMLElement) => {
    const rect = buttonEl.getBoundingClientRect();
    // Position picker above the button, aligned to left edge, but clamp to viewport
    const pickerWidth = 288; // w-72
    const pickerHeight = 280;
    let left = rect.left;
    let top = rect.top - pickerHeight - 8;
    // Clamp right edge
    if (left + pickerWidth > window.innerWidth - 8) left = window.innerWidth - pickerWidth - 8;
    // If would go above viewport, flip below
    if (top < 8) top = rect.bottom + 8;
    setPickerPos({ top, left });

    const existing = breakSchedules.find(b => b.employeeId === empId && b.dayOfWeek === day);
    if (existing) {
      const [sh, sm] = existing.startTime.split(':').map(Number);
      const [eh, em] = existing.endTime.split(':').map(Number);
      setBpStartHour((sh % 12 || 12).toString());
      setBpStartMin(sm.toString().padStart(2,'0'));
      setBpStartAmPm(sh >= 12 ? 'PM' : 'AM');
      setBpEndHour((eh % 12 || 12).toString());
      setBpEndMin(em.toString().padStart(2,'0'));
      setBpEndAmPm(eh >= 12 ? 'PM' : 'AM');
    } else {
      setBpStartHour('1'); setBpStartMin('00'); setBpStartAmPm('PM');
      setBpEndHour('2'); setBpEndMin('00'); setBpEndAmPm('PM');
    }
    setBreakPicker({ empId, day });
  };

  const saveBreakSchedule = async () => {
    if (!breakPicker) return;
    const startTime = to24h(bpStartHour, bpStartMin, bpStartAmPm);
    const endTime = to24h(bpEndHour, bpEndMin, bpEndAmPm);
    const res = await fetch('/api/break-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: breakPicker.empId, dayOfWeek: breakPicker.day, startTime, endTime }),
    });
    const saved = await res.json();
    setBreakSchedules(prev => {
      const filtered = prev.filter(b => !(b.employeeId === breakPicker.empId && b.dayOfWeek === breakPicker.day));
      return [...filtered, saved];
    });
    setBreakPicker(null);
  };

  const removeBreakSchedule = async (empId: string, day: number) => {
    const existing = breakSchedules.find(b => b.employeeId === empId && b.dayOfWeek === day);
    if (!existing) return setBreakPicker(null);
    await fetch(`/api/break-schedule/${existing.id}`, { method: 'DELETE' });
    setBreakSchedules(prev => prev.filter(b => b.id !== existing.id));
    setBreakPicker(null);
  };

  const [editingCatIconId, setEditingCatIconId] = useState<string | null>(null);

  const saveEditedCategoryIcon = async (id: string, icon: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, icon } : c));
    setEditingCatIconId(null);
    try {
      await fetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icon })
      });
    } catch(err) { console.error(err); }
  };

  const saveEditedCategory = async (id: string) => {
    if (!editingCatName.trim()) return setEditingCatId(null);
    await fetch(`/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingCatName })
    });
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: editingCatName } : c));
    setEditingCatId(null);
  };

  const toggleLeave = async (emp: Employee, dayNum: number) => {
    let leaves = JSON.parse(emp.onLeaveDays || '[]');
    if (leaves.includes(dayNum)) leaves = leaves.filter((d: number) => d !== dayNum);
    else leaves.push(dayNum);
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, onLeaveDays: JSON.stringify(leaves) } : e));
    await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onLeaveDays: JSON.stringify(leaves) })
    });
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const res = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCatName.trim(), icon: newCatIcon }) });
    setCategories([...categories, await res.json()]);
    setNewCatName('');
    setNewCatIcon('📌');
  };

  const deleteCategory = (id: string) => {
    showConfirm('Delete Category', 'Are you sure you want to delete this category?', async () => {
      await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      setCategories(categories.filter(c => c.id !== id));
    });
  };

  const toggleCategoryDayVisibility = async (cat: Category, day: number) => {
    let ex = (cat.excludedDays || '').split(',').filter(Boolean);
    if (ex.includes(day.toString())) {
      ex = ex.filter(d => d !== day.toString());
    } else {
      ex.push(day.toString());
    }
    const newEx = ex.join(',');
    
    // Optimistic update
    setCategories(categories.map(c => c.id === cat.id ? { ...c, excludedDays: newEx } : c));
    
    await fetch('/api/categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cat.id, excludedDays: newEx })
    });
  };

  const addAssignment = async (categoryId: string) => {
    if (!selectedEmp) return;
    await fetch('/api/assignments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayOfWeek: activeDay, categoryId, employeeId: selectedEmp, note })
    });
    setSelectedEmp(''); setNote(''); 
    fetchData();
  };

  const removeAssignment = async (id: string) => {
    await fetch(`/api/assignments/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const copyYesterday = () => {
    const yesterday = activeDay === 0 ? 6 : activeDay - 1;
    showConfirm('Copy Previous Roster', `Copy all assignments from ${DAYS.find(d => d.val === yesterday)?.label} to ${DAYS.find(d => d.val === activeDay)?.label}? This will overwrite today's roster.`, async () => {
      setToast({ show: true, message: 'Copying schedule...' });
      await fetch('/api/assignments/copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDay: yesterday, toDay: activeDay })
      });
      fetchData();
      setToast({ show: true, message: 'Schedule copied successfully' });
    });
  };

  const saveEditedNote = async (id: string) => {
    await fetch(`/api/assignments/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: editNoteVal })
    });
    setEditNoteId(null);
    fetchData();
  };

  const testBot = async () => {
    setToast({ show: true, message: 'Pushing to Slack...' });
    const res = await fetch(`/api/test-bot?day=${activeDay}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) showAlert('Success', `Successfully posted ${DAYS.find(d => d.val === activeDay)?.label}'s Roster to Slack!`);
    else showAlert('Error', 'Failed to push to Slack: ' + data.error);
  };

  const isOnLeave = (emp: Employee, day: number) => {
    try { return JSON.parse(emp.onLeaveDays || '[]').includes(day); } catch { return false; }
  };

  // DnD Handlers
  const handleGlobalDragStart = (e: any) => {
    if (String(e.active.id).startsWith('cat-sort-')) setActiveDragCat(e.active.data.current as Category);
    else if (String(e.active.id).startsWith('assign-')) setActiveDragAssign(e.active.data.current as Assignment);
    else if (String(e.active.id).startsWith('emp-')) setActiveDragEmp(e.active.data.current as Employee);
  };

  const handleGlobalDragEnd = async (e: any) => {
    const { active, over } = e;
    setActiveDragCat(null);
    setActiveDragAssign(null);
    setActiveDragEmp(null);
    if (!over) return;

    if (String(active.id).startsWith('cat-sort-')) {
      if (active.id === over.id) return;
      const oldIndex = categories.findIndex(c => `cat-sort-${c.id}` === active.id);
      const newIndex = categories.findIndex(c => `cat-sort-${c.id}` === over.id);
      const newCategories = arrayMove(categories, oldIndex, newIndex);
      
      setCategories(newCategories);
      await fetch('/api/categories/reorder', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: newCategories.map(c => c.id) })
      });
      return;
    }
    
    if (String(active.id).startsWith('emp-')) {
      const employeeId = String(active.id).replace('emp-', '');
      const targetCategoryId = String(over.id).replace('drop-', '');
      
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: targetCategoryId,
          employeeId: employeeId,
          dayOfWeek: activeDay,
          note: ''
        })
      });
      const newAssignment = await res.json();
      setAssignments(prev => [...prev, newAssignment]);
      return;
    }

    const assignmentId = String(active.id).replace('assign-', '');
    const targetCategoryId = String(over.id).replace('drop-', '');
    
    setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, categoryId: targetCategoryId } : a));
    
    await fetch(`/api/assignments/${assignmentId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: targetCategoryId })
    });
  };

  const isTimeDirty = dbConfig?.postTime !== postTime;
  const isTimezoneDirty = dbConfig?.timezone !== timezone;
  const isChannelDirty = dbConfig?.slackChannel !== slackChannel;
  const isHeaderDirty = dbConfig?.slackMessageHeader !== slackMessageHeader;
  const isWorkingDaysDirty = dbConfig?.workingDays !== workingDays;

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTeamExpanded, setIsTeamExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="flex flex-col items-center gap-6 relative z-10">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin shadow-lg"></div>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Initializing Command Center</h2>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleGlobalDragStart} onDragEnd={handleGlobalDragEnd}>
      <div className="flex flex-col lg:flex-row gap-6 h-full w-full p-4 md:p-6 lg:p-8 relative">
      {/* Sidebar Toggle Button */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute top-6 left-6 z-50 p-2 bg-white rounded-full shadow-md border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-indigo-600 transition-all hidden lg:block"
      >
        <LayoutList className="w-5 h-5" />
      </button>

      {/* LEFT SIDEBAR */}
      <div className={`space-y-6 shrink-0 flex flex-col h-full overflow-y-auto custom-scrollbar pr-2 pb-6 transition-all duration-500 ease-in-out ${isSidebarOpen ? 'w-full lg:w-80 lg:pl-10 opacity-100' : 'w-0 opacity-0 overflow-hidden hidden lg:block'}`}>
        
        <div className="shrink-0 flex flex-col gap-3">
          {/* Main Automation Toggle Box */}
          <div className="bg-[#3F0E40] rounded-2xl shadow-lg border border-[#5c1a63] p-4 relative overflow-hidden flex flex-col gap-2">
            <div className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${isAutoActive ? 'bg-emerald-500/10 opacity-100' : 'bg-slate-800/20 opacity-0'}`}></div>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"></div>
            
            <div className="flex items-center justify-between w-full relative z-10 cursor-pointer group" onClick={() => { const val = !isAutoActive; setIsAutoActive(val); saveConfig({ isAutomationActive: val }); }}>
              <div className="flex items-center gap-2 font-bold text-white">
                <div className={`p-2 rounded-lg transition-colors ${isAutoActive ? 'bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/30' : 'bg-[#5c1a63] text-purple-200 group-hover:text-white'}`}><Clock className="w-4 h-4" /></div>
                <h3 className="text-sm">Automation</h3>
              </div>
              <div className={`w-12 h-6 rounded-full relative transition-colors shadow-inner ${isAutoActive ? 'bg-emerald-500 group-hover:bg-emerald-400' : 'bg-[#5c1a63] group-hover:bg-[#611f69]'}`}>
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-md ${isAutoActive ? 'left-[26px]' : 'left-1'}`}></div>
              </div>
            </div>
            
            <div className="w-full relative z-10 flex justify-between items-end mt-1 mb-2">
              <div className="flex flex-col">
                <span className={`text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 ${isAutoActive ? 'text-emerald-400' : 'text-purple-200'}`}>
                  {isAutoActive ? <><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div> Running</> : <><div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div> Paused</>}
                </span>
              </div>
              {isAutoActive && (
                <div className="flex flex-col items-end">
                  <span className="text-[9px] text-purple-300">Next automated post in</span>
                  <span className="text-xs font-mono font-bold text-emerald-300">{timeUntilNext || '...'}</span>
                </div>
              )}
            </div>

            <div className="w-full relative z-10 border-t border-[#5c1a63]/50 pt-3 mt-1 flex justify-center">
              <button onClick={() => setIsAutomationExpanded(!isAutomationExpanded)} className="text-[10px] uppercase tracking-widest font-bold text-purple-200 hover:text-white flex items-center gap-1 transition-colors">
                 <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAutomationExpanded ? 'rotate-180' : ''}`} />
                 {isAutomationExpanded ? 'Hide Settings' : 'Advanced Settings'}
              </button>
            </div>
          </div>
          
          <div className={`flex flex-col gap-3 overflow-hidden transition-all duration-300 ${isAutomationExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>

          {/* Grid Settings */}
          <div className="flex flex-col gap-3 mt-2">

            {/* Time */}
            {(() => {
              const currentH24 = parseInt(postTime.split(':')[0] || '8');
              const currentM = postTime.split(':')[1] || '00';
              const isPM = currentH24 >= 12;
              const currentH12 = currentH24 === 0 ? 12 : (currentH24 > 12 ? currentH24 - 12 : currentH24);
              const ampm = isPM ? 'PM' : 'AM';

              const updateTime = (h12: string, m: string, ap: string) => {
                let h24 = parseInt(h12);
                if (ap === 'PM' && h24 !== 12) h24 += 12;
                if (ap === 'AM' && h24 === 12) h24 = 0;
                const str = `${h24.toString().padStart(2, '0')}:${m}`;
                setPostTime(str);
              };

              return (
                <div className="bg-[#4A154B] border border-[#5c1a63] rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden shadow-sm">
                  <span className="text-xs uppercase font-black tracking-widest text-purple-100">Time</span>
                  <div className="flex items-center gap-2">
                    <select value={currentH12.toString()} onChange={e => updateTime(e.target.value, currentM, ampm)} className="appearance-none bg-[#3F0E40] text-white px-3 py-2 text-sm font-bold outline-none font-mono text-center cursor-pointer hover:bg-slate-600 rounded-lg transition-colors shadow-inner border border-slate-600/50">
                      {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                    </select>
                    <span className="text-purple-300 font-extrabold text-xl">:</span>
                    <select value={currentM} onChange={e => updateTime(currentH12.toString(), e.target.value, ampm)} className="appearance-none bg-[#3F0E40] text-white px-3 py-2 text-sm font-bold outline-none font-mono text-center cursor-pointer hover:bg-slate-600 rounded-lg transition-colors shadow-inner border border-slate-600/50">
                      {['00','15','30','45'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <div className="flex bg-[#3F0E40] rounded-lg p-1 ml-auto shadow-inner border border-slate-600/50">
                      <button onClick={() => updateTime(currentH12.toString(), currentM, 'AM')} className={`text-[10px] font-extrabold px-3 py-1.5 rounded-md transition-colors ${ampm === 'AM' ? 'bg-emerald-500 text-white shadow' : 'text-purple-200 hover:text-white'}`}>AM</button>
                      <button onClick={() => updateTime(currentH12.toString(), currentM, 'PM')} className={`text-[10px] font-extrabold px-3 py-1.5 rounded-md transition-colors ${ampm === 'PM' ? 'bg-emerald-500 text-white shadow' : 'text-purple-200 hover:text-white'}`}>PM</button>
                    </div>
                  </div>
                  <div className={`absolute bottom-0 left-0 w-full h-1 transition-colors ${isTimeDirty ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-transparent'}`}></div>
                  {isTimeDirty && (
                    <button onClick={() => saveConfig({postTime}, `Time updated`)} className="mt-1 w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500 hover:text-white text-[10px] font-bold py-1.5 rounded transition-colors uppercase tracking-wider animate-in fade-in zoom-in-95 duration-200">
                      Save Time
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Timezone */}
            <div className="bg-[#4A154B] border border-[#5c1a63] rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden shadow-sm">
              <span className="text-xs uppercase font-black tracking-widest text-purple-100">Timezone</span>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className="bg-[#3F0E40] text-white text-sm font-bold font-mono p-3 rounded-lg outline-none w-full shadow-inner hover:bg-slate-600 transition-colors cursor-pointer border border-slate-600/50">
                <option value="Asia/Dubai">Asia/Dubai</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New_York</option>
              </select>
              <div className={`absolute bottom-0 left-0 w-full h-1 transition-colors ${isTimezoneDirty ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-transparent'}`}></div>
              {isTimezoneDirty && (
                <button onClick={() => saveConfig({timezone}, 'Timezone updated')} className="mt-1 w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500 hover:text-white text-[10px] font-bold py-1.5 rounded transition-colors uppercase tracking-wider animate-in fade-in zoom-in-95 duration-200">
                  Save Timezone
                </button>
              )}
            </div>

            {/* Target Channel */}
            <div className="bg-[#4A154B] border border-[#5c1a63] rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden shadow-sm">
              <span className="text-xs uppercase font-black tracking-widest text-purple-100">Target Slack Channel</span>
              <div className="flex items-center gap-2 bg-[#3F0E40]/50 p-2.5 rounded-lg border border-slate-600/50 shadow-inner focus-within:border-indigo-500/50 focus-within:bg-slate-700 transition-all">
                <span className="text-purple-300 font-extrabold text-lg pl-1">#</span>
                <input type="text" value={slackChannel} onChange={e => setSlackChannel(e.target.value)} className="bg-transparent text-white text-base font-bold outline-none w-full font-mono placeholder-slate-500" placeholder="channel-id" />
              </div>
              <div className={`absolute bottom-0 left-0 w-full h-1 transition-colors ${isChannelDirty ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-transparent'}`}></div>
              {isChannelDirty && (
                <button onClick={() => saveConfig({slackChannel}, 'Channel updated')} className="mt-1 w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500 hover:text-white text-[10px] font-bold py-1.5 rounded transition-colors uppercase tracking-wider animate-in fade-in zoom-in-95 duration-200">
                  Save Channel
                </button>
              )}
            </div>

            {/* Working Days */}
            <div className="bg-[#4A154B] border border-[#5c1a63] rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden shadow-sm">
              <span className="text-xs uppercase font-black tracking-widest text-purple-100">Active Work Days</span>
              <div className="flex gap-2 justify-between mt-1">
                {[0,1,2,3,4,5,6].map(d => {
                  const isActive = workingDays.split(',').includes(d.toString());
                  const dayLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'];
                  return (
                    <button key={d} onClick={() => {
                      let days = workingDays.split(',').filter(Boolean);
                      if(isActive) days = days.filter(x => x !== d.toString());
                      else days.push(d.toString());
                      days.sort();
                      const str = days.join(',');
                      setWorkingDays(str);
                      if (!days.includes(activeDay.toString()) && days.length > 0) setActiveDay(Number(days[0]));
                    }} className={`w-10 h-10 rounded-full text-sm font-black transition-transform hover:scale-110 ${isActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-800' : 'bg-[#3F0E40] text-purple-300 hover:bg-slate-600 hover:text-white'}`}>
                      {dayLabels[d]}
                    </button>
                  );
                })}
              </div>
              <div className={`absolute bottom-0 left-0 w-full h-1 transition-colors ${isWorkingDaysDirty ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-transparent'}`}></div>
              {isWorkingDaysDirty && (
                <button onClick={() => saveConfig({workingDays}, 'Days updated')} className="mt-1 w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500 hover:text-white text-[10px] font-bold py-1.5 rounded transition-colors uppercase tracking-wider animate-in fade-in zoom-in-95 duration-200">
                  Save Days
                </button>
              )}
            </div>

            {/* Message Header */}
            <div className="bg-[#4A154B] border border-[#5c1a63] rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden shadow-sm">
              <span className="text-xs uppercase font-black tracking-widest text-purple-100">Message Header</span>
              <textarea value={slackMessageHeader} onChange={e => setSlackMessageHeader(e.target.value)} className="bg-[#3F0E40]/50 text-white text-sm font-medium p-4 rounded-lg outline-none w-full font-mono h-24 resize-none placeholder-slate-500 focus:bg-slate-700 border border-slate-600/50 focus:border-indigo-500/50 transition-all shadow-inner leading-relaxed" placeholder="Slack mrkdwn allowed" />
              <div className={`absolute bottom-0 left-0 w-full h-1 transition-colors ${isHeaderDirty ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-transparent'}`}></div>
              {isHeaderDirty && (
                <button onClick={() => saveConfig({slackMessageHeader}, 'Header updated')} className="mt-1 w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500 hover:text-white text-[10px] font-bold py-1.5 rounded transition-colors uppercase tracking-wider animate-in fade-in zoom-in-95 duration-200">
                  Save Header
                </button>
              )}
            </div>
          </div>

          <button onClick={testBot} className="w-full flex items-center justify-center gap-2 bg-[#007A5A] text-white text-sm font-bold py-4 rounded-xl shadow-lg hover:bg-[#148567] transition-all transform hover:-translate-y-0.5 active:translate-y-0 border border-[#006248] hover:shadow-xl mt-3">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522-2.52h-6.313z"/>
            </svg>
            Push to Slack Now
          </button>
          </div>
        </div>

        {/* Task Categories (Sortable Context) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 font-bold text-slate-800 mb-4">
            <div className="p-2 bg-purple-50 rounded-lg"><LayoutList className="w-4 h-4 text-purple-600" /></div>
            <h3 className="text-sm">Task Categories</h3>
          </div>
          <form onSubmit={addCategory} className="flex gap-2 mb-4 relative z-50">
            <div className="relative">
              <button 
                type="button" 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                className="w-10 h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg text-lg hover:bg-slate-100 transition shadow-sm"
              >
                {newCatIcon}
              </button>
              {showEmojiPicker && (
                <>
                  <div className="fixed inset-0 z-[100] bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setShowEmojiPicker(false)}></div>
                  <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-white border border-slate-200 shadow-[0_20px_60px_rgba(0,0,0,0.1)] rounded-2xl p-4 w-[320px] max-h-[400px] overflow-y-auto custom-scrollbar flex flex-wrap gap-2 transform animate-in zoom-in-95 duration-200">
                    <div className="w-full text-center text-xs font-bold text-slate-400 mb-2 tracking-widest uppercase border-b border-slate-100 pb-2">Select an Icon</div>
                    {['📌','📞','💬','📧','📝','⚡','💻','🤝','📅','📊','🎯','🛠','✅','❌','⚠️','🔥','💡','📱','🎧','🎥','📷','📦','🚚','💰','💳','🛒','🍔','☕','🏥','💊','🧪','🧬','🔧','🔨','⚙️','🛡️','🔑','🔒','🎉','🏆','🥇','🚀','🛸','🌍','🏠','🏢','🚗','✈️','🚢','🎨','🎵','🎮','🎲','🧩'].map(icon => (
                      <button 
                        key={icon} 
                        type="button" 
                        onClick={() => { setNewCatIcon(icon); setShowEmojiPicker(false); }} 
                        className="w-10 h-10 flex items-center justify-center hover:bg-indigo-50 hover:scale-110 rounded-xl text-2xl transition-all"
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <input type="text" placeholder="e.g. Calls, Chats" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 flex-1 min-w-0 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm" />
            <button type="submit" className="bg-purple-100 text-purple-700 p-2 px-3 rounded-lg hover:bg-purple-200 transition shrink-0"><Plus className="w-4 h-4" /></button>
          </form>
          
          <SortableContext items={categories.map(c => `cat-sort-${c.id}`)} strategy={verticalListSortingStrategy}>
            {categories.map(cat => (
              <SortableCategory key={cat.id} cat={cat} deleteCategory={deleteCategory} toggleVisibility={() => toggleCategoryDayVisibility(cat, activeDay)} isHidden={(cat.excludedDays || '').split(',').includes(activeDay.toString())} icon={cat.icon || '📌'} />
            ))}
          </SortableContext>
        </div>

        {/* Team Members */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col transition-all duration-300">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <div className="p-2 bg-orange-50 rounded-lg"><Users className="w-4 h-4 text-orange-600" /></div>
              <h3 className="text-sm flex items-center">Team Members <span className="ml-2 text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{employees.length}</span></h3>
            </div>
            <button onClick={() => setIsTeamExpanded(!isTeamExpanded)} className="text-slate-400 hover:bg-slate-100 p-1 rounded transition-colors">
              <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isTeamExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          <div className={`flex flex-col gap-4 overflow-hidden transition-all duration-300 ease-in-out ${isTeamExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <form onSubmit={addEmployee} className="flex flex-col gap-2 shrink-0">
              <input type="text" placeholder="Name (e.g. Ritika)" value={newEmpName} onChange={e => setNewEmpName(e.target.value)} className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-xs outline-none" />
              <div className="flex gap-2">
                <input type="text" placeholder="Slack ID (U12345)" value={newEmpSlack} onChange={e => setNewEmpSlack(e.target.value)} className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 flex-1 min-w-0 text-xs outline-none" />
                <button type="submit" className="bg-orange-100 text-orange-700 p-2 px-3 rounded-lg hover:bg-orange-200 transition shrink-0"><UserPlus className="w-4 h-4" /></button>
              </div>
            </form>
            <div className="space-y-2 pr-1 custom-scrollbar">
              {employees.map(emp => {
                const taskCount = assignments.filter(a => a.employeeId === emp.id && a.dayOfWeek === activeDay).length;
                const isAbsent = isOnLeave(emp, activeDay);
                return (
                <DraggableEmployee key={emp.id} emp={emp}>
                  <div className="border border-slate-100 rounded-xl overflow-hidden hover:border-indigo-200 shadow-sm transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md bg-white group cursor-default">
                    <div className="flex justify-between items-center p-2.5 bg-white transition-colors group-hover:bg-slate-50/50 min-w-0">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex flex-col items-center justify-center text-slate-300 mr-[-4px] shrink-0">
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>
                        <div className={`w-8 h-8 rounded-full ${getAvatarColor(emp.name)} text-white flex items-center justify-center text-[11px] font-bold shadow-inner ring-2 ring-white shrink-0`}>
                          {getInitials(emp.name)}
                        </div>
                        <div className="flex-1 min-w-0 cursor-text" onDoubleClick={() => { setEditingEmpId(emp.id); setEditingEmpName(emp.name); setEditingEmpSlack(emp.slackId); }} onPointerDown={(e) => e.stopPropagation()}>
                          {editingEmpId === emp.id ? (
                            <div className="flex flex-col gap-1 w-full max-w-[120px]">
                              <input autoFocus className="text-xs font-bold text-slate-800 border-b border-indigo-300 outline-none bg-transparent py-0.5 min-w-0 w-full" value={editingEmpName} onChange={e => setEditingEmpName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditedEmployee(emp.id)} onBlur={() => saveEditedEmployee(emp.id)} />
                              <input className="text-[10px] text-slate-500 font-mono border-b border-indigo-200 outline-none bg-transparent py-0.5 min-w-0 w-full" value={editingEmpSlack} onChange={e => setEditingEmpSlack(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditedEmployee(emp.id)} onBlur={() => saveEditedEmployee(emp.id)} placeholder="Slack ID" />
                            </div>
                          ) : (
                            <>
                              <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5 flex-wrap">
                                <span className="break-all">{emp.name}</span>
                                {isAbsent ? (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded-md border border-red-100 font-bold uppercase tracking-wider shrink-0">Off</span>
                                ) : taskCount > 0 ? (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100 font-bold shrink-0">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
                                ) : null}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 break-all">{emp.slackId}</div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2" onPointerDown={(e) => e.stopPropagation()}>
                        <button onClick={() => setExpandedEmpId(expandedEmpId === emp.id ? null : emp.id)} className={`p-1.5 rounded-md transition ${expandedEmpId === emp.id ? 'bg-orange-100 text-orange-600' : 'text-slate-400 hover:bg-slate-50 hover:text-orange-500'}`}><CalendarIcon className="w-4 h-4" /></button>
                        <button onClick={() => deleteEmployee(emp.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all duration-200 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    {expandedEmpId === emp.id && (
                      <div className="bg-slate-50 border-t border-slate-100" onPointerDown={(e) => e.stopPropagation()}>
                        {/* Leave toggle row */}
                        <div className="p-3 border-b border-slate-100">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Days Off</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {DAYS.map(d => {
                              const isL = isOnLeave(emp, d.val);
                              return (
                                <button key={d.val} onClick={() => toggleLeave(emp, d.val)} className={`text-[10px] px-2 py-1.5 rounded-md font-bold transition transform active:scale-95 ${isL ? 'bg-red-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                                  {d.label.slice(0,3)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {/* Break schedule row */}
                        <div className="p-3">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">☕ Break Times</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {DAYS.map(d => {
                              const sched = breakSchedules.find(b => b.employeeId === emp.id && b.dayOfWeek === d.val);
                              const isOpen = breakPicker?.empId === emp.id && breakPicker?.day === d.val;
                              return (
                                <div key={d.val}>
                                  <button
                                    onClick={(e) => isOpen ? setBreakPicker(null) : openBreakPicker(emp.id, d.val, e.currentTarget)}
                                    className={`text-[10px] px-2 py-1.5 rounded-md font-bold transition transform active:scale-95 flex flex-col items-center leading-tight ${sched ? 'bg-orange-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600'}`}
                                  >
                                    <span>{d.label.slice(0,3)}</span>
                                    {sched && <span className="text-[8px] opacity-80">{formatBreakTime(sched.startTime)}</span>}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </DraggableEmployee>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT MAIN: Roster */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative z-10">
        
        {/* Sleek iOS Style Day Tabs */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0 flex justify-between items-center z-20 relative gap-6">
          <div className="bg-slate-100/70 p-1.5 rounded-xl inline-flex overflow-x-auto hide-scrollbar gap-1 shadow-inner border border-slate-200/50">
            {[0,1,2,3,4,5,6].filter(d => workingDays.split(',').includes(d.toString())).map(d => {
              const fullNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
              const isActive = activeDay === d;
              return (
                <button 
                  key={d} 
                  onClick={() => setActiveDay(d)} 
                  className={`shrink-0 px-5 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${isActive ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                  {fullNames[d]}
                </button>
              );
            })}
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-500 shrink-0 text-[10px] font-bold tracking-widest uppercase ${isSyncing ? 'border-amber-200 text-amber-600 bg-amber-50/50' : 'border-slate-100 text-slate-400 bg-slate-50'}`}>
             {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />}
             {isSyncing ? 'Saving' : 'Cloud Sync'}
          </div>
          <button
            onClick={openSettings}
            title="Slack Configuration"
            className="p-2 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border border-transparent hover:border-indigo-100"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar bg-slate-50 relative">
          {/* Subtle Dot Pattern */}
          <div className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-2">
              <div>
                <div className="flex items-center gap-2 text-indigo-600 mb-1"><CalendarIcon className="w-5 h-5" /><span className="font-bold text-sm tracking-widest uppercase">Roster</span></div>
                <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight pb-1">{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][activeDay]}'s Schedule</h2>
              </div>
              <button onClick={copyYesterday} className="flex items-center gap-2 text-xs bg-white border border-slate-200 shadow-sm px-4 py-2.5 rounded-xl hover:bg-slate-50 hover:shadow-md transition-all font-bold text-slate-700 transform hover:-translate-y-0.5">
                <Copy className="w-4 h-4 text-indigo-500" /> Copy {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][activeDay === 0 ? 6 : activeDay - 1]}
              </button>
            </div>

            {assignments.filter(a => a.dayOfWeek === activeDay).length === 0 && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100 shadow-sm flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                  <LayoutList className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 mb-2">This day is a blank canvas!</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">You have zero assignments scheduled for today. Drag and drop team members from the sidebar into the categories below, or click the button above to copy yesterday's roster.</p>
              </div>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              {categories.filter(cat => !(cat.excludedDays || '').split(',').includes(activeDay.toString())).map(cat => {
                  const catAssignments = assignments.filter(a => a.categoryId === cat.id && a.dayOfWeek === activeDay);
                  
                  return (
                    <DroppableCategoryCard key={cat.id} cat={cat}>
                      <div className="px-5 py-4 border-b border-slate-100 bg-white rounded-t-2xl flex justify-between items-center shadow-sm z-10 relative">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className="relative">
                            <button onClick={() => setEditingCatIconId(editingCatIconId === cat.id ? null : cat.id)} className="text-lg bg-slate-50 p-1.5 rounded-lg border border-slate-100 shadow-sm hover:bg-slate-100 transition">
                              {cat.icon || '📌'}
                            </button>
                            {editingCatIconId === cat.id && (
                              <>
                                <div className="fixed inset-0 z-[100] cursor-default" onClick={() => setEditingCatIconId(null)}></div>
                                <div className="absolute top-full left-0 mt-2 z-[101] bg-white border border-slate-200 shadow-2xl rounded-2xl p-3 w-[260px] max-h-[250px] overflow-y-auto custom-scrollbar flex flex-wrap gap-1.5 animate-in slide-in-from-top-2">
                                  <div className="w-full text-center text-[10px] font-bold text-slate-400 mb-1 tracking-widest uppercase border-b border-slate-100 pb-1">Select Emoji</div>
                                  {['📝','💻','📊','📞','✉️','🎨','🧠','🚀','🐛','🔥','✨','🎉','📅','📎','📸','🎥','🎯','📦','🚚','💰','🛒','🔑','🔒','🔧','⚙️','⚡','💡','🛑','✅','❌','⚠️','❓','💤','🍔','☕','🍎','🍕','🎵','🏆','🥇','🌍','🏠','🏢','🏥','✈️','🚗','🚲','📱','⌚','⏰','💸','💳'].map(icon => (
                                    <button key={icon} onClick={() => saveEditedCategoryIcon(cat.id, icon)} className="w-7 h-7 flex items-center justify-center hover:bg-indigo-50 hover:scale-110 rounded-lg text-base transition-all">{icon}</button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                          <h3 className="font-extrabold text-slate-800 text-sm flex-1 min-w-0" onDoubleClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }}>
                            {editingCatId === cat.id ? (
                              <input autoFocus className="text-sm font-extrabold text-slate-800 border-b border-indigo-300 outline-none bg-transparent w-full" value={editingCatName} onChange={e => setEditingCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditedCategory(cat.id)} onBlur={() => saveEditedCategory(cat.id)} />
                            ) : (
                              <div className="cursor-text break-all">{cat.name}</div>
                            )}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-[10px] font-bold bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 shadow-inner shrink-0">{catAssignments.length} assigned</span>
                          <button onClick={() => toggleCategoryDayVisibility(cat, activeDay)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove from this day"><EyeOff className="w-4 h-4" /></button>
                        </div>
                      </div>
                      
                      <div className="p-5 flex-1 flex flex-col">
                        <div className="space-y-3 mb-4 flex-1">
                          {catAssignments.length === 0 && (
                            <div className="border-2 border-dashed border-slate-200/80 rounded-xl flex flex-col items-center justify-center py-10 text-slate-400 bg-slate-50/50">
                              <Users className="w-8 h-8 mb-2 text-slate-300" />
                              <span className="text-xs font-semibold text-slate-400">Drag team members here</span>
                            </div>
                          )}
                          
                          {catAssignments.map(a => {
                            const absent = isOnLeave(a.employee, activeDay);
                            return (
                              <DraggableAssignment key={a.id} a={a} absent={absent} editNoteId={editNoteId} setEditNoteId={setEditNoteId} editNoteVal={editNoteVal} setEditNoteVal={setEditNoteVal} saveEditedNote={saveEditedNote} removeAssignment={removeAssignment} getAvatarColor={getAvatarColor} getInitials={getInitials} breakSchedules={breakSchedules} />
                            );
                          })}
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                          <div className={`grid transition-all duration-300 ease-in-out ${activeCatForAssign === cat.id ? 'grid-rows-[1fr] opacity-100 mb-2' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden">
                              <div className="flex flex-col sm:flex-row gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-inner mt-1">
                                <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white flex-1 outline-none font-medium text-slate-700">
                                  <option value="">Select teammate...</option>
                                  {employees.map(e => { const absent = isOnLeave(e, activeDay); return <option key={e.id} value={e.id} disabled={absent}>{absent ? `[OFF] ` : ''}{e.name}</option>; })}
                                </select>
                                <input type="text" placeholder="Note (Enter to save)" value={note} onChange={e => setNote(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') addAssignment(cat.id); }} className="border border-slate-200 rounded-lg px-3 py-2 text-xs flex-1 outline-none shadow-sm" />
                                <div className="flex gap-2 w-full sm:w-auto">
                                  <button onClick={() => addAssignment(cat.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm transition-colors">Add</button>
                                  <button onClick={() => setActiveCatForAssign(null)} className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 shadow-sm transition-colors">Done</button>
                                </div>
                              </div>
                            </div>
                          </div>
                          {activeCatForAssign !== cat.id && (
                            <button onClick={() => setActiveCatForAssign(cat.id)} className="w-full text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 py-2.5 rounded-xl transition-all"><Plus className="w-4 h-4" /> Assign Member</button>
                          )}

                      </div>
                    </div>
                  </DroppableCategoryCard>
                );
              })}
            </div>
            
            <DragOverlay dropAnimation={null}>
              {activeDragAssign ? (
                <AssignmentCardUI a={activeDragAssign} absent={isOnLeave(activeDragAssign.employee, activeDay)} editNoteId={null} setEditNoteId={()=>{}} editNoteVal={''} setEditNoteVal={()=>{}} saveEditedNote={()=>{}} removeAssignment={()=>{}} getAvatarColor={getAvatarColor} getInitials={getInitials} isOverlay={true} breakSchedules={breakSchedules} />
              ) : activeDragEmp ? (
                <div className="bg-white border-2 border-indigo-400 rounded-xl shadow-2xl p-3 flex items-center gap-3 opacity-90 scale-105 w-64 max-w-[90vw]">
                  <div className={`w-8 h-8 rounded-full ${getAvatarColor(activeDragEmp.name)} text-white flex items-center justify-center text-[11px] font-bold shadow-inner ring-2 ring-white shrink-0`}>
                    {getInitials(activeDragEmp.name)}
                  </div>
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5 flex-1 flex-wrap">
                    <span className="break-all">{activeDragEmp.name}</span>
                  </div>
                </div>
              ) : activeDragCat ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-indigo-200 shadow-xl ring-2 ring-indigo-500/50 scale-105">
                  <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm">{activeDragCat.icon || '📌'}</span>
                  <span className="font-semibold text-slate-700">{activeDragCat.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </div>
        </div>
      </div>
      
    <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
      {/* Global Dialog Modal */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeDialog}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden transform animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 text-indigo-600 bg-indigo-50">
                {dialog.type === 'alert' ? <AlertCircle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">{dialog.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{dialog.message}</p>
            </div>
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              {dialog.type === 'confirm' && (
                <button onClick={closeDialog} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
                  Cancel
                </button>
              )}
              <button 
                onClick={() => {
                  if (dialog.type === 'confirm' && dialog.onConfirm) dialog.onConfirm();
                  closeDialog();
                }} 
                className={`px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm transition-transform hover:scale-105 active:scale-95 ${dialog.type === 'confirm' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'}`}
              >
                {dialog.type === 'confirm' ? 'Confirm' : 'Okay'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ── Slack Configuration Modal ── */}
      {showSettings && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />

          <div className="relative w-full max-w-md" onClick={e => e.stopPropagation()}>
            {/* Card */}
            <div className="bg-white rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.25)] overflow-hidden border border-slate-200/80">

              {/* ── Hero Header ── */}
              <div className="relative px-7 pt-7 pb-6 bg-gradient-to-br from-[#4A154B] via-[#611f69] to-[#7c2d8e] overflow-hidden">
                {/* Decorative blobs */}
                <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/5 rounded-full" />
                <div className="absolute bottom-0 left-1/3 w-24 h-24 bg-white/5 rounded-full" />

                <div className="relative flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    {/* Slack-style hashtag icon */}
                    <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center shadow-inner border border-white/20">
                      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white tracking-tight">Slack Configuration</h2>
                      <p className="text-[12px] text-purple-200/80 mt-0.5">Connect to your workspace</p>
                    </div>
                  </div>
                  <button onClick={() => setShowSettings(false)} className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition">
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Status chips */}
                <div className="relative flex gap-2 mt-5">
                  {[
                    { label: 'Bot Token', set: slackCfg.SLACK_BOT_TOKEN.startsWith('••') || slackCfg.SLACK_BOT_TOKEN.length > 0 },
                    { label: 'App Token', set: slackCfg.SLACK_APP_TOKEN.startsWith('••') || slackCfg.SLACK_APP_TOKEN.length > 0 },
                    { label: 'Channel', set: !!slackCfg.SLACK_CHANNEL_ID },
                  ].map(chip => (
                    <div key={chip.label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${chip.set ? 'bg-emerald-400/20 border-emerald-400/40 text-emerald-200' : 'bg-white/10 border-white/20 text-white/50'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${chip.set ? 'bg-emerald-400' : 'bg-white/30'}`} />
                      {chip.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Fields ── */}
              <div className="px-7 py-6 space-y-5">

                {/* Bot Token */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Bot Token</label>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">xoxb-…</span>
                  </div>
                  <div className="flex gap-2 items-stretch">
                    <div className="flex-1 relative">
                      <input
                        type={showBotToken ? 'text' : 'password'}
                        value={slackCfg.SLACK_BOT_TOKEN}
                        onChange={e => setSlackCfg(p => ({ ...p, SLACK_BOT_TOKEN: e.target.value }))}
                        placeholder="Paste your bot token here"
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] font-mono text-slate-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 bg-slate-50/70 placeholder:text-slate-300 transition"
                      />
                    </div>
                    <button onClick={() => setShowBotToken(p => !p)} className="px-3.5 border border-slate-200 rounded-xl text-slate-400 hover:text-purple-600 hover:bg-purple-50 hover:border-purple-200 transition bg-slate-50/70">
                      {showBotToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">From <span className="font-semibold">api.slack.com/apps</span> → OAuth & Permissions → Bot User OAuth Token</p>
                </div>

                <div className="border-t border-slate-100" />

                {/* App Token */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">App Token</label>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">xapp-…</span>
                  </div>
                  <div className="flex gap-2 items-stretch">
                    <div className="flex-1 relative">
                      <input
                        type={showAppToken ? 'text' : 'password'}
                        value={slackCfg.SLACK_APP_TOKEN}
                        onChange={e => setSlackCfg(p => ({ ...p, SLACK_APP_TOKEN: e.target.value }))}
                        placeholder="Paste your app-level token here"
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] font-mono text-slate-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 bg-slate-50/70 placeholder:text-slate-300 transition"
                      />
                    </div>
                    <button onClick={() => setShowAppToken(p => !p)} className="px-3.5 border border-slate-200 rounded-xl text-slate-400 hover:text-purple-600 hover:bg-purple-50 hover:border-purple-200 transition bg-slate-50/70">
                      {showAppToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">From <span className="font-semibold">api.slack.com/apps</span> → Basic Information → App-Level Tokens</p>
                </div>

                <div className="border-t border-slate-100" />

                {/* Channel ID */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Channel ID</label>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">C0XXXXXXX</span>
                  </div>
                  <input
                    type="text"
                    value={slackCfg.SLACK_CHANNEL_ID}
                    onChange={e => setSlackCfg(p => ({ ...p, SLACK_CHANNEL_ID: e.target.value }))}
                    placeholder="e.g. C0BS4320V96"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] font-mono text-slate-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 bg-slate-50/70 placeholder:text-slate-300 transition"
                  />
                  <p className="text-[10px] text-slate-400">Right-click a channel in Slack → <span className="font-semibold">Copy link</span> → the ID is the last part of the URL</p>
                </div>

                {/* Restart notice */}
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200/80 rounded-2xl px-4 py-3">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-amber-800">Server restart required for tokens</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">Channel ID updates take effect immediately. Token changes need a full server restart.</p>
                  </div>
                </div>

                {/* Result message */}
                {cfgMsg && (
                  <div className={`flex items-center gap-2.5 text-[12px] font-medium px-4 py-3 rounded-2xl border ${cfgMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : cfgMsg.type === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    <Check className={`w-4 h-4 shrink-0 ${cfgMsg.type === 'error' ? 'hidden' : ''}`} />
                    {cfgMsg.text}
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              <div className="flex gap-3 px-7 pb-7">
                <button onClick={() => setShowSettings(false)} className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-500 text-sm font-semibold hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button onClick={saveSlackConfig} disabled={cfgSaving} className="flex-1 py-3 rounded-2xl bg-gradient-to-br from-[#4A154B] to-[#7c2d8e] text-white text-sm font-bold hover:opacity-90 transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 disabled:opacity-50">
                  {cfgSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save Configuration</>}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
      
      {breakPicker && (
        <div
          className="fixed z-[500] bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-72"
          style={{ top: pickerPos.top, left: pickerPos.left }}
          onPointerDown={e => e.stopPropagation()}
        >
          <p className="text-xs font-bold text-slate-700 mb-3">
            ☕ {DAYS.find(d => d.val === breakPicker.day)?.label} Break
          </p>
          {/* Start Time */}
          <div className="mb-3">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Start</p>
            <div className="flex items-center gap-2">
              <select value={bpStartHour} onChange={e => setBpStartHour(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-orange-400 bg-slate-50">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-slate-400 font-bold">:</span>
              <select value={bpStartMin} onChange={e => setBpStartMin(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-orange-400 bg-slate-50">
                {Array.from({length:12},(_,i)=>String(i*5).padStart(2,'0')).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
                <button onClick={() => setBpStartAmPm('AM')} className={`px-2.5 py-1.5 text-xs font-bold transition ${bpStartAmPm === 'AM' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>AM</button>
                <button onClick={() => setBpStartAmPm('PM')} className={`px-2.5 py-1.5 text-xs font-bold transition ${bpStartAmPm === 'PM' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>PM</button>
              </div>
            </div>
          </div>
          {/* End Time */}
          <div className="mb-4">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">End</p>
            <div className="flex items-center gap-2">
              <select value={bpEndHour} onChange={e => setBpEndHour(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-orange-400 bg-slate-50">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-slate-400 font-bold">:</span>
              <select value={bpEndMin} onChange={e => setBpEndMin(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-orange-400 bg-slate-50">
                {Array.from({length:12},(_,i)=>String(i*5).padStart(2,'0')).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
                <button onClick={() => setBpEndAmPm('AM')} className={`px-2.5 py-1.5 text-xs font-bold transition ${bpEndAmPm === 'AM' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>AM</button>
                <button onClick={() => setBpEndAmPm('PM')} className={`px-2.5 py-1.5 text-xs font-bold transition ${bpEndAmPm === 'PM' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>PM</button>
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={saveBreakSchedule} className="flex-1 bg-orange-500 text-white rounded-lg py-2 text-xs font-bold hover:bg-orange-600 transition">Set Break</button>
            {breakSchedules.find(b => b.employeeId === breakPicker.empId && b.dayOfWeek === breakPicker.day) && (
              <button onClick={() => removeBreakSchedule(breakPicker.empId, breakPicker.day)} className="px-3 bg-red-50 text-red-500 border border-red-200 rounded-lg py-2 text-xs font-bold hover:bg-red-100 transition">Remove</button>
            )}
            <button onClick={() => setBreakPicker(null)} className="px-3 bg-slate-100 text-slate-500 rounded-lg py-2 text-xs font-bold hover:bg-slate-200 transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      <div className={`fixed top-6 right-6 z-[200] transition-all duration-400 transform ${toast.show ? 'translate-x-0 opacity-100 shadow-2xl' : 'translate-x-12 opacity-0 shadow-none pointer-events-none'}`}>
        <div className="bg-slate-900 text-white px-5 py-4 rounded-xl border-l-4 border-emerald-500 flex items-center gap-4 min-w-[300px]">
          <div className="w-8 h-8 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shrink-0">
            <Check className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-emerald-400">Success</span>
            <span className="text-xs text-slate-300 font-medium mt-0.5">{toast.message}</span>
          </div>
        </div>
      </div>
      </div>
    </DndContext>
  );
}
