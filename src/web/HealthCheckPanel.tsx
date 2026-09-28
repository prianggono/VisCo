import { useEffect, useState } from "react";
import { BrowserAudioDeviceProvider } from "../engine/audio-device.js";
import { checkAudioDevices, checkVisCoVirtualAudio } from "../engine/audio-health-check.js";
import { getHealthStatus, type HealthCheckItem, type HealthStatus } from "../engine/health-check.js";
import { DEFAULT_VIRTUAL_AUDIO_CONFIG } from "../domain/virtual-audio.js";
import { UnavailableNativeVirtualAudioBridge } from "../engine/virtual-audio-native.js";
import { checkVisCoVirtualVideo } from "../engine/video-health-check.js";
import { UnavailableNativeVirtualVideoBridge } from "../engine/virtual-video-native.js";

const endpointMap = new Map(
  DEFAULT_VIRTUAL_AUDIO_CONFIG.endpoints.map((endpoint) => [endpoint.channel, endpoint])
);

const browserAudioProvider = new BrowserAudioDeviceProvider();
const nativeBridge = new UnavailableNativeVirtualAudioBridge(endpointMap);
const virtualVideoBridge = new UnavailableNativeVirtualVideoBridge();

export interface HealthCheckPanelProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function HealthCheckPanel({ open, onClose }: HealthCheckPanelProps) {
  const [items, setItems] = useState<readonly HealthCheckItem[]>([]);
  const [checking, setChecking] = useState(false);

  const refresh = async () => {
    setChecking(true);
    try {
      const [audio, virtual, video] = await Promise.all([
        checkAudioDevices(browserAudioProvider),
        checkVisCoVirtualAudio(nativeBridge),
        checkVisCoVirtualVideo(virtualVideoBridge)
      ]);
      setItems([...audio, ...virtual, video]);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  if (!open) return null;

  const status = getHealthStatus({ generatedAt: new Date().toISOString(), items });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="health-modal" onClick={(event) => event.stopPropagation()}>
        <header className="health-head">
          <div>
            <strong>HEALTH CHECK</strong>
            <span>Audio, virtual audio, virtual video and device availability</span>
          </div>
          <div className="health-actions">
            <span className={`health-summary ${status}`}>{checking ? "CHECKING…" : status.toUpperCase()}</span>
            <button onClick={() => void refresh()} disabled={checking}>REFRESH</button>
            <button onClick={onClose}>×</button>
          </div>
        </header>

        <div className="health-list">
          {items.length === 0 && <div className="health-empty">Checking system devices…</div>}
          {items.map((item) => (
            <article className="health-item" key={item.id}>
              <span className={`health-dot ${item.status}`} />
              <div>
                <strong>{item.label}</strong>
                <span>{item.message}</span>
              </div>
              <b>{formatStatus(item.status)}</b>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatStatus(status: HealthStatus): string {
  if (status === "ok") return "OK";
  if (status === "warning") return "WARNING";
  return "ERROR";
}
