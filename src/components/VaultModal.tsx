import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Trash2, Download, FileText, X, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VaultFile {
  name: string;
  size: number;
  created_at: string;
  id: string;
}

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VaultModal = ({ isOpen, onClose }: VaultModalProps) => {
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pinInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const storedPin = useRef("");

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
        setTimeout(() => setPinError(false), 1500);
      } else {
        storedPin.current = enteredPin;
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
      if (error) {
        console.error("Error fetching vault files:", error);
        setFiles([]);
        return;
      }
      if (data?.files) {
        setFiles(data.files);
      } else {
        setFiles([]);
      }
    } catch (error) {
      console.error("Failed to fetch vault files:", error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (file.type !== "application/pdf") {
      console.error("Invalid file type. Only PDF files are accepted.");
      return;
    }
    
    // Validate file size (50MB max)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      console.error("File size exceeds 50MB limit.");
      return;
    }
    
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pin", storedPin.current);

      const { error } = await supabase.functions.invoke("vault-upload", {
        body: formData,
      });

      if (error) {
        console.error("Error uploading file:", error);
        return;
      }
      
      await fetchFiles(storedPin.current);
    } catch (error) {
      console.error("Failed to upload file:", error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (fileName: string) => {
    try {
      const { error } = await supabase.functions.invoke("vault-delete", {
        body: { pin: storedPin.current, fileName },
      });
      if (error) {
        console.error("Error deleting file:", error);
        return;
      }
      await fetchFiles(storedPin.current);
    } catch (error) {
      console.error("Failed to delete file:", error);
    }
  };

  const handleDownload = async (fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from("pdfs").download(fileName);
      
      if (error) {
        console.error("Error downloading file:", error);
        return;
      }
      
      if (!data) {
        console.error("No data returned for file:", fileName);
        return;
      }
      
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(/^\d+-/, "");
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download file:", error);
    }
  };

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = pin.split("");
    newPin[index] = value.slice(-1);
    const joined = newPin.join("").slice(0, 4);
    setPin(joined);

    if (value && index < 3) {
      pinInputsRef.current[index + 1]?.focus();
    }

    if (joined.length === 4) {
      verifyPin(joined);
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      pinInputsRef.current[index - 1]?.focus();
    }
  };

  const handleClose = () => {
    setPin("");
    setAuthenticated(false);
    setFiles([]);
    setPinError(false);
    storedPin.current = "";
    onClose();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          style={{ zIndex: 100, backgroundColor: "rgba(1, 10, 15, 0.97)" }}
        >
          {/* Close button */}
          <motion.button
            onClick={handleClose}
            className="absolute top-4 sm:top-6 right-4 sm:right-6 text-muted-foreground hover:text-primary transition-colors touch-target"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Close vault"
          >
            <X size={24} />
          </motion.button>

          {!authenticated ? (
            /* PIN Entry */
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="text-center w-full max-w-sm px-4 sm:px-6"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
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
                    className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-center text-xl sm:text-2xl md:text-3xl font-body rounded-lg porthole-heavy outline-none transition-all touch-target ${
                      pinError
                        ? "border-destructive shadow-[0_0_15px_rgba(255,0,0,0.3)]"
                        : "focus:border-primary focus:glow-teal"
                    } text-foreground bg-transparent`}
                    animate={pinError ? { x: [-8, 8, -8, 8, 0] } : {}}
                    transition={{ duration: 0.4 }}
                  />
                ))}
              </div>

              {verifying && (
                <Loader2 className="mx-auto animate-spin text-primary" size={24} />
              )}
              {pinError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-destructive text-xs sm:text-sm font-body"
                >
                  Access denied
                </motion.p>
              )}
            </motion.div>
          ) : (
            /* File Management */
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="w-full max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
                <div className="min-w-0">
                  <h2 className="font-display text-xl sm:text-2xl text-foreground glow-teal-text">
                    Abyss Vault
                  </h2>
                  <p className="text-muted-foreground text-xs sm:text-sm font-body">
                    {files.length} specimen{files.length !== 1 ? "s" : ""} archived
                  </p>
                </div>
                <motion.button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg porthole-heavy text-primary font-body text-sm hover:glow-teal transition-all disabled:opacity-50 touch-target w-full sm:w-auto"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {uploading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  Upload PDF
                </motion.button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleUpload}
                  className="hidden"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 sm:pr-2">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-primary" size={28} />
                  </div>
                ) : files.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12"
                  >
                    <FileText className="mx-auto mb-3 sm:mb-4 text-muted-foreground" size={36} />
                    <p className="text-muted-foreground font-body text-sm px-4">
                      The vault is empty. Upload your first specimen.
                    </p>
                  </motion.div>
                ) : (
                  files.map((file, index) => (
                    <motion.div
                      key={file.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="porthole-heavy rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 group"
                    >
                      <FileText className="text-primary shrink-0" size={20} />
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-body text-sm truncate">
                          {file.name.replace(/^\d+-/, "")}
                        </p>
                        <p className="text-muted-foreground font-body text-xs">
                          {formatSize(file.size)} · {formatDate(file.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2 justify-end sm:justify-start sm:gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <motion.button
                          onClick={() => handleDownload(file.name)}
                          className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors touch-target"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          aria-label="Download file"
                        >
                          <Download size={18} />
                        </motion.button>
                        <motion.button
                          onClick={() => handleDelete(file.name)}
                          className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors touch-target"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          aria-label="Delete file"
                        >
                          <Trash2 size={18} />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VaultModal;
