'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, File, Image, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface UploaderProps {
  tenantId: string;
  isMockMode: boolean;
  onUploadSuccess: (url: string, fileName: string) => void;
  allowedTypes?: string; // e.g. "image/*,application/pdf"
}

interface LibraryFile {
  name: string;
  id: string;
  createdAt: string;
  sizeBytes: number;
  url: string;
}

export default function DragDropUploader({ tenantId, isMockMode, onUploadSuccess, allowedTypes }: UploaderProps) {
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [libraryFiles, setLibraryFiles] = useState<LibraryFile[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLibrary = async () => {
    setIsLoadingLibrary(true);
    try {
      const res = await fetch(`/api/media?tenantId=${encodeURIComponent(tenantId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.files) {
          setLibraryFiles(data.files);
        }
      }
    } catch (err) {
      console.error('Failed to fetch media library:', err);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, [tenantId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setStatus('idle');
    setIsUploading(true);
    setUploadProgress(10);

    try {
      if (isMockMode) {
        // Simulate upload progress
        const interval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 100) {
              clearInterval(interval);
              setIsUploading(false);
              setStatus('success');
              
              // Generate mock URL using object URL so it renders in the browser
              const mockUrl = URL.createObjectURL(selectedFile);
              onUploadSuccess(mockUrl, selectedFile.name);
              fetchLibrary();
              return 100;
            }
            return prev + 25;
          });
        }, 300);
      } else {
        // Perform a multipart fetch request to the POST /api/media endpoint
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('tenantId', tenantId);

        setUploadProgress(50);
        const res = await fetch('/api/media', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to upload file');
        }

        const data = await res.json();
        setUploadProgress(100);
        setIsUploading(false);
        setStatus('success');
        onUploadSuccess(data.url, selectedFile.name);
        
        // Refresh the file library list
        fetchLibrary();
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setIsUploading(false);
      setStatus('error');
      setErrorMsg(err.message || 'Failed to upload file');
    }
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={status === 'success' ? undefined : triggerFileInput}
        className={`relative w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
          isDragActive 
            ? 'border-emerald-400 bg-emerald-500/5' 
            : status === 'success'
              ? 'border-emerald-500/30 bg-zinc-900/40 cursor-default'
              : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/20 hover:bg-zinc-900/35'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={allowedTypes}
          onChange={handleChange}
          disabled={isUploading || status === 'success'}
        />

        {status === 'idle' && !isUploading && (
          <>
            <div className="w-12 h-12 rounded-xl bg-zinc-800/80 flex items-center justify-center mb-4 text-zinc-400 border border-zinc-700/50">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">Drag & Drop to upload</p>
            <p className="text-xs text-zinc-500 mb-2">Or click to browse from your device</p>
            <span className="text-[10px] text-zinc-600 bg-zinc-800/30 px-2 py-0.5 rounded-full border border-zinc-800">
              Max file size: 5MB for images, 100MB for docs
            </span>
          </>
        )}

        {isUploading && (
          <div className="w-full flex flex-col items-center py-2">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
            <p className="text-xs font-semibold text-white mb-2">Uploading: {file?.name}</p>
            <div className="w-full max-w-xs bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500 mt-1.5">{uploadProgress}% uploaded</span>
          </div>
        )}

        {status === 'success' && file && (
          <div className="w-full flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="w-6 h-6 animate-bounce" />
            </div>
            <p className="text-sm font-bold text-white mb-1">Upload Successful!</p>
            <div className="flex items-center space-x-1.5 bg-zinc-800/50 border border-zinc-800 px-3 py-1.5 rounded-lg max-w-xs mb-4">
              {file.type?.startsWith('image/') ? (
                <Image className="w-4 h-4 text-zinc-400 shrink-0" />
              ) : (
                <File className="w-4 h-4 text-zinc-400 shrink-0" />
              )}
              <span className="text-xs text-zinc-300 truncate font-medium">{file.name}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setStatus('idle');
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300 underline font-medium transition-colors"
            >
              Upload another file
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="w-full flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4 text-red-400 border border-red-500/20">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white mb-1">Upload Failed</p>
            <p className="text-xs text-red-400 mb-4 max-w-xs">{errorMsg}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setStatus('idle');
              }}
              className="text-xs text-zinc-400 hover:text-white bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Library Section */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-white mb-3">Select from library</h3>
        {isLoadingLibrary ? (
          <div className="flex items-center space-x-2 text-xs text-zinc-500 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Loading library files...</span>
          </div>
        ) : libraryFiles.length === 0 ? (
          <p className="text-xs text-zinc-500 italic py-4">No previously uploaded files found in library.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {libraryFiles.map((file) => {
              const isImage = file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              return (
                <div
                  key={file.id || file.name}
                  onClick={(e) => {
                    e.stopPropagation();
                    const fakeFile = {
                      name: file.name,
                      type: isImage ? 'image/png' : 'application/octet-stream',
                      size: file.sizeBytes,
                    } as any;
                    setFile(fakeFile);
                    setStatus('success');
                    onUploadSuccess(file.url, file.name);
                  }}
                  className="group relative flex flex-col items-center justify-center p-3 rounded-xl border border-zinc-800/80 hover:border-emerald-500/40 bg-zinc-900/40 hover:bg-zinc-900/70 transition-all duration-200 cursor-pointer text-center h-24 overflow-hidden"
                >
                  {isImage ? (
                    <div className="relative w-full h-12 mb-2 rounded bg-zinc-800 overflow-hidden flex items-center justify-center">
                      <img
                        src={file.url}
                        alt={file.name}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center mb-1 text-zinc-400 border border-zinc-700/30">
                      <File className="w-4 h-4" />
                    </div>
                  )}
                  <span className="text-[11px] text-zinc-300 font-medium truncate w-full px-1">
                    {file.name}
                  </span>
                  <span className="text-[9px] text-zinc-500">
                    {(file.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
