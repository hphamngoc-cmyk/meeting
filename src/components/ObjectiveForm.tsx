import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { X, Send, Target } from 'lucide-react';
import { db } from '../lib/firebase';
import { BSCPerspective, PERSPECTIVE_LABELS } from '../types';
import { SafeTextarea } from './SafeInput';

interface ObjectiveFormProps {
  deptId: string;
  quarter: number;
  year: number;
  mode: 'monthly' | 'quarterly';
  onClose: () => void;
}

export default function ObjectiveForm({ deptId, quarter, year, mode, onClose }: ObjectiveFormProps) {
  const [perspective, setPerspective] = useState<BSCPerspective>('FINANCE');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'objectives'), {
        deptId,
        quarter: mode === 'quarterly' ? 0 : quarter,
        year,
        mode, // Store the mode so we know if it's a Yearly or Quarterly objective
        perspective,
        content: content.trim(),
        createdAt: Date.now()
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const label = mode === 'monthly' ? `Mục tiêu Quý ${quarter}` : `Mục tiêu Năm ${year}`;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4 font-sans">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg tracking-tight">Thêm {label} (O)</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Xác định mục tiêu chiến lược</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors group">
            <X className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
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

          <div>
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2 block">Nội dung {label}</label>
            <SafeTextarea 
              required
              rows={3}
              value={content}
              onValueChange={setContent}
              placeholder={mode === 'monthly' ? "Ví dụ: Hoàn thành triển khai hệ thống CRM trong Quý..." : "Ví dụ: Tăng doanh thu toàn công ty lên 150% so với năm trước..."}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold placeholder:text-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all resize-none"
            />
          </div>

          <div className="pt-6 flex gap-4">
             <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all border border-slate-200"
            >
              Hủy bỏ
            </button>
            <button 
              type="submit"
              disabled={loading || !content.trim()}
              className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : 'Lưu Mục tiêu (O)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
