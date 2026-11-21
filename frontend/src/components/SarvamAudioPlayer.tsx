import { useState, useRef } from "react";
import { Volume2, VolumeX, LoaderCircle } from "lucide-react";
import { synthesizeSpeechAudio } from "../api";

interface SarvamAudioPlayerProps {
  text: string;
  defaultLang?: string;
  label?: string;
}

const LANGUAGES = [
  { code: "hi-IN", name: "Hindi" },
  { code: "ta-IN", name: "Tamil" },
  { code: "mr-IN", name: "Marathi" },
  { code: "en-IN", name: "English" }
];

export default function SarvamAudioPlayer({
  text,
  defaultLang = "hi-IN",
  label = "Listen to Diagnostic Briefing (Sarvam AI Bulbul TTS)"
}: SarvamAudioPlayerProps) {
  const [lang, setLang] = useState(defaultLang);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }

    if (audioUrl && audioRef.current) {
      audioRef.current.play();
      setPlaying(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Synthesize audio via backend Bulbul TTS endpoint
      const snippet = text.slice(0, 500);
      const res = await synthesizeSpeechAudio(snippet, lang);
      if (!res.audio_content) {
        throw new Error("No audio content returned from Sarvam API");
      }

      // Convert base64 to data URL or blob URL
      const byteCharacters = atob(res.audio_content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: res.content_type || "audio/wav" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      // Play audio
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => {
        setPlaying(false);
        setError("Playback failed");
      };
      await audio.play();
      setPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "TTS synthesis failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (newLang: string) => {
    setLang(newLang);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setAudioUrl(null);
    setPlaying(false);
  };

  return (
    <div className="sarvam-audio-player">
      <div className="audio-player-header">
        <span className="audio-label">{label}</span>
        <div className="audio-lang-selector">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              className={"lang-chip " + (lang === l.code ? "active" : "")}
              onClick={() => handleLanguageChange(l.code)}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      <div className="audio-player-controls">
        <button
          type="button"
          className={"audio-play-button " + (playing ? "playing" : "")}
          onClick={() => void handlePlay()}
          disabled={loading || !text.trim()}
          title={playing ? "Pause briefing" : "Play audio briefing"}
        >
          {loading ? (
            <LoaderCircle size={15} className="spin" />
          ) : playing ? (
            <VolumeX size={15} />
          ) : (
            <Volume2 size={15} />
          )}
          <span>{loading ? "Generating Audio…" : playing ? "Pause Audio" : "Play Voice Briefing"}</span>
        </button>

        {playing && (
          <div className="audio-wave-indicator" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      {error && <span className="audio-error">{error}</span>}
    </div>
  );
}

