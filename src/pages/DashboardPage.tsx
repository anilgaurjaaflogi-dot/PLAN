import React, { useMemo } from 'react';
import {
  Ship,
  Car,
  Scale,
  Maximize2,
  TrendingUp,
  FolderKanban,
  ShieldCheck,
  ArrowUpRight,
  Upload,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { useApp } from '../context/AppContext';

interface DashboardPageProps {
  onOpenImport: () => void;
  onOpenNewContainer: () => void;
}

const COLORS = ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#0369a1', '#075985'];
const FUEL_COLORS: Record<string, string> = {
  D: '#d97706', // Diesel (Amber)
  G: '#2563eb', // Petrol (Blue)
  H: '#16a34a', // Hybrid (Green)
  E: '#9333ea', // EV (Purple)
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ onOpenImport, onOpenNewContainer }) => {
  const { containers, setActivePage, settings, setPrintContainerData, transferContainerToBuilder } = useApp();

  // Aggregate statistics
  const totalContainers = containers.length;
  const totalVehicles = containers.reduce((acc, c) => acc + (c.vehicleCount || c.vehicles?.length || 0), 0);

  const avgCbm = totalContainers > 0
    ? (containers.reduce((acc, c) => acc + c.totalCbm, 0) / totalContainers).toFixed(2)
    : '0';

  const avgWeight = totalContainers > 0
    ? Math.round(containers.reduce((acc, c) => acc + c.totalWeight, 0) / totalContainers)
    : 0;

  const totalValue = containers.reduce((acc, c) => acc + (c.totalPrice || 0), 0);

  // Top 10 Models
  const topModelsData = useMemo(() => {
    const counts: Record<string, number> = {};
    containers.forEach((c) => {
      c.vehicles.forEach((v) => {
        const m = v.model?.toUpperCase().trim();
        if (m) counts[m] = (counts[m] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [containers]);

  // Top Chassis Prefixes
  const topPrefixesData = useMemo(() => {
    const counts: Record<string, number> = {};
    containers.forEach((c) => {
      c.vehicles.forEach((v) => {
        const p = v.chassisPrefix?.toUpperCase().trim();
        if (p) counts[p] = (counts[p] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [containers]);

  // Fuel Type Breakdown
  const fuelData = useMemo(() => {
    const counts: Record<string, number> = { D: 0, G: 0, H: 0, E: 0 };
    containers.forEach((c) => {
      c.vehicles.forEach((v) => {
        const f = v.fuel?.toUpperCase() || 'D';
        counts[f] = (counts[f] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => ({
        name: key === 'D' ? 'Diesel (D)' : key === 'G' ? 'Petrol (G)' : key === 'H' ? 'Hybrid (H)' : key,
        value,
        key,
      }));
  }, [containers]);

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Container Logistics Overview</span>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">
              40HC Export
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {settings.showHinglish
              ? 'Mukhya Dashbord • Purane container plans, models aur CBM aakde'
              : 'Japanese used vehicle container fleet analytics and historical manifests'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenImport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Plans</span>
          </button>
          <button
            onClick={() => setActivePage('builder')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Check & Plan from Old Plans</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards (Tabular Figures & Clean Surfaces) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
            <span>Stored Containers</span>
            <Ship className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {totalContainers.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {settings.showHinglish ? 'Kul Container Plans' : 'Historical container manifests'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
            <span>Total Vehicles</span>
            <Car className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {totalVehicles.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {settings.showHinglish ? 'Export ki gayi gaadiyan' : 'Indexed across all plans'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
            <span>Avg CBM / Container</span>
            <Maximize2 className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-sky-600 dark:text-sky-400 tabular-nums">
            {avgCbm} <span className="text-xs font-sans text-slate-500 font-normal">m³</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {settings.showHinglish ? 'Ausat aayatan (Target ~72-75 m³)' : 'Volume efficiency index'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-2">
            <span>Avg Cargo Weight</span>
            <Scale className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {avgWeight.toLocaleString()} <span className="text-xs font-sans text-slate-500 font-normal">kg</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {settings.showHinglish ? 'Ausat wajan prat container' : 'Excluding tare container weight'}
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 8 Models Chart */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Top Export Vehicle Models
              </h3>
              <p className="text-xs text-slate-500">
                {settings.showHinglish ? 'Sabse zyada pack hone wale models' : 'Most frequent vehicle models loaded into containers'}
              </p>
            </div>
            <button
              onClick={() => setActivePage('search')}
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>Explore All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            {topModelsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topModelsData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {topModelsData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No model data yet. Import Excel plans to see chart.
              </div>
            )}
          </div>
        </div>

        {/* Fuel Breakdown Pie Chart */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="mb-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Engine Fuel Distribution
            </h3>
            <p className="text-xs text-slate-500">
              {settings.showHinglish ? 'Diesel aur Petrol anupaat' : 'Diesel (commercial) vs Gasoline (passenger)'}
            </p>
          </div>

          <div className="h-44 w-full">
            {fuelData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fuelData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                  >
                    {fuelData.map((entry) => (
                      <Cell key={`cell-${entry.key}`} fill={FUEL_COLORS[entry.key] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No fuel data.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            {fuelData.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: FUEL_COLORS[f.key] || '#94a3b8' }} />
                <span className="text-slate-600 dark:text-slate-400 truncate">{f.name}:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 ml-auto tabular-nums">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Chassis Prefixes & Recent Plans Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Chassis Prefixes */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Top Chassis Prefixes
              </h3>
              <p className="text-xs text-slate-500">
                {settings.showHinglish ? 'Mukhya chassis code (FE315, KDH206, NPR58)' : 'Crucial for accurate dimensions & parts verification'}
              </p>
            </div>
            <button
              onClick={() => setActivePage('search')}
              className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>Search Prefixes</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {topPrefixesData.map((p, idx) => {
              const maxCount = topPrefixesData[0]?.count || 1;
              const percent = Math.round((p.count / maxCount) * 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                      {p.name}
                    </span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {p.count} units
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Containers List */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Recent Container Plans
                </h3>
                <p className="text-xs text-slate-500">
                  {settings.showHinglish ? 'Hali me add kiye gaye plans' : 'Last loaded shipping manifests'}
                </p>
              </div>
              <button
                onClick={() => setActivePage('library')}
                className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <span>View All ({totalContainers})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {containers.slice(0, 4).map((c) => (
                <div
                  key={c.id || c.containerNo}
                  className="p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 hover:border-sky-300 dark:hover:border-sky-800 transition-colors flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-mono font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                      <span>{c.containerNo}</span>
                      <span className="text-[10px] text-slate-400 font-sans font-normal">
                        • {c.sealOrBlNo || 'No Seal'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                      {c.models.join(', ') || 'No vehicles recorded'}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {c.totalCbm.toFixed(2)} m³
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                      {c.totalWeight.toLocaleString()} kg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <button
              onClick={onOpenNewContainer}
              className="text-sky-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer"
            >
              + Add Container Plan Manually
            </button>
            <button
              onClick={() => setActivePage('builder')}
              className="px-3 py-1.5 bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-md font-semibold hover:bg-sky-100 cursor-pointer"
            >
              Plan Next Container →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
