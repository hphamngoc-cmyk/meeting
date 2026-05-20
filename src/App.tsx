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
  Calendar
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
      setAllOkrs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as OKR)));
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
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              O
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight uppercase">OKR Central</span>
          </div>
          <button 
            onClick={() => setIsManagingDepts(!isManagingDepts)}
            className={cn("p-1.5 rounded-lg transition-colors", isManagingDepts ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-100")}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto no-scrollbar">
          {isManagingDepts ? (
            <div className="space-y-4">
              <div className="px-2 py-1">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Quản lý bộ phận</span>
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
                  "w-full px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-3 transition-colors",
                  view === 'dashboard' ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                Tổng quan Dashboard
              </button>
              
              <div className="pt-4 pb-2 px-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BỘ PHẬN ({departments.length})</span>
              </div>
              <div className="space-y-0.5">
                {departments.map(dept => (
                  <button 
                    key={dept.id}
                    onClick={() => { setSelectedDept(dept); setView('department'); }}
                    className={cn(
                      "w-full px-4 py-2.5 rounded-lg text-sm flex items-center justify-between transition-colors",
                      selectedDept?.id === dept.id ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {selectedDept?.id === dept.id && <motion.span layoutId="active-dot" className="w-1.5 h-1.5 rounded-full bg-indigo-600"></motion.span>}
                      <span className="truncate text-left">{dept.name}</span>
                    </div>
                    <ChevronRight className={cn("w-3 h-3 text-indigo-400 transition-transform", selectedDept?.id === dept.id ? "opacity-100 rotate-90" : "opacity-0")} />
                  </button>
                ))}
              </div>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3 text-slate-700 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
               <FileBarChart className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-xs font-bold truncate">Hệ thống báo cáo</p>
               <p className="text-[10px] text-slate-400 truncate tracking-tight">V1.0.2 - {year}</p>
            </div>
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
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch"
              >
                 {departments.map((dept, idx) => (
                   <div key={dept.id} className="flex flex-col h-full">
                     <DeptSummaryCard 
                        department={dept} 
                        month={month} 
                        year={year} 
                        reportMode={reportMode}
                        stats={getDeptStats(dept.id)}
                        onClick={() => { setSelectedDept(dept); setView('department'); }}
                      />
                   </div>
                 ))}
              </motion.div>
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
          <div className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-lg uppercase tracking-wide">
            Cập nhật
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
