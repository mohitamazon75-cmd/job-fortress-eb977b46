import { motion } from 'framer-motion';
import { useState } from 'react';
import { Linkedin, FileText, ArrowRight, Upload, Link2, Sparkles, Shield, Lock, ChevronRight, Zap } from 'lucide-react';

interface InputMethodStepProps {
  onSubmitLinkedin: (url: string) => void;
  onSubmitResume: (file: File) => void;
  onSkip: () => void;
}

export default function InputMethodStep({ onSubmitLinkedin, onSubmitResume, onSkip }: InputMethodStepProps) {
  const [method, setMethod] = useState<'linkedin' | 'resume' | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [linkedinError, setLinkedinError] = useState('');

  const [fileError, setFileError] = useState('');

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_MIME_TYPES = ['application/pdf'];

  const validateAndSubmit = (file: File) => {
    setFileError('');
    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
      setFileError('Only PDF files are accepted.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
      return;
    }
    setFileName(file.name);
    onSubmitResume(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSubmit(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSubmit(file);
  };

  const isValidLinkedinUrl = (input: string): boolean => {
    try {
      const url = new URL(input);
      const validHost = url.hostname === 'linkedin.com' || url.hostname === 'www.linkedin.com' || url.hostname.endsWith('.linkedin.com');
      return validHost && /\/in\/.+/.test(url.pathname);
    } catch {
      return false;
    }
  };

  const handleLinkedinSubmit = () => {
    if (isValidLinkedinUrl(linkedinUrl)) {
      onSubmitLinkedin(linkedinUrl);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 dot-pattern opacity-40" />
      <div className="absolute top-[-200px] right-[-200px] w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[120px] pointer-events-none" style={{ background: 'hsl(var(--primary))' }} />
      <div className="absolute bottom-[-150px] left-[-150px] w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[80px] pointer-events-none" style={{ background: 'hsl(var(--prophet-cyan))' }} />

      {/* Nav */}
      <div className="relative z-10 px-6 md:px-12 py-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xs" style={{ background: 'var(--gradient-primary)' }}>
            JB
          </div>
          <span className="text-lg font-black tracking-tight text-foreground">JOB BACHAO</span>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-xl"
        >
          {/* Header */}
          <div className="text-center mb-6 sm:mb-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-sm font-semibold text-primary mb-6"
            >
              <Zap className="w-4 h-4" />
              Hyper-personalized analysis
            </motion.div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground mb-2 sm:mb-3 tracking-tight">
              Add your career data
            </h2>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              LinkedIn or your resume gives us your exact skills, role, and seniority — unlocking{' '}
              <span className="text-foreground font-semibold">10× deeper, more accurate analysis</span>.
            </p>
          </div>

          {/* Method selector */}
          {!method && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6"
            >
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMethod('linkedin')}
                className="group relative p-5 sm:p-8 rounded-2xl border-2 border-border bg-card hover:border-primary/50 transition-all duration-300 text-center overflow-hidden"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'var(--gradient-oracle)' }} />
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.08)' }}>
                    <Linkedin className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-1">LinkedIn URL</h3>
                  <p className="text-sm text-muted-foreground">Paste your profile link</p>
                  <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-primary bg-primary/8 px-3 py-1 rounded-full">
                    <Zap className="w-3 h-3" /> Recommended
                  </span>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMethod('resume')}
                className="group relative p-5 sm:p-8 rounded-2xl border-2 border-border bg-card hover:border-prophet-cyan/50 transition-all duration-300 text-center overflow-hidden"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'hsl(var(--prophet-cyan) / 0.04)' }} />
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'hsl(var(--prophet-cyan) / 0.08)' }}>
                    <FileText className="w-8 h-8 text-prophet-cyan" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-1">Upload Resume</h3>
                  <p className="text-sm text-muted-foreground">PDF only (max 5MB)</p>
                  <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-prophet-cyan bg-prophet-cyan/8 px-3 py-1 rounded-full">
                    <Sparkles className="w-3 h-3" /> AI-Powered Extraction
                  </span>
                </div>
              </motion.button>
            </motion.div>
          )}

          {/* Skip option — shown only on method selector */}
          {!method && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center mb-4"
            >
              <button
                onClick={onSkip}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-3 rounded-lg hover:bg-muted"
              >
                Skip — I'll enter my details manually
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {/* LinkedIn input */}
          {method === 'linkedin' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Link2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <input
                  type="url"
                  value={linkedinUrl}
                 onChange={(e) => {
                   const val = e.target.value;
                   setLinkedinUrl(val);
                   if (val && !isValidLinkedinUrl(val)) {
                     setLinkedinError('Please enter a valid LinkedIn profile URL (linkedin.com/in/...)');
                   } else {
                     setLinkedinError('');
                   }
                 }}
                  placeholder="Paste your LinkedIn URL — we read it once and don't store your password"
                  className="w-full pl-12 pr-4 py-5 rounded-2xl border-2 border-border bg-card text-foreground text-lg placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  autoFocus
                />
              </div>
              {linkedinError && linkedinUrl && (
                <p className="text-sm text-destructive font-medium mt-2 px-1">{linkedinError}</p>
              )}
              <motion.button
                whileHover={isValidLinkedinUrl(linkedinUrl) ? { scale: 1.01 } : {}}
                whileTap={isValidLinkedinUrl(linkedinUrl) ? { scale: 0.99 } : {}}
                onClick={handleLinkedinSubmit}
                disabled={!isValidLinkedinUrl(linkedinUrl)}
                className="w-full mt-4 py-4 rounded-2xl text-primary-foreground font-bold text-lg flex items-center justify-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--gradient-primary)', boxShadow: isValidLinkedinUrl(linkedinUrl) ? 'var(--shadow-primary)' : 'none' }}
              >
                Analyze My Profile
                <ArrowRight className="w-5 h-5" />
              </motion.button>
              <button onClick={() => setMethod(null)} className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1">
                ← Choose different method
              </button>
            </motion.div>
          )}

          {/* Resume upload */}
          {method === 'resume' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-12 text-center transition-all cursor-pointer ${
                  dragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border bg-card hover:border-primary/30'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className={`w-10 h-10 mx-auto mb-4 transition-colors ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-foreground font-semibold text-lg mb-1">
                  {fileName || 'Upload your resume (PDF, Word — stays private)'}
                </p>
                <p className="text-sm text-muted-foreground">or click to browse • Max 5MB</p>
                {fileError && (
                  <p className="text-sm text-destructive font-medium mt-2">{fileError}</p>
                )}
              </div>
              <button onClick={() => setMethod(null)} className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
                ← Choose different method
              </button>
            </motion.div>
          )}


          {/* Trust signals + Consent */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-10 space-y-3"
          >
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                256-bit encrypted
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Used only for analysis
              </span>
            </div>
            <p className="text-center text-[10px] text-muted-foreground leading-relaxed max-w-sm mx-auto">
              By proceeding, you agree to our{' '}
              <a href="/terms" target="_blank" className="underline underline-offset-2 text-foreground/70 hover:text-foreground">Terms of Service</a> &{' '}
              <a href="/privacy" target="_blank" className="underline underline-offset-2 text-foreground/70 hover:text-foreground">Privacy Policy</a>.
              Your data is retained for 90 days then auto-deleted.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
