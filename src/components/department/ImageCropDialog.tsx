import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageFile: File | null;
  onCropComplete: (croppedBlob: Blob) => void;
}

const CROP_SIZE = 256;

export default function ImageCropDialog({
  open,
  onClose,
  imageFile,
  onCropComplete
}: ImageCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Load image when file changes
  useEffect(() => {
    if (!imageFile) return;
    
    const img = new Image();
    img.onload = () => {
      setImage(img);
      // Calculate initial scale to fit image in crop area
      const minScale = CROP_SIZE / Math.min(img.width, img.height);
      setScale(Math.max(minScale, 1));
      setPosition({ x: 0, y: 0 });
    };
    img.src = URL.createObjectURL(imageFile);
    
    return () => {
      if (img.src) URL.revokeObjectURL(img.src);
    };
  }, [imageFile]);

  // Draw image on canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !image) return;

    const containerSize = 300;
    canvas.width = containerSize;
    canvas.height = containerSize;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, containerSize, containerSize);

    // Calculate dimensions
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;
    
    // Center the image with position offset
    const x = (containerSize - scaledWidth) / 2 + position.x;
    const y = (containerSize - scaledHeight) / 2 + position.y;

    // Draw the image
    ctx.drawImage(image, x, y, scaledWidth, scaledHeight);

    // Draw crop overlay (darken outside areas)
    const cropOffset = (containerSize - CROP_SIZE) / 2;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    // Top
    ctx.fillRect(0, 0, containerSize, cropOffset);
    // Bottom
    ctx.fillRect(0, cropOffset + CROP_SIZE, containerSize, cropOffset);
    // Left
    ctx.fillRect(0, cropOffset, cropOffset, CROP_SIZE);
    // Right
    ctx.fillRect(cropOffset + CROP_SIZE, cropOffset, cropOffset, CROP_SIZE);

    // Draw crop border
    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropOffset, cropOffset, CROP_SIZE, CROP_SIZE);
  }, [image, scale, position]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  const handleReset = () => {
    if (!image) return;
    const minScale = CROP_SIZE / Math.min(image.width, image.height);
    setScale(Math.max(minScale, 1));
    setPosition({ x: 0, y: 0 });
  };

  const handleCrop = () => {
    if (!image) return;

    const containerSize = 300;
    const cropOffset = (containerSize - CROP_SIZE) / 2;
    
    // Calculate the source coordinates
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;
    const imgX = (containerSize - scaledWidth) / 2 + position.x;
    const imgY = (containerSize - scaledHeight) / 2 + position.y;

    // Source coordinates in original image
    const srcX = (cropOffset - imgX) / scale;
    const srcY = (cropOffset - imgY) / scale;
    const srcSize = CROP_SIZE / scale;

    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = CROP_SIZE;
    outputCanvas.height = CROP_SIZE;
    const outputCtx = outputCanvas.getContext('2d');
    
    if (!outputCtx) return;

    outputCtx.drawImage(
      image,
      srcX, srcY, srcSize, srcSize,
      0, 0, CROP_SIZE, CROP_SIZE
    );

    outputCanvas.toBlob(
      (blob) => {
        if (blob) {
          onCropComplete(blob);
        }
      },
      'image/jpeg',
      0.9
    );
  };

  const minScale = image ? CROP_SIZE / Math.min(image.width, image.height) : 0.5;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar imagem</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4">
          <div 
            className="relative rounded-lg overflow-hidden cursor-move border border-border"
            style={{ width: 300, height: 300 }}
          >
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
              className="touch-none"
            />
          </div>

          <div className="flex items-center gap-3 w-full px-2">
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[scale]}
              onValueChange={([value]) => setScale(value)}
              min={minScale}
              max={3}
              step={0.01}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
            <Button variant="ghost" size="icon" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Arraste para posicionar e use o zoom para ajustar
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCrop}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
