import React, { useState, useMemo, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from '@google/genai';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList
} from 'recharts';
import Markdown from 'react-markdown';
import {
  UploadCloud,
  FileSpreadsheet,
  Loader2,
  BarChart3,
  Table as TableIcon,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Users,
  Settings2,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  CalendarDays,
  X,
  Building2,
  Target,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Info
} from 'lucide-react';

type RowData = Record<string, any>;

const parseNumber = (val: any): number | null => {
  if (typeof val === 'number') return val;
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).replace(/,/g, '').trim();
  const match = str.match(/^-?\d+(\.\d+)?/);
  if (match) {
    return Number(match[0]);
  }
  return null;
};

interface ColumnConfig {
  unitCol: string;
  groupCol: string;
  dateCol: string;
  statusCol: string;
  attendanceCol: string;
  goalCol: string;
  instructorCol: string;
  modalityCol: string;
  scheduleCol: string;
  genderCol: string;
  ageCol: string;
  areaCol: string;
  startDateCol: string;
  endDateCol: string;
  groupCodeCol: string;
  inscritosCol: string;
  activosCol: string;
  bajasCol: string;
}

// Helper to parse Excel dates or string dates into a Month string
const extractMonth = (val: any): string => {
  if (!val) return 'Sin fecha';
  
  // Handle Excel serial dates (e.g., 44000)
  if (typeof val === 'number' && val > 20000) {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  }
  
  // Handle string dates or explicit month names
  const strVal = String(val).trim();
  
  // If it already looks like a month name (e.g., "Enero", "Febrero")
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  if (months.some(m => strVal.toLowerCase().includes(m))) {
    return strVal;
  }

  // Try to parse as standard date
  const parsedDate = new Date(strVal);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  }

  return strVal; // Fallback to raw value
};

const formatDate = (val: any): string => {
  if (!val) return '';
  
  if (typeof val === 'number' && val > 20000) {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  
  const strVal = String(val).trim();
  const parsedDate = new Date(strVal);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return strVal;
};

const getMonthSortValue = (monthStr: string) => {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const lower = monthStr.toLowerCase();
  
  const yearMatch = lower.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : 0;
  
  const monthIdx = months.findIndex(m => lower.includes(m));
  
  if (monthIdx === -1) {
    return monthStr;
  }
  
  return `${year.toString().padStart(4, '0')}-${(monthIdx + 1).toString().padStart(2, '0')}`;
};

const ColumnInfoIcon = ({ columnName, data }: { columnName: string, data: any[] }) => {
  if (!columnName || data.length === 0) return null;

  // Extract up to 3 unique, non-empty sample values
  const samplesSet = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    const val = data[i][columnName];
    if (val !== null && val !== undefined && val !== '') {
      samplesSet.add(String(val));
      if (samplesSet.size >= 3) break;
    }
  }

  const samples = Array.from(samplesSet);
  if (samples.length === 0) return null;

  return (
    <div className="group relative inline-flex items-center ml-1">
      <Info size={14} className="text-blue-400 hover:text-blue-600 cursor-help transition-colors" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-50 pointer-events-none">
        <p className="font-semibold mb-1 text-gray-300 border-b border-gray-600 pb-1">Ejemplos de datos:</p>
        <ul className="list-disc pl-4 space-y-1">
          {samples.map((sample, idx) => (
            <li key={idx} className="truncate" title={sample}>{sample}</li>
          ))}
        </ul>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-800"></div>
      </div>
    </div>
  );
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<RowData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [rawAiReport, setRawAiReport] = useState<string | null>(null);
  const [loadingRawAi, setLoadingRawAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [config, setConfig] = useState<ColumnConfig>({
    unitCol: '',
    groupCol: '',
    dateCol: '',
    statusCol: '',
    attendanceCol: '',
    goalCol: '',
    instructorCol: '',
    modalityCol: '',
    scheduleCol: '',
    genderCol: '',
    ageCol: '',
    areaCol: '',
    startDateCol: '',
    endDateCol: '',
    groupCodeCol: '',
    inscritosCol: '',
    activosCol: '',
    bajasCol: ''
  });
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [globalUnitFilter, setGlobalUnitFilter] = useState<string>('');
  const [globalAreaFilter, setGlobalAreaFilter] = useState<string>('');
  const [globalScheduleFilter, setGlobalScheduleFilter] = useState<string>('');
  const [aiSelectedColumns, setAiSelectedColumns] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const uploadedFile = event.target.files?.[0];
      if (!uploadedFile) return;

      setFile(uploadedFile);
      setLoading(true);
      setError(null);
      setAiReport(null);
      setData([]);
      setColumns([]);
      setAiSelectedColumns([]);
      setLoadingStep('Leyendo archivo Excel...');

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result;
          if (!buffer) throw new Error('No se pudo leer el archivo');

          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          const jsonData = XLSX.utils.sheet_to_json<RowData>(worksheet, {
            defval: null,
          });

          if (jsonData.length === 0) {
            throw new Error('El archivo Excel está vacío o no tiene un formato válido.');
          }

          const extractedColumns = Object.keys(jsonData[0]);
          setData(jsonData);
          setColumns(extractedColumns);
          setAiSelectedColumns(extractedColumns);
          setLoading(false); // Stop loading to let user see config, AI report is triggered manually or after config
        } catch (err: any) {
          console.error(err);
          setError(err.message || 'Error al procesar el archivo.');
          setLoading(false);
        }
      };

      reader.onerror = () => {
        setError('Error de lectura del archivo.');
        setLoading(false);
      };

      reader.readAsArrayBuffer(uploadedFile);
    },
    []
  );

  // Auto-detect columns
  useEffect(() => {
    if (columns.length > 0 && data.length > 0) {
      const lowerCols = columns.map(c => c.toLowerCase());
      
      const findCol = (keywords: string[]) => {
        const idx = lowerCols.findIndex(c => keywords.some(k => c.includes(k)));
        return idx !== -1 ? columns[idx] : '';
      };

      setConfig({
        unitCol: findCol(['unidad', 'sede', 'plantel', 'departamento', 'centro', 'zona', 'facultad', 'escuela']),
        groupCol: findCol(['actividad', 'nombre', 'grupo', 'curso', 'clase', 'taller']) || columns[0],
        dateCol: findCol(['mes', 'fecha', 'periodo', 'date']),
        statusCol: findCol(['baja', 'estatus', 'estado', 'status']),
        attendanceCol: findCol(['asistencia', 'falta', 'porcentaje']),
        goalCol: findCol(['meta', 'cupo', 'capacidad', 'objetivo', 'esperado', 'limite']),
        instructorCol: findCol(['instructor', 'profesor', 'maestro', 'docente', 'entrenador', 'tutor']),
        modalityCol: findCol(['modalidad', 'tipo', 'formato', 'presencial', 'linea', 'virtual']),
        scheduleCol: findCol(['horario', 'hora', 'turno', 'dia', 'dias']),
        genderCol: findCol(['genero', 'sexo', 'gender']),
        ageCol: findCol(['edad', 'age', 'años']),
        areaCol: findCol(['area', 'área', 'departamento', 'seccion', 'sección', 'categoria', 'categoría']),
        startDateCol: findCol(['inicio', 'fecha_inicio', 'fecha de inicio', 'start']),
        endDateCol: findCol(['fin', 'fecha_fin', 'fecha de fin', 'end', 'termino', 'término']),
        groupCodeCol: findCol(['clave', 'cve', 'codigo', 'código', 'id_grupo', 'id grupo']),
        inscritosCol: findCol(['inscritos', 'total', 'matricula']),
        activosCol: findCol(['activos', 'altas', 'vigentes']),
        bajasCol: findCol(['bajas', 'desercion', 'deserciones'])
      });
    }
  }, [columns, data]);

  // Data Aggregation Logic
  const availableUnits = useMemo(() => {
    if (!data.length || !config.unitCol) return [];
    const units = new Set<string>();
    data.forEach(row => {
      const val = String(row[config.unitCol] || 'Sin Unidad').trim().substring(0, 25);
      units.add(val);
    });
    return Array.from(units).sort();
  }, [data, config.unitCol]);

  const availableAreas = useMemo(() => {
    if (!data.length || !config.areaCol) return [];
    const areas = new Set<string>();
    data.forEach(row => {
      // If a unit is selected, only show areas for that unit
      if (globalUnitFilter && config.unitCol) {
        const unitVal = String(row[config.unitCol] || 'Sin Unidad').trim().substring(0, 25);
        if (unitVal !== globalUnitFilter) return;
      }
      const val = String(row[config.areaCol] || 'Sin Área').trim().substring(0, 25);
      areas.add(val);
    });
    return Array.from(areas).sort();
  }, [data, config.areaCol, config.unitCol, globalUnitFilter]);

  const availableSchedules = useMemo(() => {
    if (!data.length || !config.scheduleCol) return [];
    const schedules = new Set<string>();
    data.forEach(row => {
      if (globalUnitFilter && config.unitCol) {
        const unitVal = String(row[config.unitCol] || 'Sin Unidad').trim().substring(0, 25);
        if (unitVal !== globalUnitFilter) return;
      }
      if (globalAreaFilter && config.areaCol) {
        const areaVal = String(row[config.areaCol] || 'Sin Área').trim().substring(0, 25);
        if (areaVal !== globalAreaFilter) return;
      }
      const val = String(row[config.scheduleCol] || 'Sin Horario').trim();
      if (val) schedules.add(val);
    });
    return Array.from(schedules).sort();
  }, [data, config.scheduleCol, config.unitCol, config.areaCol, globalUnitFilter, globalAreaFilter]);

  const filteredData = useMemo(() => {
    let res = data;
    if (globalUnitFilter && config.unitCol) {
      res = res.filter(row => String(row[config.unitCol] || 'Sin Unidad').trim().substring(0, 25) === globalUnitFilter);
    }
    if (globalAreaFilter && config.areaCol) {
      res = res.filter(row => String(row[config.areaCol] || 'Sin Área').trim().substring(0, 25) === globalAreaFilter);
    }
    if (globalScheduleFilter && config.scheduleCol) {
      res = res.filter(row => String(row[config.scheduleCol] || 'Sin Horario').trim() === globalScheduleFilter);
    }
    return res;
  }, [data, globalUnitFilter, globalAreaFilter, globalScheduleFilter, config.unitCol, config.areaCol, config.scheduleCol]);

  const validationErrors = useMemo(() => {
    const errors: { groupCol?: string; dateCol?: string } = {};
    if (!filteredData.length) return errors;

    if (config.groupCol) {
      const values = filteredData.map(row => row[config.groupCol]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
      if (values.length === 0) {
        errors.groupCol = "La columna está vacía.";
      } else {
        const uniqueValues = new Set(values);
        if (uniqueValues.size > values.length * 0.9 && values.length > 20) {
          errors.groupCol = "Demasiados valores únicos (¿es un ID?).";
        }
      }
    }

    if (config.dateCol) {
      const values = filteredData.map(row => row[config.dateCol]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
      if (values.length === 0) {
        errors.dateCol = "La columna está vacía.";
      } else {
        let invalidCount = 0;
        const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        
        values.forEach(v => {
          const strVal = String(v).trim().toLowerCase();
          const isExcelDate = typeof v === 'number' && v > 20000;
          const isMonthName = months.some(m => strVal.includes(m));
          const parsedDate = new Date(strVal);
          const isStandardDate = !isNaN(parsedDate.getTime());
          
          if (!isExcelDate && !isMonthName && !isStandardDate) {
            invalidCount++;
          }
        });
        
        if (invalidCount > values.length * 0.5) {
          errors.dateCol = "Formato de fecha no reconocido.";
        }
      }
    }

    return errors;
  }, [filteredData, config]);

  const { groupStats, monthlyStats, unitStats, areaStats, modalityStats, genderStats, scheduleStats, instructorStats, totalActivos, totalBajas, totalInscritos, avgAttendance } = useMemo(() => {
    if (!filteredData.length || !config.groupCol) {
      return { groupStats: [], monthlyStats: [], unitStats: [], areaStats: [], modalityStats: [], genderStats: [], scheduleStats: [], instructorStats: [], totalActivos: 0, totalBajas: 0, totalInscritos: 0, avgAttendance: 0 };
    }

    const groups: Record<string, { inscritos: number; bajas: number; asistencias: number[]; meta: number; }> = {};
    const months: Record<string, { inscritos: number; bajas: number; asistencias: number[]; }> = {};
    const units: Record<string, { inscritos: number; bajas: number; asistencias: number[]; }> = {};
    const areas: Record<string, { inscritos: number; bajas: number; asistencias: number[]; }> = {};
    const modalities: Record<string, { inscritos: number; }> = {};
    const genders: Record<string, { inscritos: number; }> = {};
    const schedules: Record<string, { inscritos: number; }> = {};
    const instructors: Record<string, { inscritos: number; }> = {};
    
    let totalBajasCount = 0;
    let totalActivosCount = 0;
    let totalInscritosCount = 0;
    let allAsistencias: number[] = [];

    filteredData.forEach(row => {
      // 1. Group Data
      const groupVal = String(row[config.groupCol] || 'Sin actividad').trim();
      
      // 2. Month Data
      const monthVal = config.dateCol ? extractMonth(row[config.dateCol]) : 'General';

      // 3. Status (Bajas) and Activos
      let isBaja = false;
      let bajasRow = 0;
      let inscritosRow = 0;
      let activosRow = 0;

      if (config.bajasCol) {
         bajasRow = parseNumber(row[config.bajasCol]) || 0;
      } else if (config.statusCol) {
        const statusVal = String(row[config.statusCol]).toLowerCase();
        if (statusVal.includes('baja') || statusVal.includes('inactivo') || statusVal === 'no') {
          isBaja = true;
          bajasRow = 1;
        }
      }

      let hasInscritosCol = !!config.inscritosCol;
      let hasActivosCol = !!config.activosCol;

      let parsedInscritos = hasInscritosCol ? parseNumber(row[config.inscritosCol]) : null;
      let parsedActivos = hasActivosCol ? parseNumber(row[config.activosCol]) : null;

      if (hasInscritosCol && parsedInscritos === null) hasInscritosCol = false;
      if (hasActivosCol && parsedActivos === null) hasActivosCol = false;

      if (hasInscritosCol) inscritosRow = parsedInscritos || 0;
      if (hasActivosCol) activosRow = parsedActivos || 0;

      if (!hasInscritosCol && !hasActivosCol) {
         inscritosRow = 1;
         activosRow = inscritosRow - bajasRow;
      } else if (hasInscritosCol && !hasActivosCol) {
         activosRow = inscritosRow - bajasRow;
      } else if (!hasInscritosCol && hasActivosCol) {
         inscritosRow = activosRow + bajasRow;
      } else if (hasInscritosCol && hasActivosCol && !config.bajasCol && !config.statusCol) {
         bajasRow = inscritosRow - activosRow;
      }

      if (activosRow < 0) activosRow = 0;

      totalBajasCount += bajasRow;
      totalActivosCount += activosRow;
      totalInscritosCount += inscritosRow;

      // 4. Attendance
      let attendanceVal: number | null = null;
      if (config.attendanceCol) {
        const rawAtt = row[config.attendanceCol];
        if (typeof rawAtt === 'number') {
          // If it's a decimal like 0.85, treat as 85%
          attendanceVal = rawAtt <= 1 && rawAtt > 0 ? rawAtt * 100 : rawAtt;
        } else if (typeof rawAtt === 'string') {
          const parsed = parseFloat(rawAtt.replace('%', ''));
          if (!isNaN(parsed)) attendanceVal = parsed;
        }
        if (attendanceVal !== null) allAsistencias.push(attendanceVal);
      }

      // Initialize Group
      if (!validationErrors.groupCol) {
        if (!groups[groupVal]) groups[groupVal] = { inscritos: 0, bajas: 0, asistencias: [], meta: 0 };
        groups[groupVal].inscritos += inscritosRow;
        groups[groupVal].bajas += bajasRow;
        if (attendanceVal !== null) groups[groupVal].asistencias.push(attendanceVal);

        if (config.goalCol) {
          const metaVal = Number(row[config.goalCol]);
          if (!isNaN(metaVal) && metaVal > groups[groupVal].meta) {
            groups[groupVal].meta = metaVal;
          }
        }
      }

      // Initialize Month
      if (!validationErrors.dateCol) {
        if (!months[monthVal]) months[monthVal] = { inscritos: 0, bajas: 0, asistencias: [] };
        months[monthVal].inscritos += inscritosRow;
        months[monthVal].bajas += bajasRow;
        if (attendanceVal !== null) months[monthVal].asistencias.push(attendanceVal);
      }

      // Initialize Unit
      if (config.unitCol) {
        const unitVal = String(row[config.unitCol] || 'Sin Unidad').trim().substring(0, 25);
        if (!units[unitVal]) units[unitVal] = { inscritos: 0, bajas: 0, asistencias: [] };
        units[unitVal].inscritos += inscritosRow;
        units[unitVal].bajas += bajasRow;
        if (attendanceVal !== null) units[unitVal].asistencias.push(attendanceVal);
      }

      // Initialize Area
      if (config.areaCol) {
        const areaVal = String(row[config.areaCol] || 'Sin Área').trim().substring(0, 25);
        if (!areas[areaVal]) areas[areaVal] = { inscritos: 0, bajas: 0, asistencias: [] };
        areas[areaVal].inscritos += inscritosRow;
        areas[areaVal].bajas += bajasRow;
        if (attendanceVal !== null) areas[areaVal].asistencias.push(attendanceVal);
      }

      // Initialize Modality
      if (config.modalityCol) {
        const modVal = String(row[config.modalityCol] || 'Sin Modalidad').trim();
        if (!modalities[modVal]) modalities[modVal] = { inscritos: 0 };
        modalities[modVal].inscritos += inscritosRow;
      }

      // Initialize Gender
      if (config.genderCol) {
        const genVal = String(row[config.genderCol] || 'Sin Género').trim();
        if (!genders[genVal]) genders[genVal] = { inscritos: 0 };
        genders[genVal].inscritos += inscritosRow;
      }

      // Initialize Schedule
      if (config.scheduleCol) {
        const schVal = String(row[config.scheduleCol] || 'Sin Horario').trim();
        if (!schedules[schVal]) schedules[schVal] = { inscritos: 0 };
        schedules[schVal].inscritos += inscritosRow;
      }

      // Initialize Instructor
      if (config.instructorCol) {
        const instVal = String(row[config.instructorCol] || 'Sin Instructor').trim().substring(0, 25);
        if (!instructors[instVal]) instructors[instVal] = { inscritos: 0 };
        instructors[instVal].inscritos += inscritosRow;
      }
    });

    // Format Group Stats
    const formattedGroupStats = Object.entries(groups).map(([name, stats]) => ({
      name: name.substring(0, 25),
      Inscritos: stats.inscritos,
      Bajas: stats.bajas,
      Meta: stats.meta > 0 ? stats.meta : null,
      Asistencia: stats.asistencias.length ? Math.round(stats.asistencias.reduce((a,b)=>a+b,0) / stats.asistencias.length) : 0
    })).sort((a, b) => b.Inscritos - a.Inscritos);

    // Format Monthly Stats
    const formattedMonthlyStats = Object.entries(months).map(([name, stats]) => ({
      name,
      Inscritos: stats.inscritos,
      Bajas: stats.bajas,
      Asistencia: stats.asistencias.length ? Math.round(stats.asistencias.reduce((a,b)=>a+b,0) / stats.asistencias.length) : 0
    }));

    // Format Unit Stats
    const formattedUnitStats = Object.entries(units).map(([name, stats]) => ({
      name: name.substring(0, 25),
      Inscritos: stats.inscritos,
      Bajas: stats.bajas,
      Asistencia: stats.asistencias.length ? Math.round(stats.asistencias.reduce((a,b)=>a+b,0) / stats.asistencias.length) : 0
    })).sort((a, b) => b.Inscritos - a.Inscritos);

    // Format Area Stats
    const formattedAreaStats = Object.entries(areas).map(([name, stats]) => ({
      name: name.substring(0, 25),
      Inscritos: stats.inscritos,
      Bajas: stats.bajas,
      Asistencia: stats.asistencias.length ? Math.round(stats.asistencias.reduce((a,b)=>a+b,0) / stats.asistencias.length) : 0
    })).sort((a, b) => b.Inscritos - a.Inscritos);

    // Format Modality Stats
    const formattedModalityStats = Object.entries(modalities).map(([name, stats]) => ({
      name: name.substring(0, 25),
      Inscritos: stats.inscritos
    })).sort((a, b) => b.Inscritos - a.Inscritos);

    // Format Gender Stats
    const formattedGenderStats = Object.entries(genders).map(([name, stats]) => ({
      name: name.substring(0, 25),
      value: stats.inscritos
    })).sort((a, b) => b.value - a.value);

    // Format Schedule Stats
    const formattedScheduleStats = Object.entries(schedules).map(([name, stats]) => ({
      name: name.substring(0, 25),
      Inscritos: stats.inscritos
    })).sort((a, b) => b.Inscritos - a.Inscritos);

    // Format Instructor Stats
    const formattedInstructorStats = Object.entries(instructors).map(([name, stats]) => ({
      name: name.substring(0, 25),
      Inscritos: stats.inscritos
    })).sort((a, b) => b.Inscritos - a.Inscritos);

    const globalAvgAttendance = allAsistencias.length 
      ? Math.round(allAsistencias.reduce((a,b)=>a+b,0) / allAsistencias.length) 
      : 0;

    return { 
      groupStats: formattedGroupStats, 
      monthlyStats: formattedMonthlyStats,
      unitStats: formattedUnitStats,
      areaStats: formattedAreaStats,
      modalityStats: formattedModalityStats,
      genderStats: formattedGenderStats,
      scheduleStats: formattedScheduleStats,
      instructorStats: formattedInstructorStats,
      totalActivos: totalActivosCount,
      totalBajas: totalBajasCount,
      totalInscritos: totalInscritosCount,
      avgAttendance: globalAvgAttendance
    };
  }, [filteredData, config]);

  // Detailed Stats by Unit, Area, Group and Month
  const detailedStats = useMemo(() => {
    if (!filteredData.length || !config.groupCol || validationErrors.groupCol) return [];

    const statsMap = new Map<string, any>();

    filteredData.forEach(row => {
      const unidad = config.unitCol ? String(row[config.unitCol] || 'Sin Unidad').trim() : 'General';
      const area = config.areaCol ? String(row[config.areaCol] || 'Sin Área').trim() : 'General';
      const grupo = String(row[config.groupCol] || 'Sin actividad').trim();
      const mes = config.dateCol ? extractMonth(row[config.dateCol]) : 'General';
      const cveGrupo = config.groupCodeCol ? String(row[config.groupCodeCol] || '').trim() : '';
      
      const key = `${unidad}|${mes}|${area}|${grupo}|${cveGrupo}`;

      if (!statsMap.has(key)) {
        statsMap.set(key, {
          unidad,
          mes,
          area,
          grupo,
          cveGrupo,
          fechaInicio: config.startDateCol ? formatDate(row[config.startDateCol]) : '',
          fechaFin: config.endDateCol ? formatDate(row[config.endDateCol]) : '',
          meta: 0,
          inscritos: 0,
          activos: 0,
          bajas: 0,
          asistencias: [] as number[],
        });
      }

      const stat = statsMap.get(key);

      let bajasRow = 0;
      let inscritosRow = 0;
      let activosRow = 0;

      if (config.bajasCol) {
         bajasRow = parseNumber(row[config.bajasCol]) || 0;
      } else if (config.statusCol) {
        const statusVal = String(row[config.statusCol]).toLowerCase();
        if (statusVal.includes('baja') || statusVal.includes('inactivo') || statusVal === 'no') {
          bajasRow = 1;
        }
      }

      let hasInscritosCol = !!config.inscritosCol;
      let hasActivosCol = !!config.activosCol;

      let parsedInscritos = hasInscritosCol ? parseNumber(row[config.inscritosCol]) : null;
      let parsedActivos = hasActivosCol ? parseNumber(row[config.activosCol]) : null;

      if (hasInscritosCol && parsedInscritos === null) hasInscritosCol = false;
      if (hasActivosCol && parsedActivos === null) hasActivosCol = false;

      if (hasInscritosCol) inscritosRow = parsedInscritos || 0;
      if (hasActivosCol) activosRow = parsedActivos || 0;

      if (!hasInscritosCol && !hasActivosCol) {
         inscritosRow = 1;
         activosRow = inscritosRow - bajasRow;
      } else if (hasInscritosCol && !hasActivosCol) {
         activosRow = inscritosRow - bajasRow;
      } else if (!hasInscritosCol && hasActivosCol) {
         inscritosRow = activosRow + bajasRow;
      } else if (hasInscritosCol && hasActivosCol && !config.bajasCol && !config.statusCol) {
         bajasRow = inscritosRow - activosRow;
      }

      if (activosRow < 0) activosRow = 0;

      stat.inscritos += inscritosRow;
      stat.activos += activosRow;
      stat.bajas += bajasRow;

      if (config.goalCol) {
         const metaVal = Number(row[config.goalCol]);
         if (!isNaN(metaVal) && metaVal > stat.meta) {
             stat.meta = metaVal;
         }
      }

      let attVal: number | null = null;
      if (config.attendanceCol) {
        const rawAtt = row[config.attendanceCol];
        if (typeof rawAtt === 'number') {
          attVal = rawAtt <= 1 && rawAtt > 0 ? rawAtt * 100 : rawAtt;
        } else if (typeof rawAtt === 'string') {
          const parsed = parseFloat(rawAtt.replace('%', ''));
          if (!isNaN(parsed)) attVal = parsed;
        }
        if (attVal !== null) stat.asistencias.push(attVal);
      }
    });

    return Array.from(statsMap.values()).map(stat => {
       const avgAtt = stat.asistencias.length ? Math.round(stat.asistencias.reduce((a:number,b:number)=>a+b,0) / stat.asistencias.length) : null;
       const pctInscritos = stat.meta > 0 ? Math.round((stat.inscritos / stat.meta) * 100) : null;
       
       return {
           unidad: stat.unidad,
           mes: stat.mes,
           area: stat.area,
           grupo: stat.grupo,
           cveGrupo: stat.cveGrupo,
           fechaInicio: stat.fechaInicio,
           fechaFin: stat.fechaFin,
           meta: stat.meta,
           inscritos: stat.inscritos,
           activos: stat.activos,
           pctInscritos,
           bajas: stat.bajas,
           asistenciaPromedio: avgAtt,
           totalAsistencias: stat.asistencias.reduce((a, b) => a + b, 0),
       };
    }).sort((a, b) => a.unidad.localeCompare(b.unidad) || a.mes.localeCompare(b.mes) || a.grupo.localeCompare(b.grupo));
  }, [filteredData, config, validationErrors.groupCol]);

  const uniqueUnits = useMemo(() => {
    const units = new Set<string>();
    detailedStats.forEach(stat => units.add(stat.unidad));
    return Array.from(units).sort();
  }, [detailedStats]);

  const filteredDetailedStats = useMemo(() => {
    let result = detailedStats;
    if (selectedUnits.length > 0) {
      result = result.filter(stat => selectedUnits.includes(stat.unidad));
    }

    if (sortConfig !== null) {
      result = [...result].sort((a, b) => {
        let aValue = a[sortConfig.key as keyof typeof a];
        let bValue = b[sortConfig.key as keyof typeof b];

        if (sortConfig.key === 'mes') {
          aValue = getMonthSortValue(String(aValue));
          bValue = getMonthSortValue(String(bValue));
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return result;
  }, [detailedStats, selectedUnits, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const exportToCSV = () => {
    if (!filteredDetailedStats.length) return;

    // Define columns to export
    const headers = [
      'Unidad',
      'Mes',
      'Área',
      ...(config.groupCodeCol ? ['cve_grupo'] : []),
      'Actividad',
      ...(config.startDateCol ? ['Fecha de Inicio'] : []),
      ...(config.endDateCol ? ['Fecha Final'] : []),
      'Meta',
      'Inscritos',
      'Activos',
      ...(config.goalCol ? ['% Inscritos'] : []),
      'Bajas',
      'Asistencia (%)',
      'Asistencias (Total)'
    ];

    // Map data to CSV rows
    const csvRows = filteredDetailedStats.map(stat => {
      return [
        `"${stat.unidad}"`,
        `"${stat.mes}"`,
        `"${stat.area}"`,
        ...(config.groupCodeCol ? [`"${stat.cveGrupo}"`] : []),
        `"${stat.grupo}"`,
        ...(config.startDateCol ? [`"${stat.fechaInicio}"`] : []),
        ...(config.endDateCol ? [`"${stat.fechaFin}"`] : []),
        stat.meta,
        stat.inscritos,
        stat.activos,
        ...(config.goalCol ? [stat.pctInscritos !== null ? stat.pctInscritos : ''] : []),
        stat.bajas,
        stat.asistenciaPromedio !== null ? stat.asistenciaPromedio : '',
        stat.totalAsistencias
      ].join(',');
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...csvRows].join('\n');

    // Create a Blob and trigger download
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // Added BOM for Excel UTF-8 support
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'informe_detallado.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateAIReport = async () => {
    if (!filteredData.length) return;
    
    setLoading(true);
    setLoadingStep('Generando informe de resultados por mes...');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const rawDataForAI = aiSelectedColumns.length > 0 ? filteredData.map(row => {
        const filteredRow: any = {};
        aiSelectedColumns.forEach(col => {
          if (row[col] !== undefined) {
            filteredRow[col] = row[col];
          }
        });
        return filteredRow;
      }) : [];

      const prompt = `
        Actúa como un coordinador o director administrativo experto en análisis de datos.
        He procesado un archivo Excel ("${file?.name}") con datos de inscripciones, bajas y asistencias.
        
        FILTROS APLICADOS ACTUALMENTE:
        - Unidad / Sede: ${globalUnitFilter || 'Todas'}
        - Área / Departamento: ${globalAreaFilter || 'Todas'}
        - Horario: ${globalScheduleFilter || 'Todos'}

        ESTRUCTURA REQUERIDA DEL REPORTE:
        1. **Resumen Ejecutivo**: Panorama general de los resultados (considerando los filtros aplicados).
        2. **Análisis por Unidad, Mes y Actividad**: Organiza el reporte por "Unidad" (Sede/Departamento) y luego por "Mes". Para cada mes, detalla el nombre de sus actividades:
           - Compara los Inscritos vs la Meta (si hay meta).
           - Menciona las bajas y la asistencia.
           - Menciona las fechas de inicio y fin si están disponibles.
        ${aiSelectedColumns.length > 0 ? `3. **Análisis de Métricas Adicionales**: Analiza las siguientes columnas seleccionadas por el usuario para encontrar patrones, tendencias o insights relevantes: ${aiSelectedColumns.join(', ')}.` : ''}
        ${aiSelectedColumns.length > 0 ? '4' : '3'}. **Conclusiones y Plan de Acción**: Sugerencias basadas en los datos para reducir bajas y mejorar la asistencia.

        DATOS GLOBALES (Filtrados):
        - Total Inscritos: ${totalInscritos}
        - Total Activos: ${totalActivos}
        - Total Bajas: ${totalBajas}
        - Asistencia Promedio Global: ${avgAttendance}%
        
        DATOS DETALLADOS POR UNIDAD, MES, ÁREA Y ACTIVIDAD:
        ${JSON.stringify(detailedStats, null, 2)}

        ${aiSelectedColumns.length > 0 ? `DATOS CRUDOS (Columnas seleccionadas: ${aiSelectedColumns.join(', ')}):\n${JSON.stringify(rawDataForAI, null, 2)}` : ''}

        Por favor, usa un tono profesional, claro y estructurado con Markdown. No incluyas el JSON en tu respuesta.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      setAiReport(response.text || 'No se pudo generar el reporte.');
    } catch (err) {
      console.error('Error generating AI report:', err);
      setError('Hubo un error al generar el análisis de IA. Verifica tu API Key.');
    } finally {
      setLoading(false);
    }
  };

  const generateRawDataReport = async () => {
    if (!data.length) return;
    
    setLoadingRawAi(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const sampleData = data.slice(0, 100);
      const columnsList = columns.join(', ');

      const prompt = `
        Actúa como un analista de datos experto. Acabo de subir un archivo Excel con ${data.length} filas en total.
        Aquí tienes las columnas disponibles: ${columnsList}.
        
        Y aquí tienes una muestra de las primeras ${sampleData.length} filas de datos crudos:
        ${JSON.stringify(sampleData, null, 2)}

        Por favor, realiza un análisis exploratorio de estos datos tal como vienen, sin necesidad de configuraciones adicionales.
        1. ¿De qué trata este conjunto de datos? (Infiere el contexto basándote en las columnas y valores).
        2. ¿Cuáles son los hallazgos, patrones o tendencias más interesantes que puedes observar en esta muestra?
        3. ¿Hay alguna anomalía, dato curioso o área de oportunidad evidente?
        4. ¿Qué recomendaciones darías basándote únicamente en esta información?

        Usa formato Markdown, sé claro, conciso y profesional.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      setRawAiReport(response.text || 'No se pudo generar el análisis de los datos crudos.');
    } catch (err) {
      console.error('Error generating raw data report:', err);
      setError('Hubo un error al analizar los datos crudos con IA. Verifica tu API Key.');
    } finally {
      setLoadingRawAi(false);
    }
  };

  // Auto-trigger AI report when data is loaded and columns are auto-detected
  useEffect(() => {
    if (data.length > 0 && config.groupCol && !aiReport && !loading && !error) {
      generateAIReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]); // Only trigger once when data is loaded

  const resetApp = () => {
    setFile(null);
    setData([]);
    setColumns([]);
    setAiReport(null);
    setError(null);
    setConfig({ unitCol: '', groupCol: '', dateCol: '', statusCol: '', attendanceCol: '', goalCol: '', instructorCol: '', modalityCol: '', scheduleCol: '', genderCol: '', ageCol: '', areaCol: '', startDateCol: '', endDateCol: '', groupCodeCol: '', inscritosCol: '', activosCol: '', bajasCol: '' });
    setSelectedGroup(null);
  };

  // Calculate details for the selected group
  const selectedGroupDetails = useMemo(() => {
    if (!selectedGroup || !filteredData.length || !config.groupCol) return null;
    
    const rows = filteredData.filter(row => 
      String(row[config.groupCol] || 'Sin actividad').trim().substring(0, 25) === selectedGroup
    );
    
    let bajas = 0;
    let activos = 0;
    let inscritos = 0;
    let asistencias: number[] = [];
    
    rows.forEach(row => {
      let bajasRow = 0;
      let inscritosRow = 0;
      let activosRow = 0;

      if (config.bajasCol) {
         bajasRow = parseNumber(row[config.bajasCol]) || 0;
      } else if (config.statusCol) {
        const statusVal = String(row[config.statusCol]).toLowerCase();
        if (statusVal.includes('baja') || statusVal.includes('inactivo') || statusVal === 'no') {
          bajasRow = 1;
        }
      }

      let hasInscritosCol = !!config.inscritosCol;
      let hasActivosCol = !!config.activosCol;

      let parsedInscritos = hasInscritosCol ? parseNumber(row[config.inscritosCol]) : null;
      let parsedActivos = hasActivosCol ? parseNumber(row[config.activosCol]) : null;

      if (hasInscritosCol && parsedInscritos === null) hasInscritosCol = false;
      if (hasActivosCol && parsedActivos === null) hasActivosCol = false;

      if (hasInscritosCol) inscritosRow = parsedInscritos || 0;
      if (hasActivosCol) activosRow = parsedActivos || 0;

      if (!hasInscritosCol && !hasActivosCol) {
         inscritosRow = 1;
         activosRow = inscritosRow - bajasRow;
      } else if (hasInscritosCol && !hasActivosCol) {
         activosRow = inscritosRow - bajasRow;
      } else if (!hasInscritosCol && hasActivosCol) {
         inscritosRow = activosRow + bajasRow;
      } else if (hasInscritosCol && hasActivosCol && !config.bajasCol && !config.statusCol) {
         bajasRow = inscritosRow - activosRow;
      }

      if (activosRow < 0) activosRow = 0;

      bajas += bajasRow;
      activos += activosRow;
      inscritos += inscritosRow;

      if (config.attendanceCol) {
        const rawAtt = row[config.attendanceCol];
        let attendanceVal: number | null = null;
        if (typeof rawAtt === 'number') {
          attendanceVal = rawAtt <= 1 && rawAtt > 0 ? rawAtt * 100 : rawAtt;
        } else if (typeof rawAtt === 'string') {
          const parsed = parseFloat(rawAtt.replace('%', ''));
          if (!isNaN(parsed)) attendanceVal = parsed;
        }
        if (attendanceVal !== null) asistencias.push(attendanceVal);
      }
    });
    
    const avgAtt = asistencias.length ? Math.round(asistencias.reduce((a,b)=>a+b,0) / asistencias.length) : null;

    return {
      name: selectedGroup,
      rows,
      inscritos,
      activos,
      bajas,
      avgAtt
    };
  }, [filteredData, config, selectedGroup]);

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
              <FileSpreadsheet size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Dashboard de Actividades
              </h1>
              <p className="text-sm text-gray-500">
                Análisis de inscritos, bajas y asistencias por mes
              </p>
            </div>
          </div>
          {data.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={generateAIReport}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Sparkles size={16} />
                Regenerar Reporte
              </button>
              <button
                onClick={resetApp}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RefreshCw size={16} />
                Nuevo Archivo
              </button>
            </div>
          )}
        </header>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Upload State */}
        {!data.length && !loading && (
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-3xl p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition-all group relative">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-4 pointer-events-none">
              <div className="bg-gray-100 p-4 rounded-full group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors text-gray-400">
                <UploadCloud size={40} />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-700">
                  Haz clic o arrastra tu archivo Excel aquí
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Soporta .xlsx, .xls y .csv
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-3xl p-16 flex flex-col items-center justify-center text-center shadow-sm border border-gray-100">
            <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
            <h3 className="text-xl font-medium text-gray-800">Procesando...</h3>
            <p className="text-gray-500 mt-2">{loadingStep}</p>
          </div>
        )}

        {/* Dashboard State */}
        {data.length > 0 && !loading && (
          <div className="space-y-6">
            
            {/* Raw Data Analysis Button & Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Análisis Rápido de Datos Crudos</h2>
                  <p className="text-sm text-gray-500">Deja que la IA analice el archivo tal como viene, sin configurar columnas.</p>
                </div>
                <button
                  onClick={generateRawDataReport}
                  disabled={loadingRawAi}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {loadingRawAi ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  Analizar Datos Crudos
                </button>
              </div>
              
              {rawAiReport && (
                <div className="mt-6 p-5 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="text-indigo-600" size={20} />
                    <h3 className="text-md font-semibold text-indigo-900">Resultados del Análisis Crudo</h3>
                  </div>
                  <div className="prose prose-sm prose-indigo max-w-none">
                    <Markdown>{rawAiReport}</Markdown>
                  </div>
                </div>
              )}
            </div>

            {/* Configuration Panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="text-gray-500" size={20} />
                <h2 className="text-lg font-semibold text-gray-800">Configuración de Columnas</h2>
              </div>
              <div className="space-y-6">
                {/* Identificadores Principales */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Identificadores Principales</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Nombre de la Actividad <ColumnInfoIcon columnName={config.groupCol} data={data} /></label>
                      <select value={config.groupCol} onChange={e => setConfig({...config, groupCol: e.target.value})} className={`w-full bg-gray-50 border text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500 ${validationErrors.groupCol ? 'border-red-500 text-red-700' : 'border-gray-200'}`}>
                        <option value="">Seleccionar...</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {validationErrors.groupCol && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {validationErrors.groupCol}</p>}
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Clave del Grupo <ColumnInfoIcon columnName={config.groupCodeCol} data={data} /></label>
                      <select value={config.groupCodeCol} onChange={e => setConfig({...config, groupCodeCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Unidad / Sede <ColumnInfoIcon columnName={config.unitCol} data={data} /></label>
                      <select value={config.unitCol} onChange={e => setConfig({...config, unitCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Área / Departamento <ColumnInfoIcon columnName={config.areaCol} data={data} /></label>
                      <select value={config.areaCol} onChange={e => setConfig({...config, areaCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Métricas y Estado */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Métricas y Estado</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Total Inscritos (Num) <ColumnInfoIcon columnName={config.inscritosCol} data={data} /></label>
                      <select value={config.inscritosCol} onChange={e => setConfig({...config, inscritosCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Total Activos (Num) <ColumnInfoIcon columnName={config.activosCol} data={data} /></label>
                      <select value={config.activosCol} onChange={e => setConfig({...config, activosCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Total Bajas (Num) <ColumnInfoIcon columnName={config.bajasCol} data={data} /></label>
                      <select value={config.bajasCol} onChange={e => setConfig({...config, bajasCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Estado (Texto) <ColumnInfoIcon columnName={config.statusCol} data={data} /></label>
                      <select value={config.statusCol} onChange={e => setConfig({...config, statusCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Asistencia (%) <ColumnInfoIcon columnName={config.attendanceCol} data={data} /></label>
                      <select value={config.attendanceCol} onChange={e => setConfig({...config, attendanceCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Meta / Cupo <ColumnInfoIcon columnName={config.goalCol} data={data} /></label>
                      <select value={config.goalCol} onChange={e => setConfig({...config, goalCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Fechas y Tiempos */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Fechas y Tiempos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Mes / Fecha <ColumnInfoIcon columnName={config.dateCol} data={data} /></label>
                      <select value={config.dateCol} onChange={e => setConfig({...config, dateCol: e.target.value})} className={`w-full bg-gray-50 border text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500 ${validationErrors.dateCol ? 'border-red-500 text-red-700' : 'border-gray-200'}`}>
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {validationErrors.dateCol && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {validationErrors.dateCol}</p>}
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Fecha de Inicio <ColumnInfoIcon columnName={config.startDateCol} data={data} /></label>
                      <select value={config.startDateCol} onChange={e => setConfig({...config, startDateCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Fecha Final <ColumnInfoIcon columnName={config.endDateCol} data={data} /></label>
                      <select value={config.endDateCol} onChange={e => setConfig({...config, endDateCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Horario <ColumnInfoIcon columnName={config.scheduleCol} data={data} /></label>
                      <select value={config.scheduleCol} onChange={e => setConfig({...config, scheduleCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Detalles Adicionales */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">Detalles Adicionales</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Instructor <ColumnInfoIcon columnName={config.instructorCol} data={data} /></label>
                      <select value={config.instructorCol} onChange={e => setConfig({...config, instructorCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Modalidad <ColumnInfoIcon columnName={config.modalityCol} data={data} /></label>
                      <select value={config.modalityCol} onChange={e => setConfig({...config, modalityCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Género <ColumnInfoIcon columnName={config.genderCol} data={data} /></label>
                      <select value={config.genderCol} onChange={e => setConfig({...config, genderCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center text-xs font-medium text-gray-500 mb-1">Edad <ColumnInfoIcon columnName={config.ageCol} data={data} /></label>
                      <select value={config.ageCol} onChange={e => setConfig({...config, ageCol: e.target.value})} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Ninguna --</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="text-purple-500" size={18} />
                  <h3 className="text-sm font-semibold text-gray-800">Columnas para Análisis de IA</h3>
                </div>
                <p className="text-xs text-gray-500 mb-3">Selecciona las columnas adicionales que deseas enviar a la IA para un análisis más profundo.</p>
                <div className="flex flex-wrap gap-2">
                  {columns.map(col => (
                    <button
                      key={col}
                      onClick={() => {
                        if (aiSelectedColumns.includes(col)) {
                          setAiSelectedColumns(prev => prev.filter(c => c !== col));
                        } else {
                          setAiSelectedColumns(prev => [...prev, col]);
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${
                        aiSelectedColumns.includes(col) 
                          ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' 
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Global Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="text-gray-500" size={20} />
                <h2 className="text-lg font-semibold text-gray-800">Filtros Globales</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Filtrar por Unidad / Sede</label>
                  <select 
                    value={globalUnitFilter} 
                    onChange={e => {
                      setGlobalUnitFilter(e.target.value);
                      setGlobalAreaFilter(''); // Reset area filter when unit changes
                      setGlobalScheduleFilter(''); // Reset schedule filter
                    }} 
                    className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={!config.unitCol}
                  >
                    <option value="">Todas las Unidades</option>
                    {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Filtrar por Área / Departamento</label>
                  <select 
                    value={globalAreaFilter} 
                    onChange={e => {
                      setGlobalAreaFilter(e.target.value);
                      setGlobalScheduleFilter(''); // Reset schedule filter
                    }} 
                    className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={!config.areaCol}
                  >
                    <option value="">Todas las Áreas</option>
                    {availableAreas.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Filtrar por Horario</label>
                  <select 
                    value={globalScheduleFilter} 
                    onChange={e => setGlobalScheduleFilter(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={!config.scheduleCol}
                  >
                    <option value="">Todos los Horarios</option>
                    {availableSchedules.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="bg-blue-50 p-3 rounded-full text-blue-600"><Users size={24} /></div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Inscritos</p>
                  <p className="text-2xl font-bold text-gray-900">{totalInscritos}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="bg-green-50 p-3 rounded-full text-green-600"><TrendingUp size={24} /></div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Activos</p>
                  <p className="text-2xl font-bold text-gray-900">{totalActivos}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="bg-red-50 p-3 rounded-full text-red-600"><TrendingDown size={24} /></div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Bajas</p>
                  <p className="text-2xl font-bold text-gray-900">{totalBajas}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="bg-emerald-50 p-3 rounded-full text-emerald-600"><CheckCircle2 size={24} /></div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Asistencia Promedio</p>
                  <p className="text-2xl font-bold text-gray-900">{config.attendanceCol ? `${avgAttendance}%` : 'N/A'}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="bg-purple-50 p-3 rounded-full text-purple-600"><CalendarDays size={24} /></div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Actividades Activas</p>
                  <p className="text-2xl font-bold text-gray-900">{groupStats.length}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Chart: Inscritos vs Bajas por Actividad */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">Inscritos vs Bajas por Actividad</h2>
                  <p className="text-xs text-gray-500">Haz clic en una barra para ver el detalle de alumnos.</p>
                </div>
                <div className="h-80">
                  {validationErrors.groupCol ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 p-6 text-center">
                      <AlertCircle className="mb-2 text-red-400" size={32} />
                      <p className="text-sm font-medium text-gray-700">Gráfica deshabilitada</p>
                      <p className="text-xs mt-1">La columna seleccionada para Actividad contiene errores: {validationErrors.groupCol}</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={groupStats.slice(0, 10)} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorInscritos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          </linearGradient>
                          <linearGradient id="colorBajas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.2}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-45} textAnchor="end" height={80} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Legend />
                        <Bar dataKey="Inscritos" fill="url(#colorInscritos)" radius={[4, 4, 0, 0]} onClick={(data) => setSelectedGroup(data.name)} cursor="pointer" />
                        {(config.statusCol || config.bajasCol) && <Bar dataKey="Bajas" fill="url(#colorBajas)" radius={[4, 4, 0, 0]} onClick={(data) => setSelectedGroup(data.name)} cursor="pointer" />}
                        {config.goalCol && <Line type="monotone" dataKey="Meta" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Chart: Evolución Mensual */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Evolución Mensual</h2>
                {validationErrors.dateCol ? (
                  <div className="h-80 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 p-6 text-center">
                    <AlertCircle className="mb-2 text-red-400" size={32} />
                    <p className="text-sm font-medium text-gray-700">Gráfica deshabilitada</p>
                    <p className="text-xs mt-1">La columna seleccionada para Fecha contiene errores: {validationErrors.dateCol}</p>
                  </div>
                ) : config.dateCol ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorEvolucion" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                        {config.attendanceCol && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[0, 100]} />}
                        <Tooltip cursor={{ stroke: '#d1d5db', strokeWidth: 2 }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Legend />
                        <Area yAxisId="left" type="monotone" dataKey="Inscritos" stroke="#3b82f6" fill="url(#colorEvolucion)" strokeWidth={3} activeDot={{ r: 8 }} />
                        {(config.statusCol || config.bajasCol) && <Line yAxisId="left" type="monotone" dataKey="Bajas" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />}
                        {config.attendanceCol && <Line yAxisId="right" type="monotone" dataKey="Asistencia" name="Asistencia %" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-gray-400 text-sm">
                    Selecciona una columna de Mes/Fecha en la configuración para ver esta gráfica.
                  </div>
                )}
              </div>

              {/* Chart: Inscritos por Unidad */}
              {config.unitCol && unitStats.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Inscritos por Unidad / Sede</h2>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={unitStats.slice(0, 10)} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} layout="vertical">
                        <defs>
                          <linearGradient id="colorUnit" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                        <XAxis type="number" xAxisId="bottom" tick={{ fontSize: 12 }} />
                        {config.attendanceCol && <XAxis type="number" xAxisId="top" orientation="top" domain={[0, 100]} tick={{ fontSize: 12 }} />}
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Legend />
                        <Bar dataKey="Inscritos" xAxisId="bottom" fill="url(#colorUnit)" radius={[0, 4, 4, 0]} />
                        {(config.statusCol || config.bajasCol) && <Bar dataKey="Bajas" xAxisId="bottom" fill="#ef4444" radius={[0, 4, 4, 0]} />}
                        {config.attendanceCol && <Line dataKey="Asistencia" xAxisId="top" type="monotone" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Chart: Inscritos por Área */}
              {config.areaCol && areaStats.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Inscritos por Área / Departamento</h2>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={areaStats.slice(0, 10)} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} layout="vertical">
                        <defs>
                          <linearGradient id="colorArea" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Legend />
                        <Bar dataKey="Inscritos" fill="url(#colorArea)" radius={[0, 4, 4, 0]} />
                        {(config.statusCol || config.bajasCol) && <Bar dataKey="Bajas" fill="#ef4444" radius={[0, 4, 4, 0]} />}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Chart: Inscritos por Instructor */}
              {config.instructorCol && instructorStats.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Inscritos por Instructor</h2>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={instructorStats.slice(0, 10)} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} layout="vertical">
                        <defs>
                          <linearGradient id="colorInstructor" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Legend />
                        <Bar dataKey="Inscritos" fill="url(#colorInstructor)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Chart: Inscritos por Modalidad */}
              {config.modalityCol && modalityStats.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Inscritos por Modalidad</h2>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={modalityStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorModality" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Legend />
                        <Bar dataKey="Inscritos" fill="url(#colorModality)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Chart: Distribución por Género */}
              {config.genderCol && genderStats.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Distribución por Género</h2>
                  <div className="h-80 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={genderStats}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {genderStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#ec4899', '#8b5cf6', '#10b981'][index % 4]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Chart: Inscritos por Horario */}
              {config.scheduleCol && scheduleStats.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Inscritos por Horario</h2>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scheduleStats.slice(0, 10)} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} layout="vertical">
                        <defs>
                          <linearGradient id="colorSchedule" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Legend />
                        <Bar dataKey="Inscritos" fill="url(#colorSchedule)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Detailed Table by Unit and Group */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="text-blue-600" size={20} />
                    <h2 className="text-lg font-semibold text-gray-800">Informe Detallado por Unidad, Área y Actividad (Mensual)</h2>
                  </div>
                  <button
                    onClick={exportToCSV}
                    disabled={filteredDetailedStats.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={16} />
                    Exportar CSV
                  </button>
                </div>
                {validationErrors.groupCol ? (
                  <div className="flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 p-10 text-center">
                    <AlertCircle className="mb-2 text-red-400" size={32} />
                    <p className="text-sm font-medium text-gray-700">Tabla deshabilitada</p>
                    <p className="text-xs mt-1">Corrige los errores en la columna de Actividad para ver el detalle.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {uniqueUnits.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedUnits([])}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${selectedUnits.length === 0 ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
                        >
                          Todas las Unidades
                        </button>
                        {uniqueUnits.map(unit => (
                          <button
                            key={unit}
                            onClick={() => {
                              if (selectedUnits.includes(unit)) {
                                setSelectedUnits(selectedUnits.filter(u => u !== unit));
                              } else {
                                setSelectedUnits([...selectedUnits, unit]);
                              }
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${selectedUnits.includes(unit) ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'}`}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('unidad')}>
                              <div className="flex items-center gap-1">Unidad {sortConfig?.key === 'unidad' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>
                            <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('mes')}>
                              <div className="flex items-center gap-1">Mes {sortConfig?.key === 'mes' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>
                            <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('area')}>
                              <div className="flex items-center gap-1">Área {sortConfig?.key === 'area' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>
                            {config.groupCodeCol && <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('cveGrupo')}>
                              <div className="flex items-center gap-1">cve_grupo {sortConfig?.key === 'cveGrupo' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>}
                            <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('grupo')}>
                              <div className="flex items-center gap-1">Actividad {sortConfig?.key === 'grupo' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>
                            {config.startDateCol && <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('fechaInicio')}>
                              <div className="flex items-center gap-1">Fecha de Inicio {sortConfig?.key === 'fechaInicio' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>}
                            {config.endDateCol && <th className="px-4 py-3 font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleSort('fechaFin')}>
                              <div className="flex items-center gap-1">Fecha Final {sortConfig?.key === 'fechaFin' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>}
                            <th className="px-4 py-3 font-medium text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort('meta')}>
                              <div className="flex items-center justify-center gap-1">Meta {sortConfig?.key === 'meta' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>
                            <th className="px-4 py-3 font-medium text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort('inscritos')}>
                              <div className="flex items-center justify-center gap-1">Inscritos {sortConfig?.key === 'inscritos' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>
                            <th className="px-4 py-3 font-medium text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort('activos')}>
                              <div className="flex items-center justify-center gap-1">Activos {sortConfig?.key === 'activos' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>
                            {config.goalCol && <th className="px-4 py-3 font-medium text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort('pctInscritos')}>
                              <div className="flex items-center justify-center gap-1">% Inscritos {sortConfig?.key === 'pctInscritos' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>}
                            <th className="px-4 py-3 font-medium text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort('bajas')}>
                              <div className="flex items-center justify-center gap-1">Bajas {sortConfig?.key === 'bajas' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>
                            <th className="px-4 py-3 font-medium text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort('asistenciaPromedio')}>
                              <div className="flex items-center justify-center gap-1">Asistencia (%) {sortConfig?.key === 'asistenciaPromedio' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>
                            <th className="px-4 py-3 font-medium text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort('totalAsistencias')}>
                              <div className="flex items-center justify-center gap-1">Asistencias (Total) {sortConfig?.key === 'totalAsistencias' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/>) : <ArrowUpDown size={14} className="text-gray-300"/>}</div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredDetailedStats.map((stat, i) => (
                            <tr key={i} className="bg-white hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 font-medium text-gray-900">{stat.unidad}</td>
                              <td className="px-4 py-3 text-gray-700">{stat.mes}</td>
                              <td className="px-4 py-3 text-gray-700">{stat.area}</td>
                              {config.groupCodeCol && <td className="px-4 py-3 text-gray-700">{stat.cveGrupo}</td>}
                              <td className="px-4 py-3 text-gray-700">{stat.grupo}</td>
                              {config.startDateCol && <td className="px-4 py-3 text-gray-500 text-xs">{stat.fechaInicio}</td>}
                              {config.endDateCol && <td className="px-4 py-3 text-gray-500 text-xs">{stat.fechaFin}</td>}
                              <td className="px-4 py-3 text-center text-gray-600">{stat.meta > 0 ? stat.meta : '-'}</td>
                              <td className="px-4 py-3 text-center font-medium text-blue-600">{stat.inscritos}</td>
                              <td className="px-4 py-3 text-center font-medium text-green-600">{stat.activos}</td>
                              {config.goalCol && <td className="px-4 py-3 text-center font-medium text-blue-600">{stat.pctInscritos !== null ? `${stat.pctInscritos}%` : '-'}</td>}
                              <td className="px-4 py-3 text-center text-red-600">{stat.bajas}</td>
                              <td className="px-4 py-3 text-center text-green-600">{stat.asistenciaPromedio !== null ? `${stat.asistenciaPromedio}%` : '-'}</td>
                              <td className="px-4 py-3 text-center text-gray-600">{stat.totalAsistencias}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Report Full Width */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="border-b border-gray-100 bg-gray-50/50 p-5 flex items-center gap-2">
                  <Sparkles className="text-amber-500" size={20} />
                  <h2 className="text-lg font-semibold text-gray-800">
                    Informe de Resultados por Mes (IA)
                  </h2>
                </div>
                <div className="p-6 md:p-8 prose prose-blue max-w-none prose-headings:font-semibold prose-a:text-blue-600">
                  {aiReport ? (
                    <div className="markdown-body">
                      <Markdown>{aiReport}</Markdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                      <p>El reporte se generará automáticamente.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Modal for Group Details */}
        {selectedGroupDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Detalles de la Actividad: <span className="text-blue-600">{selectedGroupDetails.name}</span>
                  </h2>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">
                      {selectedGroupDetails.inscritos} Inscritos
                    </span>
                    <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-medium">
                      {selectedGroupDetails.activos} Activos
                    </span>
                    {(config.statusCol || config.bajasCol) && (
                      <span className="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-medium">
                        {selectedGroupDetails.bajas} Bajas
                      </span>
                    )}
                    {selectedGroupDetails.avgAtt !== null && (
                      <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-medium">
                        {selectedGroupDetails.avgAtt}% Asistencia
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedGroup(null)} 
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-0 overflow-auto flex-1">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100 sticky top-0 shadow-sm">
                    <tr>
                      {columns.map((col, i) => (
                        <th key={i} className="px-6 py-4 font-medium whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedGroupDetails.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="bg-white hover:bg-blue-50/50 transition-colors">
                        {columns.map((col, colIndex) => {
                          const val = row[col];
                          // Highlight dropouts if this is the status column
                          const isStatusCol = col === config.statusCol;
                          const isBaja = isStatusCol && String(val).toLowerCase().includes('baja');
                          
                          return (
                            <td key={colIndex} className={`px-6 py-3 whitespace-nowrap ${isBaja ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                              {val !== null && val !== undefined ? String(val) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

