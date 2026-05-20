import React, { useState, useEffect } from 'react';
import { addDoc, collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { X, Send, ListPlus } from 'lucide-react';
import { db } from '../lib/firebase';
import { BSCPerspective, PERSPECTIVE_LABELS, Objective } from '../types';
import { formatValue, parseValue } from '../lib/format';
import { SafeInput } from './SafeInput';

interface KRFormProps {
  deptId: string;
  month: number;
  quarter: number;
  year: number;
  mode: 'monthly' | 'quarterly';
  onClose: () => void;
}

export default function KRForm({ deptId, month, quarter, year, mode, onClose }: KRFormProps) {
  const [perspective, setPerspective] = useState<BSCPerspective>('FINANCE');
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState('');
  const [kr, setKr] = useState('');
  const [targetYear, setTargetYear] = useState('');
  const [targetQuarter, setTargetQuarter] = useState('');
  const [targetMonth, setTargetMonth] = useState('');
  const [unit, setUnit] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchObjectives = async () => {
      const q = query(
        collection(db, 'objectives'),
        where('deptId', '==', deptId),
        where('year', '==', year),
        where('quarter', '==', quarter),
        where('perspective', '==', perspective)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Objective));
      setObjectives(docs);
      if (docs.length > 0) setSelectedObjectiveId(docs[0].id);
      else setSelectedObjectiveId('');
    };
    fetchObjectives();
  }, [deptId, quarter, year, perspective]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObjectiveId) return;
    
    setLoading(true);
    try {
      // Find current KRs under this objective to determine the next sequential order number
      const q = query(
        collection(db, 'okrs'),
        where('objectiveId', '==', selectedObjectiveId)
      );
      const snap = await getDocs(q);
      const existingCount = snap.docs.length;

      const krDocRef = await addDoc(collection(db, 'okrs'), {
        deptId,
        quarter,
        year,
        mode,
        perspective,
        objectiveId: selectedObjectiveId,
        kr,
        targetYear: parseValue(targetYear),
        targetQuarter: parseValue(targetQuarter),
        targetMonth: parseValue(targetMonth),
        unit,
        order: existingCount,
        createdAt: Date.now()
      });

      const krId = krDocRef.id;

      // Always populate the current month's report target if in monthly mode
      if (mode === 'monthly') {
        const mReportId = `${deptId}_${krId}_m${month}_${year}`;
        await setDoc(doc(db, 'reports', mReportId), {
          deptId,
          krId,
          month,
          year,
          targetMonth: parseValue(targetMonth),
          targetQuarter: parseValue(targetQuarter),
          actual: '',
          status: '',
          notes: ''
        }, { merge: true });
      }

      // Always populate the current quarter's report target
      const qReportId = `${deptId}_${krId}_q${quarter}_${year}`;
      await setDoc(doc(db, 'q_reports', qReportId), {
        deptId,
        krId,
        quarter,
        year,
        targetQuarter: parseValue(targetQuarter),
        actual: '',
        status: '',
        notes: ''
      }, { merge: true });

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const clean = parseValue(val);
    if (clean === '' || !isNaN(Number(clean))) {
      setter(formatValue(clean));
    }
  };

  const handlePriceValueChange = (setter: (val: string) => void) => (val: string) => {
    const clean = parseValue(val);
    if (clean === '' || !isNaN(Number(clean))) {
      setter(formatValue(clean));
    }
  };

  const objLabel = mode === 'monthly' ? `Mục tiêu Quý ${quarter}` : `Mục tiêu Năm ${year}`;
  const krLabel = mode === 'monthly' ? `Kết quả then chốt (KR Quý)` : `Kết quả then chốt (KR Năm)`;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans focus-within:z-[70]">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <ListPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg tracking-tight">Thêm {krLabel}</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Xác định các chỉ số đo lường</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors group">
            <X className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-5">
            <div className="col-span-2">
              <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block">Phân loại BSC</label>
              <select 
                value={perspective}
                onChange={(e) => setPerspective(e.target.value as BSCPerspective)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all cursor-pointer"
              >
                {(Object.keys(PERSPECTIVE_LABELS) as BSCPerspective[]).map(p => (
                  <option key={p} value={p}>{PERSPECTIVE_LABELS[p]}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block">Chọn {objLabel}</label>
              {objectives.length > 0 ? (
                <select 
                  required
                  value={selectedObjectiveId}
                  onChange={e => setSelectedObjectiveId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all cursor-pointer"
                >
                  {objectives.map(obj => (
                    <option key={obj.id} value={obj.id}>{obj.content}</option>
                  ))}
                </select>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-600 flex items-center gap-2">
                  <X className="w-3 h-3" /> Chưa có mục tiêu nào trong nhóm này. Hãy thêm mục tiêu trước.
                </div>
              )}
            </div>

            <div className="col-span-2">
              <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block">Nội dung {krLabel}</label>
              <SafeInput 
                required
                value={kr}
                onValueChange={setKr}
                placeholder="Ví dụ: Đạt 5 tỷ doanh thu mảng Software"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold placeholder:text-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all"
              />
            </div>

            {mode === 'quarterly' && (
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block">Chỉ tiêu Năm {year}</label>
                <SafeInput 
                  required
                  value={targetYear}
                  onValueChange={handlePriceValueChange(setTargetYear)}
                  placeholder="Số lượng/Tỷ lệ"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-indigo-600 placeholder:text-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all font-mono"
                />
              </div>
            )}

            <div className={mode === 'monthly' ? "col-span-1" : "col-span-2"}>
              <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block">Chỉ tiêu Quý {quarter}</label>
              <SafeInput 
                required
                value={targetQuarter}
                onValueChange={handlePriceValueChange(setTargetQuarter)}
                placeholder="Số lượng/Tỷ lệ"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-indigo-600 placeholder:text-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all font-mono"
              />
            </div>

            {mode === 'monthly' && (
              <div className="col-span-1">
                <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block">
                  Chỉ tiêu Tháng {month}
                </label>
                <SafeInput 
                  required
                  value={targetMonth}
                  onValueChange={handlePriceValueChange(setTargetMonth)}
                  placeholder="Số lượng/Tỷ lệ"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-indigo-600 placeholder:text-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all font-mono"
                />
              </div>
            )}

            <div className="col-span-2">
              <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block">Đơn vị tính</label>
              <SafeInput 
                required
                value={unit}
                onValueChange={setUnit}
                placeholder="Ví dụ: VNĐ, %, Khách hàng..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold placeholder:text-slate-300 focus:border-indigo-600 outline-none transition-all"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading || !selectedObjectiveId}
            className="w-full bg-indigo-600 text-white rounded-2xl py-4 text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? <Send className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Lưu Kết quả KR
          </button>
        </form>
      </div>
    </div>
  );
}
