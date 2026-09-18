import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ArrowDownLeft,
  FileText,
  Boxes,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  IndianRupee,
  PlusCircle,
  ExternalLink
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function Dashboard() {
  const { user, isOwner } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [pendingMaterials, setPendingMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/dashboard-stats');
      if (res.data.success) {
        setStats(res.data.stats);
        setRecentActivity(res.data.recentActivity || []);
        setPendingMaterials(res.data.pendingMaterials || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  // Chart data configuration
  const chartLabels = recentActivity.map((a) => {
    const d = new Date(a.date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });

  const chartData = {
    labels: chartLabels.length ? chartLabels : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today'],
    datasets: [
      {
        label: 'Inward Qty (Units)',
        data: recentActivity.map((a) => a.inward_qty),
        backgroundColor: 'rgba(59, 130, 246, 0.85)',
        borderRadius: 4,
      },
      {
        label: 'Outward Qty (Units)',
        data: recentActivity.map((a) => a.outward_qty),
        backgroundColor: 'rgba(245, 158, 11, 0.85)',
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Quick Action Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs uppercase tracking-wider font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
              {isOwner ? 'Executive Dashboard' : 'Operations Terminal'}
            </span>
            <span className="text-xs text-slate-400">| Today: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          <h1 className="text-2xl font-black mt-1">
            Welcome back, {user?.full_name}!
          </h1>
          <p className="text-slate-300 text-sm mt-0.5">
            Shri.Bharathi & Co. • Job Work & Stock Register Control
          </p>
        </div>

        {/* Quick buttons */}
        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/inward"
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ New Inward Entry</span>
          </Link>
          <Link
            to="/outward"
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold shadow transition"
          >
            <FileText className="w-4 h-4" />
            <span>+ New Outward Challan</span>
          </Link>
          <Link
            to="/stock"
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition"
          >
            <Boxes className="w-4 h-4" />
            <span>View Stock</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid (Owner gets full financials & counts, Worker gets counts) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isOwner && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
              <span>Total Customers</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-slate-800 mt-2">
              {stats?.totalCustomers || 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">Active client accounts</div>
          </div>
        )}

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Inward Receipts</span>
            <ArrowDownLeft className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2">
            {stats?.totalInwardEntries || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Total {stats?.totalInwardQty || 0} units received
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Outward Challans</span>
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2">
            {stats?.totalOutwardChallans || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Total {stats?.totalOutwardQty || 0} units dispatched
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Current Stock Pending</span>
            <Boxes className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">
            {stats?.currentStockPending || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Units currently in factory
          </div>
        </div>

        {/* Today's Stats Cards */}
        <div className="bg-blue-50/70 p-5 rounded-2xl border border-blue-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-800 text-xs font-bold uppercase tracking-wider">
            <span>Today's Inward</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 mt-2">
            {stats?.todayInwardEntries || 0} <span className="text-xs font-normal text-blue-700">entries</span>
          </div>
          <div className="text-xs text-blue-700 mt-1">
            {stats?.todayInwardQty || 0} units received today
          </div>
        </div>

        <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-900 text-xs font-bold uppercase tracking-wider">
            <span>Today's Outward</span>
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-950 mt-2">
            {stats?.todayOutwardChallans || 0} <span className="text-xs font-normal text-amber-800">challans</span>
          </div>
          <div className="text-xs text-amber-800 mt-1">
            {stats?.todayOutwardQty || 0} units dispatched today
          </div>
        </div>

        {isOwner && (
          <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-xs">
            <div className="flex items-center justify-between text-emerald-800 text-xs font-bold uppercase tracking-wider">
              <span>Today's Outward Value</span>
              <IndianRupee className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-900 mt-2">
              ₹{(stats?.todayOutwardVal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-emerald-700 mt-1">
              Inclusive of 9% GST
            </div>
          </div>
        )}

        <div className="bg-purple-50/70 p-5 rounded-2xl border border-purple-200 shadow-xs">
          <div className="flex items-center justify-between text-purple-800 text-xs font-bold uppercase tracking-wider">
            <span>Pending Tasks</span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-900 mt-2">
            {stats?.totalPendingTasks || 0}
          </div>
          <div className="text-xs text-purple-700 mt-1">
            Active consignments needing dispatch
          </div>
        </div>
      </div>

      {/* Mid section: Chart & Pending Tasks Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart (Inward vs Outward) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Inward vs Outward Activity</h2>
              <p className="text-xs text-slate-500">Materials received vs dispatched over the last 7 days</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
              Daily Units
            </span>
          </div>
          <div className="h-64 w-full">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Priority Pending Materials Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900">Pending Consignments</h2>
              <Link
                to="/reports?tab=pending"
                className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center space-x-1"
              >
                <span>View all</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Materials in factory requiring outward dispatch
            </p>

            {pendingMaterials.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                <span>All inward materials have been cleared!</span>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingMaterials.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        {item.item_description}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.company_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-xs rounded-md">
                        {item.pending_qty} {item.uom}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        of {item.inward_qty} received
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              to="/outward"
              className="w-full py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-bold text-center block transition"
            >
              Create Outward Challan for Pending Goods
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
