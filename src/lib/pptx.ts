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
  const objSnap = await getDocs(query(collection(db, 'objectives'), where('year', '==', year), where('quarter', '==', reportMode === 'quarterly' ? 0 : quarter)));
  const okrSnap = await getDocs(query(collection(db, 'okrs'), where('year', '==', year), where('quarter', '==', reportMode === 'quarterly' ? 0 : quarter)));
  
  const reportColl = reportMode === 'monthly' ? 'reports' : 'q_reports';
  const reportQuery = reportMode === 'monthly'
    ? query(collection(db, 'reports'), where('month', '==', month), where('year', '==', year))
    : query(collection(db, 'q_reports'), where('quarter', '==', quarter), where('year', '==', year));
  const reportSnap = await getDocs(reportQuery);

  let monthlyReportsForQuarter: any[] = [];
  if (reportMode === 'quarterly') {
    const startM = (quarter - 1) * 3 + 1;
    const endM = quarter * 3;
    const mQuery = query(
      collection(db, 'reports'),
      where('year', '==', year)
    );
    const mSnap = await getDocs(mQuery);
    monthlyReportsForQuarter = mSnap.docs
      .map(d => d.data())
      .filter((r: any) => {
        const m = Number(r.month || 0);
        return m >= startM && m <= endM;
      });
  }

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
    colW: [0.5, 3.2, 1.4, 1.2, 1.5, 1.6],
    margin: [3, 4, 3, 4],
    valign: "middle"
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
    const resultHeader = reportMode === 'monthly' ? [
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
    ];

    const resultDataRows: any[][] = [];
    const perspectives: BSCPerspective[] = ['FINANCE', 'CUSTOMER', 'PROCESS', 'LEARNING'];
    
    perspectives.forEach(p => {
      const pObjs = deptObjectives.filter(o => o.perspective === p);
      if (pObjs.length > 0) {
        resultDataRows.push([
          { text: PERSPECTIVE_LABELS[p], options: { fill: { color: "F1F5F9" }, bold: true, border: { type: "solid", color: "CBD5E1" }, colspan: 6 } }
        ]);

        pObjs.forEach((obj, oIdx) => {
          const objKrs = deptOkrs.filter(k => k.objectiveId === obj.id);
          
          // Render Objective row spanning all 6 columns
          resultDataRows.push([
            { text: `O${oIdx + 1}. ${obj.content}`, options: { bold: true, fontSize: 9, fill: { color: "F8FAFC" }, border: { type: "solid", color: "CBD5E1" }, colspan: 6 } }
          ]);

          if (objKrs.length === 0) {
            resultDataRows.push([
              { text: "Chưa tập trung đăng ký KR", options: { fontSize: 8, italic: true, border: { type: "solid", color: "CBD5E1" } } },
              { text: "-", options: { colspan: 5, border: { type: "solid", color: "CBD5E1" } } }
            ]);
          } else {
            objKrs.forEach((okr, kIdx) => {
              const report = allReports.find(r => r.krId === okr.id && r.deptId === dept.id);
              const statusText = report?.status === 'achieved' ? "ĐẠT" : report?.status === 'not_achieved' ? "K. ĐẠT" : "-";
              const statusColor = report?.status === 'achieved' ? "10B981" : report?.status === 'not_achieved' ? "F43F5E" : "64748B";

              let syncedTargetQuarter = report?.targetQuarter ?? okr.targetQuarter;
              if (reportMode === 'quarterly') {
                const deptMReports = monthlyReportsForQuarter.filter(r => r.krId === okr.id && r.deptId === dept.id);
                if (deptMReports.length > 0) {
                  deptMReports.sort((a, b) => (b.month || 0) - (a.month || 0));
                  for (const r of deptMReports) {
                    if (r.targetQuarter !== undefined && r.targetQuarter !== null && r.targetQuarter !== '') {
                      syncedTargetQuarter = r.targetQuarter;
                      break;
                    }
                  }
                }
              }

              const isLastMonthOfQuarter = reportMode === 'monthly' && month % 3 === 0;
              const targetPeriodVal = reportMode === 'monthly'
                ? (isLastMonthOfQuarter ? (okr.targetNextQuarter ?? '') : (report?.targetQuarter ?? okr.targetQuarter))
                : okr.targetYear;

              if (reportMode === 'monthly') {
                resultDataRows.push([
                  { text: `KR${kIdx + 1}. ${okr.kr}`, options: { fontSize: 8, border: { type: "solid", color: "CBD5E1" } } },
                  { text: formatValue(targetPeriodVal), options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
                  { text: formatValue(report?.targetMonth ?? okr.targetMonth), options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
                  { text: formatValue(report?.actual) || "-", options: { fontSize: 9, align: "center", color: statusColor, bold: true, border: { type: "solid", color: "CBD5E1" } } },
                  { text: statusText, options: { fontSize: 9, align: "center", color: statusColor, bold: true, border: { type: "solid", color: "CBD5E1" } } },
                  { text: report?.notes || "", options: { fontSize: 8, border: { type: "solid", color: "CBD5E1" } } }
                ]);
              } else {
                resultDataRows.push([
                  { text: `KR${kIdx + 1}. ${okr.kr}`, options: { fontSize: 8, border: { type: "solid", color: "CBD5E1" } } },
                  { text: formatValue(targetPeriodVal), options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
                  { text: formatValue(syncedTargetQuarter), options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
                  { text: formatValue(report?.actual) || "-", options: { fontSize: 9, align: "center", color: statusColor, bold: true, border: { type: "solid", color: "CBD5E1" } } },
                  { text: statusText, options: { fontSize: 9, align: "center", color: statusColor, bold: true, border: { type: "solid", color: "CBD5E1" } } },
                  { text: report?.notes || "", options: { fontSize: 8, border: { type: "solid", color: "CBD5E1" } } }
                ]);
              }
            });
          }
        });
      }
    });

    const resultTitle = reportMode === 'monthly'
      ? `BÁO CÁO KẾT QUẢ CÔNG VIỆC - ${dept.name.toUpperCase()}`
      : `BÁO CÁO KẾT QUẢ OKR QUÝ ${quarter} - ${dept.name.toUpperCase()}`;
    const resultSubtitle = reportMode === 'monthly'
      ? `Thời gian: Tháng ${month}/${year} (Kết quả đã thực hiện)`
      : `Thời gian: Quý ${quarter}/${year} (Kết quả đánh giá OKR)`;
    const resultFooter = `Ghi chú: Đạt (Xanh lục), Không đạt (Đỏ). Phân tích nguyên nhân & giải pháp đối với mục tiêu không đạt.`;

    addTableWithSmartPagination(
      pres,
      resultTitle,
      resultSubtitle,
      resultFooter,
      resultHeader,
      resultDataRows,
      [5.0, 0.9, 0.9, 0.8, 0.8, 1.0],
      8,
      6
    );

    // -------------------------------------------------------------------------
    // SLIDE 2: KẾ HOẠCH GIAI ĐOẠN TIẾP THEO (Tháng tới / Quý tới)
    // -------------------------------------------------------------------------
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextQuarter = quarter === 4 ? 1 : quarter + 1;
    const nextQuarterYear = quarter === 4 ? year + 1 : year;

    const planHeader = [
      { text: "Chỉ tiêu (BSC)", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } },
      { text: reportMode === 'monthly' ? "Mục tiêu Quý" : "Mục tiêu Năm", options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
      { text: reportMode === 'monthly' ? `Mục tiêu Tháng ${nextMonth}` : `Mục tiêu Quý ${nextQuarter}`, options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
      { text: "Ghi chú Kế hoạch", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } }
    ];

    const planDataRows: any[][] = [];
    perspectives.forEach(p => {
      const pObjs = deptObjectives.filter(o => o.perspective === p);
      if (pObjs.length > 0) {
        planDataRows.push([
          { text: PERSPECTIVE_LABELS[p], options: { fill: { color: "F1F5F9" }, bold: true, border: { type: "solid", color: "CBD5E1" }, colspan: 4 } }
        ]);

        pObjs.forEach((obj, oIdx) => {
          const objKrs = deptOkrs.filter(k => k.objectiveId === obj.id);
          
          planDataRows.push([
            { text: `O${oIdx + 1}. ${obj.content}`, options: { bold: true, fontSize: 9, fill: { color: "F8FAFC" }, border: { type: "solid", color: "CBD5E1" }, colspan: 4 } }
          ]);
          
          if (objKrs.length === 0) {
            planDataRows.push([
              { text: "Chưa tập trung đăng ký KR", options: { fontSize: 8, italic: true, border: { type: "solid", color: "CBD5E1" } } },
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

              planDataRows.push([
                { text: `KR${kIdx + 1}. ${okr.kr}`, options: { fontSize: 8, border: { type: "solid", color: "CBD5E1" } } },
                { text: formatValue(currentPeriodTarget), options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
                { text: formatValue(nextPeriodTarget) || "-", options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } }, color: "4F46E5", bold: true },
                { text: nextPeriodNotes || "", options: { fontSize: 8, border: { type: "solid", color: "CBD5E1" } } }
              ]);
            });
          }
        });
      }
    });

    const planTitle = reportMode === 'monthly'
      ? `KẾ HOẠCH CÔNG VIỆC THÁNG TIẾP THEO - ${dept.name.toUpperCase()}`
      : `KẾ HOẠCH OKR QUÝ TIẾP THEO - ${dept.name.toUpperCase()}`;
    const planSubtitle = reportMode === 'monthly'
      ? `Thời gian: Tháng ${nextMonth}/${nextMonthYear} (Kế hoạch hành động và mục tiêu mới)`
      : `Thời gian: Quý ${nextQuarter}/${nextQuarterYear} (Kế hoạch mục tiêu OKR quý tiếp theo)`;
    const planFooter = `Ghi chú: Kế hoạch hành động để bám sát và hoàn thành các chỉ tiêu trọng yếu giai đoạn tiếp theo.`;

    addTableWithSmartPagination(
      pres,
      planTitle,
      planSubtitle,
      planFooter,
      planHeader,
      planDataRows,
      [5.4, 1.2, 1.2, 1.6],
      8,
      4
    );

    // -------------------------------------------------------------------------
    // SLIDE 3: RỦI RO & VƯỚNG MẮC (Chỉ hiển thị nếu bộ phận có rủi ro)
    // -------------------------------------------------------------------------
    const deptRisks = allRisks.filter(r => r.deptId === dept.id);
    if (deptRisks.length > 0) {
      const riskHeader = [
        { text: "STT", options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
        { text: "Mô tả rủi ro / Vướng mắc", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } },
        { text: "Mức độ", options: { fill: { color: "F8FAFC" }, bold: true, align: "center", border: { type: "solid", color: "CBD5E1" } } },
        { text: "Ảnh hưởng", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } },
        { text: "Giải pháp / Đề xuất", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } },
        { text: "Đơn vị phối hợp", options: { fill: { color: "F8FAFC" }, bold: true, border: { type: "solid", color: "CBD5E1" } } }
      ];

      const riskDataRows: any[][] = [];
      deptRisks.forEach((risk, rIdx) => {
        const levelColor = risk.level === 'High' ? "EF4444" : risk.level === 'Medium' ? "F59E0B" : "3B82F6";
        const levelLabel = risk.level === 'High' ? "Cao" : risk.level === 'Medium' ? "Trung bình" : "Thấp";

        riskDataRows.push([
          { text: `${rIdx + 1}`, options: { fontSize: 9, align: "center", border: { type: "solid", color: "CBD5E1" } } },
          { text: risk.description || "-", options: { fontSize: 9, border: { type: "solid", color: "CBD5E1" } } },
          { text: levelLabel, options: { fontSize: 9, align: "center", color: levelColor, bold: true, border: { type: "solid", color: "CBD5E1" } } },
          { text: risk.impact || "-", options: { fontSize: 9, border: { type: "solid", color: "CBD5E1" } } },
          { text: risk.solution || "-", options: { fontSize: 9, border: { type: "solid", color: "CBD5E1" } } },
          { text: risk.collaborator || "-", options: { fontSize: 9, border: { type: "solid", color: "CBD5E1" } } }
        ]);
      });

      const riskTitle = `RỦI RO & VƯỚNG MẮC - ${dept.name.toUpperCase()}`;
      const riskSubtitle = reportMode === 'monthly'
        ? `Thời gian: Tháng ${month}/${year} (Các rủi ro vận hành cần lưu ý)`
        : `Thời gian: Quý ${quarter}/${year} (Các rủi ro chiến lược & vận hành)`;
      const riskFooter = `Ghi chú: Mức độ rủi ro: Cao (Đỏ), Trung bình (Vàng), Thấp (Xanh dương). Cần sự chủ động tập trung xử lý từ chủ quản và đơn vị phối hợp.`;

      addTableWithSmartPagination(
        pres,
        riskTitle,
        riskSubtitle,
        riskFooter,
        riskHeader,
        riskDataRows,
        [0.5, 2.5, 1.0, 2.0, 2.4, 1.0],
        9,
        6
      );
    }
  }

  pres.writeFile({ fileName: `Bao_cao_OKR_Thang_${month}_${year}.pptx` });
}

/**
 * Smart table generator that manages rows and paginates perfectly to new slides
 * to prevent overflowing layout issues in pptxgenjs, maximizing slide space utilization.
 * Group objectives and KRs together to ensure they stay on the same slide.
 */
function addTableWithSmartPagination(
  pres: pptxgen,
  title: string,
  subtitle: string,
  footerText: string,
  headerRow: any[],
  dataRows: any[][],
  colWidths?: number[],
  fontSize: number = 8.5,
  tableColsCount: number = 6
) {
  if (dataRows.length === 0) {
    const slide = pres.addSlide();
    slide.addText(title, { x: 0.5, y: 0.2, w: 9, h: 0.5, fontSize: 16, bold: true, color: "1E293B", fontFace: "Arial" });
    slide.addText(subtitle, { x: 0.5, y: 0.5, w: 9, h: 0.3, fontSize: 11, italic: true, color: "64748B", fontFace: "Arial" });
    slide.addText("Chưa có dữ liệu cho phần này.", { x: 1, y: 2, w: 8, h: 1, align: "center", color: "94A3B8", italic: true, fontFace: "Arial" });
    if (footerText) {
      slide.addText(footerText, { x: 0.5, y: 5.2, w: 9, h: 0.3, fontSize: 8, color: "94A3B8", fontFace: "Arial", italic: true });
    }
    return;
  }

  // Available vertical height budget (points) for the table body.
  const TOTAL_BUDGET = 275; 

  const estimateRowHeight = (row: any[]): number => {
    const isHeading = row.some(cell => cell && cell.options && cell.options.colspan && cell.options.colspan >= tableColsCount - 1);
    const cell0Text = (row[0] && typeof row[0] === 'object' ? row[0].text : row[0]) || "";
    
    if (isHeading) {
      const textLines = cell0Text.split('\n');
      let textLinesCount = 0;
      textLines.forEach((line: string) => {
        textLinesCount += Math.max(1, Math.ceil(line.length / 115));
      });
      return Math.max(18, 6 + textLinesCount * 11);
    }
    
    const isNodata = cell0Text === "Chưa tập trung đăng ký KR" || cell0Text === "Chưa có KPI/KR nào được đăng ký";
    if (isNodata) {
      return 18;
    }
    
    const textLines = cell0Text.split('\n');
    let textLinesCount = 0;
    textLines.forEach((line: string) => {
      textLinesCount += Math.max(1, Math.ceil(line.length / 65));
    });
    
    return Math.max(16, 6 + textLinesCount * 11);
  };

  // 1. Parse flat rows into logical units (RowBlocks)
  interface RowBlock {
    perspectiveRow: any[] | null;
    objectiveRow: any[];
    krRows: any[][];
  }

  const blocks: RowBlock[] = [];
  let pendingPerspectiveRow: any[] | null = null;
  let currentBlock: RowBlock | null = null;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const cell = row[0];
    const cellText = cell && typeof cell === 'object' ? (cell.text || "") : (cell || "");
    const colspanVal = cell && cell.options ? cell.options.colspan : 0;
    
    const isPerspective = colspanVal === tableColsCount && !String(cellText).trim().match(/^O\d+/);
    const isObjective = colspanVal === tableColsCount && !!String(cellText).trim().match(/^O\d+/);

    if (isPerspective) {
      pendingPerspectiveRow = row;
    } else if (isObjective) {
      currentBlock = {
        perspectiveRow: pendingPerspectiveRow,
        objectiveRow: row,
        krRows: []
      };
      blocks.push(currentBlock);
      pendingPerspectiveRow = null; 
    } else {
      if (currentBlock) {
        currentBlock.krRows.push(row);
      } else {
        currentBlock = {
          perspectiveRow: pendingPerspectiveRow,
          objectiveRow: [{ text: "Chỉ tiêu công việc", options: { bold: true, fill: { color: "F8FAFC" }, colspan: tableColsCount } }],
          krRows: [row]
        };
        blocks.push(currentBlock);
        pendingPerspectiveRow = null;
      }
    }
  }

  const estimateBlockHeight = (block: RowBlock): number => {
    let h = 0;
    if (block.perspectiveRow) {
      h += estimateRowHeight(block.perspectiveRow);
    }
    h += estimateRowHeight(block.objectiveRow);
    block.krRows.forEach(r => {
      h += estimateRowHeight(r);
    });
    return h;
  };

  // 2. Distribute blocks into pages
  const slidesData: any[][][] = [];
  let currentSlideRows: any[][] = [];
  let currentHeight = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockHeight = estimateBlockHeight(block);

    // Can the entire block fit inside the remaining space of the current slide?
    if (currentHeight + blockHeight <= TOTAL_BUDGET) {
      if (block.perspectiveRow) {
        currentSlideRows.push(block.perspectiveRow);
      }
      currentSlideRows.push(block.objectiveRow);
      block.krRows.forEach(r => currentSlideRows.push(r));
      currentHeight += blockHeight;
    } else {
      // It doesn't fit on the current slide. Can it fit on a fresh new slide?
      if (blockHeight <= TOTAL_BUDGET) {
        if (currentSlideRows.length > 0) {
          slidesData.push(currentSlideRows);
        }
        currentSlideRows = [];
        if (block.perspectiveRow) {
          currentSlideRows.push(block.perspectiveRow);
        }
        currentSlideRows.push(block.objectiveRow);
        block.krRows.forEach(r => currentSlideRows.push(r));
        currentHeight = blockHeight;
      } else {
        // The block is too large to fit even on a single empty slide.
        // We start by adding the header on the current slide if possible, or start fresh.
        let headerHeight = 0;
        if (block.perspectiveRow) {
          headerHeight += estimateRowHeight(block.perspectiveRow);
        }
        headerHeight += estimateRowHeight(block.objectiveRow);

        const firstKrHeight = block.krRows.length > 0 ? estimateRowHeight(block.krRows[0]) : 18;
        if (currentHeight + headerHeight + firstKrHeight > TOTAL_BUDGET) {
          if (currentSlideRows.length > 0) {
            slidesData.push(currentSlideRows);
          }
          currentSlideRows = [];
          currentHeight = 0;
        }

        if (block.perspectiveRow) {
          currentSlideRows.push(block.perspectiveRow);
          currentHeight += estimateRowHeight(block.perspectiveRow);
        }
        currentSlideRows.push(block.objectiveRow);
        currentHeight += estimateRowHeight(block.objectiveRow);

        // Add KRs line by line and split when the current slide gets exhausted
        for (let j = 0; j < block.krRows.length; j++) {
          const krRow = block.krRows[j];
          const krHeight = estimateRowHeight(krRow);

          if (currentHeight + krHeight > TOTAL_BUDGET) {
            if (currentSlideRows.length > 0) {
              slidesData.push(currentSlideRows);
            }
            currentSlideRows = [];
            
            // Clone the objective header for context on the new page
            const clonedObj = JSON.parse(JSON.stringify(block.objectiveRow));
            if (clonedObj[0] && typeof clonedObj[0] === 'object') {
              clonedObj[0].text = `${clonedObj[0].text} (tiếp theo)`;
            }
            currentSlideRows.push(clonedObj);
            currentHeight = estimateRowHeight(clonedObj);
          }

          currentSlideRows.push(krRow);
          currentHeight += krHeight;
        }
      }
    }
  }

  if (currentSlideRows.length > 0) {
    slidesData.push(currentSlideRows);
  }

  // 3. Generate slides from paginated slidesData
  slidesData.forEach((slideRows, index) => {
    const slide = pres.addSlide();
    const pageTitle = slidesData.length > 1 ? `${title} (Trang ${index + 1}/${slidesData.length})` : title;
    
    slide.addText(pageTitle, { x: 0.5, y: 0.2, w: 9, h: 0.45, fontSize: 15, bold: true, color: "1E293B", fontFace: "Arial" });
    slide.addText(subtitle, { x: 0.5, y: 0.5, w: 9, h: 0.3, fontSize: 10, italic: true, color: "64748B", fontFace: "Arial" });

    // Header row mapping: Arial font, unified colors, compact padding, and middle alignment
    const headerCopy = headerRow.map(cell => ({
      ...cell,
      options: {
        ...cell.options,
        fontFace: "Arial",
        margin: [3, 4, 3, 4],
        valign: "middle"
      }
    }));

    // Body rows mapping: format for space density, middle alignment, and Arial font
    const bodyCopy = slideRows.map(row => 
      row.map(cell => {
        if (cell && typeof cell === 'object') {
          return {
            ...cell,
            options: {
              ...cell.options,
              fontFace: "Arial",
              margin: [2.5, 4, 2.5, 4],
              valign: "middle"
            }
          };
        }
        return { 
          text: cell || '', 
          options: { 
            fontFace: "Arial", 
            margin: [2.5, 4, 2.5, 4], 
            valign: "middle" 
          } 
        };
      })
    );

    const finalRows = [headerCopy, ...bodyCopy];

    slide.addTable(finalRows, {
      x: 0.3, y: 0.9, w: 9.4,
      border: { type: "solid", color: "CBD5E1" },
      fontSize: fontSize,
      colW: colWidths,
      valign: "middle"
    });

    if (footerText) {
      slide.addText(footerText, { x: 0.5, y: 5.15, w: 9, h: 0.3, fontSize: 8, color: "94A3B8", fontFace: "Arial", italic: true });
    }
  });
}

