import { useMemo } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy } from "@phosphor-icons/react";
import { buildDailyReport, formatDay } from "@/lib/dailyReport";

/**
 * The end-of-day report: every member's tasks for the day plus who hasn't
 * updated, as text that can be copied straight into the team chat.
 */
export default function DailyReportDialog({ open, onOpenChange, date, members }) {
  const text = useMemo(() => buildDailyReport(date, members), [date, members]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Report copied");
    } catch {
      toast.error("Could not copy — select the text and copy it manually");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-sm" data-testid="daily-report-dialog">
        <DialogHeader>
          <DialogTitle className="font-display font-black tracking-tight">
            Evening Report · {formatDay(date)}
          </DialogTitle>
        </DialogHeader>
        <textarea
          readOnly
          value={text}
          className="w-full h-[50vh] rounded-sm border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 resize-none"
          data-testid="daily-report-text"
        />
        <DialogFooter>
          <Button
            className="rounded-sm bg-[#0033CC] hover:bg-[#0028A3] text-xs"
            onClick={copy}
            data-testid="daily-report-copy"
          >
            <Copy size={14} className="mr-1.5" />
            Copy report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
