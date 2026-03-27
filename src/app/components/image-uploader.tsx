import { useRef, useState } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";

interface ImageUploaderProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

async function compressImage(file: File, maxSize = 800, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImageUploader({ value, onChange, disabled }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState(() =>
    value && !value.startsWith("data:") ? value : ""
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    setIsProcessing(true);
    try {
      const compressed = await compressImage(file);
      onChange(compressed);
      setUrlInput("");
    } catch {
      toast.error("ไม่สามารถประมวลผลรูปภาพได้");
    } finally {
      setIsProcessing(false);
      e.target.value = "";
    }
  };

  const handleUrlBlur = () => {
    const trimmed = urlInput.trim();
    onChange(trimmed);
  };

  const handleClear = () => {
    onChange("");
    setUrlInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const hasImage = !!value;

  return (
    <div className="space-y-3">
      {hasImage ? (
        <div className="relative w-full h-44 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          <img src={value} alt="preview" className="w-full h-full object-cover" />
          {!disabled && (
            <button
              type="button"
              className="absolute top-2 right-2 bg-white/90 rounded-full p-1.5 shadow-sm hover:bg-white transition-colors"
              onClick={handleClear}
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          className="w-full h-44 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors select-none"
          onClick={() => !disabled && fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && !disabled && fileInputRef.current?.click()}
        >
          <ImageIcon className="h-9 w-9 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">คลิกเพื่ออัปโหลดรูปภาพ</p>
          <p className="text-xs text-gray-400">JPG, PNG, WEBP — อัดขนาดอัตโนมัติ (สูงสุด 800px)</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isProcessing}
        onClick={() => fileInputRef.current?.click()}
        className="w-full"
      >
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        {isProcessing ? "กำลังประมวลผล..." : "อัปโหลดจากอุปกรณ์"}
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400">หรือวางลิงก์รูปภาพ</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <Input
        type="url"
        placeholder="https://example.com/image.jpg"
        value={urlInput}
        onChange={(e) => setUrlInput(e.target.value)}
        onBlur={handleUrlBlur}
        disabled={disabled}
      />
    </div>
  );
}
