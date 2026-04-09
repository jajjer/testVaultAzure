import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  coerceToAllowedOption,
  getTestCasePriorityOptions,
  getTestCaseTypeOptions,
} from "@/lib/test-case-field-options";
import { parseTestRailCsv } from "@/lib/testrail-csv";
import {
  ensureSectionPathForImport,
  loadSectionsForImportCache,
} from "@/lib/testrail-import-sections";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { useTestCaseStore } from "@/store/test-case-store";

const MAX_PREVIEW = 5;

type PreviewState =
  | { kind: "idle" }
  | { kind: "ready"; count: number; titles: string[]; warnings: string[]; skipped: number };

export function TestRailImportDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const account = useAuthStore((s) => s.account);
  const createTestCase = useTestCaseStore((s) => s.createTestCase);
  const cases = useTestCaseStore((s) => s.cases);

  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ kind: "idle" });
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDone, setImportDone] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setFileName(null);
    setCsvText(null);
    setPreview({ kind: "idle" });
    setParseError(null);
    setImporting(false);
    setImportError(null);
    setImportDone(null);
  }, [open]);

  function onPickFile() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setParseError(null);
    setPreview({ kind: "idle" });
    setCsvText(null);
    setFileName(null);
    setImportDone(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please choose a .csv file (TestRail export).");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setParseError("File is larger than 12 MB. Split the export or remove columns.");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setCsvText(text);
      try {
        const parsed = parseTestRailCsv(text);
        const titles = parsed.rows.slice(0, MAX_PREVIEW).map((r) => r.title);
        setPreview({
          kind: "ready",
          count: parsed.rows.length,
          titles,
          warnings: parsed.warnings,
          skipped: parsed.skipped,
        });
      } catch (err) {
        setCsvText(null);
        setFileName(null);
        setParseError(
          err instanceof Error ? err.message : "Could not parse this CSV."
        );
      }
    };
    reader.onerror = () => {
      setParseError("Could not read the file.");
      setFileName(null);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function onImport() {
    if (!csvText || !account) return;
    setImportError(null);
    setImportDone(null);
    setImporting(true);
    try {
      const parsed = parseTestRailCsv(csvText);
      if (parsed.rows.length === 0) {
        throw new Error("No rows to import.");
      }

      const sectionCache = await loadSectionsForImportCache(projectId);
      const baseOrder =
        cases.length === 0
          ? 0
          : Math.max(...cases.map((c) => c.order)) + 1;

      const projectDoc = useProjectStore
        .getState()
        .projects.find((p) => p.id === projectId);
      const priorityOpts = getTestCasePriorityOptions(projectDoc);
      const typeOpts = getTestCaseTypeOptions(projectDoc);

      let n = 0;
      for (let i = 0; i < parsed.rows.length; i += 1) {
        const row = parsed.rows[i]!;
        const sectionId = await ensureSectionPathForImport(
          projectId,
          row.sectionPath,
          sectionCache
        );
        await createTestCase(projectId, {
          title: row.title,
          preconditions: row.preconditions,
          steps: row.steps,
          priority: coerceToAllowedOption(row.priority, priorityOpts),
          type: coerceToAllowedOption(row.type, typeOpts),
          status: row.status,
          customFields: row.customFields,
          sectionId,
          createdBy: account.localAccountId,
          order: baseOrder + i,
        });
        n += 1;
      }

      setImportDone(n);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Import failed."
      );
    } finally {
      setImporting(false);
    }
  }

  const canImport =
    preview.kind === "ready" &&
    preview.count > 0 &&
    !!account &&
    !importing &&
    importDone === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from TestRail</DialogTitle>
          <DialogDescription>
            Export from TestRail as CSV. We use a small set of columns:{" "}
            <span className="font-medium text-foreground">Title</span> (required),{" "}
            <span className="font-medium text-foreground">ID</span>,{" "}
            <span className="font-medium text-foreground">Section</span> or{" "}
            <span className="font-medium text-foreground">Section Hierarchy</span>,{" "}
            Preconditions, Priority, Type, and step fields (
            <span className="font-medium text-foreground">Steps (Step)</span> /{" "}
            duplicate <span className="font-medium text-foreground">Steps</span> /{" "}
            Expected Result). Extra columns are ignored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={onFileChange}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Label className="sr-only">CSV file</Label>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={onPickFile}
              disabled={importing}
            >
              <Upload className="h-4 w-4" />
              Choose CSV
            </Button>
            {fileName ? (
              <span className="text-sm text-muted-foreground truncate max-w-[220px]">
                {fileName}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">No file selected</span>
            )}
          </div>

          {parseError ? (
            <p className="text-sm text-destructive">{parseError}</p>
          ) : null}

          {preview.kind === "ready" ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm space-y-2">
              <p>
                <span className="font-medium text-foreground">{preview.count}</span>{" "}
                test case{preview.count === 1 ? "" : "s"} ready to import
                {preview.skipped > 0 ? (
                  <span className="text-muted-foreground">
                    {" "}
                    ({preview.skipped} empty row{preview.skipped === 1 ? "" : "s"}{" "}
                    skipped)
                  </span>
                ) : null}
                .
              </p>
              {preview.warnings.length > 0 ? (
                <ul className="list-disc pl-4 text-muted-foreground text-xs space-y-0.5">
                  {preview.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              {preview.titles.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                  <ul className="text-xs space-y-0.5 font-mono truncate">
                    {preview.titles.map((t) => (
                      <li key={t} className="truncate">
                        {t}
                      </li>
                    ))}
                    {preview.count > preview.titles.length ? (
                      <li className="text-muted-foreground">…</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {importError ? (
            <p className="text-sm text-destructive">{importError}</p>
          ) : null}
          {importDone !== null ? (
            <p className="text-sm text-green-700 dark:text-green-400">
              Imported {importDone} test case{importDone === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            {importDone !== null ? "Close" : "Cancel"}
          </Button>
          <Button
            type="button"
            onClick={() => void onImport()}
            disabled={!canImport}
          >
            {importing ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
