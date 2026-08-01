import React, { useState, useEffect } from "react";
import { api } from "../api/index.js";
import { AlertCircle, Save, Send } from "lucide-react";
import { SelectMenu } from "./ui/select-menu.js";
import { Button } from "./ui/button.js";

interface GroupOption {
  id: number;
  name: string;
}

interface BroadcastFormProps {
  initialValues?: {
    title: string;
    message: string;
    category: string;
    severity: string;
    audienceType: string;
    groupId?: number | null;
  };
  onSubmit: (data: {
    title: string;
    message: string;
    category: string;
    severity: string;
    audienceType: string;
    groupId: number | null;
    submitImmediately: boolean;
  }) => void;
  loading: boolean;
}

export const BroadcastForm: React.FC<BroadcastFormProps> = ({
  initialValues,
  onSubmit,
  loading,
}) => {
  const [title, setTitle] = useState(initialValues?.title || "");
  const [message, setMessage] = useState(initialValues?.message || "");
  const [category, setCategory] = useState(initialValues?.category || "ANNOUNCEMENT");
  const [severity, setSeverity] = useState(initialValues?.severity || "LOW");
  const [audienceType, setAudienceType] = useState(initialValues?.audienceType || "ALL_ACTIVE_SUBSCRIBERS");
  const [groupId, setGroupId] = useState<number | "">(initialValues?.groupId || "");
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const categoryOptions = [
    { value: "ANNOUNCEMENT", label: "Announcement" },
    { value: "EMERGENCY", label: "Emergency" },
    { value: "SERVICE_UPDATE", label: "Service Update" },
    { value: "REMINDER", label: "Reminder" },
    { value: "OTHER", label: "Other" },
  ];
  const severityOptions = [
    { value: "LOW", label: "Low" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HIGH", label: "High" },
    { value: "CRITICAL", label: "Critical" },
  ];
  const audienceOptions = [
    { value: "ALL_ACTIVE_SUBSCRIBERS", label: "All Active Subscribers" },
    { value: "GROUP", label: "Group" },
  ];

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await api.get("/groups?limit=100");
        if (response.data?.success) {
          setGroups(response.data.data.groups);
        }
      } catch (err) {
        console.error("Failed to load subscriber groups", err);
      }
    };
    fetchGroups();
  }, []);

  const handleAction = (submitImmediately: boolean) => {
    setError(null);

    if (!title.trim()) {
      setError("Broadcast title is required");
      return;
    }
    if (title.length > 100) {
      setError("Title cannot exceed 100 characters");
      return;
    }

    if (!message.trim()) {
      setError("Broadcast message content is required");
      return;
    }
    if (message.length > 2000) {
      setError("Message cannot exceed 2000 characters");
      return;
    }

    if (audienceType === "GROUP" && !groupId) {
      setError("Please select a target subscriber group");
      return;
    }

    onSubmit({
      title: title.trim(),
      message: message.trim(),
      category,
      severity,
      audienceType,
      groupId: audienceType === "GROUP" ? Number(groupId) : null,
      submitImmediately,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-fade-in">
      {/* Form Fields */}
      <div className="rounded-lg border border-white/80 bg-white shadow-xs p-6 dark:border-tail-dark-border dark:bg-tail-dark-card space-y-5">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-tail-border dark:border-tail-dark-border pb-3">
          Configure Broadcast Campaign
        </h3>

        {error && (
          <div className="flex items-center space-x-2 rounded-lg bg-rose-50 text-rose-700 p-4 text-xs dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Campaign Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Scheduled Maintenance Alert"
            className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
          />
          <div className="flex justify-end text-[10px] text-slate-400 mt-1">
            {title.length}/100 characters
          </div>
        </div>

        {/* Category and Severity */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Category
            </label>
            <SelectMenu
              value={category}
              options={categoryOptions}
              onValueChange={setCategory}
              label="Category"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Severity
            </label>
            <SelectMenu
              value={severity}
              options={severityOptions}
              onValueChange={setSeverity}
              label="Severity"
            />
          </div>
        </div>

        {/* Audience */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Audience Type
            </label>
            <SelectMenu
              value={audienceType}
              options={audienceOptions}
              onValueChange={(value) => {
                setAudienceType(value);
                if (value !== "GROUP") setGroupId("");
              }}
              label="Audience"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Recipient Group
            </label>
            <SelectMenu
              disabled={audienceType !== "GROUP"}
              value={String(groupId)}
              options={[
                { value: "", label: "Select Group..." },
                ...groups.map((group) => ({ value: String(group.id), label: group.name })),
              ]}
              onValueChange={(value) => setGroupId(value ? Number(value) : "")}
              label="Recipient group"
            />
          </div>
        </div>

        {/* Message body */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Message Content
          </label>
          <textarea
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden dark:border-tail-dark-border dark:bg-tail-dark-bg dark:text-white"
          />
          <div className="flex justify-end text-[10px] text-slate-400 mt-1">
            {message.length}/2000 characters
          </div>
        </div>

        {/* Save/Submit Controls */}
        <div className="flex justify-end space-x-3 pt-3 border-t border-tail-border dark:border-tail-dark-border">
          <Button
            type="button"
            disabled={loading}
            onClick={() => handleAction(false)}
            className="inline-flex items-center px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-tail-dark-border dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => handleAction(true)}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer shadow-md disabled:opacity-50"
          >
            <Send className="h-4 w-4 mr-2" />
            Submit for Approval
          </Button>
        </div>
      </div>

      {/* Internal Live Preview */}
      <div className="rounded-lg border border-white/80 bg-white shadow-xs p-6 dark:border-tail-dark-border dark:bg-tail-dark-card space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-tail-border dark:border-tail-dark-border pb-3">
          Internal Broadcast Preview
        </h3>
        
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 dark:bg-tail-dark-bg dark:border-tail-dark-border space-y-4">
          <div className="flex justify-between items-start">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
              severity === "CRITICAL"
                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400"
                : severity === "HIGH"
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400"
                : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400"
            }`}>
              {severity} SEVERITY
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
              {category.replace("_", " ")}
            </span>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2 font-mono">
              {title || "(No title provided)"}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-serif whitespace-pre-wrap leading-relaxed">
              {message || "(Message content will appear here)"}
            </p>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 leading-normal bg-indigo-50/30 rounded-lg p-3 border border-indigo-100/50 dark:bg-indigo-950/10 dark:border-indigo-900/30">
          <strong>Please note:</strong> This preview matches internal formatting. Real recipients will receive this content via the WhatsApp alert gateway exactly as drafted above.
        </div>
      </div>
    </div>
  );
};
export default BroadcastForm;
