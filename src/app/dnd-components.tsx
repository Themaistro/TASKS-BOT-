import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, X, Edit2, Eye, EyeOff, Coffee } from 'lucide-react';

export function SortableCategory({ cat, deleteCategory, toggleVisibility, isHidden, icon }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `cat-sort-${cat.id}`, data: cat });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex justify-between items-center text-xs p-2 rounded-lg bg-white border ${isHidden ? 'border-dashed border-slate-200 opacity-60' : 'border-slate-100 hover:border-indigo-200'} shadow-sm transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md group mb-2`}>
      <div {...attributes} {...listeners} className="flex items-center gap-2 cursor-grab active:cursor-grabbing flex-1 min-w-0">
        <div className="shrink-0"><GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 transition-colors" /></div>
        <span className={`text-sm shrink-0 ${isHidden ? 'grayscale opacity-50' : ''}`}>{icon}</span>
        <span className={`font-semibold break-all ${isHidden ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{cat.name}</span>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onPointerDown={(e) => e.stopPropagation()} onClick={toggleVisibility} className="text-slate-300 hover:text-indigo-500 transition p-1"><EyeOff className="w-4 h-4" /></button>
        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => deleteCategory(cat.id)} className="text-slate-300 hover:text-red-500 transition p-1"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

export function DroppableCategoryCard({ cat, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop-${cat.id}`, data: cat });
  
  return (
    <div ref={setNodeRef} className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col ${isOver ? 'border-indigo-400 ring-4 ring-indigo-50 bg-indigo-50/20 scale-[1.02] shadow-xl z-20 relative' : 'border-slate-200 shadow-sm hover:shadow-md'}`}>
      {children}
    </div>
  );
}

export function AssignmentCardUI({ a, absent, editNoteId, setEditNoteId, editNoteVal, setEditNoteVal, saveEditedNote, removeAssignment, getAvatarColor, getInitials, isOverlay = false, breakSchedules = [] }) {
  // Find the break schedule for this assignment's specific day
  const dayBreak = (breakSchedules as any[]).find(b => b.employeeId === a?.employee?.id && b.dayOfWeek === a?.dayOfWeek);
  const formatBT = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${m.toString().padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  return (
    <div className={`border rounded-xl text-xs flex items-stretch group transition-all overflow-hidden bg-white ${absent ? 'border-red-300 ring-1 ring-red-400' : 'border-slate-200'} ${isOverlay ? 'shadow-2xl scale-[1.03] ring-2 ring-indigo-500/50 cursor-grabbing' : 'shadow-sm hover:shadow-md hover:border-indigo-300'}`}>
      <div className={`px-2 flex items-center border-r ${absent ? 'bg-red-50 text-red-400 border-red-200' : 'bg-slate-50 text-slate-300 group-hover:text-indigo-400 group-hover:bg-indigo-50 border-slate-100 transition-colors'}`}>
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      <div className={`flex items-center gap-2.5 px-3 py-2 border-r w-1/3 shrink-0 ${absent ? 'bg-red-50 border-red-200' : 'border-slate-100'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm ring-1 shrink-0 ${absent ? 'bg-red-400 ring-red-500' : `${getAvatarColor(a?.employee?.name || '')} ring-white`}`}>
          {absent ? <X className="w-3 h-3"/> : getInitials(a?.employee?.name || '')}
        </div>
        <div className="flex flex-col flex-1 min-w-0 justify-center leading-tight">
          <span className={`font-bold truncate w-full ${absent ? 'text-red-900' : 'text-slate-800'}`}>
            {a?.employee?.name || 'Loading'}
          </span>
          {dayBreak && (
            <span className={`text-[9.5px] font-medium truncate flex items-center gap-1 mt-0.5 ${absent ? 'text-red-700' : 'text-orange-500'}`}>
              <Coffee className="w-2.5 h-2.5 shrink-0" /> {formatBT(dayBreak.startTime)}–{formatBT(dayBreak.endTime)}
            </span>
          )}
        </div>
      </div>
      
      {editNoteId === a.id && !isOverlay ? (
        <div className={`flex items-center flex-1 ${absent ? 'bg-red-50' : 'bg-amber-50/30'}`}>
          <input autoFocus className={`text-[11px] w-full px-3 py-2 outline-none bg-transparent font-medium ${absent ? 'text-red-900 placeholder:text-red-300' : 'text-slate-700 placeholder:text-slate-300'}`} placeholder="Type note..." value={editNoteVal} onChange={e => setEditNoteVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEditedNote(a.id); }} onBlur={() => saveEditedNote(a.id)} />
        </div>
      ) : (
        <div onPointerDown={(e) => { if(!isOverlay && setEditNoteId) { e.stopPropagation(); setEditNoteId(a.id); setEditNoteVal(a.note || ''); } }} className={`px-3 py-2 flex items-center flex-1 cursor-text transition-colors ${absent ? 'bg-red-50 text-red-800 hover:bg-red-100' : 'text-slate-600 hover:bg-slate-50'}`}>
          {a.note ? <span className="font-medium text-[11px] truncate">{a.note}</span> : <span className={`italic flex items-center gap-1.5 text-[10px] ${absent ? 'text-red-400' : 'text-slate-400'}`}><Edit2 className="w-3 h-3"/> Add note</span>}
        </div>
      )}
      
      {!isOverlay && (
        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => removeAssignment(a.id)} className={`px-3 transition-all duration-200 flex items-center justify-center border-l opacity-0 group-hover:opacity-100 ${absent ? 'border-red-200 text-red-500 hover:bg-red-600 hover:text-white' : 'border-slate-100 text-slate-300 hover:bg-red-500 hover:border-red-500 hover:text-white'}`}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function DraggableAssignment({ a, absent, editNoteId, setEditNoteId, editNoteVal, setEditNoteVal, saveEditedNote, removeAssignment, getAvatarColor, getInitials, breakSchedules = [] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `assign-${a.id}`, data: a });
  
  const style = {
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}>
      <AssignmentCardUI a={a} absent={absent} editNoteId={editNoteId} setEditNoteId={setEditNoteId} editNoteVal={editNoteVal} setEditNoteVal={setEditNoteVal} saveEditedNote={saveEditedNote} removeAssignment={removeAssignment} getAvatarColor={getAvatarColor} getInitials={getInitials} isOverlay={false} breakSchedules={breakSchedules} />
    </div>
  );
}

export function DraggableEmployee({ emp, children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `emp-${emp.id}`, data: emp });
  
  const style = {
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={isDragging ? 'cursor-grabbing' : 'cursor-grab'}>
      {children}
    </div>
  );
}
