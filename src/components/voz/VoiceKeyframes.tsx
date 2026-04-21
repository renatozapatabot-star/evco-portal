'use client'

/**
 * CSS keyframe animations used by the voice interface.
 * Rendered once in the page layout.
 */
export default function VoiceKeyframes() {
  return (
    <style>{`
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.15); }
      }
      @keyframes glow {
        0%, 100% { box-shadow: 0 0 20px rgba(192,197,206,0.3), 0 0 40px rgba(192,197,206,0.1); }
        50% { box-shadow: 0 0 40px rgba(192,197,206,0.6), 0 0 80px rgba(192,197,206,0.2); }
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes waveBar {
        0%, 100% { transform: scaleY(0.4); }
        50% { transform: scaleY(1); }
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes drivingPulse {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }
      @keyframes pulse-dot {
        0%, 100% { opacity: 0.4; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1.2); }
      }
    `}</style>
  )
}
