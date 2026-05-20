import pptxgen from "pptxgenjs";
import { getDocs, collection, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { Department, OKR, Objective, MonthlyReport, PERSPECTIVE_LABELS, BSCPerspective, Risk } from "../types";
import { formatValue } from "./format";

export async function exportToPPTX(departments: Department[], month: number, year: number, reportMode: 'monthly' | 'quarterly' = 'monthly') {
  const pres = new pptxgen();
  const quarter = Math.ceil(month / 3);

  // Master Slide / Intro Slide
  const introSlide = pres.addSlide();
  const introTitle = reportMode === 'monthly'
    ? "BÁO CÁO TỔNG HỢP KẾT QUẢ & KẾ HOẠCH CÔNG VIỆC"
    : "BÁO CÁO TỔNG HỢP KẾT QUẢ OKR & KẾ HOẠCH QUÝ";
  const introSubtitle = reportMode === 'monthly'
    ? `Tháng ${month} / Năm ${year}`
    : `Quý ${quarter} / Năm ${year}`;

  introSlide.addText(introTitle, {
    x: 0.5, y: 1.5, w: 9, h: 1, fontSize: 26, bold: true, align: "center", fontFace: "Arial", color: "4F46E5"
  });
  introSlide.addText(introSubtitle, {
    x: 0.5, y: 2.5, w: 9, h: 0.5, fontSize: 20, align: "center", color: "64748B"
  });

  // Fetch all Objectives, OKRs, Reports and Risks for the context
  const objSnap = await getDocs(query(collection(db, 'objectives'), where('year', '==', year), where('quarter', '==', quarter)));
  const okrSnap = await getDocs(query(collection(db, 'okrs'), where('year', '==', year), where('quarter', '==', quarter)));
  
  const reportColl = reportMode === 'monthly' ? 'reports' : 'q_reports';
  const reportQuery = reportMode === 'monthly'
    ? query(collection(db, 'reports'), where('month', '==', month), where('year', '==', year))
    : query(collection(db, 'q_reports'), where('quarter', '==', quarter), where('year', '==', year));
  const reportSnap = await getDocs(reportQuery);

  const riskSnap = await getDocs(query(collection(db, 'risks'), where('year', '==', year), where('quarter', '==', quarter)));

  const allObjectives = objSnap.docs.map(d => ({ id: d.id, ...d.data() } as Objective));
  allObjectives.sort((a, b) => {
    const timeA = a.createdAt || 0;
    const timeB = b.createdAt || 0;
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  });

  const allOkrs = okrSnap.docs.map(d => ({ id: d.id, ...d.data() } as OKR));
  allOkrs.sort((a, b) => {
    const timeA = a.createdAt || 0;
    const timeB = b.createdAt || 0;
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  });
  const allReports = reportSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  const allRisks = riskSnap.docs.map(d => ({ id: d.id, ...d.data() } as Risk));

  // -------------------------------------------------------------------------
  // SLIDE TỔNG HỢP (Slide 2 - Báo cáo tổng hợp tiến độ)
  // -------------------------------------------------------------------------
  const summarySlide = pres.addSlide();
  const summaryTitle = reportMode === 'monthly'
    ? `BẢNG TỔNG HỢP TIẾN ĐỘ OKR THÁNG ${month}/${year}`
    : `BẢNG TỔNG HỢP TIẾN ĐỘ OKR QUÝ ${quarter}/${year}`;
  
  summarySlide.addText(summaryTitle, {
    x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 18, bold: true, color: "4F46E5", fontFace: "Arial"
  });
  summarySlide.addText(`Tổng hợp kết quả thực hiện và tỷ lệ đạt mục tiêu OKR của các bộ phận`, {
    x: 0.5, y: 0.6, w: 9, h: 0.3, fontSize: 11, italic: true, color: "64748B", fontFace: "Arial"
  });

  const summaryHeader = [
    { text: "STT", options: { fill: { color: "4F46E5" }, bold: true, align: "center", fontFace: "Arial", color: "FFFFFF" } },
    { text: "Bộ phận / Ban", options: { fill: { color: "4F46E5" }, bold: true, fontFace: "Arial", color: "FFFFFF" } },
    { text: "Tổng mục tiêu (KR)", options: { fill: { color: "4F46E5" }, bold: true, align: "center", fontFace: "Arial", color: "FFFFFF" } },
    { text: "Mục tiêu đạt", options: { fill: { color: "4F46E5" }, bold: true, align: "center", fontFace: "Arial", color: "FFFFFF" } },
    { text: "Tỷ lệ hoàn thành", options: { fill: { color: "4F46E5" }, bold: true, align: "center", fontFace: "Arial", color: "FFFFFF" } },
    { text: "Đánh giá chung", options: { fill: { color: "4F46E5" }, bold: true, align: "center", fontFace: "Arial", color: "FFFFFF" } }
  ];

  const summaryRows: any[] = [summaryHeader];

  departments.forEach((dept, index) => {
    const deptOkrs = allOkrs.filter(okr => okr.deptId === dept.id);
    const totalCount = deptOkrs.length;
    
    let achievedCount = 0;
    let achievedPct = 0;
    
    if (totalCount > 0) {
      achievedCount = allReports.filter(rep => rep.deptId === dept.id && rep.status === 'achieved').length;
      achievedPct = Math.min(100, Math.round((achievedCount / totalCount) * 100));
    }

    let statusText = "Chưa thiết lập";
    let statusColor = "64748B"; // slate
    if (totalCount > 0) {
      if (achievedPct >= 80) {
        statusText = "Xuất sắc ✓";
        statusColor = "10B981"; // emerald
      } else if (achievedPct >= 50) {
        statusText = "Đạt yêu cầu";
        statusColor = "3B82F6"; // blue
      } else {
        statusText = "Cần cải thiện";
        statusColor = "EF4444"; // red
      }
    }

    summaryRows.push([
      { text: `${index + 1}`, options: { fontSize: 9, align: "center", fontFace: "Arial", border: { type: "solid", color: "CBD5E1" } } },
      { text: dept.name, options: { fontSize: 10, bold: true, fontFace: "Arial", border: { type: "solid", color: "CBD5E1" } } },
      { text: `${totalCount}`, options: { fontSize: 10, align: "center", fontFace: "Arial", border: { type: "solid", color: "CBD5E1" } } },
      { text: `${achievedCount}`, options: { fontSize: 10, align: "center", fontFace: "Arial", border: { type: "solid", color: "CBD5E1" } } },
      { text: `${achievedPct}%`, options: { fontSize: 10, align: "center", bold: true, fontFace: "Arial", color: totalCount === 0 ? "64748B" : (achievedPct >= 80 ? "10B981" : achievedPct >= 50 ? "3B82F6" : "EF4444"), border: { type: "solid", color: "CBD5E1" } } },
      { text: statusText, options: { fontSize: 9, align: "center", bold: true, fontFace: "Arial", color: statusColor, border: { type: "solid", color: "CBD5E1" } } }
    ]);
  });

  summarySlide.addTable(summaryRows, {
    x: 0.3, y: 1.0, w: 9.4,
    border: { type: "solid", color: "CBD5E1" },
    fontSize: 9,
    colW: [0.5, 3.2, 1.4, 1.2, 1.5, 1.6]
  });

  summarySlide.addText(`Ghi chú: Đánh giá chung căn cứ vào tỷ lệ hoàn thành các chỉ tiêu (KR): Xuất sắc (>=80%), Đạt yêu cầu (>=50%), Cần cải thiện (<50%).`, {
    x: 0.5, y: 5.3, w: 9, h: 0.3, fontSize: 8, color: "94A3B8", fontFace: "Arial", italic: true
  });

  for (const dept of departments) {
    const deptObjectives = allObjectives.filter(o => o.deptId === dept.id);
    const deptOkrs = allOkrs.filter(o => o.deptId === dept.id);

    // -------------------------------------------------------------------------
    // SLIDE 1: KẾT QUẢ THỜI GIAN HIỆN TẠI (Tháng này / Quý này)
    // -------------------------------------------------------------------------
    const resultSlide = pres.addSlide();
    
    // Header
    const resultTitle = reportMode === 'monthly'
      ? `BÁO CÁO KẾT QUẢ CÔNG VIỆC - ${dept.name.toUpperCase()}`
      : `BÁO CÁO KẾT QUẢ OKR QUÝ ${quarter} - ${dept.name.toUpperCase()}`;
    const resultSubtitle = reportMode === 'monthly'
      ? `Thời gian: Tháng ${month}/${year} (Kết quả đã thực hiện)`
      : `Thời gian: Quý ${quarter}/${year} (Kết quả đánh giá OKR)`;

    resultSlide.addText(resultTitle, {
      x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 16, bold: true, color: "1E293B"
    });
    resultSlide.addText(resultSubtitle, {
      x: 0.5, y: 0.5, w: 9, h: 0.3, fontSize: 11, italic: true, color: "64748B"
    });

    const resultRows: any[] = [
      reportMode === 'monthly' ? [
        { text: "Chỉ tiêu (BSC)", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } },
        { text: "Mục tiêu Quý", options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
        { text: `Mục tiêu T${month}`, options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
        { text: "Thực hiện", options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
        { text: "Đánh giá", options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
        { text: "Ghi chú", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } }
      ] : [
        { text: "Chỉ tiêu (BSC)", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } },
        { text: `Mục tiêu Năm`, options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
        { text: `Mục tiêu Q${quarter}`, options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
        { text: "Thực hiện", options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
        { text: "Đánh giá", options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
        { text: "Ghi chú", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } }
      ]
    ];

    const perspectives: BSCPerspective[] = ['FINANCE', 'CUSTOMER', 'PROCESS', 'LEARNING'];
    
    perspectives.forEach(p => {
      const pObjs = deptObjectives.filter(o => o.perspective === p);
      if (pObjs.length > 0) {
        resultRows.push([
          { text: PERSPECTIVE_LABELS[p], options: { fill: { color: "F1F5F9" }, bold: true, border: { type: "solid", color: "CBD5E1" }, colspan: 6 } }
        ]);

        pObjs.forEach((obj, oIdx) => {
          const objKrs = deptOkrs.filter(k => k.objectiveId === obj.id);
          
          if (objKrs.length === 0) {
            resultRows.push([
              { text: `O${oIdx + 1}. ${obj.content}`, options: { fontSize: 9, bold: true, border: { type: "solid", color: "CBD5E1" } } },
              { text: "-", options: { colspan: 5, border: { type: "solid", color: "CBD5E1" } } }
            ]);
          } else {
            objKrs.forEach((okr, kIdx) => {
              const report = allReports.find(r => r.krId === okr.id && r.deptId === dept.id);
              const statusText = report?.status === 'achieved' ? "ĐẠT" : report?.status === 'not_achieved' ? "K. ĐẠT" : "-";
              const statusColor = report?.status === 'achieved' ? "10B981" : report?.status === 'not_achieved' ? "F43F5E" : "64748B";

              if (reportMode === 'monthly') {
                resultRows.push([
                  { text: `O${oIdx + 1}. ${obj.content}\nKR${kIdx + 1}. ${okr.kr}`, options: { fontSize: 8, border: { type: "solid", color: "CBD5E1" } } },
                  { text: formatValue(report?.targetQuarter ?? okr.targetQuarter), options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
                  { text: formatValue(report?.targetMonth ?? okr.targetMonth), options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
                  { text: formatValue(report?.actual) || "-", options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
                  { text: statusText, options: { fontSize: 9, align: "center", color: statusColor, bold: true, border: { type: "solid", color: "CBD5E1" } } },
                  { text: report?.notes || "", options: { fontSize: 8, border: { type: "solid", color: "CBD5E1" } } }
                ]);
              } else {
                resultRows.push([
                  { text: `O${oIdx + 1}. ${obj.content}\nKR${kIdx + 1}. ${okr.kr}`, options: { fontSize: 8, border: { type: "solid", color: "CBD5E1" } } },
                  { text: formatValue(okr.targetYear), options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
                  { text: formatValue(report?.targetQuarter ?? okr.targetQuarter), options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
                  { text: formatValue(report?.actual) || "-", options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
                  { text: statusText, options: { fontSize: 9, align: "center", color: statusColor, bold: true, border: { type: "solid", color: "CBD5E1" } } },
                  { text: report?.notes || "", options: { fontSize: 8, border: { type: "solid", color: "CBD5E1" } } }
                ]);
              }
            });
          }
        });
      }
    });

    if (resultRows.length > 1) {
      resultSlide.addTable(resultRows, {
        x: 0.3, y: 1.0, w: 9.4,
        border: { type: "solid", color: "CBD5E1" },
        fontSize: 10
      });
    } else {
      resultSlide.addText("Chưa có dữ liệu báo cáo kết quả cho bộ phận này.", {
        x: 1, y: 2, w: 8, h: 1, align: "center", color: "94A3B8", italic: true
      });
    }

    resultSlide.addText(`Ghi chú: Đạt (Xanh lục), Không đạt (Đỏ). Phân tích nguyên nhân & giải pháp đối với mục tiêu không đạt.`, {
      x: 0.5, y: 5.2, w: 9, h: 0.3, fontSize: 8, color: "94A3B8"
    });

    // -------------------------------------------------------------------------
    // SLIDE 2: KẾ HOẠCH GIAI ĐOẠN TIẾP THEO (Tháng tới / Quý tới)
    // -------------------------------------------------------------------------
    const planSlide = pres.addSlide();
    
    // Header
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextQuarter = quarter === 4 ? 1 : quarter + 1;
    const nextQuarterYear = quarter === 4 ? year + 1 : year;

    const planTitle = reportMode === 'monthly'
      ? `KẾ HOẠCH CÔNG VIỆC THÁNG TIẾP THEO - ${dept.name.toUpperCase()}`
      : `KẾ HOẠCH OKR QUÝ TIẾP THEO - ${dept.name.toUpperCase()}`;
    const planSubtitle = reportMode === 'monthly'
      ? `Thời gian: Tháng ${nextMonth}/${nextMonthYear} (Kế hoạch hành động và mục tiêu mới)`
      : `Thời gian: Quý ${nextQuarter}/${nextQuarterYear} (Kế hoạch mục tiêu OKR quý tiếp theo)`;

    planSlide.addText(planTitle, {
      x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 16, bold: true, color: "4F46E5"
    });
    planSlide.addText(planSubtitle, {
      x: 0.5, y: 0.5, w: 9, h: 0.3, fontSize: 11, italic: true, color: "64748B"
    });

    const planRows: any[] = [
      [
        { text: "Chỉ tiêu (BSC)", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } },
        { text: reportMode === 'monthly' ? "Mục tiêu Quý" : "Mục tiêu Năm", options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
        { text: reportMode === 'monthly' ? `Mục tiêu Tháng ${nextMonth}` : `Mục tiêu Quý ${nextQuarter}`, options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
        { text: "Ghi chú Kế hoạch", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } }
      ]
    ];

    perspectives.forEach(p => {
      const pObjs = deptObjectives.filter(o => o.perspective === p);
      if (pObjs.length > 0) {
        planRows.push([
          { text: PERSPECTIVE_LABELS[p], options: { fill: { color: "F1F5F9" }, bold: true, border: { type: "solid", color: "CBD5E1" }, colspan: 4 } }
        ]);

        pObjs.forEach((obj, oIdx) => {
          const objKrs = deptOkrs.filter(k => k.objectiveId === obj.id);
          
          if (objKrs.length === 0) {
            planRows.push([
              { text: `O${oIdx + 1}. ${obj.content}`, options: { fontSize: 9, bold: true, border: { type: "solid", color: "CBD5E1" } } },
              { text: "-", options: { colspan: 3, border: { type: "solid", color: "CBD5E1" } } }
            ]);
          } else {
            objKrs.forEach((okr, kIdx) => {
              const report = allReports.find(r => r.krId === okr.id && r.deptId === dept.id);
              const isLastMonthOfQuarter = reportMode === 'monthly' && month % 3 === 0;
              const currentPeriodTarget = reportMode === 'monthly' 
                ? (isLastMonthOfQuarter ? (okr.targetNextQuarter ?? '') : (report?.targetQuarter ?? okr.targetQuarter)) 
                : okr.targetYear;
              const nextPeriodTarget = reportMode === 'monthly' ? okr.targetNextMonth : okr.targetNextQuarter;
              const nextPeriodNotes = reportMode === 'monthly' ? okr.notesNextMonth : okr.notesNextQuarter;

              planRows.push([
                { text: `O${oIdx + 1}. ${obj.content}\nKR${kIdx + 1}. ${okr.kr}`, options: { fontSize: 8, border: { type: "solid", color: "CBD5E1" } } },
                { text: formatValue(currentPeriodTarget), options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
                { text: formatValue(nextPeriodTarget) || "-", options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } }, color: "4F46E5", bold: true },
                { text: nextPeriodNotes || "", options: { fontSize: 8, border: { type: "solid", color: "CBD5E1" } } }
              ]);
            });
          }
        });
      }
    });

    if (planRows.length > 1) {
      planSlide.addTable(planRows, {
        x: 0.3, y: 1.0, w: 9.4,
        border: { type: "solid", color: "CBD5E1" },
        fontSize: 10
      });
    } else {
      planSlide.addText("Chưa có dữ liệu kế hoạch mục tiêu cho giai đoạn kế tiếp.", {
        x: 1, y: 2, w: 8, h: 1, align: "center", color: "94A3B8", italic: true
      });
    }

    planSlide.addText(`Ghi chú: Kế hoạch hành động để bám sát và hoàn thành các chỉ tiêu trọng yếu giai đoạn tiếp theo.`, {
      x: 0.5, y: 5.2, w: 9, h: 0.3, fontSize: 8, color: "94A3B8"
    });

    // -------------------------------------------------------------------------
    // SLIDE 3: RỦI RO & VƯỚNG MẮC (Chỉ hiển thị nếu bộ phận có rủi ro)
    // -------------------------------------------------------------------------
    const deptRisks = allRisks.filter(r => r.deptId === dept.id);
    if (deptRisks.length > 0) {
      const riskSlide = pres.addSlide();

      const riskTitle = `RỦI RO & VƯỚNG MẮC - ${dept.name.toUpperCase()}`;
      const riskSubtitle = reportMode === 'monthly'
        ? `Thời gian: Tháng ${month}/${year} (Các rủi ro vận hành cần lưu ý)`
        : `Thời gian: Quý ${quarter}/${year} (Các rủi ro chiến lược & vận hành)`;

      riskSlide.addText(riskTitle, {
        x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 16, bold: true, color: "EF4444"
      });
      riskSlide.addText(riskSubtitle, {
        x: 0.5, y: 0.5, w: 9, h: 0.3, fontSize: 11, italic: true, color: "64748B"
      });

      const riskRows: any[] = [
        [
          { text: "STT", options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
          { text: "Mô tả rủi ro / Vướng mắc", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } },
          { text: "Mức độ", options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
          { text: "Ảnh hưởng", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } },
          { text: "Giải pháp / Đề xuất", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } },
          { text: "Đơn vị phối hợp", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } }
        ]
      ];

      deptRisks.forEach((risk, rIdx) => {
        const levelColor = risk.level === 'High' ? "EF4444" : risk.level === 'Medium' ? "F59E0B" : "3B82F6";
        const levelLabel = risk.level === 'High' ? "Cao" : risk.level === 'Medium' ? "Trung bình" : "Thấp";

        riskRows.push([
          { text: `${rIdx + 1}`, options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
          { text: risk.description || "-", options: { fontSize: 9, border: { type: "solid", color: "CBD5E1" } } },
          { text: levelLabel, options: { fontSize: 9, align: "center", color: levelColor, bold: true, border: { type: "solid", color: "CBD5E1" } } },
          { text: risk.impact || "-", options: { fontSize: 9, border: { type: "solid", color: "CBD5E1" } } },
          { text: risk.solution || "-", options: { fontSize: 9, border: { type: "solid", color: "CBD5E1" } } },
          { text: risk.collaborator || "-", options: { fontSize: 9, border: { type: "solid", color: "CBD5E1" } } }
        ]);
      });

      riskSlide.addTable(riskRows, {
        x: 0.3, y: 1.0, w: 9.4,
        border: { type: "solid", color: "CBD5E1" },
        fontSize: 9
      });

      riskSlide.addText(`Ghi chú: Mức độ rủi ro: Cao (Đỏ), Trung bình (Vàng), Thấp (Xanh dương). Cần sự chủ động tập trung xử lý từ chủ quản và đơn vị phối hợp.`, {
        x: 0.5, y: 5.2, w: 9, h: 0.3, fontSize: 8, color: "94A3B8"
      });
    }
  }

  pres.writeFile({ fileName: `Bao_cao_OKR_Thang_${month}_${year}.pptx` });
}

