import React, { useState, useEffect, Fragment } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  Edit3,
  Save, 
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  Sparkles,
  Info,
  Target,
  ListPlus,
  X,
  AlertTriangle,
  GripVertical
} from 'lucide-react';
import { db } from '../lib/firebase';
import { OKR, Objective, MonthlyReport, QuarterlyReport, BSCPerspective, PERSPECTIVE_LABELS } from '../types';
import { cn } from '../lib/utils';
import KRForm from './KRForm';
import { SafeInput, SafeTextarea } from './SafeInput';
import ObjectiveForm from './ObjectiveForm';
import { formatValue, parseValue } from '../lib/format';

interface ReportTableProps {
  deptId: string;
  month: number;
  year: number;
  mode: 'monthly' | 'quarterly';
  form: 'performance' | 'next_period' | 'risks';
}

export default function ReportTable({ deptId, month, year, mode, form }: ReportTableProps) {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [reports, setReports] = useState<Record<string, MonthlyReport>>({});
  const [qReports, setQReports] = useState<Record<string, QuarterlyReport>>({});
  
  // Historical reports for Form 03
  const [historyReports, setHistoryReports] = useState<Record<string, any[]>>({});

  const [isAddingObjective, setIsAddingObjective] = useState(false);
  const [isAddingKR, setIsAddingKR] = useState(false);
  const [analyzingNotes, setAnalyzingNotes] = useState<string | null>(null);

  // Custom modals/dialog states
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [editingKR, setEditingKR] = useState<OKR | null>(null);
  const [deletingObjective, setDeletingObjective] = useState<Objective | null>(null);
  const [deletingKR, setDeletingKR] = useState<OKR | null>(null);
  const [editingNotesReport, setEditingNotesReport] = useState<{ krId: string; krText: string; notes: string } | null>(null);

  // Drag and drop states for key results
  const [draggedKrId, setDraggedKrId] = useState<string | null>(null);
  const [dragOverKrId, setDragOverKrId] = useState<string | null>(null);

  // Inputs for edit modals
  const [editObjContent, setEditObjContent] = useState('');
  const [editKRContent, setEditKRContent] = useState('');
  const [editKRTargetYear, setEditKRTargetYear] = useState('');
  const [editKRTargetQuarter, setEditKRTargetQuarter] = useState('');
  const [editKRTargetMonth, setEditKRTargetMonth] = useState('');
  const [editKRUnit, setEditKRUnit] = useState('');

  const quarter = Math.ceil(month / 3);

  useEffect(() => {
    const qObj = query(
      collection(db, 'objectives'),
      where('deptId', '==', deptId),
      where('year', '==', year),
      where('quarter', '==', quarter)
    );
    return onSnapshot(qObj, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Objective));
      docs.sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });
      setObjectives(docs);
    });
  }, [deptId, quarter, year]);

  useEffect(() => {
    const qOkr = query(
      collection(db, 'okrs'), 
      where('deptId', '==', deptId),
      where('year', '==', year),
      where('quarter', '==', quarter)
    );
    return onSnapshot(qOkr, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as OKR));
      docs.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999999;
        const orderB = b.order !== undefined ? b.order : 999999;
        if (orderA !== orderB) return orderA - orderB;

        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        if (timeA !== timeB) return timeA - timeB;

        return a.id.localeCompare(b.id);
      });
      setOkrs(docs);
    });
  }, [deptId, quarter, year]);

  useEffect(() => {
    const q = query(
      collection(db, mode === 'monthly' ? 'reports' : 'q_reports'),
      where('deptId', '==', deptId),
      where(mode === 'monthly' ? 'month' : 'quarter', '==', mode === 'monthly' ? month : quarter),
      where('year', '==', year)
    );
    return onSnapshot(q, (snapshot) => {
      const reportMap: Record<string, any> = {};
      snapshot.docs.forEach(d => {
        const data = d.data() as any;
        reportMap[data.krId] = { id: d.id, ...data };
      });
      if (mode === 'monthly') setReports(reportMap);
      else setQReports(reportMap);
    });
  }, [deptId, month, quarter, year, mode]);

  useEffect(() => {
    if (form !== 'next_period') return;

    // Fetch historical data for previous months/quarters
    const histQuery = query(
      collection(db, mode === 'monthly' ? 'reports' : 'q_reports'),
      where('deptId', '==', deptId),
      where('year', '==', year)
    );

    return onSnapshot(histQuery, (snapshot) => {
      const histMap: Record<string, any[]> = {};
      snapshot.docs.forEach(d => {
        const data = d.data() as any;
        const krId = data.krId;
        if (!histMap[krId]) histMap[krId] = [];
        
        const periodIdx = mode === 'monthly' ? data.month : data.quarter;
        const currentPeriodIdx = mode === 'monthly' ? month : quarter;
        
        // Only include completed periods up to current
        if (periodIdx <= currentPeriodIdx) {
          // For monthly, only show months in the same quarter
          if (mode === 'monthly') {
            const mQuarter = Math.ceil(periodIdx / 3);
            if (mQuarter === quarter) histMap[krId].push(data);
          } else {
            histMap[krId].push(data);
          }
        }
      });
      setHistoryReports(histMap);
    });
  }, [deptId, year, month, quarter, mode, form]);

  const handleUpdateReport = async (krId: string, field: string, value: any) => {
    const coll = mode === 'monthly' ? 'reports' : 'q_reports';
    const existing = mode === 'monthly' ? reports[krId] : qReports[krId];
    
    // Auto-parse numeric value if field is 'actual' or similar
    const cleanValue = (field === 'actual' || field === 'actualAccumulated') ? parseValue(value) : value;

    const reportData = {
      ...existing,
      deptId,
      krId,
      [mode === 'monthly' ? 'month' : 'quarter']: mode === 'monthly' ? month : quarter,
      year,
      [field]: cleanValue
    };

    const docId = existing?.id || `${deptId}_${krId}_${mode === 'monthly' ? 'm' + month : 'q' + quarter}_${year}`;
    await setDoc(doc(db, coll, docId), reportData, { merge: true });
  };

  const handleAnalyzeNotes = async (krId: string) => {
    const report = mode === 'monthly' ? reports[krId] : qReports[krId];
    const okr = okrs.find(o => o.id === krId);
    if (!okr) return;

    // Use current notes from state if notes modal is open, otherwise report
    const currentNotes = (editingNotesReport && editingNotesReport.krId === krId) 
      ? editingNotesReport.notes 
      : (report?.notes || '');
    const currentActual = report?.actual || '';

    setAnalyzingNotes(krId);
    try {
      const res = await fetch('/api/analyze-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: currentNotes,
          kr: okr.kr,
          targetMonth: mode === 'monthly' ? (report?.targetMonth ?? okr.targetMonth) : (report?.targetQuarter ?? okr.targetQuarter),
          actual: currentActual
        })
      });
      const data = await res.json();
      if (data.analysis) {
        const appendedNotes = currentNotes 
          ? `${currentNotes}\n\n[Gợi ý AI]:\n${data.analysis}`
          : `[Gợi ý AI]:\n${data.analysis}`;

        if (editingNotesReport && editingNotesReport.krId === krId) {
          setEditingNotesReport(prev => prev ? { ...prev, notes: appendedNotes } : null);
        } else {
          await handleUpdateReport(krId, 'notes', appendedNotes);
        }
      }
    } catch (err) {
      console.error('Error analyzing notes:', err);
    } finally {
      setAnalyzingNotes(null);
    }
  };

  const handleDeleteObjectiveClick = (obj: Objective) => {
    setDeletingObjective(obj);
  };

  const handleConfirmDeleteObjective = async () => {
    if (!deletingObjective) return;
    try {
      await deleteDoc(doc(db, 'objectives', deletingObjective.id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingObjective(null);
    }
  };

  const handleEditObjectiveClick = (obj: Objective) => {
    setEditingObjective(obj);
    setEditObjContent(obj.content);
  };

  const handleSaveObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingObjective || !editObjContent.trim()) return;
    try {
      await setDoc(doc(db, 'objectives', editingObjective.id), { content: editObjContent.trim() }, { merge: true });
    } catch (err) {
      console.error(err);
    } finally {
      setEditingObjective(null);
    }
  };

  const handleKrDrop = async (targetOkr: OKR) => {
    if (!draggedKrId || draggedKrId === targetOkr.id) return;

    // Find the dragged OKR object
    const draggedOkr = okrs.find(o => o.id === draggedKrId);
    if (!draggedOkr) return;

    // Ensure they belong to the same objective
    if (draggedOkr.objectiveId !== targetOkr.objectiveId) return;

    // Get all KRs of this objective
    const objKrs = okrs.filter(o => o.objectiveId === targetOkr.objectiveId);
    const draggedIdx = objKrs.findIndex(o => o.id === draggedKrId);
    const targetIdx = objKrs.findIndex(o => o.id === targetOkr.id);

    if (draggedIdx === -1 || targetIdx === -1) return;

    // Reorder the array
    const reordered = [...objKrs];
    const [removed] = reordered.splice(draggedIdx, 1);
    reordered.splice(targetIdx, 0, removed);

    // Optimistically update local state so UI is dynamic and fast
    const otherKrs = okrs.filter(o => o.objectiveId !== targetOkr.objectiveId);
    const updatedOkrs = [...otherKrs];
    reordered.forEach((okr, index) => {
      updatedOkrs.push({
        ...okr,
        order: index
      });
    });

    updatedOkrs.sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 999999;
      const orderB = b.order !== undefined ? b.order : 999999;
      if (orderA !== orderB) return orderA - orderB;

      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      if (timeA !== timeB) return timeA - timeB;

      return a.id.localeCompare(b.id);
    });

    setOkrs(updatedOkrs);

    // Persist to Firebase
    try {
      const promises = reordered.map((okr, index) => 
        setDoc(doc(db, 'okrs', okr.id), { order: index }, { merge: true })
      );
      await Promise.all(promises);
    } catch (err) {
      console.error("Error updating KR order in Firestore:", err);
    }
  };

  const handleDeleteKRClick = (okr: OKR) => {
    setDeletingKR(okr);
  };

  const handleConfirmDeleteKR = async () => {
    if (!deletingKR) return;
    try {
      await deleteDoc(doc(db, 'okrs', deletingKR.id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingKR(null);
    }
  };

  const handleEditKRClick = (okr: OKR) => {
    setEditingKR(okr);
    setEditKRContent(okr.kr);
    setEditKRTargetYear(formatValue(okr.targetYear || ''));
    const rep = mode === 'monthly' ? reports[okr.id] : qReports[okr.id];
    setEditKRTargetQuarter(formatValue(rep?.targetQuarter ?? okr.targetQuarter ?? ''));
    setEditKRTargetMonth(formatValue(rep?.targetMonth ?? okr.targetMonth ?? ''));
    setEditKRUnit(okr.unit || '');
  };

  const handleSaveKR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKR || !editKRContent.trim()) return;
    try {
      await setDoc(doc(db, 'okrs', editingKR.id), {
        kr: editKRContent.trim(),
        targetYear: parseValue(editKRTargetYear),
        targetQuarter: parseValue(editKRTargetQuarter),
        targetMonth: parseValue(editKRTargetMonth),
        unit: editKRUnit.trim()
      }, { merge: true });

      if (mode === 'monthly') {
        await handleUpdateReport(editingKR.id, 'targetMonth', editKRTargetMonth);
        await handleUpdateReport(editingKR.id, 'targetQuarter', editKRTargetQuarter);
      } else {
        await handleUpdateReport(editingKR.id, 'targetQuarter', editKRTargetQuarter);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEditingKR(null);
    }
  };

  const perspectives: BSCPerspective[] = ['FINANCE', 'CUSTOMER', 'PROCESS', 'LEARNING'];

  // Identify column headers based on Mode and Form
  const getHeaders = () => {
    if (mode === 'monthly') {
      if (form === 'performance') {
        return ['Kết quả then chốt', 'Đơn vị tính', 'Mục tiêu Quý ' + quarter, 'Mục tiêu tháng ' + month, 'Thực hiện tháng ' + month, 'Đánh giá', 'Ghi chú'];
      } else {
        const isLastMonthOfQuarter = month % 3 === 0;
        const histCols = [];
        if (!isLastMonthOfQuarter) {
          const startMonthOfQuarter = (quarter - 1) * 3 + 1;
          for (let m = startMonthOfQuarter; m <= month; m++) {
            histCols.push('Kết quả T' + m);
          }
        }
        const displayQuarter = isLastMonthOfQuarter 
          ? (quarter === 4 ? 1 : quarter + 1) 
          : quarter;
        return ['Kết quả then chốt', 'Đơn vị tính', 'Mục tiêu Quý ' + displayQuarter, ...histCols, 'Mục tiêu tháng ' + (month + 1 > 12 ? 1 : month + 1), 'Ghi chú'];
      }
    } else {
      if (form === 'performance') {
        return ['Kết quả then chốt', 'Đơn vị tính', 'Mục tiêu năm ' + year, 'Mục tiêu Quý ' + quarter, 'Thực hiện Quý ' + quarter, 'Đánh giá', 'Ghi chú'];
      } else {
        const histCols = [];
        for (let q = 1; q <= quarter; q++) {
          histCols.push('Kết quả Q' + q);
        }
        return ['Kết quả then chốt', 'Đơn vị tính', 'Mục tiêu Năm ' + year, ...histCols, 'Mục tiêu Quý ' + (quarter + 1 > 4 ? 1 : quarter + 1), 'Ghi chú'];
      }
    }
  };

  const headers = getHeaders();

  // Group OKRs by objective for numbering
  const getGroupedData = (perspective: BSCPerspective) => {
    const pObjectives = objectives.filter(obj => obj.perspective === perspective);
    const pOkrs = okrs.filter(okr => okr.perspective === perspective);
    
    // For each objective, find its KRs
    return pObjectives.map(obj => ({
      ...obj,
      krs: pOkrs.filter(okr => okr.objectiveId === obj.id)
    }));
  };

  const handleNumericInput = (krId: string, field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const clean = parseValue(val);
    if (clean === '' || !isNaN(Number(clean))) {
      handleUpdateReport(krId, field, clean);
    }
  };

  const getColClass = (hIndex: number, totalHeaders: number) => {
    if (hIndex === 0) {
      return "w-auto min-w-[320px] text-left pr-2";
    }
    if (hIndex === 1) {
      return "w-[80px] min-w-[80px] text-center border-r border-slate-200 font-bold text-slate-500";
    }
    // Ghi chú column
    if (hIndex === totalHeaders - 1) {
      return "w-[60px] min-w-[60px] text-center";
    }
    // Đánh giá column (only exists in performance)
    if (hIndex === totalHeaders - 2 && form === 'performance') {
      return "w-[125px] min-w-[125px] text-center";
    }
    // Middle statistics columns
    return "w-[11%] min-w-[95px] text-center border-r border-slate-200 font-mono";
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm">
        <table className="w-full border-collapse text-xs min-w-[1000px] lg:min-w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              {headers.map((h, i) => (
                <th key={i} className={cn("py-2 px-2 border-r border-slate-200", getColClass(i, headers.length))}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          {perspectives.map(p => {
            const groupedData = getGroupedData(p);
            
            return (
              <tbody key={p}>
                <tr className="bg-slate-100/50">
                  <td colSpan={headers.length} className="py-1.5 px-3 font-black text-slate-900 uppercase tracking-widest text-[9px] bg-slate-100/85">
                    {PERSPECTIVE_LABELS[p]}
                  </td>
                </tr>
                {groupedData.length === 0 ? (
                  <tr>
                     <td colSpan={headers.length} className="py-4 px-3 text-slate-400 italic text-center text-xs font-medium">Chưa có mục tiêu nào được thiết lập cho mục này</td>
                  </tr>
                ) : (
                  groupedData.map((obj, oIdx) => (
                    <Fragment key={obj.id}>
                      {/* Objective Row (Full Width Span) */}
                      <tr className="bg-slate-50/70 border-b border-slate-200 group">
                        <td colSpan={headers.length} className="py-1.5 px-3 font-bold text-slate-900 text-[11px] bg-slate-50/80 leading-tight">
                          <div className="flex items-center justify-between">
                            <div>
                              O{oIdx + 1}. {obj.content}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleEditObjectiveClick(obj)}
                                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteObjectiveClick(obj)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* KR Rows */}
                      {obj.krs.length === 0 ? (
                        <tr className="border-b border-slate-100 bg-slate-50/10 italic">
                          <td colSpan={headers.length} className="py-2 px-3 text-rose-450 font-semibold text-xs text-center bg-white leading-relaxed">
                            Chưa có kết quả then chốt (KR) nào được thiết lập.
                          </td>
                        </tr>
                      ) : (
                        obj.krs.map((okr, kIdx) => {
                          const report = mode === 'monthly' ? reports[okr.id] : qReports[okr.id];
                          const hist = historyReports[okr.id] || [];
                          const histColsCount = form === 'performance' ? 0 : (headers.length - 5);
                          const isDragging = draggedKrId === okr.id;
                          const isDragOver = dragOverKrId === okr.id;
                          
                           return (
                            <tr 
                              key={okr.id} 
                              draggable
                              onDragStart={(e) => {
                                setDraggedKrId(okr.id);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (draggedKrId) {
                                  const draggedOkr = okrs.find(o => o.id === draggedKrId);
                                  if (draggedOkr && draggedOkr.objectiveId === okr.objectiveId) {
                                    if (dragOverKrId !== okr.id) {
                                      setDragOverKrId(okr.id);
                                    }
                                  }
                                }
                              }}
                              onDragLeave={() => {
                                if (dragOverKrId === okr.id) {
                                  setDragOverKrId(null);
                                }
                              }}
                              onDrop={async (e) => {
                                e.preventDefault();
                                await handleKrDrop(okr);
                                setDraggedKrId(null);
                                setDragOverKrId(null);
                              }}
                              onDragEnd={() => {
                                setDraggedKrId(null);
                                setDragOverKrId(null);
                              }}
                              className={cn(
                                "border-b border-slate-100 transition-all duration-150 group",
                                isDragging ? "opacity-30 bg-indigo-50/50" : "hover:bg-slate-50/30",
                                isDragOver && !isDragging ? "bg-indigo-100/70 border-y border-indigo-500 scale-[0.99] shadow-inner" : ""
                              )}
                            >
                              {/* Column 1: KR content */}
                              <td className={cn("py-1 px-2 border-r border-slate-200 bg-white", getColClass(0, headers.length))}>
                                <div className="flex items-center justify-start flex-wrap gap-x-2 gap-y-0.5">
                                  <div className="flex items-center gap-1">
                                    <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-500 cursor-grab shrink-0" />
                                    <span className="text-slate-600 text-[11px] font-bold leading-relaxed">
                                      KR{kIdx + 1}. {okr.kr}
                                    </span>
                                  </div>
                                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <button 
                                      onClick={() => handleEditKRClick(okr)}
                                      className="p-0.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                                      title="Sửa KR"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteKRClick(okr)}
                                      className="p-0.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                      title="Xóa KR"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </td>
                              
                              {/* Column 2: Đơn vị tính */}
                              <td className={cn("py-1 px-1.5 text-center border-r border-slate-200 bg-white font-sans text-[11px] font-semibold text-slate-600", getColClass(1, headers.length))}>
                                {okr.unit || '-'}
                              </td>
                              
                              {/* Column 3: targetYear / targetQuarter */}
                              <td className={cn("py-0.5 px-1 text-center border-r border-slate-200 bg-white font-mono", getColClass(2, headers.length))}>
                                {(() => {
                                  const isShiftedQuarter = mode === 'monthly' && month % 3 === 0 && form === 'next_period';
                                  const rawVal = isShiftedQuarter
                                    ? (okr.targetNextQuarter ?? '')
                                    : (mode === 'monthly' 
                                        ? (report?.targetQuarter ?? okr.targetQuarter ?? '') 
                                        : (okr.targetYear ?? ''));
                                  const inputValue = formatValue(rawVal);
                                  const inputWidth = Math.max(45, Math.min(100, inputValue.length * 7.5 + 15));
                                  return (
                                    <div className="flex items-center justify-center gap-1 inline-flex flex-wrap">
                                      <SafeInput 
                                        type="text"
                                        value={inputValue}
                                        onValueChange={(val) => {
                                          const clean = parseValue(val);
                                          if (clean === '' || !isNaN(Number(clean))) {
                                            if (isShiftedQuarter) {
                                              setDoc(doc(db, 'okrs', okr.id), { targetNextQuarter: clean }, { merge: true });
                                            } else if (mode === 'monthly') {
                                              handleUpdateReport(okr.id, 'targetQuarter', clean);
                                            } else {
                                              setDoc(doc(db, 'okrs', okr.id), { targetYear: clean }, { merge: true });
                                            }
                                          }
                                        }}
                                        placeholder="..."
                                        style={{ width: `${inputWidth}px` }}
                                        className="font-mono text-xs font-bold py-0.5 px-1 rounded-md border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none bg-slate-50/50 transition-all text-center text-slate-700 hover:border-slate-300"
                                      />
                                    </div>
                                  );
                                })()}
                              </td>
   
                              {/* Non-Performance (Next period target columns or history columns) */}
                              {form === 'next_period' && Array.from({ length: histColsCount }).map((_, i) => {
                                const periodIdx = mode === 'monthly' ? ((quarter - 1) * 3 + 1 + i) : (i + 1);
                                const hReport = hist.find(h => (mode === 'monthly' ? h.month : h.quarter) === periodIdx);
                                const colIndex = 3 + i;
                                return (
                                  <td key={i} className={cn("py-1 px-1.5 text-center border-r border-slate-200 bg-white font-mono text-xs font-bold text-slate-500", getColClass(colIndex, headers.length))}>
                                    {formatValue(hReport?.actual) || '-'}
                                  </td>
                                );
                              })}
   
                              {/* Column 4: targetMonth or targetQuarter */}
                              {form === 'performance' && (
                                <td className={cn("py-0.5 px-1 text-center border-r border-slate-200 bg-white font-mono", getColClass(3, headers.length))}>
                                  {(() => {
                                    const rawVal = mode === 'monthly'
                                      ? (report?.targetMonth ?? '')
                                      : (report?.targetQuarter ?? '');
                                    const inputValue = formatValue(rawVal);
                                    const inputWidth = Math.max(45, Math.min(100, inputValue.length * 7.5 + 15));
                                    return (
                                      <div className="flex items-center justify-center gap-1 inline-flex flex-wrap">
                                        <SafeInput 
                                          type="text"
                                          value={inputValue}
                                          onValueChange={(val) => {
                                            const clean = parseValue(val);
                                            if (clean === '' || !isNaN(Number(clean))) {
                                              if (mode === 'monthly') {
                                                handleUpdateReport(okr.id, 'targetMonth', clean);
                                              } else {
                                                handleUpdateReport(okr.id, 'targetQuarter', clean);
                                              }
                                            }
                                          }}
                                          placeholder="..."
                                          style={{ width: `${inputWidth}px` }}
                                          className="font-mono text-xs font-black py-0.5 px-1 rounded-md border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none bg-slate-50/50 transition-all text-center text-indigo-700 hover:border-slate-300"
                                        />
                                      </div>
                                    );
                                  })()}
                                </td>
                              )}
   
                              {/* Column 5: Actual Result Input */}
                              <td className={cn("py-0.5 px-1 text-center border-r border-slate-200 bg-white font-mono", getColClass(form === 'performance' ? 4 : 3 + histColsCount, headers.length))}>
                                 {(() => {
                                   const rawVal = form === 'performance' 
                                     ? (report?.actual ?? '') 
                                     : (mode === 'monthly' ? (okr.targetNextMonth ?? '') : (okr.targetNextQuarter ?? ''));
                                   const inputValue = formatValue(rawVal);
                                   const inputWidth = Math.max(45, Math.min(100, inputValue.length * 7.5 + 15));
                                   return (
                                     <div className="flex items-center justify-center gap-1 inline-flex flex-wrap">
                                       <SafeInput 
                                         type="text"
                                         value={inputValue}
                                         onValueChange={(val) => {
                                           const clean = parseValue(val);
                                           if (clean === '' || !isNaN(Number(clean))) {
                                             if (form === 'performance') handleUpdateReport(okr.id, 'actual', clean);
                                             else {
                                               const field = mode === 'monthly' ? 'targetNextMonth' : 'targetNextQuarter';
                                               setDoc(doc(db, 'okrs', okr.id), { [field]: clean }, { merge: true });
                                             }
                                           }
                                         }}
                                         placeholder="..."
                                         style={{ width: `${inputWidth}px` }}
                                         className="font-mono text-xs font-black py-0.5 px-1 rounded-md border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none bg-slate-50/50 transition-all text-center"
                                       />
                                     </div>
                                   );
                                 })()}
                              </td>
  
                              {/* Column 5: Status (Evaluation - only performance) */}
                              {form === 'performance' && (
                                <td className={cn("py-1 px-1 text-center border-r border-slate-200 bg-white font-sans", getColClass(headers.length - 2, headers.length))}>
                                  <select
                                    value={report?.status || ''}
                                    onChange={(e) => handleUpdateReport(okr.id, 'status', e.target.value)}
                                    className={cn(
                                      "font-bold text-[11px] bg-slate-50 border border-slate-200 py-0.5 px-1 rounded-md focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none cursor-pointer text-center mx-auto block w-full max-w-[110px] appearance-auto font-sans transition-all duration-150",
                                      report?.status === 'achieved' && "text-emerald-700 bg-emerald-50/70 border-emerald-200",
                                      report?.status === 'not_achieved' && "text-rose-700 bg-rose-50/70 border-rose-200",
                                      (!report?.status) && "text-slate-500 hover:bg-slate-100"
                                    )}
                                  >
                                    <option value="" className="text-slate-400 font-sans">Chưa đánh giá</option>
                                    <option value="achieved" className="text-emerald-700 font-bold font-sans">Đạt</option>
                                    <option value="not_achieved" className="text-rose-700 font-bold font-sans">Không đạt</option>
                                  </select>
                                </td>
                              )}
  
                              {/* Column 6: Ghi chú */}
                              <td className={cn("py-1 px-1 bg-white hover:bg-slate-50/40 transition-colors text-center", getColClass(headers.length - 1, headers.length))}>
                                <div className="flex items-center justify-center min-h-[24px]">
                                  {(() => {
                                    const notesVal = form === 'performance'
                                      ? (report?.notes || '')
                                      : (mode === 'monthly' ? (okr.notesNextMonth || '') : (okr.notesNextQuarter || ''));
                                    
                                    if (notesVal) {
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => setEditingNotesReport({ krId: okr.id, krText: okr.kr, notes: notesVal })}
                                          className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/50 text-indigo-600 cursor-pointer transition-all hover:scale-110 shadow-sm mx-auto"
                                          title="Xem ghi chú"
                                        >
                                          <MessageSquare className="w-3 h-3 text-indigo-600" />
                                        </button>
                                      );
                                    } else {
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => setEditingNotesReport({ krId: okr.id, krText: okr.kr, notes: '' })}
                                          className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-600 border-dashed cursor-pointer hover:scale-110 shadow-sm opacity-0 group-hover:opacity-100 transition-all mx-auto"
                                          title="Thêm ghi chú"
                                        >
                                          <Plus className="w-3 h-3" />
                                        </button>
                                      );
                                    }
                                  })()}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            );
          })}
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <button 
            onClick={() => setIsAddingObjective(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Target className="w-4 h-4" />
            Thêm Mục tiêu (O) mới
          </button>
          <button 
            onClick={() => setIsAddingKR(true)}
            className="px-6 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-700 flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ListPlus className="w-4 h-4 text-indigo-600" />
            Thêm KR mới
          </button>
        </div>
        
        <div className="flex items-center gap-6 text-[10px] uppercase font-black text-slate-400 tracking-widest">
           <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"></div> Đạt (Xanh)</div>
           <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]"></div> Không đạt (Đỏ)</div>
        </div>
      </div>

      <div className="p-8 bg-slate-900 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
               <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <Info className="w-4 h-4 text-indigo-400" />
               </div>
               <h4 className="font-bold text-base tracking-tight">Hướng dẫn thực hiện báo cáo</h4>
            </div>
            <ul className="text-sm text-slate-400 space-y-3 font-medium">
              <li className="flex gap-3 items-start"><span className="text-indigo-500 font-bold">•</span> Mục tiêu Quý (O): Là định hướng chiến lược cho các Kết quả then chốt (KR).</li>
              <li className="flex gap-3 items-start"><span className="text-indigo-500 font-bold">•</span> Kết quả thực hiện (KR): Các chỉ số đo lường tiến độ của Mục tiêu (O).</li>
              <li className="flex gap-3 items-start"><span className="text-indigo-500 font-bold">•</span> Đánh giá: Nhấn <CheckCircle2 className="inline w-4 h-4 text-emerald-400" /> nếu đạt mục tiêu, <XCircle className="inline w-4 h-4 text-rose-400" /> nếu chưa hoàn thành.</li>
              <li className="flex gap-3 items-start"><span className="text-indigo-500 font-bold">•</span> Khắc phục: Với các chỉ tiêu chưa đạt, hãy sử dụng AI trợ giúp (<Sparkles className="inline w-3 h-3 text-indigo-400" />) để phân tích nguyên nhân và đề xuất hành động.</li>
            </ul>
          </div>
      </div>

      {isAddingObjective && (
        <ObjectiveForm 
          deptId={deptId}
          quarter={quarter}
          year={year}
          mode={mode}
          onClose={() => setIsAddingObjective(false)}
        />
      )}
      
      {isAddingKR && (
        <KRForm 
          deptId={deptId}
          month={month}
          quarter={quarter}
          year={year}
          mode={mode}
          onClose={() => setIsAddingKR(false)}
        />
      )}

      {/* Delete Objective Confirmation Modal */}
      {deletingObjective && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4 font-sans animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-8 border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-rose-600 mb-6">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Xác nhận xóa Mục tiêu?</h3>
                <p className="text-xs text-slate-500 font-medium">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 leading-relaxed font-semibold mb-6">
              Bạn có chắc chắn muốn xóa vĩnh viễn mục tiêu: <span className="text-slate-900 font-bold block mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100">O. {deletingObjective.content}</span>
              Lưu ý: Các Kết quả then chốt (KR) liên kết với mục tiêu này sẽ bị ẩn hoặc ảnh hưởng hiển thị.
            </p>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setDeletingObjective(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleConfirmDeleteObjective}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-100"
              >
                Xóa mục tiêu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete KR Confirmation Modal */}
      {deletingKR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4 font-sans animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl p-8 border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-rose-600 mb-6">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Xác nhận xóa Kết quả (KR)?</h3>
                <p className="text-xs text-slate-500 font-medium font-sans">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 leading-relaxed font-semibold mb-6">
              Bạn có chắc chắn muốn xóa vĩnh viễn kết quả then chốt: <span className="text-slate-900 font-bold block mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100">KR. {deletingKR.kr}</span>
            </p>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setDeletingKR(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleConfirmDeleteKR}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-100"
              >
                Xóa kết quả
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Objective Modal */}
      {editingObjective && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4 font-sans animate-in fade-in duration-200">
          <form onSubmit={handleSaveObjective} className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Sửa Mục tiêu</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Cập nhật nội dung O</p>
                </div>
              </div>
              <button type="button" onClick={() => setEditingObjective(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-8 space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block font-bold">Nội dung mục tiêu</label>
                <SafeTextarea 
                  required
                  rows={4}
                  value={editObjContent}
                  onValueChange={setEditObjContent}
                  placeholder="Nhập nội dung mục tiêu..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all resize-none font-sans"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3 justify-end">
              <button 
                type="button"
                onClick={() => setEditingObjective(null)}
                className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-bold transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-100"
              >
                Cập nhật
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit KR Modal */}
      {editingKR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4 font-sans animate-in fade-in duration-200">
          <form onSubmit={handleSaveKR} className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <ListPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Sửa Kết quả then chốt (KR)</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Cập nhật nội dung & chỉ tiêu đo lường</p>
                </div>
              </div>
              <button type="button" onClick={() => setEditingKR(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block font-bold">Nội dung kết quả (KR)</label>
                <SafeInput 
                  required
                  value={editKRContent}
                  onValueChange={setEditKRContent}
                  placeholder="Ví dụ: Đạt 5 tỷ doanh thu mảng Software"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {mode === 'quarterly' && (
                  <div className="col-span-2">
                    <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block font-bold font-mono">Chỉ tiêu Năm {editingKR.year}</label>
                    <SafeInput 
                      required
                      value={editKRTargetYear}
                      onValueChange={(val) => {
                        const clean = parseValue(val);
                        if (clean === '' || !isNaN(Number(clean))) setEditKRTargetYear(formatValue(clean));
                      }}
                      placeholder="Số lượng/Tỷ lệ"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-indigo-600 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all font-mono font-black"
                    />
                  </div>
                )}

                <div className={mode === 'monthly' ? "col-span-1" : "col-span-2"}>
                  <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block font-bold">Chỉ tiêu Quý {editingKR.quarter}</label>
                  <SafeInput 
                    required
                    value={editKRTargetQuarter}
                    onValueChange={(val) => {
                      const clean = parseValue(val);
                      if (clean === '' || !isNaN(Number(clean))) setEditKRTargetQuarter(formatValue(clean));
                    }}
                    placeholder="Số lượng/Tỷ lệ"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-indigo-600 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all font-mono font-black"
                  />
                </div>

                {mode === 'monthly' && (
                  <div className="col-span-1">
                    <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block font-bold">
                      Chỉ tiêu Tháng {month}
                    </label>
                    <SafeInput 
                      required
                      value={editKRTargetMonth}
                      onValueChange={(val) => {
                        const clean = parseValue(val);
                        if (clean === '' || !isNaN(Number(clean))) setEditKRTargetMonth(formatValue(clean));
                      }}
                      placeholder="Số lượng/Tỷ lệ"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-indigo-600 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all font-mono font-black"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block font-bold">Đơn vị tính</label>
                  <SafeInput 
                    required
                    value={editKRUnit}
                    onValueChange={setEditKRUnit}
                    placeholder="Ví dụ: VNĐ, %, Khách hàng..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-600 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3 justify-end">
              <button 
                type="button"
                onClick={() => setEditingKR(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-bold transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-100"
              >
                Cập nhật
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Notes Modal */}
      {editingNotesReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4 font-sans animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                   <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Ghi chú & Phân tích giải trình</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Cập nhật nội dung giải trình hoặc đề xuất cho KR</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingNotesReport(null)} 
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-8 space-y-4">
              <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50">
                <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-widest block mb-1">Kết quả then chốt (KR)</span>
                <p className="text-slate-800 text-xs font-bold leading-relaxed">{editingNotesReport.krText}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest block font-bold">Nội dung ghi chú</label>
                  {form === 'performance' && (
                    <button
                      type="button"
                      onClick={() => handleAnalyzeNotes(editingNotesReport.krId)}
                      disabled={analyzingNotes === editingNotesReport.krId}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all disabled:opacity-50 hover:scale-[1.03]"
                    >
                      {analyzingNotes === editingNotesReport.krId ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>{analyzingNotes === editingNotesReport.krId ? 'AI Đang phân tích...' : 'AI Phân tích & Gợi ý'}</span>
                    </button>
                  )}
                </div>
                <SafeTextarea 
                  rows={6}
                  value={editingNotesReport.notes}
                  onValueChange={(val) => setEditingNotesReport(prev => prev ? { ...prev, notes: val } : null)}
                  placeholder="Nhập lý do chưa đạt, phân tích nguyên nhân, đề xuất hành động giải quyết..."
                  className="w-full bg-slate-50 border border-slate-205 rounded-2xl px-4 py-3 text-sm font-semibold focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all resize-none font-sans leading-relaxed"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3 justify-end">
              <button 
                type="button"
                onClick={() => setEditingNotesReport(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-bold transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                type="button"
                onClick={async () => {
                  if (form === 'performance') {
                    await handleUpdateReport(editingNotesReport.krId, 'notes', editingNotesReport.notes);
                  } else {
                    const field = mode === 'monthly' ? 'notesNextMonth' : 'notesNextQuarter';
                    await setDoc(doc(db, 'okrs', editingNotesReport.krId), { [field]: editingNotesReport.notes }, { merge: true });
                  }
                  setEditingNotesReport(null);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-100"
              >
                Cập nhật
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Loader2(props: any) {
  return <Loader2Icon {...props} />;
}

import { Loader2 as Loader2Icon } from 'lucide-react';
