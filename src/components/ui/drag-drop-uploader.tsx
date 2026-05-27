'use client';

import React, { useState, useRef } from 'react';
import { Upload, File, Image, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UploaderProps {
  tenantId: string;
  isMockMode: boolean;
  onUploadSuccess: (url: string, fileName: string) => void;
  allowedTypes?: string; // e.g. "image/*,application/pdf"
}

export default function DragDropUploader({ tenantId, isMockMode, onUploadSuccess, allowedTypes }: UploaderProps) {
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
              return 100;
            }
            return prev + 25;
          });
        }, 300);
      } else {
        // Real Supabase storage upload
        const fileExtension = selectedFile.name.split('.').pop() || 'bin';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
        const filePath = `${tenantId}/${fileName}`;

        setUploadProgress(30);
        const { data, error } = await supabase.storage
          .from('media')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) throw error;
        setUploadProgress(80);

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        const publicUrl = publicUrlData.publicUrl;
        setUploadProgress(100);
        setIsUploading(false);
        setStatus('success');
        onUploadSuccess(publicUrl, selectedFile.name);
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
              {file.type.startsWith('image/') ? (
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
    </div>
  );
}
