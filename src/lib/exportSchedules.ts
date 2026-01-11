import jsPDF from 'jspdf';
import ExcelJS from 'exceljs';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Schedule {
  id: string;
  user_id: string;
  date: string;
  time_start: string;
  time_end: string;
  notes: string | null;
  profile?: {
    name: string;
    avatar_url: string | null;
  };
}

interface ExportOptions {
  schedules: Schedule[];
  departmentName: string;
  monthYear: string;
}

export const exportToPDF = ({ schedules, departmentName, monthYear }: ExportOptions) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Escalas - ${departmentName}`, 20, 20);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${monthYear}`, 20, 30);
  
  // Sort schedules by date
  const sortedSchedules = [...schedules].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Table headers
  let yPos = 45;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Data', 20, yPos);
  doc.text('Membro', 60, yPos);
  doc.text('Horário', 130, yPos);
  doc.text('Observações', 165, yPos);
  
  // Line under headers
  doc.setLineWidth(0.5);
  doc.line(20, yPos + 2, 190, yPos + 2);
  
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  
  sortedSchedules.forEach((schedule) => {
    // Check if we need a new page
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    
    const formattedDate = format(parseISO(schedule.date), "dd/MM/yyyy (EEE)", { locale: ptBR });
    const timeRange = `${schedule.time_start.slice(0, 5)} - ${schedule.time_end.slice(0, 5)}`;
    // Get first name only for cleaner display
    const fullName = schedule.profile?.name || 'Membro';
    const memberName = fullName.split(' ')[0];
    const notes = schedule.notes ? (schedule.notes.length > 20 ? schedule.notes.slice(0, 20) + '...' : schedule.notes) : '-';
    
    doc.text(formattedDate, 20, yPos);
    doc.text(memberName.slice(0, 25), 60, yPos);
    doc.text(timeRange, 130, yPos);
    doc.text(notes, 165, yPos);
    
    yPos += 8;
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - Página ${i} de ${totalPages}`,
      20,
      285
    );
  }

  // Download
  const fileName = `escalas-${departmentName.toLowerCase().replace(/\s+/g, '-')}-${monthYear.toLowerCase().replace(/\s+/g, '-')}.pdf`;
  doc.save(fileName);
};

export const exportToExcel = async ({ schedules, departmentName, monthYear }: ExportOptions) => {
  // Sort schedules by date
  const sortedSchedules = [...schedules].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LEVI';
  workbook.created = new Date();
  
  const worksheet = workbook.addWorksheet('Escalas');

  // Define columns
  worksheet.columns = [
    { header: 'Data', key: 'date', width: 12 },
    { header: 'Dia da Semana', key: 'dayOfWeek', width: 15 },
    { header: 'Membro', key: 'member', width: 25 },
    { header: 'Início', key: 'start', width: 8 },
    { header: 'Fim', key: 'end', width: 8 },
    { header: 'Observações', key: 'notes', width: 30 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Add data rows
  sortedSchedules.forEach((schedule) => {
    const fullName = schedule.profile?.name || 'Membro';
    const firstName = fullName.split(' ')[0];
    
    worksheet.addRow({
      date: format(parseISO(schedule.date), "dd/MM/yyyy", { locale: ptBR }),
      dayOfWeek: format(parseISO(schedule.date), "EEEE", { locale: ptBR }),
      member: firstName,
      start: schedule.time_start.slice(0, 5),
      end: schedule.time_end.slice(0, 5),
      notes: schedule.notes || '',
    });
  });

  // Generate and download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  
  const fileName = `escalas-${departmentName.toLowerCase().replace(/\s+/g, '-')}-${monthYear.toLowerCase().replace(/\s+/g, '-')}.xlsx`;
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  
  URL.revokeObjectURL(url);
};
