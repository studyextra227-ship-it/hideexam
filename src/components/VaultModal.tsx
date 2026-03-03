import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Download, FileText, X, Lock, Loader2,
  Trash2, CheckCircle, AlertCircle, FolderUp, CloudUpload,
  Pencil, ShieldCheck, Save, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VaultFile {
  name: string;
  size: number;
  created_at: string;
  id: string;
}

interface UploadItem {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
}

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const VaultModal = ({ isOpen, onClose }: VaultModalProps) => {
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pinInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const storedPin = useRef("");

  useEffect(() => {
    if (isOpen && !authenticated) {
      setTimeout(() => pinInputsRef.current[0]?.focus(), 300);
    }
  }, [isOpen, authenticated]);

  useEffect(() => {
    if (renamingFile && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingFile]);

  const verifyPin = useCallback(async (enteredPin: string) => {
    setVerifying(true);
    setPinError(false);
    try {
      const { data, error } = await supabase.functions.invoke("verify-pin", {
        body: { pin: enteredPin },
      });
      if (error || !data?.valid) {
        setPinError(true);
        setPin("");
        setTimeout(() => {
          setPinError(false);
          pinInputsRef.current[0]?.focus();
        }, 1500);
      } else {
        storedPin.current = enteredPin;
        setIsAdmin(!!data.isAdmin);
        setAuthenticated(true);
        fetchFiles(enteredPin);
      }
    } catch {
      setPinError(true);
      setPin("");
    } finally {
      setVerifying(false);
    }
  }, []);

  const fetchFiles = async (p: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("vault-files", {
        body: { pin: p },
      });
      if (!error && data?.files) setFiles(data.files);
      else setFiles([]);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const uploadOne = async (file: File, idx: number) => {
    if (file.type !== "application/pdf") {
      setUploadQueue((q) => q.map((item, i) => i === idx ? { ...item, status: "error" } : item));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadQueue((q) => q.map((item, i) => i === idx ? { ...item, status: "error" } : item));
      return;
    }
    setUploadQueue((q) => q.map((item, i) => i === idx ? { ...item, status: "uploading", progress: 0 } : item));

    const progressInterval = setInterval(() => {
      setUploadQueue((q) => q.map((item, i) =>
        i === idx && item.status === "uploading" && item.progress < 85
          ? { ...item, progress: item.progress + Math.random() * 15 }
          : item
      ));
    }, 300);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pin", storedPin.current);
      const { error } = await supabase.functions.invoke("vault-upload", { body: formData });
      clearInterval(progressInterval);
      setUploadQueue((q) => q.map((item, i) =>
        i === idx ? { ...item, status: error ? "error" : "done", progress: error ? 0 : 100 } : item
      ));
    } catch {
      clearInterval(progressInterval);
      setUploadQueue((q) => q.map((item, i) => i === idx ? { ...item, status: "error", progress: 0 } : item));
    }
  };

  const handleFiles = async (selectedFiles: FileList | File[]) => {
    const arr = Array.from(selectedFiles);
    if (!arr.length) return;
    const newItems: UploadItem[] = arr.map((f) => ({ file: f, status: "pending", progress: 0 }));
    const startIdx = uploadQueue.length;
    setUploadQueue((q) => [...q, ...newItems]);
    await Promise.all(arr.map((file, i) => uploadOne(file, startIdx + i)));
    await fetchFiles(storedPin.current);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const handleDownload = async (fileName: string) => {
    setDownloadingFiles((s) => new Set(s).add(fileName));
    try {
      const { data, error } = await supabase.functions.invoke("vault-download", {
        body: { pin: storedPin.current, fileName },
      });
      if (error || !data?.signedUrl) return;
      const res = await fetch(data.signedUrl);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(/^\d+-/, "");
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    } finally {
      setDownloadingFiles((s) => { const n = new Set(s); n.delete(fileName); return n; });
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!window.confirm(`Delete "${fileName.replace(/^\d+-/, "")}"? This cannot be undone.`)) return;
    setDeletingFiles((s) => new Set(s).add(fileName));
    try {
      const { error } = await supabase.functions.invoke("vault-delete", {
        body: { pin: storedPin.current, fileName },
      });
      if (!error) setFiles((f) => f.filter((file) => file.name !== fileName));
    } catch {
      // silent
    } finally {
      setDeletingFiles((s) => { const n = new Set(s); n.delete(fileName); return n; });
    }
  };

  const startRename = (file: VaultFile) => {
    setRenamingFile(file.name);
    setRenameValue(file.name.replace(/^\d+-/, "").replace(/\.pdf$/i, ""));
  };

  const cancelRename = () => {
    setRenamingFile(null);
    setRenameValue("");
  };

  const handleRename = async (oldFileName: string) => {
    if (!renameValue.trim()) return;
    setSavingRename(true);
    try {
      const { data, error } = await supabase.functions.invoke("vault-rename", {
        body: { pin: storedPin.current, oldFileName, newDisplayName: renameValue.trim() },
      });
      if (!error && data?.newFileName) {
        await fetchFiles(storedPin.current);
        setRenamingFile(null);
        setRenameValue("");
      }
    } catch {
      // silent
    } finally {
      setSavingRename(false);
    }
  };

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = pin.split("");
    newPin[index] = value.slice(-1);
    const joined = newPin.join("").slice(0, 4);
    setPin(joined);
    if (value && index < 3) pinInputsRef.current[index + 1]?.focus();
    if (joined.length === 4) verifyPin(joined);
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      pinInputsRef.current[index - 1]?.focus();
    }
  };

  const handleClose = () => {
    setPin(""); setAuthenticated(false); setIsAdmin(false); setFiles([]);
    setPinError(false); setUploadQueue([]); setDragging(false);
    setRenamingFile(null); setRenameValue("");
    storedPin.current = "";
    onClose();
  };

  const clearDoneUploads = () =>
    setUploadQueue((q) => q.filter((i) => i.status === "uploading" || i.status === "pending"));

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const isUploading = uploadQueue.some((i) => i.status === "uploading" || i.status === "pending");
  const hasDoneOrError = uploadQueue.some((i) => i.status === "done" || i.status === "error");

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          style={{ zIndex: 100, backgroundColor: "rgba(1, 10, 15, 0.97)" }}
        >
          <motion.button
            onClick={handleClose}
            className="absolute top-4 sm:top-6 right-4 sm:right-6 text-muted-foreground hover:text-primary transition-colors touch-target"
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            aria-label="Close vault"
          >
            <X size={24} />
          </motion.button>

          <AnimatePresence mode="wait">
            {!authenticated ? (
              /* ── PIN Entry ── */
              <motion.div
                key="pin"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="text-center w-full max-w-sm px-4 sm:px-6"
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="mb-6 sm:mb-8"
                >
                  <Lock className="mx-auto text-primary" size={44} />
                </motion.div>
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 text-foreground glow-teal-text leading-tight">
                  The Abyss Vault
                </h2>
                <p className="text-muted-foreground font-body text-xs sm:text-sm md:text-base mb-8 sm:mb-10 tracking-wide">
                  Enter access code to descend
                </p>
                <div className="flex gap-2.5 sm:gap-3 md:gap-4 justify-center mb-8 sm:mb-10">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.input
                      key={i}
                      ref={(el) => { pinInputsRef.current[i] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={pin[i] || ""}
                      onChange={(e) => handlePinChange(i, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(i, e)}
                      className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-center text-xl sm:text-2xl md:text-3xl font-body rounded-lg porthole-heavy outline-none transition-all touch-target ${pinError
                          ? "border-destructive shadow-[0_0_15px_rgba(255,0,0,0.3)]"
                          : "focus:border-primary focus:glow-teal"
                        } text-foreground bg-transparent`}
                      animate={pinError ? { x: [-8, 8, -8, 8, 0] } : {}}
                      transition={{ duration: 0.4 }}
                    />
                  ))}
                </div>
                {verifying && <Loader2 className="mx-auto animate-spin text-primary" size={24} />}
                <AnimatePresence>
                  {pinError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-destructive text-xs sm:text-sm font-body"
                    >
                      Access denied
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              /* ── File Management / Admin Panel ── */
              <motion.div
                key="vault"
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 24, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                className="w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col gap-4"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-xl sm:text-2xl text-foreground glow-teal-text">
                        {isAdmin ? "Admin Panel" : "Abyss Vault"}
                      </h2>
                      {isAdmin && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-body font-semibold"
                          style={{ backgroundColor: "rgba(255,60,60,0.15)", color: "#ff6060", border: "1px solid rgba(255,60,60,0.3)" }}
                        >
                          <ShieldCheck size={11} />
                          ADMIN
                        </motion.span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs sm:text-sm font-body">
                      {files.length} specimen{files.length !== 1 ? "s" : ""} archived
                    </p>
                  </div>
                  <motion.button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg porthole-heavy text-primary font-body text-sm hover:glow-teal transition-all disabled:opacity-50 touch-target w-full sm:w-auto shrink-0"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {isUploading ? <Loader2 size={15} className="animate-spin" /> : <FolderUp size={15} />}
                    Upload Files
                  </motion.button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleInputChange}
                    className="hidden"
                  />
                </div>

                {/* Drag & Drop zone */}
                <motion.div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  animate={dragging ? { scale: 1.02 } : { scale: 1 }}
                  transition={{ duration: 0.15 }}
                  className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200
                    ${dragging
                      ? "border-primary/80 bg-primary/5 glow-teal"
                      : isAdmin
                        ? "border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5"
                        : "border-border/40 hover:border-primary/40 hover:bg-primary/5"
                    }`}
                >
                  <CloudUpload
                    className={`mx-auto mb-1 transition-colors ${dragging ? "text-primary" : "text-muted-foreground/50"}`}
                    size={22}
                  />
                  <p className="text-muted-foreground font-body text-xs">
                    {dragging ? "Release to upload" : "Drag & drop PDFs here, or click to browse"}
                  </p>
                  <p className="text-muted-foreground/50 font-body text-xs mt-0.5">Multiple files supported · 50 MB max each</p>
                </motion.div>

                {/* Upload queue */}
                <AnimatePresence>
                  {uploadQueue.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1.5">
                        {uploadQueue.map((item, idx) => (
                          <motion.div
                            key={`${item.file.name}-${idx}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className="porthole-heavy rounded-lg px-3 py-2 flex items-center gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-foreground font-body text-xs truncate">{item.file.name}</p>
                              {item.status === "uploading" && (
                                <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                                  <motion.div
                                    className="h-full bg-primary rounded-full"
                                    animate={{ width: `${item.progress}%` }}
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="shrink-0">
                              {item.status === "pending" && <Loader2 size={14} className="text-muted-foreground animate-spin" />}
                              {item.status === "uploading" && <Loader2 size={14} className="text-primary animate-spin" />}
                              {item.status === "done" && <CheckCircle size={14} className="text-green-400" />}
                              {item.status === "error" && <AlertCircle size={14} className="text-destructive" />}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                      {hasDoneOrError && !isUploading && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={clearDoneUploads}
                          className="mt-1.5 text-xs text-muted-foreground hover:text-primary font-body transition-colors"
                        >
                          Clear completed
                        </motion.button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* File list */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {loading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="animate-spin text-primary" size={28} />
                    </div>
                  ) : files.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-10"
                    >
                      <FileText className="mx-auto mb-3 text-muted-foreground/40" size={36} />
                      <p className="text-muted-foreground font-body text-sm">
                        The vault is empty. Upload your first specimen.
                      </p>
                    </motion.div>
                  ) : (
                    <AnimatePresence>
                      {files.map((file, index) => {
                        const displayName = file.name.replace(/^\d+-/, "");
                        const isDownloading = downloadingFiles.has(file.name);
                        const isDeleting = deletingFiles.has(file.name);
                        const isRenaming = renamingFile === file.name;

                        return (
                          <motion.div
                            key={file.name}
                            layout
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 16, height: 0 }}
                            transition={{ delay: index * 0.04, layout: { duration: 0.2 } }}
                            className={`porthole-heavy rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 group ${isAdmin ? "hover:border-red-500/20" : ""
                              }`}
                          >
                            <FileText
                              className={`shrink-0 ${isAdmin ? "text-red-400/70" : "text-primary"}`}
                              size={20}
                            />
                            <div className="flex-1 min-w-0">
                              {isRenaming ? (
                                /* ── Inline Rename Input ── */
                                <div className="flex items-center gap-2">
                                  <input
                                    ref={renameInputRef}
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleRename(file.name);
                                      if (e.key === "Escape") cancelRename();
                                    }}
                                    className="flex-1 bg-transparent border-b border-primary/50 outline-none text-foreground font-body text-sm pb-0.5 focus:border-primary"
                                    placeholder="New file name..."
                                    maxLength={100}
                                  />
                                  <motion.button
                                    onClick={() => handleRename(file.name)}
                                    disabled={savingRename || !renameValue.trim()}
                                    className="p-1 text-green-400 hover:text-green-300 disabled:opacity-40 transition-colors"
                                    whileTap={{ scale: 0.9 }}
                                    aria-label="Save rename"
                                  >
                                    {savingRename ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                  </motion.button>
                                  <motion.button
                                    onClick={cancelRename}
                                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                    whileTap={{ scale: 0.9 }}
                                    aria-label="Cancel rename"
                                  >
                                    <XCircle size={14} />
                                  </motion.button>
                                </div>
                              ) : (
                                <>
                                  <p className="text-foreground font-body text-sm truncate">{displayName}</p>
                                  <p className="text-muted-foreground font-body text-xs">
                                    {formatSize(file.size)} · {formatDate(file.created_at)}
                                  </p>
                                </>
                              )}
                            </div>

                            {!isRenaming && (
                              <div className="flex gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
                                {/* Download */}
                                <motion.button
                                  onClick={() => handleDownload(file.name)}
                                  disabled={isDownloading}
                                  className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors touch-target disabled:opacity-40"
                                  whileHover={{ scale: 1.12 }}
                                  whileTap={{ scale: 0.9 }}
                                  aria-label="Download"
                                >
                                  {isDownloading
                                    ? <Loader2 size={16} className="animate-spin" />
                                    : <Download size={16} />}
                                </motion.button>

                                {/* Admin-only: Rename */}
                                {isAdmin && (
                                  <motion.button
                                    onClick={() => startRename(file)}
                                    className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-yellow-400 transition-colors touch-target"
                                    whileHover={{ scale: 1.12 }}
                                    whileTap={{ scale: 0.9 }}
                                    aria-label="Rename"
                                  >
                                    <Pencil size={16} />
                                  </motion.button>
                                )}

                                {/* Admin-only: Delete */}
                                {isAdmin && (
                                  <motion.button
                                    onClick={() => handleDelete(file.name)}
                                    disabled={isDeleting}
                                    className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors touch-target disabled:opacity-40"
                                    whileHover={{ scale: 1.12 }}
                                    whileTap={{ scale: 0.9 }}
                                    aria-label="Delete"
                                  >
                                    {isDeleting
                                      ? <Loader2 size={16} className="animate-spin" />
                                      : <Trash2 size={16} />}
                                  </motion.button>
                                )}
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VaultModal;
