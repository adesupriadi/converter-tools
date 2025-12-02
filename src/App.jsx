import { useState, useRef, useEffect } from 'react';

// Pastikan index.html memuat script FFmpeg v0.10.1 di folder public

function App() {
  const [isReady, setIsReady] = useState(false);
  const [status, setStatus] = useState('Memuat Mesin...');
  const [progress, setProgress] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const ffmpegRef = useRef(null);

  useEffect(() => {
    initEngine();
  }, []);

  const initEngine = async () => {
    try {
      if (!window.FFmpeg) {
        setStatus("Error: Script FFmpeg tidak ditemukan.");
        setIsError(true);
        return;
      }
      
      const { createFFmpeg } = window.FFmpeg;
      
      // Load dari CDN agar aman di Netlify
      // Kita paksa path core ke versi 0.10.0 yang stabil
      const ffmpeg = createFFmpeg({ 
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js'
      }); 
      
      ffmpegRef.current = ffmpeg;
      await ffmpeg.load();
      
      // Mesin siap, langsung tampilkan UI Upload
      setIsReady(true);
      setStatus('WEBM2MP4 SIAP'); 

    } catch (err) {
      console.error(err);
      setStatus('Gagal Memuat Mesin. Cek Koneksi Internet.');
      setIsError(true);
    }
  };

  const handleManualUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Reset state jika sebelumnya sukses/error
      setIsSuccess(false); 
      setIsError(false);
      
      // Mulai proses
      processVideo(file, file.name.replace(/\.[^/.]+$/, "")); 
  };

  const processVideo = async (blob, filename) => {
    setIsConverting(true);
    setProgress(0);
    setStatus('Sedang Mengkonversi...');

    const ffmpeg = ffmpegRef.current;
    const { fetchFile } = window.FFmpeg;

    // Timer simulasi progress (karena v0.10.1 single thread memblokir update UI real-time)
    const timer = setInterval(() => {
        setProgress((old) => {
            if (old >= 95) return 95;
            return old + 5;
        });
    }, 500);

    try {
        // 1. Tulis File
        ffmpeg.FS('writeFile', 'input.webm', await fetchFile(blob));
        
        // 2. Jalankan Konversi (Rumus Stabilisasi)
        // -r 30: Paksa 30fps agar tidak patah-patah
        await ffmpeg.run('-i', 'input.webm', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-r', '30', '-pix_fmt', 'yuv420p', 'output.mp4');
        
        // 3. Baca Hasil
        const data = ffmpeg.FS('readFile', 'output.mp4');
        
        if (data.length === 0) throw new Error("File kosong");

        const mp4Url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

        // 4. Download
        const a = document.createElement('a');
        a.href = mp4Url;
        a.download = `${filename}.mp4`; // Nama file output bersih (tanpa -converted)
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // 5. Bersihkan Memori
        try {
            ffmpeg.FS('unlink', 'input.webm');
            ffmpeg.FS('unlink', 'output.mp4');
        } catch(e) {}

        clearInterval(timer);
        setIsConverting(false);
        setProgress(100);
        setIsSuccess(true);
        setStatus('SELESAI! Silakan Upload Lagi.');
        
        // Reset input file agar bisa upload file yang sama jika perlu
        const fileInput = document.getElementById('fileInput');
        if (fileInput) fileInput.value = "";

    } catch (err) {
        clearInterval(timer);
        console.error(err);
        setIsConverting(false);
        setIsError(true);
        setStatus('Gagal Konversi. Pastikan file valid.');
    }
  };

  return (
    <div style={styles.container}>
        <div style={styles.card}>
            
            {/* HEADER SIMPEL */}
            <div style={styles.header}>
                <div style={{fontSize: '48px', marginBottom:'10px'}}>
                    {isSuccess ? '🎉' : isError ? '❌' : isConverting ? '⚙️' : '🎥'}
                </div>
                <h1 style={{...styles.title, color: isError ? 'red' : '#333'}}>
                    {status}
                </h1>
            </div>

            {/* AREA PROGRESS BAR */}
            {isConverting && (
                <div style={styles.progressContainer}>
                    <div style={styles.progressBarTrack}>
                        <div style={{...styles.progressBarFill, width: `${progress}%`}}></div>
                    </div>
                    <p style={styles.progressText}>{progress}% Berjalan</p>
                </div>
            )}

            {/* TOMBOL UPLOAD BESAR (Hanya muncul jika Siap & Tidak sedang convert) */}
            {isReady && !isConverting && (
                <div style={{marginTop: '20px'}}>
                    <label style={styles.uploadButton}>
                        <span style={{fontSize: '24px', display:'block', marginBottom:'8px'}}>📂</span>
                        UPLOAD WEBM DI SINI
                        <input 
                            id="fileInput"
                            type="file" 
                            accept="video/webm, video/mkv"
                            onChange={handleManualUpload}
                            style={{display:'none'}}
                        />
                    </label>
                    <p style={styles.hint}>Otomatis download MP4 setelah selesai</p>
                </div>
            )}

            {/* Loading Awal */}
            {!isReady && !isError && (
                <div style={{marginTop: '30px', color: '#888'}}>
                    Sedang menyiapkan mesin...
                </div>
            )}
            
            {/* Tombol Reset Error */}
            {isError && (
                <button 
                    onClick={() => window.location.reload()}
                    style={{marginTop:'20px', padding:'10px 20px', cursor:'pointer'}}
                >
                    Refresh Halaman
                </button>
            )}

        </div>
    </div>
  );
}

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f4f4f9',
        fontFamily: "'Segoe UI', sans-serif",
        padding: '20px',
    },
    card: {
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '450px',
        textAlign: 'center',
    },
    header: {
        marginBottom: '20px',
    },
    title: {
        margin: '0',
        fontSize: '24px',
        fontWeight: '800',
        color: '#222',
        textTransform: 'uppercase',
        letterSpacing: '1px'
    },
    uploadButton: {
        display: 'block',
        backgroundColor: '#d32f2f', // Merah Shortnews
        color: 'white',
        padding: '40px 20px',
        borderRadius: '16px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '18px',
        boxShadow: '0 8px 20px rgba(211, 47, 47, 0.3)',
        transition: 'transform 0.1s, background 0.2s',
        border: '2px dashed rgba(255,255,255,0.3)',
    },
    hint: {
        marginTop: '15px',
        fontSize: '12px',
        color: '#999',
    },
    progressContainer: {
        margin: '30px 0',
    },
    progressBarTrack: {
        height: '12px',
        backgroundColor: '#eee',
        borderRadius: '6px',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#0070f3',
        transition: 'width 0.3s',
    },
    progressText: {
        marginTop: '8px',
        fontSize: '14px',
        color: '#666',
        fontWeight: 'bold'
    }
};

export default App;
