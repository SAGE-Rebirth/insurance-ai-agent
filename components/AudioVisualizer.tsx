import React, { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
  userAnalyzerRef: React.MutableRefObject<AnalyserNode | null>;
  agentAnalyzerRef: React.MutableRefObject<AnalyserNode | null>;
  isActive: boolean;
  isConnecting: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  userAnalyzerRef, 
  agentAnalyzerRef, 
  isActive, 
  isConnecting 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays for crisp lines
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;

    let animationId: number;
    const dataArray = new Uint8Array(32); 
    
    let tick = 0;

    const drawWave = (
      color: string, 
      volume: number, 
      frequency: number, 
      offset: number, 
      amplitudeMultiplier: number
    ) => {
       ctx.beginPath();
       ctx.moveTo(0, height / 2);
       
       for (let x = 0; x < width; x++) {
         const baseAmp = isActive ? (volume * amplitudeMultiplier) : 5; 
         const y = height / 2 + Math.sin(x * frequency + tick * 0.05 + offset) * baseAmp;
         ctx.lineTo(x, y);
       }
       
       ctx.strokeStyle = color;
       ctx.lineWidth = 2;
       ctx.lineCap = 'round';
       ctx.lineJoin = 'round';
       ctx.stroke();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      let agentVol = 0;
      let userVol = 0;

      if (agentAnalyzerRef.current && isActive) {
        agentAnalyzerRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        agentVol = avg;
      }

      if (userAnalyzerRef.current && isActive) {
        userAnalyzerRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        userVol = avg;
      }

      // If connecting, simulate a "thinking" pulse
      if (isConnecting) {
         const pulse = (Math.sin(tick * 0.1) + 1) * 10;
         agentVol = 10 + pulse; 
      }

      // Draw Agent Waves (Blue/Violet) - Main focus
      drawWave('rgba(59, 130, 246, 0.3)', agentVol, 0.01, 0, 0.8);
      drawWave('rgba(139, 92, 246, 0.5)', agentVol, 0.02, 2, 0.6);
      drawWave('rgba(59, 130, 246, 1.0)', agentVol, 0.015, 4, 1.0);

      // Draw User Waves (Green/Teal) - Reacts to user input
      if (userVol > 5) {
        drawWave('rgba(52, 211, 153, 0.4)', userVol, 0.02, 1, 0.7); 
        drawWave('rgba(45, 212, 191, 1.0)', userVol, 0.025, 3, 0.9);
      }

      tick++;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [isActive, isConnecting, userAnalyzerRef, agentAnalyzerRef]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full absolute inset-0 rounded-xl"
      style={{ width: '100%', height: '100%' }}
    />
  );
};