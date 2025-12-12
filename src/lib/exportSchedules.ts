import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
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

export const exportToExcel = ({ schedules, departmentName, monthYear }: ExportOptions) => {
  // Sort schedules by date
  const sortedSchedules = [...schedules].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Prepare data for Excel
  const data = sortedSchedules.map((schedule) => {
    // Get first name only for cleaner display
    const fullName = schedule.profile?.name || 'Membro';
    const firstName = fullName.split(' ')[0];
    
    return {
      'Data': format(parseISO(schedule.date), "dd/MM/yyyy", { locale: ptBR }),
      'Dia da Semana': format(parseISO(schedule.date), "EEEE", { locale: ptBR }),
      'Membro': firstName,
      'Início': schedule.time_start.slice(0, 5),
      'Fim': schedule.time_end.slice(0, 5),
      'Observações': schedule.notes || '',
    };
  });

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Data
    { wch: 15 }, // Dia da Semana
    { wch: 25 }, // Membro
    { wch: 8 },  // Início
    { wch: 8 },  // Fim
    { wch: 30 }, // Observações
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Escalas');

  // Download
  const fileName = `escalas-${departmentName.toLowerCase().replace(/\s+/g, '-')}-${monthYear.toLowerCase().replace(/\s+/g, '-')}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
