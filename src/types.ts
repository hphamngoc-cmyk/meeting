export type BSCPerspective = 'FINANCE' | 'CUSTOMER' | 'PROCESS' | 'LEARNING';

export interface Department {
  id: string;
  name: string;
  order?: number;
}

export interface Objective {
  id: string;
  deptId: string;
  year: number;
  quarter: number;
  perspective: BSCPerspective;
  content: string;
  createdAt?: number;
}

export interface OKR {
  id: string;
  deptId: string;
  year: number;
  quarter: number;
  perspective: BSCPerspective;
  objectiveId: string;        // ID of the parent objective
  kr: string;
  targetYear: string;         // For Phụ lục 02
  targetQuarter: string;      // Current Quarter target
  targetMonth: string;        // Current Month target
  targetNextMonth?: string;   // For Form 03 Phụ lục 01
  targetNextQuarter?: string; // For Form 02 Phụ lục 02
  unit: string;
  notesNextMonth?: string;    // Ghi chú tháng tiếp theo
  notesNextQuarter?: string;  // Ghi chú quý tiếp theo
  createdAt?: number;         // Timestamp of creation for ordering
  order?: number;             // Sort order of KRs under objective
  // Legacy support
  objective?: string;         
}

export interface MonthlyReport {
  id: string;
  deptId: string;
  krId: string;
  month: number;
  year: number;
  actual: string;             // Monthly actual
  actualAccumulated?: string; // For Form 03: Kết quả đã thực hiện (accumulated)
  status: 'achieved' | 'not_achieved';
  notes: string;
  targetMonth?: string;       // Month-specific target
  targetQuarter?: string;     // Quarter-specific target (loaded for reference)
}

export interface QuarterlyReport {
  id: string;
  deptId: string;
  krId: string;
  quarter: number;
  year: number;
  actual: string;             // Quarterly actual
  actualAccumulated?: string; // For Form 02 Phụ lục 02
  status: 'achieved' | 'not_achieved';
  notes: string;
  targetQuarter?: string;     // Quarter-specific target
}

export interface Risk {
  id: string;
  deptId: string;
  month?: number;
  quarter: number;
  year: number;
  description: string;
  level: 'High' | 'Medium' | 'Low';
  impact: string;
  solution: string;
  collaborator: string;
}

export const PERSPECTIVE_LABELS: Record<BSCPerspective, string> = {
  FINANCE: 'TÀI CHÍNH',
  CUSTOMER: 'KHÁCH HÀNG',
  PROCESS: 'QUY TRÌNH NỘI BỘ',
  LEARNING: 'HỌC HỎI VÀ PHÁT TRIỂN'
};
