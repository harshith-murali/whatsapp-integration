import React from "react";
import { Link } from "react-router-dom";
import { Search, ArrowLeft } from "lucide-react";

export const NotFound: React.FC = () => {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center px-4">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <Search className="h-8 w-8" />
      </div>
      <h2 className="mt-6 text-3xl font-extrabold text-slate-900 dark:text-white">
        Page Not Found
      </h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md">
        The page you are looking for does not exist or has been moved to another path.
      </p>
      <div className="mt-8">
        <Link
          to="/"
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm shadow-md hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};
