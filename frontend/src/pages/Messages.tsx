import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/index.js";
import {
  MessageSquare,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";

interface MessageLog {
  id: number;
  broadcastId: number;
  broadcastTitle: string;
  subscriberId: number;
  subscriberName: string | null;
  phoneNumber: string;
  status: string;
  createdAt: string;
}

interface BroadcastOption {
  id: number;
  title: string;
}

export const Messages: React.FC = () => {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination / Filter states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [broadcastFilter, setBroadcastFilter] = useState("");
  
  // Options lists
  const [broadcasts, setBroadcasts] = useState<BroadcastOption[]>([]);

  // Fetch broadcasts options for select filter
  useEffect(() => {
    const fetchBroadcastOptions = async () => {
      try {
        const response = await api.get("/broadcasts?limit=100");
        if (response.data?.success) {
          setBroadcasts(
            response.data.data.broadcasts.map((b: any) => ({
              id: b.id,
              title: b.title,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load campaigns options", err);
      }
    };
    fetchBroadcastOptions();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = `/messages?page=${page}&search=${search}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (broadcastFilter) url += `&broadcastId=${broadcastFilter}`;
      
      const response = await api.get(url);
      if (response.data?.success) {
        setMessages(response.data.data.messages);
        setTotalPages(response.data.data.totalPages);
        setTotal(response.data.data.total);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load message logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [page, statusFilter, broadcastFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMessages();
  };

  return (
    <div className="space-y-6 animate-fade-in w-full max-w-7xl mx-auto">
      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Message Delivery Logs
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Track individual WhatsApp delivery logs, event status queues, and failures.
        </p>
      </div>

      {/* Filter workspace */}
      <div className="bg-white p-5 rounded-lg border border-tail-border shadow-xs dark:bg-tail-dark-card dark:border-tail-dark-border">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search subscriber name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
            />
          </div>

          <div>
            <select
              value={broadcastFilter}
              onChange={(e) => {
                setBroadcastFilter(e.target.value);
                setPage(1);
              }}
              className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-slate-350"
            >
              <option value="">All Campaigns</option>
              {broadcasts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-slate-350"
            >
              <option value="">All Statuses</option>
              <option value="QUEUED">QUEUED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </form>
      </div>

      {/* Results grid list */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-6 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-100 dark:border-red-900/50">
          <p className="font-semibold">Failed to fetch logs</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-lg bg-white border border-tail-border p-16 text-center dark:bg-tail-dark-card dark:border-tail-dark-border">
          <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">No Message Logs</h3>
          <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
            Once campaign broadcasts are approved and queued, message logs will populate here.
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-white shadow-xs border border-tail-border dark:bg-tail-dark-card dark:border-tail-dark-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold border-b border-tail-border dark:border-tail-dark-border">
                  <th className="px-5 py-4">Subscriber</th>
                  <th className="px-5 py-4">Phone Number</th>
                  <th className="px-5 py-4">Broadcast Campaign</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Queued At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tail-border dark:divide-tail-dark-border text-sm">
                {messages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                      {msg.subscriberName || <span className="text-slate-400 italic font-normal">No name provided</span>}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-600 dark:text-slate-400">
                      {msg.phoneNumber}
                    </td>
                    <td className="px-5 py-4 text-slate-700 dark:text-slate-350">
                      <Link to={`/broadcasts/${msg.broadcastId}`} className="hover:text-indigo-650 hover:underline">
                        {msg.broadcastTitle}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                        msg.status === "QUEUED"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                          : "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                      }`}>
                        {msg.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>{new Date(msg.createdAt).toLocaleString()}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-tail-border dark:border-tail-dark-border flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages} ({total} message logs)
              </span>
              <div className="flex space-x-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default Messages;
