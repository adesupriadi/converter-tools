import { useState, useRef, useEffect } from 'react';

// PENTING: Pastikan file 'index.html' kamu memuat script FFmpeg v0.9.8
// dan memiliki script Polyfill SharedArrayBuffer.

function App() {
  const [statusTitle, setStatusTitle] = useState('Menunggu Koneksi...');
  const [statusDesc, setStatusDesc] = useState('Siap menerima video dari Shortnews.');
  const [progress, setProgress] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const ffmpegRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    initEngine();
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const initEngine = async () => {
    try {
      if (!window.FFmpeg) {
        setStatusTitle("Gagal Memuat Sistem");
        setStatusDesc("Script FFmpeg hilang. Cek index.html");
        setIsError(true);
        return;
      }

      setStatusTitle('Memanaskan Mesin (v0.10.0)...');
      setStatusDesc('Sedang menyiapkan mesin yang paling kompatibel.');
      
      const { createFFmpeg } = window.FFmpeg;
      
      // --- KUNCI SUKSES: VERSI 0.10.0 (MATCHING) ---
      const ffmpeg = createFFmpeg({ 
        log: true,
        // Core Path WAJIB v0.10.0 juga
        corePath: 'https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js'
      }); 
      // ---------------------------------------------
      
      ffmpegRef.current = ffmpeg;
      await ffmpeg.load();
      
      setIsReady(true);
      setStatusTitle('WEBM2MP4 SIAP'); 
      setStatusDesc('Silakan upload video Anda.');

      if (window.opener) {
        try { window.opener.postMessage('CONVERTER_READY', '*'); } catch (e) {}
      }
      window.addEventListener('message', handleIncomingFile);

      // Timeout 10 detik
      timeoutRef.current = setTimeout(() => {
          setStatusTitle('⚠️ KONEKSI GAGAL');
          setStatusDesc('Waktu habis. Silakan upload manual di bawah.');
          setIsError(true);
      }, 10000);

    } catch (err) {
      console.error(err);
      setStatusTitle('Gagal Inisialisasi');
      // Tampilkan pesan error asli agar kita tahu
      setStatusDesc('Error: ' + (err.message || "Crash Memory"));
      setIsError(true);
    }
  };

  const setIsReadyState = () => {
      setStatusTitle('WEBM2MP4 SIAP'); 
      setStatusDesc('Silakan upload video Anda (Otomatis/Manual).');

      // Kabari tab Shortnews (Jika dibuka via popup)
      if (window.opener) {
        try { window.opener.postMessage('CONVERTER_READY', '*'); } catch (e) {}
      }
      
      // Pasang telinga untuk file otomatis
      window.addEventListener('message', handleIncomingFile);

      // Timer Timeout (Jika file tidak masuk otomatis dalam 10 detik)
      timeoutRef.current = setTimeout(() => {
          setStatusTitle('⚠️ KONEKSI GAGAL');
          setStatusDesc('Waktu habis. Silakan upload manual di bawah.');
          setIsError(true);
      }, 10000);
  };

  const handleIncomingFile = async (event) => {
    if (event.data && event.data.type === 'VIDEO_DATA') {
        clearTimeout(timeoutRef.current);
        const { blob, filename } = event.data;
        processVideo(blob, filename);
    }
  };

  const handleManualUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Reset state sebelum mulai
      clearTimeout(timeoutRef.current);
      setIsSuccess(false); 
      setIsError(false);
      
      processVideo(file, file.name.replace(/\.[^/.]+$/, "")); 
  };

  const processVideo = async (blob, filename) => {
    setIsConverting(true);
    setProgress(0);
    setStatusTitle('Sedang Mengkonversi...');
    setStatusDesc('Mohon tunggu, sedang menstabilkan video...');

    const ffmpeg = ffmpegRef.current;
    const { fetchFile } = window.FFmpeg;

    // Simulasi progress bar (karena v0.9.8 single thread memblokir update UI real-time)
    const timer = setInterval(() => {
        setProgress((old) => (old >= 95 ? 95 : old + 5));
    }, 500);

    try {
        // A. Tulis File ke Memori Virtual
        ffmpeg.FS('writeFile', 'input.webm', await fetchFile(blob));
        
        // B. Jalankan Konversi (FFmpeg v0.9.8 Syntax)
        // Parameter lengkap untuk hasil terbaik & kompatibel di HP
        await ffmpeg.run(
            '-i', 'input.webm', 
            '-r', '30',             // FPS Stabil 30
            '-c:v', 'libx264',      // Codec MP4
            '-preset', 'ultrafast', // Cepat
            '-crf', '28',           // Kompresi
            '-pix_fmt', 'yuv420p',  // Format warna wajib untuk HP
            '-movflags', '+faststart', 
            'output.mp4'
        );
        
        // C. Baca Hasil
        const data = ffmpeg.FS('readFile', 'output.mp4');
        
        if (data.length === 0) throw new Error("File output kosong.");

        const mp4Url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

        // D. Download
        triggerDownload(mp4Url, `${filename}.mp4`);

        // E. Bersihkan Memori
        try {
            ffmpeg.FS('unlink', 'input.webm');
            ffmpeg.FS('unlink', 'output.mp4');
        } catch(e) {}

        clearInterval(timer);
        setIsConverting(false);
        setProgress(100);
        setIsSuccess(true);
        setStatusTitle('Selesai!');
        
        // F. Auto Close Logic
        setStatusDesc('Tab ini akan tertutup otomatis dalam 3 detik...');
        setTimeout(() => {
            try { if (window.opener && !window.opener.closed) window.opener.focus(); } catch (e) {}
            window.close();
        }, 3000);

    } catch (err) {
        clearInterval(timer);
        console.error(err);
        setIsConverting(false);
        setIsError(true);
        setStatusTitle('Gagal Konversi');
        setStatusDesc('Error: ' + (err.message || "Terjadi kesalahan teknis"));
    }
  };

  const triggerDownload = (url, name) => {
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const backToShortnews = () => {
      try {
          if (window.opener && !window.opener.closed) window.opener.focus();
          else alert("Silakan klik Tab Shortnews secara manual.");
      } catch (e) { alert("Silakan klik Tab Shortnews secara manual."); }
  };

  return (
    <div style={styles.container}>
        <div style={styles.card}>
            <div style={styles.iconWrapper}>
                {isSuccess ? '🎉' : isError ? '❌' : isConverting ? '⚙️' : '🎬'}
            </div>
            <h1 style={{...styles.title, color: isError ? '#d32f2f' : isSuccess ? '#2e7d32' : '#333'}}>
                {statusTitle}
            </h1>
            <p style={styles.description}>
                {isSuccess ? (
                    <span>
                        File MP4 berhasil diunduh. <br/>
                        <span onClick={backToShortnews} style={styles.blinkingLink} className="blink-anim">Kembali ke Shortnews</span>
                    </span>
                ) : ( statusDesc )}
            </p>

            {isConverting && (
                <div style={styles.progressContainer}>
                    <div style={styles.progressBarTrack}>
                        <div style={{...styles.progressBarFill, width: `${progress}%`}}></div>
                    </div>
                    <p style={styles.progressText}>{progress}% Berjalan</p>
                </div>
            )}

            {(!isConverting && !isSuccess) && (
                <div style={styles.uploadBox}>
                    <div style={styles.warningBox}>
                        <p style={{fontWeight: 'bold', color: '#d32f2f', marginBottom: '5px'}}>⚠️ FILE TIDAK MASUK?</p>
                        <p style={{fontSize: '13px', color: '#555', lineHeight: '1.4'}}>
                            Silakan upload file WebM manual di bawah ini.
                        </p>
                    </div>
                    <div style={styles.arrowAnim}>⬇️</div>
                    <label style={styles.uploadButton}>
                        📁 Upload File WebM
                        <input id="fileInput" type="file" accept="video/webm, video/mkv" onChange={handleManualUpload} style={{display:'none'}} />
                    </label>
                </div>
            )}

            {isSuccess && (
                <button onClick={() => { setIsSuccess(false); setStatusTitle('Siap'); setProgress(0); setIsError(false); }} style={styles.resetButton}>
                    🔄 Convert Lagi
                </button>
            )}
        </div>
        <style>{`@keyframes bounceArrow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(10px); } } @keyframes blinkText { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } } .blink-anim { animation: blinkText 1.5s infinite ease-in-out; }`}</style>
    </div>
  );
}

const styles = {
    container: { minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5', fontFamily: "sans-serif", padding: '20px' },
    card: { backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', padding: '40px', width: '100%', maxWidth: '480px', textAlign: 'center' },
    iconWrapper: { fontSize: '48px', marginBottom: '20px' },
    title: { margin: '0 0 10px 0', fontSize: '24px', fontWeight: '700' },
    description: { margin: '0 0 30px 0', color: '#666', fontSize: '15px', lineHeight: '1.5' },
    progressContainer: { margin: '30px 0' },
    progressBarTrack: { height: '12px', backgroundColor: '#e9ecef', borderRadius: '6px', overflow: 'hidden' },
    progressBarFill: { height: '100%', background: 'linear-gradient(90deg, #00C9FF 0%, #92FE9D 100%)', borderRadius: '6px', transition: 'width 0.3s ease-in-out' },
    progressText: { marginTop: '10px', fontSize: '14px', fontWeight: '600', color: '#555' },
    uploadBox: { marginTop: '20px', borderTop: '2px solid #f0f0f0', paddingTop: '20px' },
    warningBox: { backgroundColor: '#fff5f5', border: '1px solid #ffcdd2', borderRadius: '8px', padding: '15px', marginBottom: '15px', textAlign: 'left' },
    arrowAnim: { fontSize: '32px', color: 'red', margin: '10px 0', animation: 'bounceArrow 1.5s infinite' },
    uploadButton: { display: 'block', width: '100%', backgroundColor: '#d32f2f', color: 'white', padding: '15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', boxShadow: '0 4px 6px rgba(211,47,47,0.3)', transition: 'transform 0.1s' },
    resetButton: { marginTop: '20px', padding: '12px 24px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
    blinkingLink: { color: '#007bff', fontWeight: 'bold', textDecoration: 'underline', cursor: 'pointer', display: 'inline-block', marginTop: '8px', padding: '5px 10px', borderRadius: '4px', backgroundColor: '#e3f2fd' },
    inlineLink: { color: '#007bff', fontWeight: 'bold', textDecoration: 'underline', cursor: 'pointer' }
};

export default App;
