import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Download, FileText, X, Lock, Loader2,
  Trash2, CheckCircle, AlertCircle, FolderUp, CloudUpload,
  Pencil, ShieldCheck, Save, XCircle, Mail, KeyRound,
  RefreshCw, Settings,
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

type AuthStage =
  | "pin"            // Enter PIN
  | "admin_email_prompt" // Admin: Enter email to receive OTP
  | "admin_otp"      // Admin: Enter email OTP
  | "forgot_otp"     // Forgot PIN: Enter email OTP
  | "forgot_newpin"  // Forgot PIN: Set new PIN
  | "vault"          // Normal vault view
  | "admin_vault"    // Admin vault view
  | "admin_change_email_old_otp"
  | "admin_change_email_new_input"
  | "admin_change_email_new_otp";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const OtpInput = ({
  value,
  onChange,
  disabled,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  error?: boolean;
}) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const handleChange = (idx: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const chars = value.split("");
    chars[idx] = v.slice(-1);
    const joined = chars.join("").slice(0, 6);
    onChange(joined);
    if (v && idx < 5) refs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !value[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <motion.input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          className={`w-10 h-12 text-center text-lg font-mono rounded-lg porthole-heavy outline-none transition-all
            ${error ? "border-destructive shadow-[0_0_12px_rgba(255,0,0,0.3)]" : "focus:border-primary focus:glow-teal"}
            text-foreground bg-transparent disabled:opacity-40`}
          animate={error ? { x: [-6, 6, -6, 6, 0] } : {}}
          transition={{ duration: 0.35 }}
        />
      ))}
    </div>
  );
};

const PinInput = ({
  value,
  onChange,
  onComplete,
  error,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  error?: boolean;
  disabled?: boolean;
}) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (idx: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const chars = value.split("");
    chars[idx] = v.slice(-1);
    const joined = chars.join("").slice(0, 4);
    onChange(joined);
    if (v && idx < 3) refs.current[idx + 1]?.focus();
    if (joined.length === 4) onComplete?.(joined);
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !value[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  return (
    <div className="flex gap-3 justify-center">
      {[0, 1, 2, 3].map((i) => (
        <motion.input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          className={`w-14 h-14 text-center text-2xl font-body rounded-lg porthole-heavy outline-none transition-all touch-target
            ${error ? "border-destructive shadow-[0_0_15px_rgba(255,0,0,0.3)]" : "focus:border-primary focus:glow-teal"}
            text-foreground bg-transparent disabled:opacity-40`}
          animate={error ? { x: [-8, 8, -8, 8, 0] } : {}}
          transition={{ duration: 0.4 }}
        />
      ))}
    </div>
  );
};

const VaultModal = ({ isOpen, onClose }: VaultModalProps) => {
  const [stage, setStage] = useState<AuthStage>("pin");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // OTP states
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [otpSendErrorMsg, setOtpSendErrorMsg] = useState("");

  // New PIN (for forgot flow)
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [pinMismatch, setPinMismatch] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);
  const [pinSaveErrorMsg, setPinSaveErrorMsg] = useState("");

  // Vault state
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Admin PIN management
  const [showAdminPinPanel, setShowAdminPinPanel] = useState(false);
  const [adminChangePinTarget, setAdminChangePinTarget] = useState<"vault" | "admin">("vault");
  const [adminNewPin, setAdminNewPin] = useState("");
  const [adminNewPinConfirm, setAdminNewPinConfirm] = useState("");
  const [adminPinChangeError, setAdminPinChangeError] = useState("");
  const [adminPinChanging, setAdminPinChanging] = useState(false);
  const [adminPinChanged, setAdminPinChanged] = useState(false);

  // Admin Change Email handling
  const [newAdminEmailInput, setNewAdminEmailInput] = useState("");
  const [emailChangeErrorMsg, setEmailChangeErrorMsg] = useState("");
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const storedPin = useRef("");

  const isAdmin = stage === "admin_vault";

  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => {
      setOtpResendCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [isOpen]);

  useEffect(() => {
    if (renamingFile && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingFile]);

  const showPinError = () => {
    setPinError(true);
    setPin("");
    setTimeout(() => setPinError(false), 1500);
  };

  const sendOtp = async (purpose: "admin_verify" | "pin_reset", extraEmail?: string) => {
    setOtpSending(true);
    setOtpSendErrorMsg("");
    try {
      const payload: any = { purpose };
      if (extraEmail) payload.email = extraEmail.trim();

      const { data, error } = await supabase.functions.invoke("send-otp", { body: payload });
      if (error || !data?.success) {
        setOtpSendErrorMsg(data?.error || "Failed to send OTP. Please try again.");
        return false;
      }
      setMaskedEmail(data.maskedEmail || "");
      setOtpResendCooldown(60);
      return true;
    } catch {
      setOtpSendErrorMsg("Network error trying to send OTP. Please try again.");
      return false;
    } finally {
      setOtpSending(false);
    }
  };

  const verifyPin = useCallback(async (enteredPin: string) => {
    setVerifying(true);
    setPinError(false);
    try {
      const { data, error } = await supabase.functions.invoke("verify-pin", { body: { pin: enteredPin } });
      if (error || !data?.valid) {
        showPinError();
        return;
      }
      storedPin.current = enteredPin;
      if (data.isAdmin && data.requiresOtp) {
        // Admin: Prompt for email
        setStage("admin_email_prompt");
      } else if (data.isAdmin && !data.requiresOtp) {
        // Admin: Cached active OTP Session allows direct entry
        setStage("admin_vault");
        fetchFiles(enteredPin);
      } else {
        // Normal Vault User
        setStage("vault");
        fetchFiles(enteredPin);
      }
    } catch {
      showPinError();
    } finally {
      setVerifying(false);
    }
  }, []);

  const verifyAdminOtp = async () => {
    if (otp.length < 6) return;
    setOtpVerifying(true);
    setOtpError(false);
    try {
      const { data } = await supabase.functions.invoke("grant-otp-session", { body: { otp, purpose: "admin_verify" } });
      if (!data?.valid) {
        setOtpError(true);
        setOtp("");
        setTimeout(() => setOtpError(false), 1500);
        return;
      }
      setOtp("");
      setStage("admin_vault");
      fetchFiles(storedPin.current);
    } catch {
      setOtpError(true);
    } finally {
      setOtpVerifying(false);
    }
  };

  const startForgotPin = async () => {
    const sent = await sendOtp("pin_reset");
    if (sent) setStage("forgot_otp");
  };

  const verifyForgotOtp = async () => {
    if (otp.length < 6) return;
    setOtpVerifying(true);
    setOtpError(false);
    try {
      const { data } = await supabase.functions.invoke("grant-otp-session", { body: { otp, purpose: "pin_reset" } });
      if (!data?.valid) {
        setOtpError(true);
        setOtp("");
        setTimeout(() => setOtpError(false), 1500);
        return;
      }
      setOtp("");
      setStage("forgot_newpin");
    } catch {
      setOtpError(true);
    } finally {
      setOtpVerifying(false);
    }
  };

  const saveNewPin = async () => {
    setPinSaveErrorMsg("");
    if (newPin.length !== 4 || newPin !== newPinConfirm) {
      setPinMismatch(true);
      setTimeout(() => setPinMismatch(false), 1500);
      return;
    }
    setSavingPin(true);
    try {
      const { data } = await supabase.functions.invoke("manage-pin", { body: { action: "reset_vault_pin", newPin } });
      if (data?.success) {
        setPinSaved(true);
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        setPinSaveErrorMsg(data?.error || "Failed to reset PIN. Please try again.");
      }
    } catch {
      setPinSaveErrorMsg("An error occurred. Please try again.");
    } finally {
      setSavingPin(false);
    }
  };

  const handleAdminChangePin = async () => {
    setAdminPinChangeError("");
    if (adminNewPin.length !== 4) {
      setAdminPinChangeError("PIN must be exactly 4 digits");
      return;
    }
    if (adminNewPin !== adminNewPinConfirm) {
      setAdminPinChangeError("PINs do not match");
      return;
    }
    setAdminPinChanging(true);
    try {
      const { data } = await supabase.functions.invoke("manage-pin", {
        body: {
          action: "admin_change_pin",
          adminPin: storedPin.current,
          newPin: adminNewPin,
          targetPinType: adminChangePinTarget,
        },
      });
      if (data?.success) {
        setAdminPinChanged(true);
        setAdminNewPin("");
        setAdminNewPinConfirm("");
        setTimeout(() => setAdminPinChanged(false), 3000);
      } else {
        setAdminPinChangeError(data?.error || "Failed to change PIN.");
      }
    } catch {
      setAdminPinChangeError("An error occurred.");
    } finally {
      setAdminPinChanging(false);
    }
  };

  const startChangeAdminEmail = async () => {
    // Stage 1: Request OTP to old/current email
    const sent = await sendOtp("change_email_old");
    if (sent) setStage("admin_change_email_old_otp");
  };

  const verifyOldEmailOtp = async () => {
    if (otp.length < 6) return;
    setOtpVerifying(true);
    setEmailChangeErrorMsg("");
    try {
      const { data } = await supabase.functions.invoke("grant-otp-session", { body: { otp, purpose: "change_email_old" } });
      if (!data?.valid) {
        setEmailChangeErrorMsg(data?.error || "Invalid OTP code.");
        setOtp("");
        return;
      }
      setOtp("");
      setStage("admin_change_email_new_input");
    } catch {
      setEmailChangeErrorMsg("Verification failed.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const sendNewEmailOtp = async () => {
    if (!newAdminEmailInput.trim() || !newAdminEmailInput.includes("@")) {
      setEmailChangeErrorMsg("Please enter a valid email address.");
      return;
    }
    const sent = await sendOtp("change_email_new", newAdminEmailInput);
    if (sent) setStage("admin_change_email_new_otp");
  };

  const saveNewAdminEmail = async () => {
    if (otp.length < 6) return;
    setOtpVerifying(true);
    setEmailChangeErrorMsg("");
    try {
      // Grant session for new email
      const { data: grantData } = await supabase.functions.invoke("grant-otp-session", { body: { otp, purpose: "change_email_new" } });
      if (!grantData?.valid) {
        setEmailChangeErrorMsg(grantData?.error || "Invalid OTP code.");
        setOtp("");
        return;
      }

      // Manage edge function execution
      const { data } = await supabase.functions.invoke("manage-email", { body: { action: "admin_change_email", newEmail: newAdminEmailInput.trim(), adminPin: storedPin.current } });
      if (data?.success) {
        setEmailChangeSuccess(true);
        setTimeout(() => {
          setStage("admin_vault");
          setOtp("");
          setNewAdminEmailInput("");
          setEmailChangeSuccess(false);
        }, 3000);
      } else {
        setEmailChangeErrorMsg(data?.error || "Failed to save new email.");
      }
    } catch {
      setEmailChangeErrorMsg("An error occurred preserving the email.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const fetchFiles = async (p: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("vault-files", { body: { pin: p } });
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

  const handleDownload = async (fileName: string) => {
    setDownloadingFiles((s) => new Set(s).add(fileName));
    try {
      const { data, error } = await supabase.functions.invoke("vault-download", { body: { pin: storedPin.current, fileName } });
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
    } catch { /* silent */ } finally {
      setDownloadingFiles((s) => { const n = new Set(s); n.delete(fileName); return n; });
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!window.confirm(`Delete "${fileName.replace(/^\d+-/, "")}"? This cannot be undone.`)) return;
    setDeletingFiles((s) => new Set(s).add(fileName));
    try {
      const { error } = await supabase.functions.invoke("vault-delete", { body: { pin: storedPin.current, fileName } });
      if (!error) setFiles((f) => f.filter((file) => file.name !== fileName));
    } catch { /* silent */ } finally {
      setDeletingFiles((s) => { const n = new Set(s); n.delete(fileName); return n; });
    }
  };

  const startRename = (file: VaultFile) => {
    setRenamingFile(file.name);
    setRenameValue(file.name.replace(/^\d+-/, "").replace(/\.pdf$/i, ""));
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
    } catch { /* silent */ } finally {
      setSavingRename(false);
    }
  };

  const handleClose = () => {
    setStage("pin");
    setPin(""); setOtp(""); setNewPin(""); setNewPinConfirm(""); setAdminEmailInput("");
    setPinError(false); setOtpError(false); setPinMismatch(false); setPinSaved(false);
    setOtpSendErrorMsg(""); setPinSaveErrorMsg("");
    setFiles([]); setUploadQueue([]); setDragging(false);
    setRenamingFile(null); setRenameValue("");
    setShowAdminPinPanel(false);
    setAdminNewPin(""); setAdminNewPinConfirm(""); setAdminPinChangeError(""); setAdminPinChanged(false);
    setNewAdminEmailInput(""); setEmailChangeErrorMsg(""); setEmailChangeSuccess(false);
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

            {/* ── Stage: PIN Entry ── */}
            {stage === "pin" && (
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
                <PinInput
                  value={pin}
                  onChange={setPin}
                  onComplete={verifyPin}
                  error={pinError}
                  disabled={verifying}
                />
                <div className="mt-6 min-h-[24px]">
                  {verifying && <Loader2 className="mx-auto animate-spin text-primary" size={22} />}
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
                </div>
                <div className="mt-4 flex flex-col items-center">
                  <motion.button
                    onClick={startForgotPin}
                    disabled={otpSending}
                    className="text-xs text-muted-foreground hover:text-primary font-body transition-colors flex items-center gap-1.5 mx-auto disabled:opacity-50"
                    whileTap={{ scale: 0.95 }}
                  >
                    {otpSending ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                    Forgot PIN? Reset via email
                  </motion.button>
                  <AnimatePresence>
                    {otpSendErrorMsg && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-3"
                      >
                        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-body rounded px-3 py-2 flex items-center gap-1.5">
                          <AlertCircle size={14} className="shrink-0" />
                          <span className="text-left leading-tight">{otpSendErrorMsg}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* ── Stage: Update Email — Old Email OTP ── */}
            {stage === "admin_change_email_old_otp" && (
              <motion.div
                key="admin_change_email_old_otp"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="text-center w-full max-w-sm px-4 sm:px-6"
              >
                <div className="mb-6 flex justify-center">
                  <div className="bg-red-500/10 p-4 rounded-full border border-red-500/20">
                    <ShieldCheck className="text-red-400" size={32} />
                  </div>
                </div>
                <h2 className="font-display text-2xl font-bold mb-2 text-foreground" style={{ color: "#ff6060" }}>
                  Verify Current Email
                </h2>
                <p className="text-muted-foreground font-body text-xs mb-6">
                  OTP sent to <span className="text-primary">{maskedEmail}</span>
                </p>

                <OtpInput value={otp} onChange={setOtp} error={!!emailChangeErrorMsg} disabled={otpVerifying} />

                <div className="min-h-[36px] my-3 flex items-center justify-center">
                  <AnimatePresence>
                    {emailChangeErrorMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-destructive text-xs font-body flex items-center gap-1"
                      >
                        <AlertCircle size={13} />
                        {emailChangeErrorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <motion.button
                  onClick={verifyOldEmailOtp}
                  disabled={otp.length < 6 || otpVerifying}
                  className="w-full py-3 rounded-lg font-body text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: "rgba(255,96,96,0.15)", border: "1px solid rgba(255,96,96,0.3)", color: "#ff8080" }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {otpVerifying ? <Loader2 size={16} className="animate-spin" /> : "Verify Identity"}
                </motion.button>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <motion.button
                    onClick={() => { setOtpSendErrorMsg(""); setEmailChangeErrorMsg(""); setStage("admin_vault"); setOtp(""); }}
                    className="text-xs text-muted-foreground hover:text-primary font-body transition-colors"
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── Stage: Update Email — New Email Input ── */}
            {stage === "admin_change_email_new_input" && (
              <motion.div
                key="admin_change_email_new_input"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="text-center w-full max-w-sm px-4 sm:px-6"
              >
                <div className="mb-6 flex justify-center">
                  <div className="bg-red-500/10 p-4 rounded-full border border-red-500/20">
                    <Mail className="text-red-400" size={32} />
                  </div>
                </div>
                <h2 className="font-display text-2xl font-bold mb-2 text-foreground" style={{ color: "#ff6060" }}>
                  New Admin Email
                </h2>
                <p className="text-muted-foreground font-body text-xs mb-6">
                  Enter the new address to receive admin OTPs
                </p>

                <input
                  type="email"
                  value={newAdminEmailInput}
                  onChange={(e) => setNewAdminEmailInput(e.target.value)}
                  placeholder="new-admin@example.com"
                  className={`w-full bg-transparent border rounded-lg px-4 py-3 text-center text-foreground font-body text-sm outline-none transition-colors mb-2
                    ${emailChangeErrorMsg ? "border-destructive/50 focus:border-destructive" : "border-red-500/20 focus:border-red-500/40"}`}
                  disabled={otpSending}
                />

                <div className="min-h-[36px] mb-3 flex items-center justify-center">
                  <AnimatePresence>
                    {emailChangeErrorMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-destructive text-xs font-body flex items-center gap-1"
                      >
                        <AlertCircle size={13} />
                        {emailChangeErrorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <motion.button
                  onClick={sendNewEmailOtp}
                  disabled={otpSending || !newAdminEmailInput.trim()}
                  className="w-full py-3 rounded-lg font-body text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: "rgba(255,96,96,0.15)", border: "1px solid rgba(255,96,96,0.3)", color: "#ff8080" }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {otpSending ? <Loader2 size={16} className="animate-spin" /> : "Send Verification OTP"}
                </motion.button>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <motion.button
                    onClick={() => { setOtpSendErrorMsg(""); setEmailChangeErrorMsg(""); setStage("admin_vault"); setOtp(""); }}
                    className="text-xs text-muted-foreground hover:text-primary font-body transition-colors"
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── Stage: Update Email — New Email OTP ── */}
            {stage === "admin_change_email_new_otp" && (
              <motion.div
                key="admin_change_email_new_otp"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="text-center w-full max-w-sm px-4 sm:px-6"
              >
                {emailChangeSuccess ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                    <CheckCircle className="mx-auto text-green-400 mb-4" size={52} />
                    <h2 className="font-display text-2xl font-bold text-green-400 mb-2">Email Updated!</h2>
                    <p className="text-muted-foreground font-body text-sm">You will now use {newAdminEmailInput} for OTP verification.</p>
                  </motion.div>
                ) : (
                  <>
                    <div className="mb-6 flex justify-center">
                      <div className="bg-red-500/10 p-4 rounded-full border border-red-500/20">
                        <CheckCircle className="text-red-400" size={32} />
                      </div>
                    </div>
                    <h2 className="font-display text-2xl font-bold mb-2 text-foreground" style={{ color: "#ff6060" }}>
                      Verify New Email
                    </h2>
                    <p className="text-muted-foreground font-body text-xs mb-6">
                      OTP sent to <span className="text-primary">{maskedEmail}</span>
                    </p>

                    <OtpInput value={otp} onChange={setOtp} error={!!emailChangeErrorMsg} disabled={otpVerifying} />

                    <div className="min-h-[36px] my-3 flex items-center justify-center">
                      <AnimatePresence>
                        {emailChangeErrorMsg && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-destructive text-xs font-body flex items-center gap-1"
                          >
                            <AlertCircle size={13} />
                            {emailChangeErrorMsg}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <motion.button
                      onClick={saveNewAdminEmail}
                      disabled={otp.length < 6 || otpVerifying}
                      className="w-full py-3 rounded-lg font-body text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ background: "rgba(255,96,96,0.15)", border: "1px solid rgba(255,96,96,0.3)", color: "#ff8080" }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {otpVerifying ? <Loader2 size={16} className="animate-spin" /> : "Confirm New Email"}
                    </motion.button>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <motion.button
                        onClick={() => { setOtpSendErrorMsg(""); setEmailChangeErrorMsg(""); setStage("admin_vault"); setOtp(""); }}
                        className="text-xs text-muted-foreground hover:text-primary font-body transition-colors"
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ── Stage: Admin Email Prompt ── */}
            {stage === "admin_email_prompt" && (
              <motion.div
                key="admin_email_prompt"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="text-center w-full max-w-sm px-4 sm:px-6"
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="mb-6"
                >
                  <div className="relative mx-auto w-fit">
                    <ShieldCheck className="text-red-400" size={44} />
                    <motion.div
                      className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-400"
                      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  </div>
                </motion.div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold mb-2 text-foreground" style={{ color: "#ff6060" }}>
                  Verify Identity
                </h2>
                <p className="text-muted-foreground font-body text-sm mb-6 tracking-wide">
                  Enter admin email to receive OTP
                </p>

                <input
                  type="email"
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  placeholder="admin@example.com"
                  className={`w-full bg-transparent border rounded-lg px-4 py-3 text-center text-foreground font-body text-sm outline-none transition-colors mb-2
                    ${otpSendErrorMsg ? "border-destructive/50 focus:border-destructive shadow-[0_0_12px_rgba(255,0,0,0.1)]" : "border-red-500/20 focus:border-red-500/40"}`}
                  disabled={otpSending}
                />

                <div className="min-h-[36px] mb-3 flex items-center justify-center">
                  <AnimatePresence>
                    {otpSendErrorMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-destructive text-xs font-body flex items-center gap-1"
                      >
                        <AlertCircle size={13} />
                        {otpSendErrorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <motion.button
                  onClick={async () => {
                    if (!adminEmailInput.trim()) return;
                    const sent = await sendOtp("admin_verify", adminEmailInput);
                    if (sent) setStage("admin_otp");
                  }}
                  disabled={otpSending || !adminEmailInput.trim()}
                  className="w-full py-3 rounded-lg font-body text-sm font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: "rgba(255,96,96,0.15)", border: "1px solid rgba(255,96,96,0.3)", color: "#ff8080" }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {otpSending ? <Loader2 size={16} className="animate-spin" /> : "Send OTP"}
                </motion.button>

                <div className="mt-4">
                  <motion.button
                    onClick={() => { setStage("pin"); setAdminEmailInput(""); }}
                    className="text-xs text-muted-foreground hover:text-primary font-body transition-colors"
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── Stage: Admin OTP Verification ── */}
            {stage === "admin_otp" && (
              <motion.div
                key="admin_otp"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="text-center w-full max-w-sm px-4 sm:px-6"
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  className="mb-6"
                >
                  <div className="relative mx-auto w-fit">
                    <ShieldCheck className="text-red-400" size={44} />
                    <motion.div
                      className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-400"
                      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  </div>
                </motion.div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold mb-2 text-foreground" style={{ color: "#ff6060" }}>
                  Admin Verification
                </h2>
                <p className="text-muted-foreground font-body text-sm mb-2 tracking-wide">
                  Two-step verification required
                </p>
                <p className="text-muted-foreground/70 font-body text-xs mb-8">
                  OTP sent to <span className="text-primary">{maskedEmail}</span>
                </p>
                <OtpInput value={otp} onChange={setOtp} error={otpError} disabled={otpVerifying} />
                <div className="mt-6 min-h-[24px]">
                  {otpVerifying && <Loader2 className="mx-auto animate-spin" style={{ color: "#ff6060" }} size={22} />}
                  <AnimatePresence>
                    {otpError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-destructive text-xs font-body"
                      >
                        Invalid or expired OTP
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <motion.button
                  onClick={verifyAdminOtp}
                  disabled={otp.length < 6 || otpVerifying}
                  className="mt-4 w-full py-3 rounded-lg font-body text-sm font-semibold transition-all disabled:opacity-40"
                  style={{ background: "rgba(255,96,96,0.15)", border: "1px solid rgba(255,96,96,0.3)", color: "#ff8080" }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Verify & Enter Admin Panel
                </motion.button>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <motion.button
                    onClick={() => sendOtp("admin_verify", adminEmailInput)}
                    disabled={otpResendCooldown > 0 || otpSending}
                    className="text-xs text-muted-foreground hover:text-primary font-body transition-colors flex items-center gap-1 disabled:opacity-40"
                    whileTap={{ scale: 0.95 }}
                  >
                    <RefreshCw size={11} />
                    {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : "Resend OTP"}
                  </motion.button>
                  <span className="text-muted-foreground/30 text-xs">·</span>
                  <motion.button
                    onClick={() => { setStage("pin"); setOtp(""); setOtpError(false); }}
                    className="text-xs text-muted-foreground hover:text-primary font-body transition-colors"
                    whileTap={{ scale: 0.95 }}
                  >
                    Back
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── Stage: Forgot PIN — Enter OTP ── */}
            {stage === "forgot_otp" && (
              <motion.div
                key="forgot_otp"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="text-center w-full max-w-sm px-4 sm:px-6"
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="mb-6"
                >
                  <Mail className="mx-auto text-primary" size={44} />
                </motion.div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold mb-2 text-foreground glow-teal-text">
                  Check Your Email
                </h2>
                <p className="text-muted-foreground font-body text-sm mb-2">
                  PIN reset code sent to
                </p>
                <p className="text-primary font-body text-sm mb-8">{maskedEmail}</p>
                <OtpInput value={otp} onChange={setOtp} error={otpError} disabled={otpVerifying} />
                <div className="mt-6 min-h-[24px]">
                  {otpVerifying && <Loader2 className="mx-auto animate-spin text-primary" size={22} />}
                  <AnimatePresence>
                    {otpError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-destructive text-xs font-body"
                      >
                        Invalid or expired OTP
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <motion.button
                  onClick={verifyForgotOtp}
                  disabled={otp.length < 6 || otpVerifying}
                  className="mt-4 w-full py-3 rounded-lg porthole-heavy font-body text-sm text-primary hover:glow-teal transition-all disabled:opacity-40"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Verify OTP
                </motion.button>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <motion.button
                    onClick={() => sendOtp("pin_reset")}
                    disabled={otpResendCooldown > 0 || otpSending}
                    className="text-xs text-muted-foreground hover:text-primary font-body transition-colors flex items-center gap-1 disabled:opacity-40"
                    whileTap={{ scale: 0.95 }}
                  >
                    <RefreshCw size={11} />
                    {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : "Resend OTP"}
                  </motion.button>
                  <span className="text-muted-foreground/30 text-xs">·</span>
                  <motion.button
                    onClick={() => { setStage("pin"); setOtp(""); setOtpError(false); }}
                    className="text-xs text-muted-foreground hover:text-primary font-body transition-colors"
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── Stage: Forgot PIN — Set New PIN ── */}
            {stage === "forgot_newpin" && (
              <motion.div
                key="forgot_newpin"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="text-center w-full max-w-sm px-4 sm:px-6"
              >
                {pinSaved ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                    <CheckCircle className="mx-auto text-green-400 mb-4" size={52} />
                    <h2 className="font-display text-2xl font-bold text-green-400 mb-2">PIN Updated!</h2>
                    <p className="text-muted-foreground font-body text-sm">Your new PIN has been saved securely.</p>
                  </motion.div>
                ) : (
                  <>
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      className="mb-6"
                    >
                      <KeyRound className="mx-auto text-primary" size={44} />
                    </motion.div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold mb-2 text-foreground glow-teal-text">
                      Set New PIN
                    </h2>
                    <p className="text-muted-foreground font-body text-sm mb-8">
                      Choose a new 4-digit vault access code
                    </p>
                    <div className="space-y-6">
                      <div>
                        <p className="text-muted-foreground/70 font-body text-xs mb-3">New PIN</p>
                        <PinInput
                          value={newPin}
                          onChange={setNewPin}
                          error={pinMismatch}
                          disabled={savingPin}
                        />
                      </div>
                      <div>
                        <p className="text-muted-foreground/70 font-body text-xs mb-3">Confirm PIN</p>
                        <PinInput
                          value={newPinConfirm}
                          onChange={setNewPinConfirm}
                          error={pinMismatch}
                          disabled={savingPin}
                        />
                      </div>
                    </div>

                    <div className="min-h-[28px] mt-2 flex flex-col items-center justify-center">
                      <AnimatePresence>
                        {pinMismatch && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-destructive text-xs font-body"
                          >
                            PINs do not match
                          </motion.p>
                        )}
                        {pinSaveErrorMsg && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="bg-destructive/10 border border-destructive/20 text-destructive text-xs font-body rounded px-3 py-2 flex items-center gap-1.5"
                          >
                            <AlertCircle size={14} className="shrink-0" />
                            {pinSaveErrorMsg}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <motion.button
                      onClick={saveNewPin}
                      disabled={newPin.length < 4 || newPinConfirm.length < 4 || savingPin}
                      className="mt-6 w-full py-3 rounded-lg porthole-heavy font-body text-sm text-primary hover:glow-teal transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {savingPin ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Save New PIN
                    </motion.button>
                  </>
                )}
              </motion.div>
            )}

            {/* ── Stage: Vault (normal + admin) ── */}
            {(stage === "vault" || stage === "admin_vault") && (
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
                    <div className="flex items-center gap-2 flex-wrap">
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
                  <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                    {isAdmin && (
                      <>
                        <motion.button
                          onClick={() => setShowAdminPinPanel(!showAdminPinPanel)}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg porthole-heavy font-body text-sm transition-all touch-target"
                          style={{ color: "#ff8080", borderColor: "rgba(255,96,96,0.3)" }}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          title="Manage PINs"
                        >
                          <Settings size={15} />
                          <span className="hidden sm:inline">PIN Settings</span>
                        </motion.button>
                        <motion.button
                          onClick={() => { setShowAdminPinPanel(false); setOtpSendErrorMsg(""); setEmailChangeErrorMsg(""); startChangeAdminEmail(); }}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg porthole-heavy font-body text-sm transition-all touch-target"
                          style={{ color: "#ff8080", borderColor: "rgba(255,160,122,0.3)" }}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          title="Change Admin Email"
                        >
                          <Mail size={15} />
                          <span className="hidden sm:inline">Change Email</span>
                        </motion.button>
                      </>
                    )}
                    <motion.button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg porthole-heavy text-primary font-body text-sm hover:glow-teal transition-all disabled:opacity-50 touch-target w-full sm:w-auto"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {isUploading ? <Loader2 size={15} className="animate-spin" /> : <FolderUp size={15} />}
                      Upload Files
                    </motion.button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => { if (e.target.files) handleFiles(e.target.files); }}
                    className="hidden"
                  />
                </div>

                {/* Admin PIN Management Panel */}
                <AnimatePresence>
                  {isAdmin && showAdminPinPanel && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div
                        className="rounded-xl p-4 space-y-4"
                        style={{ background: "rgba(255,60,60,0.06)", border: "1px solid rgba(255,60,60,0.2)" }}
                      >
                        <div className="flex items-center gap-2">
                          <KeyRound size={14} style={{ color: "#ff8080" }} />
                          <h3 className="font-body text-sm font-semibold" style={{ color: "#ff8080" }}>
                            PIN Management
                          </h3>
                        </div>

                        {/* Target selector */}
                        <div className="flex gap-2">
                          {(["vault", "admin"] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => { setAdminChangePinTarget(t); setAdminNewPin(""); setAdminNewPinConfirm(""); setAdminPinChangeError(""); setAdminPinChanged(false); }}
                              className="px-3 py-1.5 rounded-lg font-body text-xs transition-all"
                              style={{
                                background: adminChangePinTarget === t ? "rgba(255,96,96,0.2)" : "transparent",
                                border: `1px solid ${adminChangePinTarget === t ? "rgba(255,96,96,0.4)" : "rgba(255,96,96,0.1)"}`,
                                color: adminChangePinTarget === t ? "#ff8080" : "#556677",
                              }}
                            >
                              Change {t === "vault" ? "User PIN" : "Admin PIN"}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground/70 font-body block mb-1.5">
                              New {adminChangePinTarget === "vault" ? "User" : "Admin"} PIN
                            </label>
                            <input
                              type="password"
                              inputMode="numeric"
                              maxLength={4}
                              value={adminNewPin}
                              onChange={(e) => { if (/^\d*$/.test(e.target.value)) setAdminNewPin(e.target.value.slice(0, 4)); }}
                              placeholder="••••"
                              className="w-full bg-transparent border border-red-500/20 rounded-lg px-3 py-2 text-foreground font-body text-sm outline-none focus:border-red-500/40 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground/70 font-body block mb-1.5">
                              Confirm PIN
                            </label>
                            <input
                              type="password"
                              inputMode="numeric"
                              maxLength={4}
                              value={adminNewPinConfirm}
                              onChange={(e) => { if (/^\d*$/.test(e.target.value)) setAdminNewPinConfirm(e.target.value.slice(0, 4)); }}
                              placeholder="••••"
                              className="w-full bg-transparent border border-red-500/20 rounded-lg px-3 py-2 text-foreground font-body text-sm outline-none focus:border-red-500/40 transition-colors"
                            />
                          </div>
                        </div>

                        {adminPinChangeError && (
                          <p className="text-destructive font-body text-xs flex items-center gap-1">
                            <AlertCircle size={11} /> {adminPinChangeError}
                          </p>
                        )}
                        {adminPinChanged && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-green-400 font-body text-xs flex items-center gap-1"
                          >
                            {/* Drag & Drop zone */}
                            <motion.div
                              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                              onDragLeave={() => setDragging(false)}
                              onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
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
                                        className={`porthole-heavy rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 group ${isAdmin ? "hover:border-red-500/20" : ""}`}
                                      >
                                        <FileText
                                          className={`shrink-0 ${isAdmin ? "text-red-400/70" : "text-primary"}`}
                                          size={20}
                                        />
                                        <div className="flex-1 min-w-0">
                                          {isRenaming ? (
                                            <div className="flex items-center gap-2">
                                              <input
                                                ref={renameInputRef}
                                                type="text"
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") handleRename(file.name);
                                                  if (e.key === "Escape") { setRenamingFile(null); setRenameValue(""); }
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
                                              >
                                                {savingRename ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                              </motion.button>
                                              <motion.button
                                                onClick={() => { setRenamingFile(null); setRenameValue(""); }}
                                                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                                whileTap={{ scale: 0.9 }}
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
                                            <motion.button
                                              onClick={() => handleDownload(file.name)}
                                              disabled={isDownloading}
                                              className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors touch-target disabled:opacity-40"
                                              whileHover={{ scale: 1.12 }}
                                              whileTap={{ scale: 0.9 }}
                                              aria-label="Download"
                                            >
                                              {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                            </motion.button>

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

                                            {isAdmin && (
                                              <motion.button
                                                onClick={() => handleDelete(file.name)}
                                                disabled={isDeleting}
                                                className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors touch-target disabled:opacity-40"
                                                whileHover={{ scale: 1.12 }}
                                                whileTap={{ scale: 0.9 }}
                                                aria-label="Delete"
                                              >
                                                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
