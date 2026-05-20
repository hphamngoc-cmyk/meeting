/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  doc, 
  setDoc,
  deleteDoc,
  where
} from 'firebase/firestore';
import { 
  Building2, 
  LayoutDashboard, 
  Plus, 
  ChevronRight, 
  Settings,
  Target,
  FileBarChart,
  Presentation,
  Loader2,
  Check,
  Edit3,
  Trash2,
  Calendar,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './lib/firebase';
import { Department, OKR, MonthlyReport, PERSPECTIVE_LABELS } from './types';
import { cn } from './lib/utils';
import ReportTable from './components/ReportTable';
import RiskTable from './components/RiskTable';
import { exportToPPTX } from './lib/pptx';
import { SafeInput } from './components/SafeInput';

type ReportMode = 'monthly' | 'quarterly';
type FormType = 'performance' | 'next_period' | 'risks';

// Default departments list if DB is empty
const INITIAL_DEPARTMENTS = [
  "Ban Giám đốc",
  "Phòng Nhân sự",
  "Phòng Tài chính - Kế toán",
  "Phòng Kinh doanh",
  "Phòng Công nghệ thông tin",
  "Phòng Marketing",
  "Phòng Vận hành",
  "Phòng Quản lý chất lượng",
  "Phòng R&D",
  "Phòng Thu mua",
  "Phòng Chăm sóc khách hàng",
  "Phòng Pháp chế",
  "Phòng Hành chính"
];

export default function App() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [view, setView] = useState<'dashboard' | 'department'>('dashboard');
  const [reportMode, setReportMode] = useState<ReportMode>('monthly');
  const [formType, setFormType] = useState<FormType>('performance');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  
  const [isManagingDepts, setIsManagingDepts] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDeptName, setEditingDeptName] = useState('');
  const [newDeptName, setNewDeptName] = useState('');

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const handleDrop = async (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) return;

    const reordered = [...departments];
    const [removed] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIdx, 0, removed);

    // Optimistically update local state for fast UI response
    setDepartments(reordered);

    try {
      const promises = reordered.map((dept, i) =>
        setDoc(doc(db, 'departments', dept.id), { order: i }, { merge: true })
      );
      await Promise.all(promises);
    } catch (err) {
      console.error("Error updating department order:", err);
    }
  };

  const handleAddDept = async () => {
    if (!newDeptName.trim()) return;
    await addDoc(collection(db, 'departments'), {
      name: newDeptName.trim(),
      order: departments.length + 1
    });
    setNewDeptName('');
  };

  const handleUpdateDept = async (id: string, name: string) => {
    if (!name || !name.trim()) return;
    await setDoc(doc(db, 'departments', id), { name: name.trim() }, { merge: true });
    setEditingDeptId(null);
    setEditingDeptName('');
  };

  const handleDeleteDept = async (id: string, name: string) => {
    if (confirm(`Xóa vĩnh viễn bộ phận "${name}"? Thao tác này không thể hoàn tác.`)) {
      await deleteDoc(doc(db, 'departments', id));
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'departments'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const depts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Department));
      setDepartments(depts);
      
      setSelectedDept(prev => {
        if (!prev) return null;
        const updated = depts.find(d => d.id === prev.id);
        return updated || prev;
      });
      
      // Auto-populate if empty
      if (depts.length === 0) {
        INITIAL_DEPARTMENTS.forEach(async (name, index) => {
          await addDoc(collection(db, 'departments'), { name, order: index });
        });
      }
    });
    return unsub;
  }, []);

  const [allOkrs, setAllOkrs] = useState<OKR[]>([]);
  const [allReports, setAllReports] = useState<any[]>([]);

  const quarter = Math.ceil(month / 3);

  useEffect(() => {
    const qOkrs = query(
      collection(db, 'okrs'),
      where('year', '==', year),
      where('quarter', '==', quarter)
    );
    return onSnapshot(qOkrs, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as OKR));
      docs.sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });
      setAllOkrs(docs);
    });
  }, [quarter, year]);

  useEffect(() => {
    const qReports = reportMode === 'monthly'
      ? query(collection(db, 'reports'), where('month', '==', month), where('year', '==', year))
      : query(collection(db, 'q_reports'), where('quarter', '==', quarter), where('year', '==', year));

    return onSnapshot(qReports, (snapshot) => {
      setAllReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
  }, [reportMode, month, quarter, year]);

  const getDeptStats = (deptId: string) => {
    const deptOkrs = allOkrs.filter(okr => okr.deptId === deptId);
    const totalCount = deptOkrs.length;
    if (totalCount === 0) {
      return { totalCount: 0, achievedCount: 0, achievedPct: 0, pendingPct: 0 };
    }
    const deptReports = allReports.filter(rep => rep.deptId === deptId);
    const achievedCount = deptReports.filter(rep => rep.status === 'achieved').length;
    const achievedPct = Math.min(100, Math.round((achievedCount / totalCount) * 100));
    const pendingPct = 100 - achievedPct;
    return { totalCount, achievedCount, achievedPct, pendingPct };
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans text-slate-800">
      {/* Sidebar spacer to prevent layout overlap */}
      <div className="w-16 shrink-0 select-none pointer-events-none" />

      {/* Sidebar - Auto hide to 16, expands to 72 on hover */}
      <aside 
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => {
          setIsSidebarHovered(false);
          // Also reset managing depts on collapse for clean state
          setIsManagingDepts(false);
        }}
        className={cn(
          "fixed top-0 left-0 h-full bg-white border-r border-slate-200 flex flex-col z-35 transition-all duration-300 ease-in-out shadow-sm select-none",
          isSidebarHovered ? "w-72 shadow-2xl shadow-indigo-900/10" : "w-16"
        )}
      >
        <div className={cn(
          "border-b border-slate-100 flex items-center transition-all duration-300",
          isSidebarHovered ? "p-6 justify-between h-16" : "p-4 justify-center h-16"
        )}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 shrink-0 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black shadow-md shadow-indigo-100 text-sm">
              O
            </div>
            {isSidebarHovered && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="font-bold text-slate-900 text-sm tracking-tight uppercase whitespace-nowrap"
              >
                OKR Central
              </motion.span>
            )}
          </div>
          {isSidebarHovered && (
            <button 
              onClick={() => setIsManagingDepts(!isManagingDepts)}
              className={cn(
                "p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer",
                isManagingDepts ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-100"
              )}
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto no-scrollbar">
          {isManagingDepts && isSidebarHovered ? (
            <div className="space-y-4">
              <div className="px-2 py-1">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block whitespace-nowrap">Quản lý bộ phận</span>
              </div>
              <div className="space-y-2">
                {departments.map(dept => (
                  <div key={dept.id} className="p-2 border border-slate-100 rounded-xl bg-slate-50/50 space-y-2">
                    {editingDeptId === dept.id ? (
                      <div className="flex gap-2">
                        <SafeInput 
                          autoFocus
                          className="flex-1 bg-white border border-indigo-200 rounded-lg px-2 py-1 text-sm outline-none"
                          value={editingDeptName}
                          onValueChange={setEditingDeptName}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateDept(dept.id, editingDeptName);
                            if (e.key === 'Escape') setEditingDeptId(null);
                          }}
                        />
                        <button 
                          type="button"
                          onClick={() => handleUpdateDept(dept.id, editingDeptName)}
                          className="bg-emerald-500 text-white p-1.5 rounded-lg hover:bg-emerald-600 transition-colors cursor-pointer flex items-center justify-center shadow-sm"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700 truncate">{dept.name}</span>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingDeptId(dept.id); setEditingDeptName(dept.name); }} className="p-1 text-slate-400 hover:text-indigo-600"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteDept(dept.id, dept.name)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex gap-2">
                    <SafeInput 
                      placeholder="Thêm bộ phận mới..."
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-600"
                      value={newDeptName}
                      onValueChange={setNewDeptName}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddDept()}
                    />
                    <button 
                      onClick={handleAddDept}
                      className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <button 
                onClick={() => { setView('dashboard'); setSelectedDept(null); }}
                className={cn(
                  "w-full rounded-lg text-sm font-bold flex items-center transition-all duration-200 cursor-pointer",
                  isSidebarHovered ? "px-4 py-2.5 gap-3 justify-start" : "p-3 justify-center",
                  view === 'dashboard' ? "bg-indigo-50 text-indigo-700 font-extrabold" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
                title={!isSidebarHovered ? "Tổng quan Dashboard" : undefined}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                {isSidebarHovered && (
                  <motion.span 
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="whitespace-nowrap"
                  >
                    Tổng quan Dashboard
                  </motion.span>
                )}
              </button>
              
              {isSidebarHovered ? (
                <div className="pt-4 pb-2 px-4 transition-all whitespace-nowrap select-none">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">BỘ PHẬN ({departments.length})</span>
                </div>
              ) : (
                <div className="py-2.5 flex justify-center select-none">
                  <div className="w-8 h-[2px] bg-slate-200 rounded-full" />
                </div>
              )}

              <div className="space-y-1">
                {departments.map((dept) => {
                  const isSelected = selectedDept?.id === dept.id;
                  
                  // Extract two-letter department initials nicely
                  const cleanName = dept.name.replace(/^(Phòng|Ban|Bộ phận)\s+/i, '').trim();
                  const words = cleanName.split(/\s+/);
                  const initials = words.length >= 2 
                    ? (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
                    : cleanName.slice(0, 2).toUpperCase();

                  return (
                    <button 
                      key={dept.id}
                      onClick={() => { setSelectedDept(dept); setView('department'); }}
                      className={cn(
                        "w-full rounded-lg text-sm flex items-center transition-all duration-150 relative cursor-pointer",
                        isSidebarHovered ? "px-4 py-2.5 justify-between" : "p-2 justify-center",
                        isSelected ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-600 hover:bg-slate-50"
                      )}
                      title={!isSidebarHovered ? dept.name : undefined}
                    >
                      <div className="flex items-center gap-2 overflow-hidden w-full">
                        {isSelected && !isSidebarHovered && (
                          <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-indigo-600 rounded-r-lg" />
                        )}
                        {isSelected && isSidebarHovered && (
                          <motion.span layoutId="active-dot" className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0"></motion.span>
                        )}
                        {isSidebarHovered ? (
                          <span className="truncate text-left whitespace-nowrap block flex-1">{dept.name}</span>
                        ) : (
                          <span className={cn(
                            "text-[10px] font-black w-8 h-8 flex items-center justify-center rounded-lg transition-all shadow-sm shrink-0 border uppercase",
                            isSelected 
                              ? "bg-indigo-600 text-white border-indigo-600" 
                              : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100 hover:text-slate-705"
                          )}>
                            {initials}
                          </span>
                        )}
                      </div>
                      {isSidebarHovered && (
                        <ChevronRight className={cn("w-3 h-3 text-indigo-400 transition-transform shrink-0", isSelected ? "opacity-100 rotate-90" : "opacity-0")} />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </nav>

        <div className={cn("border-t border-slate-100 transition-all duration-300 shrink-0", isSidebarHovered ? "p-4" : "p-2")}>
          <div className={cn(
            "flex items-center text-slate-700 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden transition-all duration-300",
            isSidebarHovered ? "px-4 py-3 gap-3" : "p-2 justify-center"
          )}>
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
               <FileBarChart className="w-4 h-4" />
            </div>
            {isSidebarHovered && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 min-w-0"
              >
                 <p className="text-xs font-bold truncate">Hệ thống báo cáo</p>
                 <p className="text-[10px] text-slate-400 truncate tracking-tight">V1.0.2 - {year}</p>
              </motion.div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {view === 'dashboard' ? `Báo cáo tổng hợp Tháng ${month}/${year}` : selectedDept?.name}
            </h2>
            <p className="text-slate-500 text-[11px] font-medium uppercase tracking-wide">
              {view === 'dashboard' 
                ? `Theo dõi tiến độ OKR của ${departments.length} bộ phận` 
                : 'Báo cáo kết quả công việc tháng (gắn với OKR Quý)'}
            </p>
          </div>

          <div className="flex items-center gap-3">
             <div className="flex bg-slate-100 p-1 rounded-xl">
               <button 
                  onClick={() => setReportMode('monthly')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                    reportMode === 'monthly' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
               >
                 Báo cáo Tháng
               </button>
               <button 
                  onClick={() => setReportMode('quarterly')}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                    reportMode === 'quarterly' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
               >
                 Báo cáo Quý
               </button>
             </div>

             <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1">
                <select 
                  className="bg-transparent text-xs font-bold px-2 outline-none cursor-pointer text-slate-700"
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i+1} value={i+1}>Tháng {i+1}</option>
                  ))}
                </select>
                <div className="w-px h-3 bg-slate-200" />
                <select 
                  className="bg-transparent text-xs font-bold px-2 outline-none cursor-pointer text-slate-700"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                >
                  {[2024, 2025, 2026].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
             </div>

             <button 
              onClick={() => exportToPPTX(departments, month, year, reportMode)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Presentation className="w-4 h-4" />
              Xuất PowerPoint Ngay
            </button>
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {view === 'dashboard' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5 bg-indigo-50/50 text-indigo-600 px-3 py-1.5 rounded-full border border-indigo-100">
                    <svg className="w-3.5 h-3.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <line x1="4" y1="9" x2="20" y2="9" strokeWidth="2" strokeLinecap="round" />
                      <line x1="4" y1="15" x2="20" y2="15" strokeWidth="2" strokeLinecap="round" />
                      <circle cx="8" cy="9" r="1.5" fill="currentColor" />
                      <circle cx="16" cy="9" r="1.5" fill="currentColor" />
                      <circle cx="8" cy="15" r="1.5" fill="currentColor" />
                      <circle cx="16" cy="15" r="1.5" fill="currentColor" />
                    </svg>
                    Mẹo: Giữ & kéo thả các bộ phận bên dưới để thay đổi thứ tự sắp xếp hiển thị
                  </span>
                </div>
                <motion.div 
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch"
                >
                   {departments.map((dept, idx) => {
                     const isDragging = draggedIdx === idx;
                     const isDragOver = dragOverIdx === idx;
                     return (
                       <div 
                         key={dept.id} 
                         draggable
                         onDragStart={(e) => {
                           setDraggedIdx(idx);
                           e.dataTransfer.effectAllowed = 'move';
                         }}
                         onDragOver={(e) => {
                           e.preventDefault();
                           if (dragOverIdx !== idx) {
                             setDragOverIdx(idx);
                           }
                         }}
                         onDragLeave={() => {
                           if (dragOverIdx === idx) {
                             setDragOverIdx(null);
                           }
                         }}
                         onDrop={async (e) => {
                           e.preventDefault();
                           await handleDrop(idx);
                         }}
                         onDragEnd={() => {
                           setDraggedIdx(null);
                           setDragOverIdx(null);
                         }}
                         className={cn(
                           "flex flex-col h-full rounded-2xl transition-all duration-200 relative",
                           isDragging ? "opacity-30 scale-95 border-2 border-dashed border-indigo-300" : "",
                           isDragOver && !isDragging ? "border-2 border-indigo-500 scale-[1.02] shadow-xl shadow-indigo-100/50" : ""
                         )}
                       >
                         <DeptSummaryCard 
                            department={dept} 
                            month={month} 
                            year={year} 
                            reportMode={reportMode}
                            stats={getDeptStats(dept.id)}
                            onClick={() => { setSelectedDept(dept); setView('department'); }}
                          />
                       </div>
                     );
                   })}
                </motion.div>
              </div>
            ) : (
              <motion.div
                key="department"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {selectedDept && (
                  <div className="space-y-6">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 gap-8 mb-6">
                      <button 
                        onClick={() => setFormType('performance')}
                        className={cn(
                          "pb-4 text-sm font-bold transition-all relative",
                          formType === 'performance' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        {reportMode === 'monthly' ? 'Biểu mẫu 02: Kết quả OKR' : 'Biểu mẫu 01: Kết quả OKR Quý'}
                        {formType === 'performance' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
                      </button>
                      <button 
                        onClick={() => setFormType('next_period')}
                        className={cn(
                          "pb-4 text-sm font-bold transition-all relative",
                          formType === 'next_period' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        {reportMode === 'monthly' ? 'Biểu mẫu 03: Công việc tiếp theo' : 'Biểu mẫu 02: OKR Quý tiếp theo'}
                        {formType === 'next_period' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
                      </button>
                      <button 
                        onClick={() => setFormType('risks')}
                        className={cn(
                          "pb-4 text-sm font-bold transition-all relative",
                          formType === 'risks' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        {reportMode === 'monthly' ? 'Biểu mẫu 04: Rủi ro & Vướng mắc' : 'Biểu mẫu 03: Rủi ro & Vướng mắc'}
                        {formType === 'risks' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
                      </button>
                    </div>

                    {formType === 'performance' || formType === 'next_period' ? (
                      <ReportTable 
                        deptId={selectedDept.id}
                        month={month}
                        year={year}
                        mode={reportMode}
                        form={formType}
                      />
                    ) : (
                      <RiskTable 
                        deptId={selectedDept.id}
                        month={month}
                        quarter={Math.ceil(month / 3)}
                        year={year}
                      />
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

interface DeptCardProps {
  department: Department;
  month: number;
  year: number;
  reportMode: 'monthly' | 'quarterly';
  stats: {
    totalCount: number;
    achievedCount: number;
    achievedPct: number;
    pendingPct: number;
  };
  onClick: () => void;
}

function DeptSummaryCard({ department, month, year, reportMode, stats, onClick }: DeptCardProps) {
  const { totalCount, achievedCount, achievedPct, pendingPct } = stats;
  return (
    <button 
      onClick={onClick}
      className="w-full h-full p-6 bg-white border border-slate-200 rounded-2xl text-left hover:shadow-xl hover:shadow-slate-200/50 transition-all group flex flex-col justify-between"
    >
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-inner">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg uppercase tracking-wide">
              Cập nhật
            </div>
            <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors cursor-grab" />
          </div>
        </div>
        <h3 className="font-bold text-slate-900 mb-1 text-base leading-snug line-clamp-2">{department.name}</h3>
        <p className="text-slate-400 text-[10px] mb-4 font-bold uppercase tracking-wider">
          {reportMode === 'monthly' ? `Tháng ${month}/${year}` : `Quý ${Math.ceil(month/3)}/${year}`}
        </p>
      </div>
      
      <div className="space-y-3 w-full mt-auto pt-2 border-t border-slate-50">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-1.5 text-slate-500">
            <div className={`w-2 h-2 rounded-full ${totalCount > 0 ? (achievedPct >= 80 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-300'}`}></div>
            {totalCount > 0 ? `Đạt: ${achievedPct}% (${achievedCount}/${totalCount})` : 'Chưa có OKR'}
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <div className="w-2 h-2 rounded-full bg-slate-200"></div>
              Chờ: {pendingPct}%
            </div>
          )}
        </div>

        {totalCount > 0 ? (
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              style={{ width: `${achievedPct}%` }} 
              className="bg-indigo-500 h-full rounded-full shadow-[0_0_8px_rgba(79,70,229,0.3)] transition-all duration-500"
            ></div>
          </div>
        ) : (
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-slate-200 h-full w-0 rounded-full"></div>
          </div>
        )}
      </div>
    </button>
  );
}
