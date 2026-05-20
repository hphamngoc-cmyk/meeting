import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { 
  Plus, 
  Trash2, 
  TriangleAlert,
  AlertCircle
} from 'lucide-react';
import { db } from '../lib/firebase';
import { Risk } from '../types';
import { cn } from '../lib/utils';
import { SafeInput, SafeTextarea } from './SafeInput';

interface RiskTableProps {
  deptId: string;
  month?: number;
  quarter: number;
  year: number;
}

export default function RiskTable({ deptId, month, quarter, year }: RiskTableProps) {
  const [risks, setRisks] = useState<Risk[]>([]);

  useEffect(() => {
    let q = query(
      collection(db, 'risks'), 
      where('deptId', '==', deptId),
      where('year', '==', year),
      where('quarter', '==', quarter)
    );
    
    // Optional monthly filter
    // if (month) q = query(q, where('month', '==', month));

    return onSnapshot(q, (snapshot) => {
      setRisks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Risk)));
    });
  }, [deptId, quarter, year, month]);

  const handleUpdateRisk = async (riskId: string | null, field: keyof Risk, value: any) => {
    if (riskId) {
      await setDoc(doc(db, 'risks', riskId), { [field]: value }, { merge: true });
    }
  };

  const handleAddRisk = async () => {
    await addDoc(collection(db, 'risks'), {
      deptId,
      month: month || null,
      quarter,
      year,
      description: '',
      level: 'Medium',
      impact: '',
      solution: '',
      collaborator: ''
    });
  };

  const handleDeleteRisk = async (id: string) => {
    if (confirm('Xóa rủi ro này?')) {
      await deleteDoc(doc(db, 'risks', id));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-widest font-bold">
            <th className="p-4 text-center border-r border-slate-200 w-12">TT</th>
            <th className="p-4 text-left border-r border-slate-200">Rủi ro/vướng mắc</th>
            <th className="p-4 text-center border-r border-slate-200 w-32">Mức độ</th>
            <th className="p-4 text-left border-r border-slate-200">Ảnh hưởng</th>
            <th className="p-4 text-left border-r border-slate-200">Giải pháp đề xuất</th>
            <th className="p-4 text-left w-48">Bộ phận phối hợp</th>
            <th className="p-4 w-12"></th>
          </tr>
        </thead>
        <tbody className="text-xs">
          {risks.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-8 text-center text-slate-400 italic font-medium">
                Chưa có ghi nhận rủi ro/vướng mắc nào.
              </td>
            </tr>
          ) : (
            risks.map((risk, index) => (
              <tr key={risk.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                <td className="p-4 text-center border-r border-slate-200 font-bold text-slate-400">{index + 1}</td>
                <td className="p-4 border-r border-slate-200">
                  <SafeTextarea 
                    value={risk.description}
                    onValueChange={(val) => handleUpdateRisk(risk.id, 'description', val)}
                    placeholder="..."
                    className="w-full bg-transparent outline-none resize-none focus:text-slate-900"
                  />
                </td>
                <td className="p-4 text-center border-r border-slate-200">
                  <select 
                    value={risk.level}
                    onChange={(e) => handleUpdateRisk(risk.id, 'level', e.target.value)}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider outline-none cursor-pointer border border-transparent",
                      risk.level === 'High' ? "text-rose-600 bg-rose-50" : 
                      risk.level === 'Medium' ? "text-amber-600 bg-amber-50" : 
                      "text-emerald-600 bg-emerald-50"
                    )}
                  >
                    <option value="High">Cao</option>
                    <option value="Medium">Trung bình</option>
                    <option value="Low">Thấp</option>
                  </select>
                </td>
                <td className="p-4 border-r border-slate-200">
                  <SafeTextarea 
                    value={risk.impact}
                    onValueChange={(val) => handleUpdateRisk(risk.id, 'impact', val)}
                    placeholder="..."
                    className="w-full bg-transparent outline-none resize-none focus:text-slate-900"
                  />
                </td>
                <td className="p-4 border-r border-slate-200">
                  <SafeTextarea 
                    value={risk.solution}
                    onValueChange={(val) => handleUpdateRisk(risk.id, 'solution', val)}
                    placeholder="..."
                    className="w-full bg-transparent outline-none resize-none focus:text-slate-900 underline decoration-indigo-200"
                  />
                </td>
                <td className="p-4 border-r border-slate-200 italic font-medium">
                  <SafeInput 
                    type="text"
                    value={risk.collaborator}
                    onValueChange={(val) => handleUpdateRisk(risk.id, 'collaborator', val)}
                    placeholder="..."
                    className="w-full bg-transparent outline-none"
                  />
                </td>
                <td className="p-4 text-center">
                  <button 
                    onClick={() => handleDeleteRisk(risk.id)}
                    className="text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="p-4 bg-slate-50/50 border-t border-slate-100">
        <button 
          onClick={handleAddRisk}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-white rounded-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          Thêm rủi ro/vướng mắc
        </button>
      </div>
    </div>
  );
}
